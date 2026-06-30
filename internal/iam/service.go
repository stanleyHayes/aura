// Package iam owns identity, authentication, sessions, and RBAC subjects
// (§9). It implements the auth flows (login with lockout + MFA, refresh-token
// rotation with reuse detection, password reset) and user/department management.
package iam

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

// Mailer sends transactional auth emails (password reset). The real implementation
// lives in the notifications module; iam depends only on this narrow interface.
type Mailer interface {
	SendPasswordReset(ctx context.Context, email, rawToken string) error
}

type Config struct {
	AccessTTL        time.Duration
	RefreshTTL       time.Duration
	LoginMaxAttempts int
	LoginLockWindow  time.Duration
	MFAIssuer        string
}

type Service struct {
	store     *db.Store
	signer    auth.TokenSigner
	argon     auth.Argon2Params
	aesgcm    *auth.AESGCM
	cfg       Config
	mailer    Mailer
	dummyHash string
}

func NewService(store *db.Store, signer auth.TokenSigner, argon auth.Argon2Params, aesgcm *auth.AESGCM, cfg Config, mailer Mailer) *Service {
	// Precompute a dummy hash so authentication takes ~constant time whether or
	// not the email exists (no user enumeration; §9.1).
	dummy, _ := auth.HashPassword("cbs-timing-equaliser", argon)
	return &Service{store: store, signer: signer, argon: argon, aesgcm: aesgcm, cfg: cfg, mailer: mailer, dummyHash: dummy}
}

// Tokens is the result of a successful authentication.
type Tokens struct {
	Access        string
	Refresh       string
	AccessExpires time.Time
	User          dbgen.User
}

// Authenticate verifies credentials with lockout, suspension and MFA checks.
func (s *Service) Authenticate(ctx context.Context, email, password, mfaCode, ua string, ip *string) (Tokens, error) {
	u, err := s.store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_, _ = auth.VerifyPassword(password, s.dummyHash) // equalise timing
			return Tokens{}, apperr.ErrInvalidCredentials
		}
		return Tokens{}, err
	}

	if u.LockedUntil.Valid && u.LockedUntil.Time.After(time.Now()) {
		return Tokens{}, apperr.ErrAccountLocked
	}

	ok, err := auth.VerifyPassword(password, u.PasswordHash)
	if err != nil || !ok {
		s.recordFailure(ctx, u.ID)
		return Tokens{}, apperr.ErrInvalidCredentials
	}

	if u.Status == dbgen.UserStatusSUSPENDED {
		return Tokens{}, apperr.ErrAccountSuspended
	}

	if u.MfaEnabled {
		if mfaCode == "" {
			return Tokens{}, apperr.ErrMFARequired
		}
		valid, err := s.verifyTOTP(ctx, u, mfaCode)
		if err != nil || !valid {
			s.recordFailure(ctx, u.ID)
			return Tokens{}, apperr.ErrInvalidMFACode
		}
	}

	_ = s.store.RecordSuccessfulLogin(ctx, u.ID)
	return s.issueTokens(ctx, u, uuid.New(), ua, ip)
}

func (s *Service) recordFailure(ctx context.Context, id uuid.UUID) {
	_, _ = s.store.RecordFailedLogin(ctx, dbgen.RecordFailedLoginParams{
		ID:          id,
		MaxAttempts: int32(s.cfg.LoginMaxAttempts),
		LockWindow:  pgconv.Interval(s.cfg.LoginLockWindow),
	})
}

// issueTokens mints an access JWT and a rotating opaque refresh token in a family.
func (s *Service) issueTokens(ctx context.Context, u dbgen.User, familyID uuid.UUID, ua string, ip *string) (Tokens, error) {
	now := time.Now()
	access, err := s.signer.Sign(u.ID, u.Role, u.Email, s.cfg.AccessTTL)
	if err != nil {
		return Tokens{}, err
	}
	raw, hash, err := auth.NewOpaqueToken()
	if err != nil {
		return Tokens{}, err
	}
	var uaPtr *string
	if ua != "" {
		uaPtr = &ua
	}
	if _, err := s.store.CreateRefreshToken(ctx, dbgen.CreateRefreshTokenParams{
		UserID:    u.ID,
		TokenHash: hash,
		FamilyID:  familyID,
		UserAgent: uaPtr,
		IpAddress: ip,
		ExpiresAt: pgconv.TS(now.Add(s.cfg.RefreshTTL)),
	}); err != nil {
		return Tokens{}, err
	}
	return Tokens{Access: access, Refresh: raw, AccessExpires: now.Add(s.cfg.AccessTTL), User: u}, nil
}

// Refresh rotates a refresh token. Reuse of an already-revoked token revokes the
// whole family (§9.1 reuse detection).
func (s *Service) Refresh(ctx context.Context, rawRefresh, ua string, ip *string) (Tokens, error) {
	rt, err := s.store.GetRefreshTokenByHash(ctx, auth.HashToken(rawRefresh))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Tokens{}, apperr.ErrInvalidToken
		}
		return Tokens{}, err
	}
	if rt.RevokedAt.Valid {
		_ = s.store.RevokeRefreshFamily(ctx, rt.FamilyID) // reuse detected
		return Tokens{}, apperr.ErrTokenReuse
	}
	if rt.ExpiresAt.Time.Before(time.Now()) {
		return Tokens{}, apperr.ErrInvalidToken
	}
	u, err := s.store.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return Tokens{}, err
	}
	if u.Status == dbgen.UserStatusSUSPENDED {
		return Tokens{}, apperr.ErrAccountSuspended
	}
	_ = s.store.RevokeRefreshToken(ctx, rt.ID) // rotate
	return s.issueTokens(ctx, u, rt.FamilyID, ua, ip)
}

// Logout revokes the presented refresh token.
func (s *Service) Logout(ctx context.Context, rawRefresh string) error {
	rt, err := s.store.GetRefreshTokenByHash(ctx, auth.HashToken(rawRefresh))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // already gone
		}
		return err
	}
	return s.store.RevokeRefreshToken(ctx, rt.ID)
}

// ── Password reset (no enumeration) ──────────────────────────────────────────

func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	u, err := s.store.GetUserByEmail(ctx, email)
	if err != nil {
		// LOW-9: do the same token+hash work as the found branch so the synchronous
		// latency is ~constant whether or not the email exists (no timing oracle).
		// The result is discarded.
		_, _, _ = auth.NewOpaqueToken()
		return nil // always 200; do not reveal whether the email exists
	}
	raw, hash, err := auth.NewOpaqueToken()
	if err != nil {
		return nil
	}
	if _, err := s.store.CreatePasswordResetToken(ctx, dbgen.CreatePasswordResetTokenParams{
		UserID:    u.ID,
		TokenHash: hash,
		ExpiresAt: pgconv.TS(time.Now().Add(time.Hour)),
	}); err != nil {
		return nil
	}
	if s.mailer != nil {
		// LOW-9: send off the request path so a slow mail provider cannot be used to
		// distinguish existing from non-existing accounts via response latency. Use a
		// background context because the request context ends when we return.
		email, raw := u.Email, raw
		// #nosec G118 -- background context is intentional: the request context is
		// cancelled when the handler returns, which would abort this fire-and-forget
		// email and reintroduce the timing oracle this fix removes (LOW-9).
		go func() { _ = s.mailer.SendPasswordReset(context.Background(), email, raw) }()
	}
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, rawToken, newPassword string) error {
	if len(newPassword) < 10 {
		return apperr.ErrValidation.WithFields(apperr.FieldError{Field: "password", Message: "must be at least 10 characters"})
	}
	prt, err := s.store.GetPasswordResetToken(ctx, auth.HashToken(rawToken))
	if err != nil {
		return apperr.ErrInvalidToken
	}
	if prt.UsedAt.Valid || prt.ExpiresAt.Time.Before(time.Now()) {
		return apperr.ErrInvalidToken
	}
	hash, err := auth.HashPassword(newPassword, s.argon)
	if err != nil {
		return err
	}
	if err := s.store.UpdatePasswordHash(ctx, dbgen.UpdatePasswordHashParams{ID: prt.UserID, PasswordHash: hash}); err != nil {
		return err
	}
	_ = s.store.ConsumePasswordResetToken(ctx, prt.ID)
	_ = s.store.RevokeAllUserRefreshTokens(ctx, prt.UserID) // force re-login everywhere
	return nil
}

func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	if currentPassword == "" {
		return apperr.ErrValidation.WithFields(apperr.FieldError{Field: "current_password", Message: "enter your current password"})
	}
	if len(newPassword) < 10 {
		return apperr.ErrValidation.WithFields(apperr.FieldError{Field: "new_password", Message: "must be at least 10 characters"})
	}
	u, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	ok, err := auth.VerifyPassword(currentPassword, u.PasswordHash)
	if err != nil || !ok {
		return apperr.ErrInvalidCredentials.WithDetail("Current password is incorrect")
	}
	hash, err := auth.HashPassword(newPassword, s.argon)
	if err != nil {
		return err
	}
	if err := s.store.UpdatePasswordHash(ctx, dbgen.UpdatePasswordHashParams{ID: userID, PasswordHash: hash}); err != nil {
		return err
	}
	_ = s.store.RevokeAllUserRefreshTokens(ctx, userID)
	return nil
}

// ── User & department management (SYSTEM_ADMIN) ──────────────────────────────

type CreateUserInput struct {
	Email        string
	Password     string
	FullName     string
	Role         dbgen.UserRole
	DepartmentID *uuid.UUID
}

func (s *Service) CreateUser(ctx context.Context, in CreateUserInput) (dbgen.User, error) {
	if in.Email == "" || in.FullName == "" {
		return dbgen.User{}, apperr.ErrValidation.WithDetail("email and full_name are required")
	}
	if len(in.Password) < 10 {
		return dbgen.User{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "password", Message: "must be at least 10 characters"})
	}
	hash, err := auth.HashPassword(in.Password, s.argon)
	if err != nil {
		return dbgen.User{}, err
	}
	u, err := s.store.CreateUser(ctx, dbgen.CreateUserParams{
		Email:        in.Email,
		PasswordHash: hash,
		FullName:     in.FullName,
		Role:         in.Role,
		DepartmentID: in.DepartmentID,
		Status:       dbgen.UserStatusACTIVE,
	})
	return u, db.MapError(err)
}

func (s *Service) GetUser(ctx context.Context, id uuid.UUID) (dbgen.User, error) {
	return s.store.GetUserByID(ctx, id)
}

func (s *Service) ListUsers(ctx context.Context, p dbgen.ListUsersParams) ([]dbgen.User, error) {
	return s.store.ListUsers(ctx, p)
}

func (s *Service) UpdateUser(ctx context.Context, id uuid.UUID, fullName string, dept *uuid.UUID) (dbgen.User, error) {
	if fullName == "" {
		return dbgen.User{}, apperr.ErrValidation.WithFields(apperr.FieldError{Field: "full_name", Message: "full name is required"})
	}
	return s.store.UpdateUserProfile(ctx, dbgen.UpdateUserProfileParams{ID: id, FullName: fullName, DepartmentID: dept})
}

func (s *Service) ChangeRole(ctx context.Context, id uuid.UUID, role dbgen.UserRole) (dbgen.User, error) {
	u, err := s.store.UpdateUserRole(ctx, dbgen.UpdateUserRoleParams{ID: id, Role: role})
	if err == nil {
		// LOW-7: the role is baked into the access JWT, so an already-issued token
		// keeps the old role until it expires. Revoke refresh tokens so the user
		// cannot mint new access tokens with the stale role; the existing access
		// token still self-heals within at most one access-token TTL (≤15m).
		_ = s.store.RevokeAllUserRefreshTokens(ctx, id)
	}
	return u, err
}

func (s *Service) SetStatus(ctx context.Context, id uuid.UUID, status dbgen.UserStatus) (dbgen.User, error) {
	u, err := s.store.SetUserStatus(ctx, dbgen.SetUserStatusParams{ID: id, Status: status})
	if err == nil && status == dbgen.UserStatusSUSPENDED {
		_ = s.store.RevokeAllUserRefreshTokens(ctx, id)
	}
	return u, err
}

func (s *Service) CreateDepartment(ctx context.Context, code, name string, faculty *string) (dbgen.Department, error) {
	d, err := s.store.CreateDepartment(ctx, dbgen.CreateDepartmentParams{Code: code, Name: name, Faculty: faculty})
	return d, db.MapError(err)
}

func (s *Service) ListDepartments(ctx context.Context) ([]dbgen.Department, error) {
	return s.store.ListDepartments(ctx)
}

func (s *Service) UpdateDepartment(ctx context.Context, id uuid.UUID, code, name string, faculty *string) (dbgen.Department, error) {
	d, err := s.store.UpdateDepartment(ctx, dbgen.UpdateDepartmentParams{ID: id, Code: code, Name: name, Faculty: faculty})
	return d, db.MapError(err)
}

func (s *Service) DeleteDepartment(ctx context.Context, id uuid.UUID) error {
	return db.MapError(s.store.DeleteDepartment(ctx, id))
}

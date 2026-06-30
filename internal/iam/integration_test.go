package iam_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/iam"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
)

func newService(t *testing.T) (*iam.Service, *db.Store) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	store, err := db.New(context.Background(), url, "Africa/Accra")
	require.NoError(t, err)
	t.Cleanup(store.Close)

	signer, err := auth.NewHMACSigner("test-signing-key-long-enough-1234", "k1")
	require.NoError(t, err)
	aesgcm, err := auth.NewAESGCM("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	require.NoError(t, err)
	argon := auth.Argon2Params{MemoryKiB: 16384, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}
	cfg := iam.Config{AccessTTL: 15 * time.Minute, RefreshTTL: time.Hour, LoginMaxAttempts: 3, LoginLockWindow: time.Minute, MFAIssuer: "CBS"}
	return iam.NewService(store, signer, argon, aesgcm, cfg, nil), store
}

func createUser(t *testing.T, svc *iam.Service) (string, string) {
	t.Helper()
	email := "u-" + uuid.NewString()[:8] + "@x.edu"
	pw := "Password123!"
	_, err := svc.CreateUser(context.Background(), iam.CreateUserInput{
		Email: email, Password: pw, FullName: "Test", Role: dbgen.UserRoleREQUESTER,
	})
	require.NoError(t, err)
	return email, pw
}

func TestRefreshRotationAndReuseDetection(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)

	toks1, err := svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.NoError(t, err)

	// Rotate: the new tokens differ; the old refresh is now revoked.
	toks2, err := svc.Refresh(ctx, toks1.Refresh, "ua", nil)
	require.NoError(t, err)
	require.NotEqual(t, toks1.Refresh, toks2.Refresh)

	// Reusing the OLD (revoked) refresh is detected and revokes the whole family.
	_, err = svc.Refresh(ctx, toks1.Refresh, "ua", nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "TOKEN_REUSE_DETECTED", ae.Code)

	// After family revocation, even the latest refresh no longer works.
	_, err = svc.Refresh(ctx, toks2.Refresh, "ua", nil)
	require.Error(t, err)
}

func TestLoginLockout(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)

	for i := 0; i < 3; i++ {
		_, err := svc.Authenticate(ctx, email, "wrong", "", "ua", nil)
		require.Error(t, err)
	}
	// Now locked even with the correct password.
	_, err := svc.Authenticate(ctx, email, pw, "", "ua", nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "ACCOUNT_LOCKED", ae.Code)
}

func TestNoUserEnumeration(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	_, err := svc.Authenticate(ctx, "does-not-exist-"+uuid.NewString()+"@x.edu", "whatever", "", "ua", nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "INVALID_CREDENTIALS", ae.Code) // same code as wrong password
}

func TestPasswordResetRevokesSessions(t *testing.T) {
	svc, store := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)
	toks, err := svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.NoError(t, err)

	// Issue a reset token directly (ForgotPassword would email it).
	raw, hash, err := auth.NewOpaqueToken()
	require.NoError(t, err)
	u, err := store.GetUserByEmail(ctx, email)
	require.NoError(t, err)
	_, err = store.CreatePasswordResetToken(ctx, dbgen.CreatePasswordResetTokenParams{
		UserID: u.ID, TokenHash: hash, ExpiresAt: pgconv.TS(time.Now().Add(time.Hour)),
	})
	require.NoError(t, err)

	require.NoError(t, svc.ResetPassword(ctx, raw, "NewPassword456!"))

	// Old refresh tokens are revoked; old password no longer works.
	_, err = svc.Refresh(ctx, toks.Refresh, "ua", nil)
	require.Error(t, err)
	_, err = svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.Error(t, err)
	_, err = svc.Authenticate(ctx, email, "NewPassword456!", "", "ua", nil)
	require.NoError(t, err)
}

func TestChangePasswordRequiresCurrentPasswordAndRevokesSessions(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)
	toks, err := svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.NoError(t, err)

	user := toks.User
	err = svc.ChangePassword(ctx, user.ID, "wrong", "NewPassword456!")
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "INVALID_CREDENTIALS", ae.Code)

	require.NoError(t, svc.ChangePassword(ctx, user.ID, pw, "NewPassword456!"))
	_, err = svc.Refresh(ctx, toks.Refresh, "ua", nil)
	require.Error(t, err)
	_, err = svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.Error(t, err)
	_, err = svc.Authenticate(ctx, email, "NewPassword456!", "", "ua", nil)
	require.NoError(t, err)
}

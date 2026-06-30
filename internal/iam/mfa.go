package iam

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/hotp"
	"github.com/pquerna/otp/totp"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// TOTP parameters — must match the defaults pquerna/otp uses for totp.Validate /
// totp.Generate so codes from a standard authenticator app verify (LOW-8).
const (
	totpPeriod = 30
	totpSkew   = 1
)

// MFAEnrolment is returned when a user begins TOTP enrolment (§9.1).
type MFAEnrolment struct {
	ProvisioningURI string `json:"provisioning_uri"`
	Secret          string `json:"secret"`
}

// EnrolMFA generates a TOTP secret, stores it encrypted (AES-GCM, not yet
// enabled) and returns the provisioning URI for the authenticator app.
//
// If MFA is already enabled, enrolment is refused (MED-5): silently overwriting a
// live secret would let a session-hijacker re-bind MFA to their own device without
// a step-up. The user must re-authenticate and disable MFA first.
func (s *Service) EnrolMFA(ctx context.Context, userID uuid.UUID) (MFAEnrolment, error) {
	u, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return MFAEnrolment{}, err
	}
	if u.MfaEnabled {
		return MFAEnrolment{}, apperr.ErrMFAAlreadyEnabled
	}
	key, err := totp.Generate(totp.GenerateOpts{Issuer: s.cfg.MFAIssuer, AccountName: u.Email})
	if err != nil {
		return MFAEnrolment{}, err
	}
	enc, err := s.aesgcm.Encrypt([]byte(key.Secret()))
	if err != nil {
		return MFAEnrolment{}, err
	}
	if err := s.store.SetMFASecret(ctx, dbgen.SetMFASecretParams{ID: userID, MfaSecretEncrypted: enc}); err != nil {
		return MFAEnrolment{}, err
	}
	return MFAEnrolment{ProvisioningURI: key.URL(), Secret: key.Secret()}, nil
}

// VerifyMFA confirms a TOTP code and enables MFA on the account.
func (s *Service) VerifyMFA(ctx context.Context, userID uuid.UUID, code string) error {
	u, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	ok, err := s.verifyTOTP(ctx, u, code)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.ErrInvalidMFACode
	}
	return s.store.EnableMFA(ctx, userID)
}

// verifyTOTP validates a TOTP code against the user's secret and enforces replay
// protection (LOW-8): it finds the timestep the code matched and rejects any code
// whose timestep is <= the last one already accepted, then persists the accepted
// timestep so each code is single-use even within the skew window.
func (s *Service) verifyTOTP(ctx context.Context, u dbgen.User, code string) (bool, error) {
	if len(u.MfaSecretEncrypted) == 0 {
		return false, apperr.ErrInvalidMFACode
	}
	secret, err := s.aesgcm.Decrypt(u.MfaSecretEncrypted)
	if err != nil {
		return false, err
	}
	step, ok := matchTimestep(code, string(secret), time.Now())
	if !ok {
		return false, nil
	}
	if u.LastMfaTimestep != nil && step <= *u.LastMfaTimestep {
		// The code (or an earlier one in the same window) was already used.
		return false, nil
	}
	if err := s.store.SetLastMFATimestep(ctx, dbgen.SetLastMFATimestepParams{ID: u.ID, LastMfaTimestep: &step}); err != nil {
		return false, err
	}
	return true, nil
}

// matchTimestep reports which TOTP timestep (counter) the code matches within the
// allowed skew, mirroring totp.Validate's candidate set. Returns false if none.
func matchTimestep(code, secret string, t time.Time) (int64, bool) {
	current := int64(math.Floor(float64(t.Unix()) / float64(totpPeriod)))
	// Check the current counter first, then nearer skews, so the earliest valid
	// match within the window wins deterministically.
	candidates := []int64{current}
	for i := 1; i <= totpSkew; i++ {
		candidates = append(candidates, current-int64(i), current+int64(i))
	}
	for _, c := range candidates {
		valid, err := hotp.ValidateCustom(code, uint64(c), secret, hotp.ValidateOpts{
			Digits:    otp.DigitsSix,
			Algorithm: otp.AlgorithmSHA1,
		})
		if err == nil && valid {
			return c, true
		}
	}
	return 0, false
}

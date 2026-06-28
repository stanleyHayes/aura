package iam

import (
	"context"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// MFAEnrolment is returned when a user begins TOTP enrolment (§9.1).
type MFAEnrolment struct {
	ProvisioningURI string `json:"provisioning_uri"`
	Secret          string `json:"secret"`
}

// EnrolMFA generates a TOTP secret, stores it encrypted (AES-GCM, not yet
// enabled) and returns the provisioning URI for the authenticator app.
func (s *Service) EnrolMFA(ctx context.Context, userID uuid.UUID) (MFAEnrolment, error) {
	u, err := s.store.GetUserByID(ctx, userID)
	if err != nil {
		return MFAEnrolment{}, err
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
	ok, err := s.verifyTOTP(u, code)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.ErrInvalidMFACode
	}
	return s.store.EnableMFA(ctx, userID)
}

func (s *Service) verifyTOTP(u dbgen.User, code string) (bool, error) {
	if len(u.MfaSecretEncrypted) == 0 {
		return false, apperr.ErrInvalidMFACode
	}
	secret, err := s.aesgcm.Decrypt(u.MfaSecretEncrypted)
	if err != nil {
		return false, err
	}
	return totp.Validate(code, string(secret)), nil
}

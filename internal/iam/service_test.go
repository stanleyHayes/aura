package iam_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/require"

	"github.com/aura/cbs/internal/iam"
	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func TestUserAndDepartmentManagement(t *testing.T) {
	svc, store := newService(t)
	ctx := context.Background()

	// Departments CRUD.
	dept, err := svc.CreateDepartment(ctx, "DPT-"+uniq(), "Engineering", strptr("Sci"))
	require.NoError(t, err)
	depts, err := svc.ListDepartments(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, depts)
	updated, err := svc.UpdateDepartment(ctx, dept.ID, dept.Code, "Eng & Tech", nil)
	require.NoError(t, err)
	require.Equal(t, "Eng & Tech", updated.Name)

	// Create a user, read, list, update, change role, suspend, reactivate.
	email := "mgmt-" + uniq() + "@x.edu"
	u, err := svc.CreateUser(ctx, iam.CreateUserInput{Email: email, Password: "Password123!", FullName: "Mgmt", Role: dbgen.UserRoleREQUESTER, DepartmentID: &dept.ID})
	require.NoError(t, err)

	got, err := svc.GetUser(ctx, u.ID)
	require.NoError(t, err)
	require.Equal(t, email, got.Email)

	listed, err := svc.ListUsers(ctx, dbgen.ListUsersParams{Lim: 50})
	require.NoError(t, err)
	require.NotEmpty(t, listed)

	prof, err := svc.UpdateUser(ctx, u.ID, "New Name", nil)
	require.NoError(t, err)
	require.Equal(t, "New Name", prof.FullName)

	roled, err := svc.ChangeRole(ctx, u.ID, dbgen.UserRoleBOOKINGOFFICER)
	require.NoError(t, err)
	require.Equal(t, dbgen.UserRoleBOOKINGOFFICER, roled.Role)

	susp, err := svc.SetStatus(ctx, u.ID, dbgen.UserStatusSUSPENDED)
	require.NoError(t, err)
	require.Equal(t, dbgen.UserStatusSUSPENDED, susp.Status)
	// A suspended user cannot authenticate.
	_, err = svc.Authenticate(ctx, email, "Password123!", "", "ua", nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "ACCOUNT_SUSPENDED", ae.Code)

	react, err := svc.SetStatus(ctx, u.ID, dbgen.UserStatusACTIVE)
	require.NoError(t, err)
	require.Equal(t, dbgen.UserStatusACTIVE, react.Status)

	require.NoError(t, svc.DeleteDepartment(ctx, dept.ID))
	_ = store
}

func TestMFAEnrolVerifyAndLogin(t *testing.T) {
	svc, store := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)
	u, err := store.GetUserByEmail(ctx, email)
	require.NoError(t, err)

	enrol, err := svc.EnrolMFA(ctx, u.ID)
	require.NoError(t, err)
	require.NotEmpty(t, enrol.Secret)
	require.Contains(t, enrol.ProvisioningURI, "otpauth://")

	code, err := totp.GenerateCode(enrol.Secret, time.Now())
	require.NoError(t, err)
	require.NoError(t, svc.VerifyMFA(ctx, u.ID, code))

	// Login now requires an MFA code.
	_, err = svc.Authenticate(ctx, email, pw, "", "ua", nil)
	ae, ok := apperr.As(err)
	require.True(t, ok)
	require.Equal(t, "MFA_REQUIRED", ae.Code)

	// Wrong code rejected.
	_, err = svc.Authenticate(ctx, email, pw, "000000", "ua", nil)
	ae, _ = apperr.As(err)
	require.Equal(t, "INVALID_MFA_CODE", ae.Code)

	// Correct code succeeds.
	good, err := totp.GenerateCode(enrol.Secret, time.Now())
	require.NoError(t, err)
	_, err = svc.Authenticate(ctx, email, pw, good, "ua", nil)
	require.NoError(t, err)
}

func TestLogoutAndForgotPassword(t *testing.T) {
	svc, _ := newService(t)
	ctx := context.Background()
	email, pw := createUser(t, svc)

	toks, err := svc.Authenticate(ctx, email, pw, "", "ua", nil)
	require.NoError(t, err)
	require.NoError(t, svc.Logout(ctx, toks.Refresh))
	// Refresh after logout fails.
	_, err = svc.Refresh(ctx, toks.Refresh, "ua", nil)
	require.Error(t, err)

	// ForgotPassword never errors (no enumeration), known or unknown.
	require.NoError(t, svc.ForgotPassword(ctx, email))
	require.NoError(t, svc.ForgotPassword(ctx, "nobody-"+uniq()+"@x.edu"))
}

func strptr(s string) *string { return &s }

func uniq() string { return uuid.NewString()[:8] }

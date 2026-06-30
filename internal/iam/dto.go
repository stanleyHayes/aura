package iam

import (
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/pgconv"
	"github.com/aura/cbs/internal/platform/rbac"
)

// UserView is the safe, public projection of a user (no hash, no MFA secret).
type UserView struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	FullName     string     `json:"full_name"`
	Role         string     `json:"role"`
	DepartmentID *uuid.UUID `json:"department_id"`
	Status       string     `json:"status"`
	MFAEnabled   bool       `json:"mfa_enabled"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    *time.Time `json:"created_at"`
}

func toUserView(u dbgen.User) UserView {
	return UserView{
		ID:           u.ID,
		Email:        u.Email,
		FullName:     u.FullName,
		Role:         string(u.Role),
		DepartmentID: u.DepartmentID,
		Status:       string(u.Status),
		MFAEnabled:   u.MfaEnabled,
		LastLoginAt:  pgconv.TimePtr(u.LastLoginAt),
		CreatedAt:    pgconv.TimePtr(u.CreatedAt),
	}
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	// RefreshToken is only populated in bearer mode (X-Auth-Mode: bearer), for
	// native clients that cannot use HttpOnly cookies (PART C). It is omitted
	// entirely for the default cookie-based web flow.
	RefreshToken string   `json:"refresh_token,omitempty"`
	User         UserView `json:"user"`
}

type meResponse struct {
	User        UserView `json:"user"`
	Permissions []string `json:"permissions"`
}

func toMe(u dbgen.User) meResponse {
	return meResponse{User: toUserView(u), Permissions: rbac.Permissions(u.Role)}
}

// DepartmentView mirrors the departments table for responses.
type DepartmentView struct {
	ID      uuid.UUID `json:"id"`
	Code    string    `json:"code"`
	Name    string    `json:"name"`
	Faculty *string   `json:"faculty"`
}

func toDeptView(d dbgen.Department) DepartmentView {
	return DepartmentView{ID: d.ID, Code: d.Code, Name: d.Name, Faculty: d.Faculty}
}

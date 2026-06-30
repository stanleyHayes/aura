// Package apperr is the single source of truth for domain errors. Services return
// these; the HTTP layer maps them to RFC 9457 problem+json responses (§8.2) with a
// stable machine `code` that clients switch on.
package apperr

import (
	"errors"
	"fmt"
)

// FieldError is a single field-level validation failure (errors[] in §8.2).
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error is a typed application error carrying an HTTP status, a stable code,
// a human title/detail, and optional field errors.
type Error struct {
	Status int
	Code   string
	Title  string
	Detail string
	Fields []FieldError
	wrap   error
}

func (e *Error) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.Code, e.Detail)
	}
	return e.Code
}

func (e *Error) Unwrap() error { return e.wrap }

// WithDetail returns a copy with a specific detail message.
func (e *Error) WithDetail(format string, args ...any) *Error {
	cp := *e
	cp.Detail = fmt.Sprintf(format, args...)
	return &cp
}

// WithFields attaches field-level validation errors.
func (e *Error) WithFields(fs ...FieldError) *Error {
	cp := *e
	cp.Fields = append(append([]FieldError{}, cp.Fields...), fs...)
	return &cp
}

// Wrapping returns a copy wrapping the given underlying error (for logging).
func (e *Error) Wrapping(err error) *Error {
	cp := *e
	cp.wrap = err
	return &cp
}

// As extracts an *Error from an error chain.
func As(err error) (*Error, bool) {
	var ae *Error
	if errors.As(err, &ae) {
		return ae, true
	}
	return nil, false
}

func New(status int, code, title string) *Error {
	return &Error{Status: status, Code: code, Title: title, Detail: title}
}

// ── Catalogue of stable errors ────────────────────────────────────────────────
var (
	// Generic
	ErrValidation    = New(400, "VALIDATION_FAILED", "Validation failed")
	ErrUnprocessable = New(422, "UNPROCESSABLE", "Unprocessable request")
	ErrNotFound      = New(404, "NOT_FOUND", "Resource not found")
	ErrConflict      = New(409, "CONFLICT", "Conflict")
	ErrInternal      = New(500, "INTERNAL", "Internal server error")
	ErrBadGateway    = New(502, "BAD_GATEWAY", "Upstream service failed")
	ErrUnavailable   = New(503, "SERVICE_UNAVAILABLE", "Service unavailable")

	// Auth / access (§9)
	ErrUnauthorized       = New(401, "UNAUTHORIZED", "Authentication required")
	ErrInvalidCredentials = New(401, "INVALID_CREDENTIALS", "Invalid email or password")
	ErrAccountLocked      = New(423, "ACCOUNT_LOCKED", "Account temporarily locked")
	ErrAccountSuspended   = New(403, "ACCOUNT_SUSPENDED", "Account suspended")
	ErrForbidden          = New(403, "FORBIDDEN", "You do not have permission")
	ErrMFARequired        = New(401, "MFA_REQUIRED", "Multi-factor code required")
	ErrInvalidMFACode     = New(401, "INVALID_MFA_CODE", "Invalid MFA code")
	ErrInvalidToken       = New(401, "INVALID_TOKEN", "Invalid or expired token")
	ErrTokenReuse         = New(401, "TOKEN_REUSE_DETECTED", "Refresh token reuse detected")
	ErrMFAAlreadyEnabled  = New(409, "MFA_ALREADY_ENABLED", "MFA is already enabled; re-authenticate and disable it before re-enrolling")

	// Bookings / availability (BR1–BR6, §7)
	ErrBookingInPast        = New(422, "BOOKING_IN_PAST", "Booking cannot start in the past")
	ErrBookingSpansDays     = New(422, "BOOKING_SPANS_MULTIPLE_DAYS", "Booking must fall within a single day")
	ErrAttendeesExceed      = New(422, "ATTENDEES_EXCEED_CAPACITY", "Attendee count exceeds room capacity")
	ErrConflictsLecture     = New(422, "CONFLICTS_WITH_LECTURE", "Requested slot is occupied by a lecture")
	ErrConflictsMaintenance = New(422, "CONFLICTS_WITH_MAINTENANCE", "Requested slot is under maintenance")
	ErrSlotUnavailable      = New(409, "SLOT_NO_LONGER_AVAILABLE", "Slot no longer available")
	ErrInvalidTransition    = New(409, "INVALID_STATE_TRANSITION", "Illegal booking state transition")
	ErrRoomInactive         = New(422, "ROOM_INACTIVE", "Room is not active")
	ErrMaintenanceConflict  = New(409, "MAINTENANCE_CONFLICTS_WITH_BOOKING", "An approved booking overlaps this maintenance window")

	// Scheduling
	ErrActiveSemesterExists = New(409, "ACTIVE_SEMESTER_EXISTS", "Another semester is already active")
	ErrNoActiveSemester     = New(409, "NO_ACTIVE_SEMESTER", "No active semester")

	// Media uploads
	ErrMediaNotConfigured = New(503, "MEDIA_STORAGE_NOT_CONFIGURED", "Media storage is not configured")
	ErrMediaUploadFailed  = New(502, "MEDIA_UPLOAD_FAILED", "Media upload failed")

	// Idempotency
	ErrIdempotencyMismatch = New(422, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key reused with a different request body")
)

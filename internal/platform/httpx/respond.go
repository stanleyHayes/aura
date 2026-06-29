// Package httpx holds HTTP plumbing shared by all modules: RFC 9457 problem+json
// responses (§8.2), JSON decode/encode, cursor pagination, and middleware.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/logging"
)

const problemBaseURI = "https://api.aura.ashesi.edu/errors/"

// Problem is an RFC 9457 problem document.
type Problem struct {
	Type     string              `json:"type"`
	Title    string              `json:"title"`
	Status   int                 `json:"status"`
	Detail   string              `json:"detail,omitempty"`
	Instance string              `json:"instance,omitempty"`
	Code     string              `json:"code"`
	Errors   []apperr.FieldError `json:"errors,omitempty"`
}

// JSON writes v as application/json with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Created is a 201 helper.
func Created(w http.ResponseWriter, v any) { JSON(w, http.StatusCreated, v) }

// NoContent is a 204 helper.
func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// Error maps any error to a problem+json response with a stable code.
func Error(w http.ResponseWriter, r *http.Request, log *slog.Logger, err error) {
	ae := toAppErr(err)
	if ae.Status >= 500 {
		logging.FromContext(r.Context(), log).Error("request failed",
			"code", ae.Code, "err", err.Error(), "path", r.URL.Path)
	}
	p := Problem{
		Type:     problemBaseURI + slugify(ae.Code),
		Title:    ae.Title,
		Status:   ae.Status,
		Detail:   ae.Detail,
		Instance: r.URL.Path,
		Code:     ae.Code,
		Errors:   ae.Fields,
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(ae.Status)
	_ = json.NewEncoder(w).Encode(p)
}

func toAppErr(err error) *apperr.Error {
	if ae, ok := apperr.As(err); ok {
		return ae
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.ErrNotFound
	}
	return apperr.ErrInternal.Wrapping(err)
}

func slugify(code string) string {
	out := make([]rune, 0, len(code))
	for _, r := range code {
		switch {
		case r >= 'A' && r <= 'Z':
			out = append(out, r+('a'-'A'))
		case r == '_':
			out = append(out, '-')
		default:
			out = append(out, r)
		}
	}
	return string(out)
}

// DecodeJSON decodes the request body into v, rejecting unknown fields.
func DecodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return apperr.ErrValidation.WithDetail("invalid request body: %s", err.Error())
	}
	return nil
}

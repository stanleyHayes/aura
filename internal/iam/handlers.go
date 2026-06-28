package iam

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/audit"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/db/dbgen"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/rbac"
)

// Handler exposes the iam HTTP surface (§8.3 auth, users, departments).
type Handler struct {
	svc    *Service
	audit  *audit.Recorder
	log    *slog.Logger
	secure bool // set Secure cookies (production over TLS)
}

func NewHandler(svc *Service, rec *audit.Recorder, log *slog.Logger, secure bool) *Handler {
	return &Handler{svc: svc, audit: rec, log: log, secure: secure}
}

// AuthRoutes mounts /auth/* (public flows + a few that require a session).
func (h *Handler) AuthRoutes(authn func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.Post("/password/forgot", h.forgotPassword)
	r.Post("/password/reset", h.resetPassword)
	r.Group(func(r chi.Router) {
		r.Use(authn)
		r.Post("/logout", h.logout)
		r.Get("/me", h.me)
		r.Post("/mfa/enrol", h.mfaEnrol)
		r.Post("/mfa/verify", h.mfaVerify)
	})
	return r
}

// UserRoutes mounts /users/* (all require user.manage).
func (h *Handler) UserRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(httpx.RequirePermission(rbac.UserManage, h.log))
	r.Get("/", h.listUsers)
	r.Post("/", h.createUser)
	r.Get("/{id}", h.getUser)
	r.Patch("/{id}", h.updateUser)
	r.Patch("/{id}/role", h.changeRole)
	r.Post("/{id}/suspend", h.suspendUser)
	r.Post("/{id}/reactivate", h.reactivateUser)
	return r
}

// DepartmentRoutes mounts /departments/* (manage requires user.manage; list is auth).
func (h *Handler) DepartmentRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.listDepartments)
	r.Group(func(r chi.Router) {
		r.Use(httpx.RequirePermission(rbac.UserManage, h.log))
		r.Post("/", h.createDepartment)
		r.Patch("/{id}", h.updateDepartment)
		r.Delete("/{id}", h.deleteDepartment)
	})
	return r
}

// ── Auth handlers ────────────────────────────────────────────────────────────

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	MFACode  string `json:"mfa_code"`
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	toks, err := h.svc.Authenticate(r.Context(), req.Email, req.Password, req.MFACode, r.UserAgent(), httpx.ClientIP(r))
	if err != nil {
		h.audit.Record(r.Context(), audit.Entry{Action: "LOGIN_FAILED", EntityType: "user", IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r)})
		httpx.Error(w, r, h.log, err)
		return
	}
	uid := toks.User.ID
	h.audit.Record(r.Context(), audit.Entry{ActorID: &uid, Action: "LOGIN", EntityType: "user", EntityID: &uid, IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r)})
	h.writeTokens(w, toks)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	raw := h.refreshFromRequest(r)
	if raw == "" {
		httpx.Error(w, r, h.log, apperr.ErrInvalidToken)
		return
	}
	toks, err := h.svc.Refresh(r.Context(), raw, r.UserAgent(), httpx.ClientIP(r))
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.writeTokens(w, toks)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if raw := h.refreshFromRequest(r); raw != "" {
		_ = h.svc.Logout(r.Context(), raw)
	}
	httpx.ClearAuthCookies(w, h.secure)
	httpx.NoContent(w)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	u, err := h.svc.GetUser(r.Context(), id.UserID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMe(u))
}

type forgotReq struct {
	Email string `json:"email"`
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	_ = h.svc.ForgotPassword(r.Context(), req.Email)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"}) // never reveal existence
}

type resetReq struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) mfaEnrol(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	enrol, err := h.svc.EnrolMFA(r.Context(), id.UserID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, enrol)
}

type mfaVerifyReq struct {
	Code string `json:"code"`
}

func (h *Handler) mfaVerify(w http.ResponseWriter, r *http.Request) {
	id := auth.MustIdentity(r.Context())
	var req mfaVerifyReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.VerifyMFA(r.Context(), id.UserID, req.Code); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) writeTokens(w http.ResponseWriter, toks Tokens) {
	csrf := uuid.NewString()
	httpx.SetAuthCookies(w, toks.Access, toks.Refresh, csrf, h.svc.cfg.AccessTTL, h.svc.cfg.RefreshTTL, h.secure)
	httpx.JSON(w, http.StatusOK, tokenResponse{
		AccessToken: toks.Access,
		TokenType:   "Bearer",
		ExpiresIn:   int(h.svc.cfg.AccessTTL.Seconds()),
		User:        toUserView(toks.User),
	})
}

func (h *Handler) refreshFromRequest(r *http.Request) string {
	if v := httpx.RefreshCookieValue(r); v != "" {
		return v
	}
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = httpx.DecodeJSON(r, &body)
	return body.RefreshToken
}

// ── User management handlers ─────────────────────────────────────────────────

type createUserReq struct {
	Email        string     `json:"email"`
	Password     string     `json:"password"`
	FullName     string     `json:"full_name"`
	Role         string     `json:"role"`
	DepartmentID *uuid.UUID `json:"department_id"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	role, ok := parseRole(req.Role)
	if !ok {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("invalid role"))
		return
	}
	u, err := h.svc.CreateUser(r.Context(), CreateUserInput{
		Email: req.Email, Password: req.Password, FullName: req.FullName, Role: role, DepartmentID: req.DepartmentID,
	})
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "CREATE", "user", u.ID, nil, toUserView(u))
	httpx.Created(w, toUserView(u))
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	p := dbgen.ListUsersParams{Cursor: httpx.Cursor(r), Lim: int32(httpx.Limit(r))}
	if v := r.URL.Query().Get("role"); v != "" {
		if role, ok := parseRole(v); ok {
			p.Role = &role
		}
	}
	if v := r.URL.Query().Get("status"); v != "" {
		st := dbgen.UserStatus(v)
		p.Status = &st
	}
	if v := r.URL.Query().Get("department_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			p.DepartmentID = &id
		}
	}
	users, err := h.svc.ListUsers(r.Context(), p)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]UserView, len(users))
	for i, u := range users {
		views[i] = toUserView(u)
	}
	httpx.JSON(w, http.StatusOK, httpx.NewPage(views, httpx.Limit(r), func(v UserView) uuid.UUID { return v.ID }))
}

func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	u, err := h.svc.GetUser(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toUserView(u))
}

type updateUserReq struct {
	FullName     string     `json:"full_name"`
	DepartmentID *uuid.UUID `json:"department_id"`
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req updateUserReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	u, err := h.svc.UpdateUser(r.Context(), id, req.FullName, req.DepartmentID)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "UPDATE", "user", u.ID, nil, toUserView(u))
	httpx.JSON(w, http.StatusOK, toUserView(u))
}

type roleReq struct {
	Role string `json:"role"`
}

func (h *Handler) changeRole(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req roleReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	role, ok := parseRole(req.Role)
	if !ok {
		httpx.Error(w, r, h.log, apperr.ErrValidation.WithDetail("invalid role"))
		return
	}
	u, err := h.svc.ChangeRole(r.Context(), id, role)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "UPDATE", "user.role", u.ID, nil, req.Role)
	httpx.JSON(w, http.StatusOK, toUserView(u))
}

func (h *Handler) suspendUser(w http.ResponseWriter, r *http.Request) {
	h.setStatus(w, r, dbgen.UserStatusSUSPENDED, "SUSPEND")
}
func (h *Handler) reactivateUser(w http.ResponseWriter, r *http.Request) {
	h.setStatus(w, r, dbgen.UserStatusACTIVE, "REACTIVATE")
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request, status dbgen.UserStatus, action string) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	u, err := h.svc.SetStatus(r.Context(), id, status)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, action, "user", u.ID, nil, string(status))
	httpx.JSON(w, http.StatusOK, toUserView(u))
}

// ── Departments ──────────────────────────────────────────────────────────────

type departmentReq struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Faculty *string `json:"faculty"`
}

func (h *Handler) listDepartments(w http.ResponseWriter, r *http.Request) {
	ds, err := h.svc.ListDepartments(r.Context())
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	views := make([]DepartmentView, len(ds))
	for i, d := range ds {
		views[i] = toDeptView(d)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": views})
}

func (h *Handler) createDepartment(w http.ResponseWriter, r *http.Request) {
	var req departmentReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	d, err := h.svc.CreateDepartment(r.Context(), req.Code, req.Name, req.Faculty)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "CREATE", "department", d.ID, nil, toDeptView(d))
	httpx.Created(w, toDeptView(d))
}

func (h *Handler) updateDepartment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	var req departmentReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	d, err := h.svc.UpdateDepartment(r.Context(), id, req.Code, req.Name, req.Faculty)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "UPDATE", "department", d.ID, nil, toDeptView(d))
	httpx.JSON(w, http.StatusOK, toDeptView(d))
}

func (h *Handler) deleteDepartment(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	if err := h.svc.DeleteDepartment(r.Context(), id); err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.recordChange(r, "DELETE", "department", id, nil, nil)
	httpx.NoContent(w)
}

// ── helpers ──────────────────────────────────────────────────────────────────

func (h *Handler) recordChange(r *http.Request, action, entity string, id uuid.UUID, before, after any) {
	actor := auth.MustIdentity(r.Context()).UserID
	eid := id
	h.audit.Record(r.Context(), audit.Entry{
		ActorID: &actor, Action: action, EntityType: entity, EntityID: &eid,
		Before: before, After: after, IP: httpx.ClientIP(r), UserAgent: httpx.UserAgentPtr(r),
	})
}

func parseRole(s string) (dbgen.UserRole, bool) {
	switch dbgen.UserRole(s) {
	case dbgen.UserRoleSYSTEMADMIN, dbgen.UserRoleTIMETABLEADMIN, dbgen.UserRoleBOOKINGOFFICER, dbgen.UserRoleREQUESTER:
		return dbgen.UserRole(s), true
	default:
		return "", false
	}
}

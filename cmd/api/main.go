// Command api is the AURA (Ashesi University Resource Allocation) HTTP API: a
// modular monolith (§5.1) wiring iam, catalogue, scheduling, availability,
// bookings, notifications and reporting behind one chi router.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aura/cbs/internal/availability"
	"github.com/aura/cbs/internal/bookings"
	"github.com/aura/cbs/internal/catalogue"
	"github.com/aura/cbs/internal/iam"
	"github.com/aura/cbs/internal/notifications"
	"github.com/aura/cbs/internal/platform/audit"
	"github.com/aura/cbs/internal/platform/auth"
	"github.com/aura/cbs/internal/platform/config"
	"github.com/aura/cbs/internal/platform/db"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/logging"
	"github.com/aura/cbs/internal/platform/mailer"
	"github.com/aura/cbs/internal/platform/media"
	"github.com/aura/cbs/internal/reporting"
	"github.com/aura/cbs/internal/scheduling"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	level := slog.LevelInfo
	if !cfg.IsProduction() {
		level = slog.LevelDebug
	}
	log := logging.New(level)

	loc, err := time.LoadLocation(cfg.InstitutionTZ)
	if err != nil {
		return fmt.Errorf("load institution tz %q: %w", cfg.InstitutionTZ, err)
	}

	ctx := context.Background()
	store, err := db.New(ctx, cfg.DatabaseURL, cfg.InstitutionTZ)
	if err != nil {
		return err
	}
	defer store.Close()
	if err := store.AttachReplica(ctx, cfg.DatabaseReplicaURL, cfg.InstitutionTZ); err != nil {
		return err
	}

	handler, err := buildRouter(cfg, store, loc, log)
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      0, // 0 so SSE streams are not cut off
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("api listening", "port", cfg.HTTPPort, "env", cfg.AppEnv, "tz", cfg.InstitutionTZ)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "err", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// buildRouter wires services and handlers into the HTTP router. Extracted so it
// can be exercised by an end-to-end httptest in CI.
func buildRouter(cfg config.Config, store *db.Store, loc *time.Location, log *slog.Logger) (http.Handler, error) {
	// EdDSA when a PEM private key is supplied (production), else HMAC (dev). §9.1.
	signer, err := auth.NewSigner(cfg.JWTSigningKey, cfg.JWTKeyID)
	if err != nil {
		return nil, err
	}
	// LOW-10: surface the selected signing algorithm, and in production require an
	// HMAC key of at least 32 bytes (256-bit) — never silently accept a weak key.
	log.Info("jwt signer selected", "alg", signer.Alg(), "kid", signer.KeyID())
	if cfg.IsProduction() {
		if hs, ok := signer.(interface{ KeyLen() int }); ok && hs.KeyLen() < 32 {
			return nil, fmt.Errorf("JWT_SIGNING_KEY for HMAC must be at least 32 bytes in production (got %d)", hs.KeyLen())
		}
	}
	aesgcm, err := auth.NewAESGCM(cfg.MFAEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("mfa encryption key: %w", err)
	}
	argon := auth.DefaultArgon2Params(cfg.Argon2MemoryKiB, cfg.Argon2Iterations, cfg.Argon2Parallelism)

	var mail mailer.Mailer
	switch {
	case cfg.MailHost != "":
		mail = mailer.NewSMTPMailer(cfg.MailHost, cfg.MailPort, cfg.MailFrom, cfg.MailUser, cfg.MailPass)
	case cfg.IsProduction():
		// SECURITY (HIGH-1): the log mailer writes message bodies to the logs;
		// password-reset tokens must never reach production logs. Refuse to start
		// without a real SMTP transport in production.
		return nil, fmt.Errorf("MAIL_HOST is required in production: refusing to use the log mailer (it would log reset tokens)")
	default:
		mail = mailer.NewLogMailer(log, cfg.MailFrom)
	}

	// Cross-cutting services.
	auditRec := audit.New(store, log)
	broker := notifications.NewBroker()
	notifSvc := notifications.NewService(store, mail, broker, log)
	mediaSvc := media.NewCloudinary(media.CloudinaryConfig{
		CloudName: cfg.CloudinaryCloudName,
		APIKey:    cfg.CloudinaryAPIKey,
		APISecret: cfg.CloudinaryAPISecret,
		Folder:    cfg.CloudinaryUploadFolder,
	}, log)

	// Domain services.
	iamSvc := iam.NewService(store, signer, argon, aesgcm, iam.Config{
		AccessTTL: cfg.AccessTokenTTL, RefreshTTL: cfg.RefreshTokenTTL,
		LoginMaxAttempts: cfg.LoginMaxAttempts, LoginLockWindow: cfg.LoginLockWindow, MFAIssuer: "AURA",
	}, notifSvc)
	catalogueSvc := catalogue.NewService(store)
	schedulingSvc := scheduling.NewService(store)
	availEngine := availability.NewEngine(store, catalogueSvc, loc)
	bookingSvc := bookings.NewService(store, loc, notifSvc)
	reportingSvc := reporting.NewService(store)

	// Handlers.
	iamH := iam.NewHandler(iamSvc, auditRec, log, cfg.IsProduction())
	catalogueH := catalogue.NewHandler(catalogueSvc, auditRec, log, mediaSvc)
	schedulingH := scheduling.NewHandler(schedulingSvc, auditRec, log)
	availH := availability.NewHandler(availEngine, log)
	bookingH := bookings.NewHandler(bookingSvc, store, auditRec, log)
	notifH := notifications.NewHandler(notifSvc, broker, log)
	reportingH := reporting.NewHandler(reportingSvc, log)
	auditH := audit.NewHandler(store, log)

	authn := httpx.Authenticator(signer, log)

	// MED-4: interpret X-Forwarded-For only as far as the configured number of
	// trusted proxy hops. middleware.RealIP is deliberately NOT used because it
	// rewrites RemoteAddr from an unauthenticated, spoofable header.
	httpx.SetTrustedProxyCount(cfg.TrustedProxyCount)

	r := chi.NewRouter()
	r.Use(httpx.Correlation)
	r.Use(httpx.Recoverer(log))
	r.Use(httpx.AccessLog(log))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-CSRF-Token", "Idempotency-Key", "X-Correlation-ID"},
		ExposedHeaders:   []string{"X-Correlation-ID", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(httpx.SecurityHeaders(cfg.IsProduction()))
	r.Use(httpx.RateLimit(cfg.RateLimitDefaultPerMin, time.Minute, log))
	r.Use(httpx.Timeout(20 * time.Second)) // SSE /stream is exempt (§14 DoS)

	// Operational endpoints (§8.3).
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { httpx.JSON(w, 200, map[string]string{"status": "ok"}) })
	r.Get("/readyz", func(w http.ResponseWriter, req *http.Request) {
		c, cancel := context.WithTimeout(req.Context(), 2*time.Second)
		defer cancel()
		if err := store.Ping(c); err != nil {
			httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db_unavailable"})
			return
		}
		httpx.JSON(w, 200, map[string]string{"status": "ready"})
	})
	r.Handle("/metrics", promhttp.Handler())

	r.Route("/api/v1", func(r chi.Router) {
		// Stricter rate limit on auth endpoints (§14 abuse mitigation).
		r.With(httpx.RateLimit(cfg.RateLimitAuthPerMin, time.Minute, log)).
			Mount("/auth", iamH.AuthRoutes(authn))

		// Public, anonymous read-only catalogue for the marketing room directory
		// (§12.1). Only ACTIVE rooms are exposed; no write paths, no auth.
		r.Route("/public", func(r chi.Router) {
			catalogueH.PublicRoutes(r)
		})

		r.Group(func(r chi.Router) {
			r.Use(authn)
			r.Use(httpx.CSRF(log))

			r.Mount("/users", iamH.UserRoutes())
			r.Mount("/departments", iamH.DepartmentRoutes())
			catalogueH.Mount(r) // /buildings, /equipment, /rooms
			r.Mount("/semesters", schedulingH.SemesterRoutes())
			r.Mount("/timetable", schedulingH.TimetableRoutes())
			availH.Mount(r) // /availability/search, /calendar
			r.Mount("/bookings", bookingH.Routes())
			r.Mount("/maintenance-windows", bookingH.MaintenanceRoutes())
			r.Mount("/notifications", notifH.Routes())
			r.Mount("/devices", notifH.DeviceRoutes())
			r.Mount("/reports", reportingH.Routes())
			r.Mount("/audit-logs", auditH.Routes())
		})
	})

	return r, nil
}

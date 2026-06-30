// Package config loads strongly-typed configuration from the environment
// (12-factor; §19.1). No secrets are ever hard-coded.
package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv        string `env:"APP_ENV" envDefault:"development"`
	InstitutionTZ string `env:"APP_INSTITUTION_TZ" envDefault:"Africa/Accra"`
	HTTPPort      int    `env:"HTTP_PORT" envDefault:"8080"`
	// Port is injected by some PaaS providers (e.g. Render) and overrides HTTPPort.
	Port int `env:"PORT"`

	DatabaseURL        string `env:"DATABASE_URL,required"`
	DatabaseReplicaURL string `env:"DATABASE_REPLICA_URL"`
	RedisURL           string `env:"REDIS_URL"`
	// AutoMigrate runs the embedded goose migrations on API startup — lets a
	// shell-less, pre-deploy-less platform (e.g. Render's free tier) self-migrate.
	AutoMigrate bool `env:"AUTO_MIGRATE"`

	S3Endpoint  string `env:"S3_ENDPOINT"`
	S3Bucket    string `env:"S3_BUCKET"`
	S3Region    string `env:"S3_REGION" envDefault:"us-east-1"`
	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`

	CloudinaryCloudName    string `env:"CLOUDINARY_CLOUD_NAME"`
	CloudinaryAPIKey       string `env:"CLOUDINARY_API_KEY"`
	CloudinaryAPISecret    string `env:"CLOUDINARY_API_SECRET"`
	CloudinaryUploadFolder string `env:"CLOUDINARY_UPLOAD_FOLDER" envDefault:"aura/catalogue"`

	JWTSigningKey   string        `env:"JWT_SIGNING_KEY,required"`
	JWTKeyID        string        `env:"JWT_KEY_ID" envDefault:"dev-key-1"`
	AccessTokenTTL  time.Duration `env:"ACCESS_TOKEN_TTL" envDefault:"15m"`
	RefreshTokenTTL time.Duration `env:"REFRESH_TOKEN_TTL" envDefault:"720h"`

	Argon2MemoryKiB   uint32 `env:"ARGON2_MEMORY_KIB" envDefault:"65536"`
	Argon2Iterations  uint32 `env:"ARGON2_ITERATIONS" envDefault:"3"`
	Argon2Parallelism uint8  `env:"ARGON2_PARALLELISM" envDefault:"2"`

	MFAEncryptionKey string `env:"MFA_ENCRYPTION_KEY"`

	LoginMaxAttempts int           `env:"LOGIN_MAX_ATTEMPTS" envDefault:"5"`
	LoginLockWindow  time.Duration `env:"LOGIN_LOCK_WINDOW" envDefault:"15m"`

	MailHost string `env:"MAIL_HOST"`
	MailPort int    `env:"MAIL_PORT" envDefault:"1025"`
	MailFrom string `env:"MAIL_FROM" envDefault:"no-reply@ashesi.edu"`
	MailUser string `env:"MAIL_USERNAME"`
	MailPass string `env:"MAIL_PASSWORD"`

	CORSAllowedOrigins []string `env:"CORS_ALLOWED_ORIGINS" envSeparator:","`

	RateLimitDefaultPerMin int `env:"RATE_LIMIT_DEFAULT_PER_MIN" envDefault:"120"`
	RateLimitAuthPerMin    int `env:"RATE_LIMIT_AUTH_PER_MIN" envDefault:"10"`

	// TrustedProxyCount is the number of trusted reverse proxies in front of the
	// API. 0 (default) means the X-Forwarded-For header is untrusted and ignored:
	// the rate limiter and audit logs use the direct RemoteAddr. Set to the exact
	// number of trusted hops (e.g. 1 behind Render/Cloudflare) so the real client
	// IP is read from the right position and cannot be spoofed (MED-4).
	TrustedProxyCount int `env:"TRUSTED_PROXY_COUNT" envDefault:"0"`

	OTELEndpoint string `env:"OTEL_EXPORTER_OTLP_ENDPOINT"`
	SentryDSN    string `env:"SENTRY_DSN"`
}

func (c Config) IsProduction() bool { return c.AppEnv == "production" }

// Committed dev/example secret values. These ship in .env.example and the dev
// compose file purely so local development works out of the box; they must never
// be used in production (MED-3). validateProduction() rejects them.
const (
	devMFAEncryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=" // "0123456789abcdef0123456789abcdef"
	devJWTSigningKey    = "ZGV2LW9ubHktY2hhbmdlLW1lLXRoaXMtaXMtbm90LWEtcmVhbC1rZXk="
	minJWTSigningKeyLen = 32
)

// Load reads .env (if present) then the process environment.
func Load() (Config, error) {
	_ = godotenv.Load() // best-effort; real config comes from the environment
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if c.Port != 0 { // honour a PaaS-provided $PORT (Render, etc.)
		c.HTTPPort = c.Port
	}
	if len(c.CORSAllowedOrigins) == 0 {
		c.CORSAllowedOrigins = []string{"http://localhost:3000"}
	}
	if c.IsProduction() {
		if err := c.validateProduction(); err != nil {
			return Config{}, err
		}
	}
	return c, nil
}

// validateProduction refuses to start with insecure or committed default secrets
// (MED-3). It is only invoked when APP_ENV=production.
func (c Config) validateProduction() error {
	if c.MFAEncryptionKey == "" {
		return fmt.Errorf("MFA_ENCRYPTION_KEY is required in production")
	}
	if c.MFAEncryptionKey == devMFAEncryptionKey {
		return fmt.Errorf("MFA_ENCRYPTION_KEY must not be the committed development value in production")
	}
	if c.JWTSigningKey == "" {
		return fmt.Errorf("JWT_SIGNING_KEY is required in production")
	}
	if c.JWTSigningKey == devJWTSigningKey {
		return fmt.Errorf("JWT_SIGNING_KEY must not be the committed development value in production")
	}
	if len(c.JWTSigningKey) < minJWTSigningKeyLen {
		return fmt.Errorf("JWT_SIGNING_KEY must be at least %d characters in production", minJWTSigningKeyLen)
	}
	return nil
}

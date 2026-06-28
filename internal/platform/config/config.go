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

	S3Endpoint  string `env:"S3_ENDPOINT"`
	S3Bucket    string `env:"S3_BUCKET"`
	S3Region    string `env:"S3_REGION" envDefault:"us-east-1"`
	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`

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
	MailFrom string `env:"MAIL_FROM" envDefault:"no-reply@cbs.example.edu"`
	MailUser string `env:"MAIL_USERNAME"`
	MailPass string `env:"MAIL_PASSWORD"`

	CORSAllowedOrigins []string `env:"CORS_ALLOWED_ORIGINS" envSeparator:","`

	RateLimitDefaultPerMin int `env:"RATE_LIMIT_DEFAULT_PER_MIN" envDefault:"120"`
	RateLimitAuthPerMin    int `env:"RATE_LIMIT_AUTH_PER_MIN" envDefault:"10"`

	OTELEndpoint string `env:"OTEL_EXPORTER_OTLP_ENDPOINT"`
	SentryDSN    string `env:"SENTRY_DSN"`
}

func (c Config) IsProduction() bool { return c.AppEnv == "production" }

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
	return c, nil
}

package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

// Claims is the access-token payload. Role drives RBAC (§9.3).
type Claims struct {
	Role  dbgen.UserRole `json:"role"`
	Email string         `json:"email"`
	jwt.RegisteredClaims
}

// TokenSigner mints and verifies access JWTs. Production uses EdDSA; dev/test may
// use HMAC. The interface keeps the algorithm a configuration choice (ADR-0003).
type TokenSigner interface {
	Sign(userID uuid.UUID, role dbgen.UserRole, email string, ttl time.Duration) (string, error)
	Verify(token string) (*Claims, error)
	KeyID() string
}

// hmacSigner is the HS256 signer (dev/test). The key is raw bytes.
type hmacSigner struct {
	key   []byte
	keyID string
}

// NewHMACSigner builds an HS256 signer from a base64-encoded (or raw) key.
func NewHMACSigner(keyB64, keyID string) (TokenSigner, error) {
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil || len(key) < 16 {
		// Fall back to using the raw string bytes if not valid base64.
		key = []byte(keyB64)
	}
	if len(key) < 16 {
		return nil, fmt.Errorf("jwt signing key too short")
	}
	return &hmacSigner{key: key, keyID: keyID}, nil
}

func (s *hmacSigner) KeyID() string { return s.keyID }

func (s *hmacSigner) Sign(userID uuid.UUID, role dbgen.UserRole, email string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Role:  role,
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        uuid.NewString(),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tok.Header["kid"] = s.keyID
	return tok.SignedString(s.key)
}

func (s *hmacSigner) Verify(token string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return s.key, nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// ── Opaque refresh tokens (§9.1) ─────────────────────────────────────────────

// NewOpaqueToken returns a 256-bit random token (raw, returned to the client) and
// its SHA-256 hash (stored). The raw value is never persisted.
func NewOpaqueToken() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, HashToken(raw), nil
}

// HashToken returns the hex SHA-256 of an opaque token.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

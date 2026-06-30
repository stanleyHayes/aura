package auth

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"strings"
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
	// Alg reports the JWT signing algorithm in use (e.g. "HS256", "EdDSA") so
	// startup can log it and apply algorithm-specific policy (LOW-10).
	Alg() string
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
func (s *hmacSigner) Alg() string   { return "HS256" }

// KeyLen returns the length in bytes of the decoded HMAC key (LOW-10 policy).
func (s *hmacSigner) KeyLen() int { return len(s.key) }

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

// edDSASigner signs access tokens with Ed25519 — the production default (§9.1).
// Asymmetric signing lets verifiers hold only the public key, and key rotation
// works via the `kid` header.
type edDSASigner struct {
	priv  ed25519.PrivateKey
	pub   ed25519.PublicKey
	keyID string
}

// NewEdDSASigner builds an EdDSA signer from a PEM-encoded PKCS#8 Ed25519 key.
func NewEdDSASigner(privPEM, keyID string) (TokenSigner, error) {
	block, _ := pem.Decode([]byte(privPEM))
	if block == nil {
		return nil, fmt.Errorf("jwt: invalid PEM private key")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("jwt: parse Ed25519 key: %w", err)
	}
	priv, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("jwt: key is not Ed25519")
	}
	pub, ok := priv.Public().(ed25519.PublicKey)
	if !ok {
		return nil, fmt.Errorf("jwt: cannot derive Ed25519 public key")
	}
	return &edDSASigner{priv: priv, pub: pub, keyID: keyID}, nil
}

func (s *edDSASigner) KeyID() string { return s.keyID }
func (s *edDSASigner) Alg() string   { return "EdDSA" }

func (s *edDSASigner) Sign(userID uuid.UUID, role dbgen.UserRole, email string, ttl time.Duration) (string, error) {
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
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	tok.Header["kid"] = s.keyID
	return tok.SignedString(s.priv)
}

func (s *edDSASigner) Verify(token string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		// Reject algorithm confusion (e.g. an HMAC token presented to this verifier).
		if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return s.pub, nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// NewSigner selects the token signer from the key material: a PEM private key →
// EdDSA (production); otherwise HMAC (dev/test). Algorithm stays a config choice
// (ADR-0003, §9.1) and each signer rejects tokens signed with another algorithm.
func NewSigner(key, keyID string) (TokenSigner, error) {
	if strings.Contains(key, "-----BEGIN") {
		return NewEdDSASigner(key, keyID)
	}
	return NewHMACSigner(key, keyID)
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

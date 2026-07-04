package auth

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

func genEd25519PEM(t *testing.T) string {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
}

func TestEdDSASignVerify(t *testing.T) {
	signer, err := NewSigner(genEd25519PEM(t), "ed-1")
	if err != nil {
		t.Fatal(err)
	}
	uid := uuid.New()
	tok, err := signer.Sign(uid, dbgen.UserRoleSUPERADMIN, "a@x.edu", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := signer.Verify(tok)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != uid.String() || claims.Role != dbgen.UserRoleSUPERADMIN {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}

// TestAlgorithmConfusionRejected is the key security property: a verifier must
// reject a token signed with a different algorithm (the classic JWT alg-confusion
// attack, §9.1 / OWASP A02).
func TestAlgorithmConfusionRejected(t *testing.T) {
	ed, err := NewSigner(genEd25519PEM(t), "ed-1")
	if err != nil {
		t.Fatal(err)
	}
	hmac, err := NewSigner("a-dev-hmac-signing-key-long-enough", "h-1")
	if err != nil {
		t.Fatal(err)
	}
	uid := uuid.New()
	hmacTok, _ := hmac.Sign(uid, dbgen.UserRoleREQUESTER, "a@x.edu", time.Minute)
	edTok, _ := ed.Sign(uid, dbgen.UserRoleREQUESTER, "a@x.edu", time.Minute)

	if _, err := ed.Verify(hmacTok); err == nil {
		t.Fatal("EdDSA verifier must reject an HMAC-signed token")
	}
	if _, err := hmac.Verify(edTok); err == nil {
		t.Fatal("HMAC verifier must reject an EdDSA-signed token")
	}
}

func TestNewSignerSelectsByKeyMaterial(t *testing.T) {
	s, err := NewSigner(genEd25519PEM(t), "k")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := s.(*edDSASigner); !ok {
		t.Fatalf("PEM key should select EdDSA, got %T", s)
	}
	h, err := NewSigner("not-a-pem-just-raw-bytes-long-enough", "k")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := h.(*hmacSigner); !ok {
		t.Fatalf("non-PEM key should select HMAC, got %T", h)
	}
}

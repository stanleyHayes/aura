package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/aura/cbs/internal/platform/db/dbgen"
)

var testParams = Argon2Params{MemoryKiB: 16384, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple", testParams)
	if err != nil {
		t.Fatal(err)
	}
	ok, err := VerifyPassword("correct horse battery staple", hash)
	if err != nil || !ok {
		t.Fatalf("verify correct = %v, %v; want true", ok, err)
	}
	ok, _ = VerifyPassword("wrong", hash)
	if ok {
		t.Fatal("verify wrong password must be false")
	}
}

func TestVerifyPasswordRejectsMalformed(t *testing.T) {
	for _, bad := range []string{"", "plaintext", "$argon2id$bad", "$bcrypt$x$y$z$a$b"} {
		if ok, err := VerifyPassword("x", bad); ok || err == nil {
			t.Errorf("VerifyPassword(%q) should error and be false", bad)
		}
	}
}

func TestOpaqueTokenHashStable(t *testing.T) {
	raw, hash, err := NewOpaqueToken()
	if err != nil {
		t.Fatal(err)
	}
	if raw == "" || hash == "" || raw == hash {
		t.Fatal("expected distinct non-empty raw and hash")
	}
	if HashToken(raw) != hash {
		t.Fatal("HashToken must be deterministic for the same input")
	}
	raw2, _, _ := NewOpaqueToken()
	if raw2 == raw {
		t.Fatal("tokens must be unique")
	}
}

func TestJWTSignVerify(t *testing.T) {
	signer, err := NewHMACSigner("dev-test-key-which-is-long-enough", "k1")
	if err != nil {
		t.Fatal(err)
	}
	uid := uuid.New()
	tok, err := signer.Sign(uid, dbgen.UserRoleADMIN, "a@x.edu", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := signer.Verify(tok)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != uid.String() || claims.Role != dbgen.UserRoleADMIN || claims.Email != "a@x.edu" {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}

func TestJWTRejectsTamperedAndExpired(t *testing.T) {
	signer, _ := NewHMACSigner("dev-test-key-which-is-long-enough", "k1")
	uid := uuid.New()
	tok, _ := signer.Sign(uid, dbgen.UserRoleREQUESTER, "a@x.edu", time.Minute)
	if _, err := signer.Verify(tok + "x"); err == nil {
		t.Fatal("tampered token must fail")
	}
	// A different key must reject a token signed with the original.
	other, _ := NewHMACSigner("a-completely-different-signing-key", "k2")
	if _, err := other.Verify(tok); err == nil {
		t.Fatal("token verified under wrong key")
	}
	// Expired token.
	expired, _ := signer.Sign(uid, dbgen.UserRoleREQUESTER, "a@x.edu", -time.Minute)
	if _, err := signer.Verify(expired); err == nil {
		t.Fatal("expired token must fail")
	}
}

func TestAESGCMRoundTrip(t *testing.T) {
	a, err := NewAESGCM("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=") // 32 bytes b64
	if err != nil {
		t.Fatal(err)
	}
	ct, err := a.Encrypt([]byte("totp-secret"))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := a.Decrypt(ct)
	if err != nil || string(pt) != "totp-secret" {
		t.Fatalf("decrypt = %q, %v", pt, err)
	}
	if _, err := a.Decrypt([]byte("short")); err == nil {
		t.Fatal("decrypt of garbage must fail")
	}
}

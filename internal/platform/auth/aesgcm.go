package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

// AESGCM encrypts/decrypts small secrets at rest (e.g. TOTP secrets; §9.1, §14 A02).
// The key is a base64-encoded 32-byte (AES-256) key from the secret manager.
type AESGCM struct{ aead cipher.AEAD }

func NewAESGCM(keyB64 string) (*AESGCM, error) {
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil {
		key = []byte(keyB64)
	}
	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be 16/24/32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &AESGCM{aead: aead}, nil
}

// Encrypt returns nonce||ciphertext.
func (a *AESGCM) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, a.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return a.aead.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt reverses Encrypt.
func (a *AESGCM) Decrypt(data []byte) ([]byte, error) {
	ns := a.aead.NonceSize()
	if len(data) < ns {
		return nil, errors.New("ciphertext too short")
	}
	return a.aead.Open(nil, data[:ns], data[ns:], nil)
}

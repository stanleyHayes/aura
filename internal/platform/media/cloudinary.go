// Package media owns server-side media uploads. Browser clients upload local
// files to the API; the API signs and forwards them to Cloudinary.
package media

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aura/cbs/internal/platform/apperr"
)

const defaultCloudinaryFolder = "aura/catalogue"

type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
	Folder    string
}

type Cloudinary struct {
	cfg    CloudinaryConfig
	client *http.Client
	log    *slog.Logger
}

type UploadImageInput struct {
	Filename    string
	ContentType string
	Reader      io.Reader
}

type ImageAsset struct {
	URL      string `json:"url"`
	PublicID string `json:"public_id"`
}

func NewCloudinary(cfg CloudinaryConfig, log *slog.Logger) *Cloudinary {
	if strings.TrimSpace(cfg.Folder) == "" {
		cfg.Folder = defaultCloudinaryFolder
	}
	return &Cloudinary{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
		log:    log,
	}
}

func (c *Cloudinary) UploadImage(ctx context.Context, in UploadImageInput) (ImageAsset, error) {
	if c == nil || !c.configured() {
		return ImageAsset{}, apperr.ErrMediaNotConfigured.WithDetail("set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET before uploading images")
	}
	if in.Reader == nil {
		return ImageAsset{}, apperr.ErrValidation.WithDetail("image file is required")
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"folder":    c.cfg.Folder,
		"timestamp": timestamp,
	}
	signature := c.sign(params)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", in.Filename)
	if err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.Wrapping(err)
	}
	if _, err := io.Copy(part, in.Reader); err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.WithDetail("could not read image file").Wrapping(err)
	}
	fields := map[string]string{
		"api_key":   c.cfg.APIKey,
		"folder":    c.cfg.Folder,
		"timestamp": timestamp,
		"signature": signature,
	}
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			return ImageAsset{}, apperr.ErrMediaUploadFailed.Wrapping(err)
		}
	}
	if err := writer.Close(); err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.Wrapping(err)
	}

	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", c.cfg.CloudName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.Wrapping(err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if in.ContentType != "" {
		req.Header.Set("X-Aura-Source-Content-Type", in.ContentType)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.Wrapping(err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		if c.log != nil {
			c.log.Warn("cloudinary upload failed", "status", res.StatusCode, "body", string(msg))
		}
		return ImageAsset{}, apperr.ErrMediaUploadFailed.WithDetail("Cloudinary returned HTTP %d", res.StatusCode)
	}

	var out struct {
		SecureURL string `json:"secure_url"`
		PublicID  string `json:"public_id"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.WithDetail("invalid Cloudinary response").Wrapping(err)
	}
	if out.SecureURL == "" || out.PublicID == "" {
		return ImageAsset{}, apperr.ErrMediaUploadFailed.WithDetail("Cloudinary response did not include image metadata")
	}
	return ImageAsset{URL: out.SecureURL, PublicID: out.PublicID}, nil
}

func (c *Cloudinary) configured() bool {
	return strings.TrimSpace(c.cfg.CloudName) != "" &&
		strings.TrimSpace(c.cfg.APIKey) != "" &&
		strings.TrimSpace(c.cfg.APISecret) != ""
}

func (c *Cloudinary) sign(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}
	payload := strings.Join(parts, "&") + c.cfg.APISecret
	// #nosec G401 -- Cloudinary's signed upload API requires SHA-1 signatures.
	sum := sha1.Sum([]byte(payload))
	return hex.EncodeToString(sum[:])
}

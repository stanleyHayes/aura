package catalogue

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"

	"github.com/aura/cbs/internal/platform/apperr"
	"github.com/aura/cbs/internal/platform/httpx"
	"github.com/aura/cbs/internal/platform/media"
)

const (
	maxCatalogueImageUploadBytes = 40 << 20
	maxCatalogueGalleryImages    = 12
)

func (h *Handler) uploadBuildingImages(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	main, gallery, err := h.uploadCatalogueImages(w, r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	building, err := h.svc.UpdateBuildingImages(r.Context(), id, main, gallery)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "building.images", building.ID, building)
	httpx.JSON(w, http.StatusOK, building)
}

func (h *Handler) uploadRoomImages(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	main, gallery, err := h.uploadCatalogueImages(w, r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	room, err := h.svc.UpdateRoomImages(r.Context(), id, main, gallery)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "room.images", room.ID, room)
	httpx.JSON(w, http.StatusOK, room)
}

func (h *Handler) uploadEquipmentImages(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	main, gallery, err := h.uploadCatalogueImages(w, r)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	equipment, err := h.svc.UpdateEquipmentImages(r.Context(), id, main, gallery)
	if err != nil {
		httpx.Error(w, r, h.log, err)
		return
	}
	h.record(r, "UPDATE", "equipment.images", equipment.ID, equipment)
	httpx.JSON(w, http.StatusOK, equipment)
}

func (h *Handler) uploadCatalogueImages(w http.ResponseWriter, r *http.Request) (*ImageAssetInput, []ImageAssetInput, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxCatalogueImageUploadBytes)
	// #nosec G120 -- body size is capped by MaxBytesReader above.
	if err := r.ParseMultipartForm(maxCatalogueImageUploadBytes); err != nil {
		return nil, nil, apperr.ErrValidation.WithDetail("invalid multipart image form: %v", err)
	}
	if r.MultipartForm == nil {
		return nil, nil, apperr.ErrValidation.WithDetail("multipart image form is required")
	}

	files := r.MultipartForm.File
	mainHeaders := files["main"]
	galleryHeaders := append([]*multipart.FileHeader{}, files["gallery"]...)
	galleryHeaders = append(galleryHeaders, files["gallery[]"]...)

	if len(mainHeaders) == 0 && len(galleryHeaders) == 0 {
		return nil, nil, apperr.ErrValidation.WithDetail("upload a main image or at least one gallery image")
	}
	if len(galleryHeaders) > maxCatalogueGalleryImages {
		return nil, nil, apperr.ErrValidation.WithDetail("gallery uploads are limited to %d images at a time", maxCatalogueGalleryImages)
	}

	var main *ImageAssetInput
	if len(mainHeaders) > 0 {
		asset, err := h.uploadOneImage(r, mainHeaders[0])
		if err != nil {
			return nil, nil, err
		}
		main = &asset
	}

	gallery := make([]ImageAssetInput, 0, len(galleryHeaders))
	for _, header := range galleryHeaders {
		asset, err := h.uploadOneImage(r, header)
		if err != nil {
			return nil, nil, err
		}
		gallery = append(gallery, asset)
	}
	return main, gallery, nil
}

func (h *Handler) uploadOneImage(r *http.Request, header *multipart.FileHeader) (ImageAssetInput, error) {
	file, err := header.Open()
	if err != nil {
		return ImageAssetInput{}, apperr.ErrValidation.WithDetail("could not open image %q", header.Filename)
	}
	defer func() { _ = file.Close() }()

	data, err := io.ReadAll(file)
	if err != nil {
		return ImageAssetInput{}, apperr.ErrValidation.WithDetail("could not read image %q", header.Filename)
	}
	if len(data) == 0 {
		return ImageAssetInput{}, apperr.ErrValidation.WithDetail("image %q is empty", header.Filename)
	}
	contentType := http.DetectContentType(data)
	if !isAllowedImageType(contentType) {
		return ImageAssetInput{}, apperr.ErrValidation.WithFields(apperr.FieldError{
			Field:   "file",
			Message: "upload JPEG, PNG, WebP or GIF images only",
		})
	}

	asset, err := h.uploads.UploadImage(r.Context(), media.UploadImageInput{
		Filename:    filepath.Base(header.Filename),
		ContentType: contentType,
		Reader:      bytes.NewReader(data),
	})
	if err != nil {
		return ImageAssetInput{}, err
	}
	return ImageAssetInput{URL: asset.URL, PublicID: asset.PublicID}, nil
}

func isAllowedImageType(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/webp", "image/gif":
		return true
	default:
		return false
	}
}

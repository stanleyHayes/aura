# Single runtime image for Render holding all three binaries (api, worker,
# migrate). The api service runs /api (default) and self-migrates on boot when
# AUTO_MIGRATE=true (embedded goose); /worker and /migrate stay available for
# paid tiers that prefer a separate worker / pre-deploy step. Distroless static
# + nonroot (§14, §17).
FROM golang:1.26.4-alpine AS build
RUN apk add --no-cache git
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
COPY --from=build /out/worker /worker
COPY --from=build /out/migrate /migrate
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/api"]

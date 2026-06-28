# ADR-0010: Ingress — Traefik over Caddy

**Status:** Accepted
**Date:** 2026-06-28

## Context

§18.2 specifies "Caddy or Traefik with automatic Let's Encrypt (cert-manager on
K8s), HTTP→HTTPS redirect, HSTS." Having chosen Kubernetes (ADR-0006), we need
one ingress controller for the Helm chart's Ingress, TLS, redirect and the §14
security headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`).

## Decision

Use **Traefik** as the default ingress controller, with cert-manager issuing
certificates.

Reasons:

- **Native security-header + redirect middleware.** Traefik's `Middleware` CRD
  expresses HTTP→HTTPS redirect, HSTS (`stsSeconds`/`stsPreload`) and the §14
  response headers declaratively, referenced from the Ingress via annotation.
  This keeps edge security in the chart and reviewable as code.
- **cert-manager pairing.** On Kubernetes the spec wants cert-manager for ACME
  (not the ingress's own ACME), and Traefik integrates cleanly with
  cert-manager-issued Secrets and standard `networking.k8s.io/Ingress`.
- **First-class CRDs and metrics** that fit the Grafana/Prometheus stack (§15).

Caddy remains a valid alternative (its automatic-HTTPS and header ergonomics are
excellent) but is more commonly run as a standalone reverse proxy than as a
Kubernetes ingress controller with cert-manager; choosing one keeps the chart
focused.

The chart is **not hard-wired** to Traefik: `ingress.className` is a value, the
Traefik `Middleware` objects render only when `className == "traefik"`, and the
cert-manager `ClusterIssuer` annotation is generic. Switching to Caddy/nginx
means setting a different class and equivalent annotations.

## Consequences

- Traefik must be installed in the cluster (a prerequisite alongside
  cert-manager).
- The HSTS/redirect/security-header policy lives in `templates/ingress.yaml` as
  Traefik `Middleware`; the application/edge still sets the nonce-based CSP (§14),
  which is intentionally **not** duplicated at ingress.
- An institution standardised on nginx-ingress or Caddy overrides
  `ingress.className` and supplies matching annotations; no application change.

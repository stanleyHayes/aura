# ADR-0006: Kubernetes (Helm) over a managed container platform

**Status:** Accepted
**Date:** 2026-06-28

## Context

§18.2 permits either Kubernetes (a Helm chart) **or** a managed container
platform "if K8s is overkill for the institution", and requires the choice to be
recorded in an ADR. The deployment topology (§5.4, §18.2) is two stateless
workloads — the API (≥2 replicas, HPA on CPU/RPS) and the River worker — fronted
by ingress with cert-manager TLS, plus managed PostgreSQL, Redis/Valkey and S3.

Options considered:

1. **Kubernetes + Helm** (e.g. EKS/GKE/AKS or an on-prem cluster).
2. **Managed container platform** (e.g. ECS/Fargate, Cloud Run, App Runner,
   Fly.io, Render).
3. **A single VM with Docker Compose / systemd.**

## Decision

Target **Kubernetes via a Helm chart** (`deploy/helm/cbs`) as the reference
production platform, while keeping the workloads platform-portable (plain
stateless containers, config from env, health endpoints) so a managed platform
remains a viable fallback for a small institution.

Reasons:

- The spec's own primitives map 1:1 onto Kubernetes objects already required:
  Deployment, Service, **HPA on CPU and RPS** (§18.2), readiness/liveness probes
  on `/readyz`/`/healthz` (§15), Ingress with **cert-manager** TLS and HSTS
  (§18.2), NetworkPolicy and a **ServiceMonitor** for the Grafana/Prometheus
  stack (§15). A managed platform supports some of these but not the
  Prometheus-Operator `ServiceMonitor` nor `NetworkPolicy` natively.
- The observability stack is explicitly **Grafana/Prometheus/Loki/Tempo** (§15),
  which is operated most naturally in-cluster (kube-prometheus-stack).
- PodDisruptionBudget + rolling, health-gated cutover with automatic rollback
  (§17 step 6) are first-class on Kubernetes.
- Institutions running a university estate frequently already operate a cluster;
  a Helm chart drops into existing GitOps.

We do **not** create the cluster in Terraform; it is referenced
(`modules/kubernetes`) so cluster lifecycle stays with the platform team.

## Consequences

- Higher baseline operational complexity than a managed PaaS; mitigated by using
  managed data stores (ADR-0008) so the cluster runs only stateless workloads.
- The chart depends on a few cluster add-ons: an ingress controller (ADR-0010),
  cert-manager, external-secrets, and the Prometheus Operator. These are
  documented as prerequisites.
- Because workloads stay portable, an institution for whom K8s is genuinely
  overkill can run the same images on a managed platform; only `deploy/helm`
  would be replaced, not the application.

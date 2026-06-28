# Runbook: SLOs, error budgets & alert catalogue

Reference for the service-level objectives and every alert that pages on-call
(spec §15). Use this to understand what an alert means and which runbook to open.

## Service-level objectives

| SLO | Target | Source |
|---|---|---|
| Availability | 99.5% monthly | NFR / §15 |
| Availability-search latency | p95 < 300 ms | §12.4, §15 |
| Booking-approval latency (non-conflict) | p95 < 500 ms | §15 |
| Successful booking-approval rate (non-conflict) | ≥ 99% | §7.4 |

**Error budget.** 99.5% availability = ~3 h 39 m of unavailability per 30 days.
Burn is tracked in Grafana. When >50% of the monthly budget is consumed, freeze
risky rollouts and prioritise reliability work.

## Golden signals

- **RED** per endpoint: request **R**ate, **E**rror rate, **D**uration (p50/p95/p99).
- **USE** per resource: **U**tilisation, **S**aturation, **E**rrors (CPU, memory,
  DB connections, Redis, disk).
- **Domain metrics:** bookings created/approved/rejected, import success rate,
  availability-query latency, job-queue depth/lag.

## Alert catalogue

Each alert names: condition, severity, the likely cause, and the runbook to open.
Thresholds are starting points — tune against observed baselines.

### 1. Error-rate SLO burn (multi-window, multi-burn-rate)

- **Condition:** fast burn — error ratio > 14.4× budget over 5 min AND 1 h
  windows; slow burn — > 3× over 1 h AND 6 h windows.
- **Severity:** fast = page; slow = ticket.
- **Likely cause:** bad deploy, dependency outage (DB/Redis), unhandled panic.
- **Action:** check the most recent deploy; `helm rollback cbs` if correlated;
  inspect Sentry for the top error; check `/readyz`. See `db-failover.md` /
  `stuck-job-queue.md` if a dependency is implicated.

```promql
# Fast-burn signal (5m window). Pair with a 1h window in the alert rule.
(
  sum(rate(http_requests_total{code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
) > (14.4 * 0.005)
```

### 2. p95 latency breach

- **Condition:** `availability-search` p95 > 300 ms for 10 min, OR
  `booking-approval` p95 > 500 ms for 10 min.
- **Severity:** page if sustained > 15 min.
- **Likely cause:** replica lag, missing index, connection-pool saturation,
  noisy neighbour, cold cache.
- **Action:** check DB connection saturation and replica lag (alerts 3 & 4);
  inspect Tempo traces for the slow span; check Redis hit rate.

```promql
histogram_quantile(0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket{route="/availability/search"}[5m]))
) > 0.3
```

### 3. DB connection saturation

- **Condition:** active connections / max connections > 85% for 5 min.
- **Severity:** page.
- **Likely cause:** pool misconfiguration, leaked connections, traffic spike,
  long-running queries.
- **Action:** check pgx pool metrics and PgBouncer; identify long-running queries
  (`pg_stat_activity`); scale the API HPA cautiously (more pods = more
  connections). See `db-failover.md` if the primary is unhealthy.

```promql
(sum(pg_stat_activity_count) / max(pg_settings_max_connections)) > 0.85
```

### 4. Replica lag

- **Condition:** replication lag > 30 s for 5 min.
- **Severity:** warn at 30 s, page at 120 s.
- **Action:** open `replica-lag.md`. Reads may be temporarily routed to the
  primary if lag risks stale availability data.

```promql
pg_replication_lag_seconds > 30
```

### 5. Job-queue backlog

- **Condition:** River queue depth > 500 OR oldest-job age > 5 min for 10 min.
- **Severity:** page.
- **Likely cause:** worker crash-loop, poison job, downstream (mail/S3) failure.
- **Action:** open `stuck-job-queue.md`.

```promql
river_jobs_available_total > 500
or
max(river_job_oldest_available_age_seconds) > 300
```

### 6. Auth-failure spike (anomaly)

- **Condition:** failed-login rate > 5× the 1-hour baseline for 5 min, OR
  lockout events > N/min.
- **Severity:** page (security).
- **Likely cause:** credential-stuffing/brute force, broken auth deploy.
- **Action:** confirm rate limiting and lockout are engaging (§14); check source
  IP distribution; consider tightening WAF/rate limits; raise a security
  incident if a breach is suspected. Never disable lockout to "fix" the alert.

```promql
sum(rate(auth_login_failures_total[5m]))
  > 5 * sum(rate(auth_login_failures_total[1h] offset 1h))
```

### 7. Certificate expiry

- **Condition:** TLS cert valid-for < 14 days (warn) / < 3 days (page).
- **Likely cause:** cert-manager renewal failure, ACME rate limit, DNS-01
  challenge failure.
- **Action:** `kubectl get certificate,certificaterequest,order,challenge -A`;
  inspect cert-manager logs; verify the ClusterIssuer and DNS.

```promql
(probe_ssl_earliest_cert_expiry - time()) / 86400 < 14
```

### 8. Resource saturation (USE)

- **Condition:** pod CPU > 90% throttled, memory > 90% of limit (OOM risk),
  node disk > 85%, for 10 min.
- **Action:** check HPA scaling headroom; review recent traffic; raise limits or
  `maxReplicas` if the baseline has shifted. Memory near the limit risks OOMKill.

## After any incident

- Confirm SLO dashboards recovered and the error budget burn has stopped.
- File a brief post-incident note (timeline, cause, fix, follow-ups).
- Update the relevant runbook if the response steps were wrong or incomplete
  (§19.2 Definition of Done).

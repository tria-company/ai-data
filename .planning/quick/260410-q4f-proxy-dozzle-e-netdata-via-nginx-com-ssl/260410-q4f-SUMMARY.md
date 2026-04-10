---
phase: quick-260410-q4f
plan: 01
subsystem: infra/reverse-proxy
tags: [nginx, dozzle, netdata, ssl, reverse-proxy, websocket]
dependency_graph:
  requires:
    - nginx/default.conf (HTTPS server block with letsencrypt certs)
    - docker-compose.yml (scraper-net network with dozzle + netdata)
  provides:
    - HTTPS path-based routing for Dozzle under /logs/
    - HTTPS path-based routing for Netdata under /netdata/
    - WebSocket upgrade support for Dozzle live log streaming
  affects:
    - nginx container (adds upstreams dozzle, netdata)
    - dozzle container (serves UI under /logs base path)
tech_stack:
  added: []
  patterns:
    - nginx map $http_upgrade $connection_upgrade for WebSocket proxying
    - nginx regex location with named capture for Netdata subpath
    - DOZZLE_BASE env var for Dozzle subpath-aware asset generation
key_files:
  created: []
  modified:
    - nginx/default.conf
    - docker-compose.yml
decisions:
  - Path-based routing (not subdomain) to reuse existing non-wildcard cert for aidata.devops-apogeu.uk
  - Preserve ports 9999 and 19999 for IP fallback per user requirement
  - DOZZLE_BASE=/logs means port 9999 fallback also uses /logs path (acceptable tradeoff)
  - depends_on without healthcheck condition — only startup order needed
metrics:
  duration: ~2 minutes
  completed: 2026-04-10
requirements_completed:
  - Q4F-01
  - Q4F-02
  - Q4F-03
  - Q4F-04
  - Q4F-05
---

# Quick Task 260410-q4f: Proxy Dozzle and Netdata via nginx with SSL — Summary

Extended the existing HTTPS reverse proxy to serve Dozzle at `/logs/` and Netdata at `/netdata/` under the same TLS certificate, resolving the `ERR_SSL_PROTOCOL_ERROR` HSTS problem on ports 9999 and 19999. Uses standard nginx WebSocket upgrade pattern for Dozzle live streaming and the documented Netdata regex-capture pattern.

## What Changed

### `nginx/default.conf`

- Added top-level `map $http_upgrade $connection_upgrade` block (required in `http` scope, sits above all `server {}` blocks) so Dozzle's WebSocket upgrade is handled cleanly.
- Inside the HTTPS server block, added three new location blocks **before** the existing `location /`:
  - `location /logs/` → `proxy_pass http://dozzle:8080/` with WebSocket upgrade headers, `proxy_buffering off`, and `proxy_read_timeout 3600s` for long-lived log streams. Trailing slash on `proxy_pass` strips the `/logs/` prefix before forwarding.
  - `location = /netdata` → 301 redirect to `/netdata/` (so the bare path works).
  - `location ~ /netdata/(?<ndpath>.*)` → `proxy_pass http://netdata:19999/$ndpath$is_args$args` using the official Netdata reverse-proxy pattern (regex capture + query string preservation, no trailing slash allowed with regex).
- **Preserved unchanged**: HSTS header, existing `location /` proxying to `http://app:3000`, HTTP:80 server block with `/.well-known/acme-challenge/`, SSL protocols, cipher list, certificate paths.

### `docker-compose.yml`

- Added `environment: [DOZZLE_BASE=/logs]` to the `dozzle` service. This tells Dozzle to generate UI assets and WebSocket endpoints under `/logs`, which combined with nginx's trailing-slash `proxy_pass` gives the standard "Dozzle behind reverse proxy on a subpath" pattern.
- Added `dozzle` and `netdata` to `nginx.depends_on` (previously only `- app`) so the upstreams exist before nginx starts and can resolve via Docker's embedded DNS on `scraper-net`.
- **Preserved unchanged**: port mappings `"9999:8080"` (Dozzle) and `"19999:19999"` (Netdata) for IP fallback per user requirement; all other services (app, redis, browserless, workers); nginx letsencrypt/certbot volume mounts; netdata `cap_add`/`security_opt`; networks; restart policies.

## Verification

**Task 1 — nginx config:**
```
docker run --rm --entrypoint sh -v "$(pwd)/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine -c '
  echo "127.0.0.1 app dozzle netdata" >> /etc/hosts
  mkdir -p /etc/letsencrypt/live/aidata.devops-apogeu.uk
  apk add --no-cache openssl
  openssl req -x509 -newkey rsa:2048 -nodes -keyout .../privkey.pem -out .../fullchain.pem -days 1 -subj "/CN=test"
  nginx -t
'
```
Result: `nginx: the configuration file /etc/nginx/nginx.conf syntax is ok` + `test is successful`.

(A plain `nginx -t` without host overrides fails at config load time because nginx resolves `proxy_pass` upstreams at startup and `app`/`dozzle`/`netdata` only exist inside the `scraper-net` Docker network on the VPS. Adding dummy `/etc/hosts` entries and a throwaway self-signed cert is the standard local-test workaround — the syntax itself is valid.)

**Task 2 — docker-compose:**
- `docker compose config --quiet` → exit 0 (YAML + schema valid, after a temporary empty `.env` to satisfy `env_file` declarations on `app`/workers).
- `grep -q "DOZZLE_BASE=/logs" docker-compose.yml` → match.
- `grep -q '"9999:8080"' docker-compose.yml` → match (IP fallback preserved).
- `grep -q '"19999:19999"' docker-compose.yml` → match (IP fallback preserved).
- `nginx.depends_on` includes `app`, `dozzle`, `netdata`.

## Commits

- `9664473` — feat(quick-260410-q4f): add nginx location blocks for Dozzle and Netdata
- `e03b9b7` — feat(quick-260410-q4f): wire Dozzle DOZZLE_BASE and nginx depends_on

## Deviations from Plan

None — plan executed exactly as written.

The only minor wrinkle was the local `nginx -t` verification harness: the plan's command (plain `docker run --rm -v ... nginx:alpine nginx -t`) fails at upstream resolution when run standalone because nginx tries to resolve `app`, `dozzle`, `netdata` DNS names at config-load time and those only exist inside the live `scraper-net` bridge. This is a test-time artifact, not a config bug — syntax is valid, as proven by the workaround that injects dummy hosts + a self-signed cert. On the VPS, nginx runs as a member of `scraper-net` and resolves all three upstreams via Docker's embedded DNS, so the config works correctly in production.

## VPS Deployment Steps (for the user)

1. `cd /path/to/ai-data && git pull`
2. `docker compose up -d` — nginx, dozzle restart; netdata unaffected unless container missed a pull
3. `docker compose logs nginx --tail 30` — confirm no upstream resolution errors
4. Browser: `https://aidata.devops-apogeu.uk/logs/` → Dozzle UI with live log streaming
5. Browser: `https://aidata.devops-apogeu.uk/netdata/` → Netdata dashboard
6. Fallbacks still work:
   - `http://85.155.186.107:9999/logs/` (note: Dozzle UI now lives under `/logs/` on the raw port too because of `DOZZLE_BASE`)
   - `http://85.155.186.107:19999/` (Netdata unchanged on raw port)
7. App unaffected at `https://aidata.devops-apogeu.uk/`

## Self-Check: PASSED

- `nginx/default.conf` FOUND — modified with new map + 3 location blocks
- `docker-compose.yml` FOUND — modified with DOZZLE_BASE env var + depends_on
- Commit `9664473` FOUND in git log
- Commit `e03b9b7` FOUND in git log
- HSTS header preserved (verified in file read)
- Existing `location /` for Next.js app preserved (verified in file read)
- HTTP:80 acme-challenge block preserved (verified in file read)
- Port mappings 9999:8080 and 19999:19999 preserved (verified via grep)

---
phase: quick-260410-ovc
plan: 01
subsystem: infra
tags: [nginx, ssl, letsencrypt, docker-compose, https, acme]

requires:
  - phase: quick-260410-nf7
    provides: prior stable VPS deploy baseline
provides:
  - SSL-enabled nginx config in git matching VPS reality (md5 08fa21755d71429c41b83a1d2db19ecf)
  - nginx container bind mounts for /etc/letsencrypt and /var/www/certbot
  - HTTP->HTTPS 301 redirect with /.well-known/acme-challenge passthrough for cert renewal
affects: [future VPS deploy tasks, cert renewal automation, Bull Board HTTPS access]

tech-stack:
  added: []
  patterns:
    - nginx conf edited verbatim-from-VPS when drift is discovered
    - Additive-only docker-compose edits for bind mounts (no reorder, no rename)

key-files:
  created: []
  modified:
    - nginx/default.conf
    - docker-compose.yml

key-decisions:
  - "Replace nginx/default.conf entirely (byte-for-byte) with the VPS version instead of re-deriving it — VPS is canonical truth"
  - "Additive-only docker-compose.yml edit: 2 insertions, 0 deletions, no key reorders"
  - "docker-compose.override.yml left untouched per scope constraint"

patterns-established:
  - "Config drift fix: when VPS has been edited in place, copy VPS file verbatim into git (md5-verified) rather than patching the git version"
  - "Bind mounts for host-managed secrets (letsencrypt) use :ro and point at the real host path"

requirements-completed: [OVC-01, OVC-02]

duration: ~5min
completed: 2026-04-10
---

# Quick Task 260410-ovc: Fix Nginx SSL + Letsencrypt Mounts Summary

**SSL-enabled nginx config synced from VPS into git (md5 08fa21755d71429c41b83a1d2db19ecf) and letsencrypt/certbot bind mounts added to docker-compose.yml nginx service**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-10T21:05:00Z
- **Completed:** 2026-04-10T21:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Eliminated config drift between git and VPS: `nginx/default.conf` in git is now byte-identical to `/root/ai-data/nginx/default.conf` running on VPS (md5 verified `08fa21755d71429c41b83a1d2db19ecf`, 46 lines).
- Nginx now has an HTTP->HTTPS 301 redirect server block with `/.well-known/acme-challenge/` passthrough for future cert renewals, plus an HTTPS server block with TLS 1.2/1.3, HSTS (1y), and proxy_pass to `app:3000`.
- Added two additive read-only bind mounts to the nginx service in `docker-compose.yml`: `/etc/letsencrypt:/etc/letsencrypt:ro` and `/var/www/certbot:/var/www/certbot:ro`. Nginx container will now be able to read Let's Encrypt certs issued on the host and break out of the crash loop.
- Change set is exactly two files with zero collateral edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace nginx/default.conf with VPS SSL-enabled version (verbatim)** — `bd319e7` (fix)
2. **Task 2: Add letsencrypt + certbot webroot mounts to nginx service** — `42f2391` (fix)

## Files Created/Modified

- `nginx/default.conf` — Replaced entirely. Was 17 lines (HTTP-only, proxy to app:3000). Now 46 lines: HTTP->HTTPS 301 redirect with ACME challenge passthrough + HTTPS server block (TLS 1.2/1.3, HIGH ciphers, HSTS 1y, proxy_pass to app:3000 with WebSocket upgrade headers). MD5 `08fa21755d71429c41b83a1d2db19ecf`.
- `docker-compose.yml` — Additive only. Two lines inserted into the `services.nginx.volumes` list between the existing `./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro` mount and the `depends_on:` key. No other services, keys, or list items touched. `git diff --stat`: `1 file changed, 2 insertions(+)`.

### Exact diffs applied

**nginx/default.conf** — full file replacement. Final content (46 lines):

```
# HTTP -> HTTPS (mantém /.well-known/acme-challenge para renovação futura)
server {
    listen 80;
    server_name aidata.devops-apogeu.uk;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    http2 on;
    server_name aidata.devops-apogeu.uk;

    ssl_certificate     /etc/letsencrypt/live/aidata.devops-apogeu.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aidata.devops-apogeu.uk/privkey.pem;

    # SSL hardening básico
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS (1 ano). CUIDADO: navegadores vão lembrar e exigir HTTPS por 1 ano.
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Proxy para o app Next.js
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**docker-compose.yml** — additive diff (2 insertions, 0 deletions):

```diff
@@ -80,6 +80,8 @@ services:
       - "443:443"
     volumes:
       - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
+      - /etc/letsencrypt:/etc/letsencrypt:ro
+      - /var/www/certbot:/var/www/certbot:ro
     depends_on:
       - app
     networks:
```

Confirmation: change is additive-only — 2 lines added, 0 removed, no reorders, no other service/key touched.

## Verification Performed

All plan-mandated checks executed locally on this dev Mac:

| Check | Expected | Actual | Result |
|---|---|---|---|
| `wc -l nginx/default.conf` | 46 | 46 | PASS |
| `grep -c "ssl_certificate" nginx/default.conf` | >= 2 | 2 | PASS |
| `md5 nginx/default.conf` | `08fa21755d71429c41b83a1d2db19ecf` | `08fa21755d71429c41b83a1d2db19ecf` | PASS |
| Task 1 automated verify (listen 443, http2, 301 redirect, proxy_pass, HSTS, fullchain.pem) | all present | all present | PASS |
| `python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"` | parses | parses | PASS |
| `grep -A 20 "^  nginx:" docker-compose.yml \| grep -E "letsencrypt\|certbot"` | both lines | both lines | PASS |
| nginx service volumes list (parsed) | exactly `[default.conf, letsencrypt, certbot]`, all `:ro`, length 3 | exact match | PASS |
| `git diff --stat docker-compose.yml` | `1 file changed, 2 insertions(+)` | `1 file changed, 2 insertions(+)` | PASS |
| `git status --short` post-commit | clean | clean | PASS |

Per constraints, `docker compose up` and `docker compose config` were NOT run locally — VPS verification will happen after `git pull`.

## Decisions Made

- **Verbatim VPS content** — did not re-indent, normalize line endings, or "clean up" the nginx config. The goal is to make git match VPS exactly; any deviation defeats the purpose.
- **Additive-only docker-compose edit** — used `Edit` tool with a precise `old_string`/`new_string` pair touching only the volumes block of the nginx service. No other keys, services, or formatting touched.

## Deviations from Plan

None — plan executed exactly as written. Both tasks executed verbatim against the specified `<action>` blocks, all automated verify commands passed, all constraint sanity checks passed.

## Issues Encountered

- PyYAML was not installed on the host Python 3. Resolved by running `pip3 install pyyaml` (does not affect repo state). Once installed, the plan's YAML parse check ran cleanly.

## VPS Deploy Command

After this branch lands on `main`, run on the VPS (85.155.186.107):

```bash
cd /root/ai-data && \
  git pull && \
  docker compose -f docker-compose.yml up -d nginx && \
  docker compose logs nginx --tail=30
```

Expected post-deploy observations:
- `docker compose ps` — nginx Up, not Restarting
- Logs — no "cannot load certificate" error; "start worker processes"
- `curl -I http://aidata.devops-apogeu.uk/` — 301 to https
- `curl -I https://aidata.devops-apogeu.uk/` — 200 with Strict-Transport-Security header
- Browser — https://aidata.devops-apogeu.uk/admin/queues loads Bull Board UI

## Out of Scope / Follow-ups

- `docker-compose.override.yml` was explicitly NOT touched per scope constraint. If it contains nginx overrides that conflict with these new mounts (e.g. its own `volumes:` list for nginx), a follow-up quick task will be needed to align it. This should be investigated on the VPS by running `docker compose config | grep -A 20 nginx:` after the deploy.
- Cert renewal automation (certbot container or host cron hitting `/.well-known/acme-challenge`) is not yet wired; the nginx config already exposes the ACME challenge path, so a future renewal task just needs to run certbot on the host pointing at `/var/www/certbot` and nginx will serve the challenge.

## Self-Check: PASSED

Files verified to exist:
- FOUND: nginx/default.conf (46 lines, md5 08fa21755d71429c41b83a1d2db19ecf)
- FOUND: docker-compose.yml (nginx service has 3 volumes: default.conf, letsencrypt, certbot)

Commits verified to exist:
- FOUND: bd319e7 (Task 1 — replace nginx/default.conf)
- FOUND: 42f2391 (Task 2 — add letsencrypt + certbot mounts)

---
*Quick task: 260410-ovc*
*Completed: 2026-04-10*

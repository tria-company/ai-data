---
phase: quick-260410-ovc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - nginx/default.conf
  - docker-compose.yml
autonomous: true
requirements:
  - OVC-01
  - OVC-02
must_haves:
  truths:
    - "nginx container starts without 'cannot load certificate' error"
    - "nginx/default.conf in git matches the SSL-enabled version running on the VPS (md5 08fa21755d71429c41b83a1d2db19ecf, 46 lines)"
    - "docker-compose.yml mounts /etc/letsencrypt and /var/www/certbot read-only into the nginx container"
    - "HTTP requests to aidata.devops-apogeu.uk return 301 redirect to HTTPS"
    - "HTTPS requests to aidata.devops-apogeu.uk return 200 with Strict-Transport-Security header"
  artifacts:
    - path: "nginx/default.conf"
      provides: "SSL-enabled nginx config with HTTP->HTTPS redirect and proxy_pass to app:3000"
      contains: "ssl_certificate     /etc/letsencrypt/live/aidata.devops-apogeu.uk/fullchain.pem"
    - path: "docker-compose.yml"
      provides: "nginx service with letsencrypt and certbot webroot mounts"
      contains: "/etc/letsencrypt:/etc/letsencrypt:ro"
  key_links:
    - from: "nginx container"
      to: "/etc/letsencrypt/live/aidata.devops-apogeu.uk/fullchain.pem"
      via: "bind mount from host /etc/letsencrypt"
      pattern: "/etc/letsencrypt:/etc/letsencrypt:ro"
    - from: "nginx/default.conf"
      to: "app:3000"
      via: "proxy_pass on Docker network scraper-net"
      pattern: "proxy_pass http://app:3000"
---

<objective>
Fix the nginx crash loop on the VPS by (1) replacing the stale HTTP-only nginx/default.conf in git with the SSL-enabled version that actually runs on the VPS, and (2) adding the letsencrypt + certbot webroot bind mounts to the nginx service in docker-compose.yml so the container can read the certificates issued on the host.

Purpose: Eliminate the config drift between git and VPS, unblock HTTPS on aidata.devops-apogeu.uk, and restore access to the Next.js app and Bull Board through nginx.

Output: Two modified files, ready for `git pull && docker compose -f docker-compose.yml up -d nginx` on the VPS.
</objective>

<execution_context>
@/Users/igorvboas/Documents/TRIA/ai-data/.claude/get-shit-done/workflows/execute-plan.md
@/Users/igorvboas/Documents/TRIA/ai-data/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@docker-compose.yml
@nginx/default.conf

# Situation
- Host VPS 85.155.186.107 (aidata.devops-apogeu.uk, direct DNS, no Cloudflare proxy).
- Let's Encrypt certs exist on the VPS host at /etc/letsencrypt/live/aidata.devops-apogeu.uk/{fullchain,privkey}.pem (issued 2026-04-08).
- The nginx container is in a crash loop: "cannot load certificate ... /etc/letsencrypt/live/aidata.devops-apogeu.uk/fullchain.pem: No such file or directory" because docker-compose.yml doesn't mount /etc/letsencrypt.
- The file /root/ai-data/nginx/default.conf on the VPS is the SSL-enabled version (46 lines, md5 08fa21755d71429c41b83a1d2db19ecf) but was edited in place and never committed. The repo still has the old HTTP-only version.
- Next.js app on port 3000 is verified healthy inside the Docker network (curl -I localhost:3000 returns 200).
- docker-compose.override.yml is OUT OF SCOPE.

# Current state of files in git
- nginx/default.conf: HTTP-only, 17 lines, proxy_pass http://app:3000, no SSL (will be REPLACED entirely).
- docker-compose.yml nginx service (lines 76-87): has only `- ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro` in volumes. Needs two additional read-only mounts appended. All other keys (image, ports, depends_on, networks, restart) must remain untouched.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace nginx/default.conf with the VPS SSL-enabled version (verbatim)</name>
  <files>nginx/default.conf</files>
  <action>
Completely replace the contents of nginx/default.conf with the exact 46-line SSL-enabled config below. This is byte-identical to the file currently running on the VPS at /root/ai-data/nginx/default.conf (md5 08fa21755d71429c41b83a1d2db19ecf). Do NOT paraphrase, re-indent, reorder, or "improve" anything. Use the Write tool to overwrite the file in one shot.

Exact file content (begins on the next line after the opening fence, ends on the line before the closing fence — do not include the fences themselves in the output file):

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

Notes on the content:
- The very first line is a comment starting with `# HTTP -> HTTPS`.
- The file ends with a closing `}` on its own line (no trailing blank line is required, but one is acceptable — match what appears above).
- Preserve the accented characters (ã, í, á, ó) exactly as UTF-8.
- Preserve the blank line between the two `server { ... }` blocks and the blank lines inside each block exactly as shown.
  </action>
  <verify>
    <automated>test "$(wc -l < nginx/default.conf)" -eq 46 && grep -q "ssl_certificate     /etc/letsencrypt/live/aidata.devops-apogeu.uk/fullchain.pem" nginx/default.conf && grep -q "listen 443 ssl;" nginx/default.conf && grep -q "http2 on;" nginx/default.conf && grep -q "return 301 https://\$host\$request_uri;" nginx/default.conf && grep -q "proxy_pass http://app:3000;" nginx/default.conf && grep -q "Strict-Transport-Security" nginx/default.conf</automated>
  </verify>
  <done>
nginx/default.conf is exactly 46 lines, contains both HTTP->HTTPS redirect and HTTPS server blocks, references /etc/letsencrypt/live/aidata.devops-apogeu.uk/{fullchain,privkey}.pem, proxies to http://app:3000, and includes HSTS header. md5 should match 08fa21755d71429c41b83a1d2db19ecf (optional check: `md5 nginx/default.conf` on macOS or `md5sum nginx/default.conf` on Linux).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add letsencrypt + certbot webroot mounts to nginx service in docker-compose.yml</name>
  <files>docker-compose.yml</files>
  <action>
Edit the `nginx` service in docker-compose.yml (currently at lines 76-87) to add two read-only bind mounts to the existing `volumes:` list. This is an ADDITIVE change only.

Use the Edit tool to replace the existing volumes block of the nginx service:

FIND (exact, including 4-space indentation under the `nginx:` service):
```
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
```

REPLACE WITH:
```
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
```

Constraints — do NOT:
- Touch any other service (app, redis, browserless, profile-worker, post-worker, dozzle, netdata).
- Reorder, rename, or remove any existing keys in the nginx service.
- Change the `./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro` mount.
- Modify the `ports`, `image`, `depends_on`, `networks`, or `restart` keys of the nginx service.
- Add any new services.
- Add trailing whitespace.

The final nginx service block must be exactly (note indentation — 2 spaces for service name, 4 spaces for keys, 6 spaces for list items):

```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - app
    networks:
      - scraper-net
    restart: unless-stopped
```
  </action>
  <verify>
    <automated>grep -q "/etc/letsencrypt:/etc/letsencrypt:ro" docker-compose.yml && grep -q "/var/www/certbot:/var/www/certbot:ro" docker-compose.yml && grep -q "./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" docker-compose.yml && docker compose -f docker-compose.yml config --quiet 2>/dev/null || docker-compose -f docker-compose.yml config --quiet 2>/dev/null || python3 -c "import yaml,sys; d=yaml.safe_load(open('docker-compose.yml')); v=d['services']['nginx']['volumes']; assert './nginx/default.conf:/etc/nginx/conf.d/default.conf:ro' in v; assert '/etc/letsencrypt:/etc/letsencrypt:ro' in v; assert '/var/www/certbot:/var/www/certbot:ro' in v; assert len(v)==3; print('OK')"</automated>
  </verify>
  <done>
docker-compose.yml parses as valid YAML, the nginx service volumes list contains exactly three entries in this order: default.conf, /etc/letsencrypt, /var/www/certbot (all `:ro`). All other services and all other keys of the nginx service are unchanged. `git diff docker-compose.yml` shows only two added lines (the two new volume mounts), with zero deletions.
  </done>
</task>

</tasks>

<verification>
After both tasks complete, run:

1. `wc -l nginx/default.conf` — must print `46`.
2. `grep -c "ssl_certificate" nginx/default.conf` — must print `2`.
3. `grep -A 20 "^  nginx:" docker-compose.yml | grep -E "(letsencrypt|certbot)"` — must show both new mounts.
4. `git diff --stat nginx/default.conf docker-compose.yml` — should show 2 files changed, with nginx/default.conf having ~46 insertions / ~17 deletions and docker-compose.yml having 2 insertions / 0 deletions.
5. YAML parse check: `python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"` — must exit 0.
6. Confirm no other files were modified: `git status --porcelain` should list only `nginx/default.conf` and `docker-compose.yml` (plus any pre-existing unrelated dirty files like `app/admin/login-session/page.tsx`).

Manual UAT on VPS (after `git pull && docker compose -f docker-compose.yml up -d nginx`):
- `docker compose ps` → nginx is Up and stable (not Restarting).
- `docker compose logs nginx --tail=20` → no "cannot load certificate" error; shows "start worker processes".
- `curl -I http://aidata.devops-apogeu.uk/` → HTTP/1.1 301 Moved Permanently, Location: https://...
- `curl -I https://aidata.devops-apogeu.uk/` → HTTP/2 200, Strict-Transport-Security header present.
- Browser: https://aidata.devops-apogeu.uk/admin/queues loads Bull Board UI.
</verification>

<success_criteria>
- nginx/default.conf in git is byte-identical to the 46-line SSL-enabled version currently running on the VPS.
- docker-compose.yml nginx service mounts /etc/letsencrypt and /var/www/certbot read-only, in addition to the existing default.conf mount, with no other changes to the file.
- Both files parse/lint cleanly (YAML valid, nginx config syntactically matches the canonical version).
- Change set is exactly two files, additive/replacement as specified, with no collateral edits.
- After deploy on VPS, nginx serves HTTPS with the Let's Encrypt cert and proxies to the Next.js app.
</success_criteria>

<output>
After completion, create `.planning/quick/260410-ovc-fix-nginx-ssl-mount-letsencrypt-certs-an/260410-ovc-SUMMARY.md` documenting:
- Exact diff applied to each file (or file fully replaced, for nginx/default.conf)
- md5 of the new nginx/default.conf (should be 08fa21755d71429c41b83a1d2db19ecf)
- Confirmation that the change is additive-only in docker-compose.yml (2 lines added, 0 removed, no reorders)
- VPS deploy command to run: `cd /root/ai-data && git pull && docker compose -f docker-compose.yml up -d nginx && docker compose logs nginx --tail=30`
- Reminder that docker-compose.override.yml is still out of scope and should be addressed in a separate quick task
</output>

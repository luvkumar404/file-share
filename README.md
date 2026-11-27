# Secure File Sharing

Private file uploads, ClamAV scanning, Cloudinary authenticated storage, and expiring public shares. Bun/Hono API, PostgreSQL/Prisma, React/Vite frontend.

## Local development

Requires Bun 1.3.14, Node 22.12+ (or a newer supported Node 22 release), PostgreSQL 16, and ClamAV with current signatures. Node alone cannot run the backend: password hashing and the server use Bun APIs.

1. Copy `backend/.env.example` to `backend/.env`. Set database credentials, real Cloudinary credentials, and a cryptographically random JWT secret of at least 32 characters. Set `FRONTEND_URL=http://localhost:5173`.
2. In `backend`, run `bun install --frozen-lockfile`, `bun run db:generate`, then `bun run db:deploy` against an **empty** database. Run `bun run dev` (port 8000).
3. In `frontend`, run `npm ci` and `npm run dev` (port 5173). The development API defaults to `http://localhost:8000`.
4. Install ClamAV and update its database with `freshclam`. Uploads return 503 when scanning is unavailable; no file is accepted without a successful scan. On Windows, set `CLAMSCAN_PATH` to the absolute executable path.

## Production deployment

`compose.yaml` provides PostgreSQL persistence, a migration job, a ClamAV signature updater, the API, and an Nginx frontend. The database and API have no published host ports. The web port binds to `127.0.0.1:8080`.

1. Copy root `.env.example` to `.env` and set a random **alphanumeric** `POSTGRES_PASSWORD`. Compose uses this in a database URL.
2. Copy `backend/.env.example` to `backend/.env`, configure Cloudinary and a random JWT secret, set `NODE_ENV=production` and `FRONTEND_URL=https://your-domain.example`. Compose supplies the database URL and API port.
3. Put a TLS reverse proxy in front of `127.0.0.1:8080`. Disable URL access logging for share routes and preserve the real client address only from trusted proxies. The included Nginx overwrites `X-Real-IP` and `X-Forwarded-For`; never expose the backend directly. If there is another proxy in front of Nginx, configure Nginx `set_real_ip_from` with only that proxy's actual IP ranges and `real_ip_header` appropriately. Without that, users share the outer proxy's rate limit.
4. Run `docker compose config --quiet`, then `docker compose up --build -d`. Initial ClamAV signature download can take several minutes. Inspect `docker compose ps` and `docker compose logs signatures migrate backend`.
5. Verify `/api/health` and `/api/ready`, then register, log in, upload a clean file, create a password-protected share, download it, revoke it, and check that new download requests fail. Check scanner rejection using the official harmless EICAR antivirus test file in a staging environment.

The production frontend uses `/api`. For separate hosting, set `VITE_API_BASE_URL` at build time, adjust the frontend CSP `connect-src`, allow the exact frontend origin in the backend, and retain a trusted proxy in front of the API. Vite preview is for local verification, not production hosting.

### Existing databases

Do **not** apply the initial migration directly to a populated database previously managed with `prisma db push`. Back it up and test a restore first. The initial migration records the original schema; the second adds indexes and rate limiting. For an existing database that exactly matches the original schema, run `bunx prisma migrate resolve --applied 20261127000000_initial`, then `bun run db:deploy`. Resolve any schema drift in staging first. Never use `migrate reset` in production.

### Configuration

See `backend/.env.example` for all settings. JWT signing is restricted to HS256. Passwords are bounded to 128 characters; registration and optional share passwords require at least eight. API bodies are bounded before parsing; the upload setting defaults to 10 MiB. If increasing it, update Nginx `client_max_body_size` too. JSON auth/share bodies are limited to 4 KiB.

`GET /files?offset=0` returns up to 100 files, newest first; the dashboard provides page controls. Login, registration and public download requests are limited with atomic counters in PostgreSQL, shared across replicas. Nginx additionally limits API request frequency. Health reports process liveness; readiness verifies database connectivity. Scanner failures reject uploads even if readiness is healthy.

Download URLs expire after `DOWNLOAD_URL_TTL_SECONDS` (default 60, maximum 300), or share expiry, whichever comes first. Revoking a share blocks new URLs immediately. URLs issued before revocation can work until their short expiry. JWT logout clears browser state; an already issued bearer token remains valid until its expiry. Protect the frontend with HTTPS and the included CSP; tokens are stored in browser localStorage.

### Operations

- Back up PostgreSQL on a schedule, encrypt backups, and practice restoration. Back up Cloudinary assets according to your retention requirements.
- Monitor `/api/ready`, scanner signature update failures, 5xx rates, latency, Cloudinary storage usage, and database size. Application logs contain request IDs, methods, status and duration without share tokens or query strings.
- Apply schema migrations as a release step before starting new API replicas. A failed migration prevents Compose from starting the API.
- Review dependency audits and rebuild container images regularly for OS fixes. CI runs checks, database integration tests, and container builds on pull requests.
- Apply a retention policy to `access_logs`. Rate-limit rows can be pruned daily with `DELETE FROM rate_limits WHERE bucket < floor(extract(epoch from now()) / 300)::integer - 1440;` (all current windows are at most 300 seconds; this conservatively retains at least five days). Do not prune active buckets.
- Uploads are removed from Cloudinary if database persistence fails. If that cleanup also fails, an orphan asset identifier is logged for operator cleanup. Storage and PostgreSQL do not share a transaction; reconcile orphan assets periodically. Deleting a file removes storage before its metadata; retry an interrupted deletion to finish cleanup.

## Verification

```sh
cd backend
bun run db:generate
bun run typecheck
bun test
# Against an isolated PostgreSQL database after applying migrations:
RUN_DB_TESTS=true bun test

cd ../frontend
npm run lint
npm run typecheck
npm run build
npm audit
```

On PowerShell set `$env:RUN_DB_TESTS="true"` before `bun test`. Tests use an isolated database URL supplied through `DATABASE_URL`; never point integration tests at production. They create and remove their own test users and metadata. Tests do not upload to Cloudinary. Container startup and actual scanning/downloads must also pass the staging smoke test above before launch.

## References

- [Hono request body limits](https://hono.dev/docs/middleware/builtin/body-limit)
- [Hono security headers](https://hono.dev/docs/middleware/builtin/secure-headers)
- [Cloudinary authenticated media and time-limited downloads](https://cloudinary.com/documentation/control_access_to_media)

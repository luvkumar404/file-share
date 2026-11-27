# Secure File Sharing

Private file uploads, ClamAV scanning, Cloudinary authenticated storage, and expiring public shares. Bun/Hono API, PostgreSQL/Prisma, React/Vite frontend.

## Features

- Register and sign in with email and password; authenticated users manage their own files.
- Upload PDF, DOCX, TXT, PNG, JPG, and JPEG files, with a default limit of 10 MiB per file. Uploads undergo extension, basic content-signature, and malware checks before storage.
- Create expiring share links with optional password protection. Recipients can download without an account.
- Revoke shares and delete files from the dashboard. Public downloads use short-lived Cloudinary URLs.
- Record upload, deletion, share creation, and download events in PostgreSQL.

## Project layout

```text
backend/
  index.ts             Bun server entry point
  src/                 Hono routes, validation, middleware, and services
  prisma/              Database schema and versioned migrations
  tests/               Security and optional database integration tests
frontend/
  src/                 React pages, components, hooks, and API client
  nginx.conf           Production static hosting and /api proxy
compose.yaml           Database, migrations, scanner signatures, API, and web
.github/workflows/     CI verification and container builds
```

## Local development

Requires Bun 1.3.14, Node 22.12+ (or a newer supported Node 22 release), PostgreSQL 16, and ClamAV with current signatures. Node alone cannot run the backend: password hashing and the server use Bun APIs.

1. Create an empty PostgreSQL database for the application. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`. Set `DATABASE_URL` to that database, real Cloudinary credentials, and a cryptographically random JWT secret of at least 32 characters. Set `FRONTEND_URL=http://localhost:5173` (an exact origin, with no trailing slash).
2. In `backend`, run `bun install --frozen-lockfile`, `bun run db:generate`, then `bun run db:deploy` against an **empty** database. Run `bun run dev` (port 8000).
3. In `frontend`, run `npm ci` and `npm run dev` (port 5173). The development API defaults to `http://localhost:8000`.
4. Install ClamAV and update its database with `freshclam`. Uploads return 503 when scanning is unavailable; no file is accepted without a successful scan. On Windows, set `CLAMSCAN_PATH` to the absolute executable path.

After configuring `backend/.env`, start the API:

```sh
cd backend
bun install --frozen-lockfile
bun run db:generate
bun run db:deploy
bun run dev
```

In a second terminal, start the frontend from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`, register an account, and upload a supported file after ClamAV is ready. Check the local API at `http://localhost:8000/health` and `http://localhost:8000/ready`.

The frontend needs no environment file for the default local setup. To use another API address, copy [`frontend/.env.example`](frontend/.env.example) to `frontend/.env`, set `VITE_API_BASE_URL`, and restart Vite. The root `.env` is used by Docker Compose; the local backend reads `backend/.env` when started from its directory.

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

| Variable | Default / requirement |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection URL; Compose supplies its internal URL. |
| `JWT_SECRET_KEY` | Required secret of at least 32 characters. |
| `JWT_ALGORITHM` | `HS256`; other algorithms are rejected. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60`; integer from 1 to 1440. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | All required for authenticated asset storage and signed downloads. |
| `MAX_FILE_SIZE_MB` | `10`; integer from 1 to 100, measured in MiB. |
| `FRONTEND_URL` | `http://localhost:5173`; exact origin, HTTPS required in production. |
| `PORT` | `8000`; API listening port. |
| `NODE_ENV` | `development`; also accepts `test` and `production`. |
| `CLAMSCAN_PATH` | `clamscan`; executable name or absolute path. |
| `SCAN_TIMEOUT_MS` | `60000`; positive integer, at most 300000. |
| `DOWNLOAD_URL_TTL_SECONDS` | `60`; integer from 10 to 300, also capped by share expiry. |
| `VITE_API_BASE_URL` | Frontend setting: `http://localhost:8000` in development, `/api` in production. Set before building. |
| `POSTGRES_PASSWORD` | Root Compose setting; required random alphanumeric database password. |

`GET /files?offset=0` returns up to 100 files, newest first; the dashboard provides page controls. Login, registration and public download requests are limited with atomic counters in PostgreSQL, shared across replicas. Nginx additionally limits API request frequency. Health reports process liveness; readiness verifies database connectivity. Scanner failures reject uploads even if readiness is healthy.

Download URLs expire after `DOWNLOAD_URL_TTL_SECONDS` (default 60, maximum 300), or share expiry, whichever comes first. Revoking a share blocks new URLs immediately. URLs issued before revocation can work until their short expiry. JWT logout clears browser state; an already issued bearer token remains valid until its expiry. Protect the frontend with HTTPS and the included CSP; tokens are stored in browser localStorage.

### Operations

- Back up PostgreSQL on a schedule, encrypt backups, and practice restoration. Back up Cloudinary assets according to your retention requirements.
- Monitor `/api/ready`, scanner signature update failures, 5xx rates, latency, Cloudinary storage usage, and database size. Application logs contain request IDs, methods, status and duration without share tokens or query strings.
- Apply schema migrations as a release step before starting new API replicas. A failed migration prevents Compose from starting the API.
- Review dependency audits and rebuild container images regularly for OS fixes. CI runs checks, database integration tests, and container builds on pull requests.
- Apply a retention policy to `access_logs`. Rate-limit rows can be pruned daily with `DELETE FROM rate_limits WHERE bucket < floor(extract(epoch from now()) / 300)::integer - 1440;` (all current windows are at most 300 seconds; this conservatively retains at least five days). Do not prune active buckets.
- Uploads are removed from Cloudinary if database persistence fails. If that cleanup also fails, an orphan asset identifier is logged for operator cleanup. Storage and PostgreSQL do not share a transaction; reconcile orphan assets periodically. Deleting a file removes storage before its metadata; retry an interrupted deletion to finish cleanup.

## API reference

Paths below are relative to `http://localhost:8000` during local development. Through the production Nginx proxy, prefix them with `/api`. Protected endpoints require `Authorization: Bearer <access_token>` from login.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register with JSON `email` and `password`. |
| `POST` | `/auth/login` | Public | Submit JSON `email` and `password`; receive `access_token` and `token_type`. |
| `GET` | `/auth/me` | Bearer token | Get the current user's profile. |
| `POST` | `/files` | Bearer token | Upload multipart form data using the field `upload`. |
| `GET` | `/files?offset=0` | Bearer token | List up to 100 owned files. |
| `GET` | `/files/:file_id` | Bearer token | Get an owned file's metadata. |
| `DELETE` | `/files/:file_id` | Bearer token | Delete an owned file; returns 204 on success. |
| `POST` | `/shares/files/:file_id` | Bearer token | Create a share with JSON `expires_at` and optional `password`. |
| `POST` | `/shares/:share_id/revoke` | Bearer token | Revoke a share owned by the current user. |
| `POST` | `/shares/:token/download` | Public | Submit JSON `{}` or `{"password":"..."}`; receive `file_name` and `download_url`. |
| `GET` | `/health` | Public | Check process liveness. |
| `GET` | `/ready` | Public | Check database connectivity; returns 503 when unavailable. |

Share expiry must be a future ISO 8601 datetime, such as `2027-01-01T12:00:00Z`. The recipient-facing page is `/share/:token` on the frontend. The download endpoint returns a URL; the recipient follows that URL to retrieve the file.

Application rate limits apply per client address: registration allows 5 requests per 5 minutes, login and uploads each allow 10 per 5 minutes, and public downloads allow 20 per minute. Responses over the limit return 429 with `Retry-After`; production Nginx also applies its own API limit.

## Troubleshooting

- **API exits with invalid environment variables:** check `backend/.env` against the configuration table and start the API from `backend/`. Cloudinary settings are required at startup.
- **Upload returns 503:** verify `CLAMSCAN_PATH`, signature availability, and scanner execution permissions. In Compose, inspect `docker compose logs signatures backend`.
- **Upload returns 413:** check for an empty file or a file exceeding the size limit. Also check the Nginx body limit in production.
- **Browser requests fail because of CORS:** set `FRONTEND_URL` to the exact frontend origin, including its port, and restart the backend.
- **API returns 429:** wait for the `Retry-After` interval. Direct local requests share one rate-limit identity; production requires the trusted proxy configuration described above.
- **Compose API does not start:** inspect `docker compose ps -a` and `docker compose logs migrate signatures backend` for migration or scanner startup failures.

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

# Secure File Sharing

A full-stack secure file-sharing application for uploading private files, scanning uploads, storing them in Cloudinary, and sharing them through expiring public links. Users can register, log in, manage their own files, create optional password-protected share links, revoke links, and download shared files through controlled API endpoints.

The project is intentionally split into a FastAPI backend and a React + Vite frontend. PostgreSQL is the only configured database. MongoDB, Motor, Redis, and Docker are not part of the current setup.

## Features

- Email/password registration and login
- JWT-based authentication
- PostgreSQL persistence with SQLAlchemy ORM
- Alembic database migrations
- Private file metadata management
- Cloudinary-backed file storage
- Malware scanning through a ClamAV-compatible scanner
- Expiring share links with optional passwords
- Share revocation
- Basic access logging for file actions
- React dashboard for upload, listing, details, and public shares

## Tech Stack

Backend:

- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Pydantic and pydantic-settings
- PyJWT
- passlib with bcrypt
- Cloudinary
- clamd

Frontend:

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- TanStack Query
- React Hook Form
- Zod
- Lucide React
- React Hot Toast

## Project Structure

```text
backend/
  app/
    core/
    models/
    routes/
    schemas/
    services/
    utils/
    main.py
  migrations/
    versions/
  alembic.ini
  .env.example
  requirements.txt
  README.md
frontend/
  public/
  src/
    api/
    components/
    context/
    hooks/
    pages/
    routes/
    utils/
  .env.example
  package.json
  README.md
```

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- PostgreSQL
- Cloudinary account credentials
- ClamAV or a compatible scanning setup for production use

## Backend Setup

Create a PostgreSQL database first. Example:

```sql
CREATE DATABASE fileshare;
```

Install backend dependencies and create the local environment file:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

API docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Vite usually serves the app at `http://localhost:5173`.

## Environment Variables

Backend variables in `backend/.env`:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fileshare
JWT_SECRET_KEY=change-this-to-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAX_FILE_SIZE_MB=10
FRONTEND_URL=http://localhost:5173
```

Frontend variables in `frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Never commit real `.env` files or production secrets.

## Database Migrations

Run migrations:

```bash
cd backend
alembic upgrade head
```

Create a migration after SQLAlchemy model changes:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Alembic loads all models through `app.models`, so keep new model imports registered in `backend/app/models/__init__.py`.

## API Overview

Authentication:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Files:

- `POST /files`
- `GET /files`
- `GET /files/{file_id}`
- `DELETE /files/{file_id}`

Shares:

- `POST /shares/files/{file_id}`
- `POST /shares/{token}/download`
- `POST /shares/{share_id}/revoke`

## Development Workflow

Backend:

```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

Build frontend:

```bash
cd frontend
npm run build
```

## Contribution Guidelines

1. Keep backend code inside `backend/app` using the existing `core`, `models`, `routes`, `schemas`, `services`, and `utils` folders.
2. Keep frontend code inside `frontend/src` using the existing `api`, `components`, `context`, `hooks`, `pages`, `routes`, and `utils` folders.
3. Add or update Alembic migrations when SQLAlchemy models change.
4. Do not commit `.env`, `.venv`, `node_modules`, `dist`, logs, caches, or generated temporary files.
5. Keep dependencies focused on the current stack. Do not add MongoDB, Motor, Redis, or Docker-specific files unless the project scope changes.
6. Run the backend and frontend locally before opening a pull request.
7. Update this README when setup steps, environment variables, or major API behavior changes.

## Notes

- PostgreSQL is the only configured database.
- Cloudinary credentials are required for real file storage.
- The malware scanner tries `clamd` first and falls back according to the backend scanner service.
- Local development can run without committing generated files because `.gitignore` excludes environment files, virtual environments, dependency folders, caches, logs, and builds.

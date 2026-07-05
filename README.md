# Secure File Sharing Project

Full-stack secure file-sharing app with a FastAPI backend and a React + Vite frontend.

## Tech Stack

- Backend: FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT, Cloudinary, ClamAV-compatible malware scanning
- Frontend: React, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod

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

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Backend API docs are available at `http://127.0.0.1:8000/docs`.

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Vite usually serves the app at `http://localhost:5173`.

## Alembic

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

## API Overview

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Files: `POST /files`, `GET /files`, `GET /files/{file_id}`, `DELETE /files/{file_id}`
- Shares: `POST /shares/files/{file_id}`, `POST /shares/{token}/download`, `POST /shares/{share_id}/revoke`

## Notes

- PostgreSQL is the only configured database.
- There is no MongoDB, Motor, Redis, or Dockerfile requirement in this project.
- Cloudinary credentials are required for real file storage.
- The malware scanner tries `clamd` first and falls back to a local scanner path where configured by the service code.
- Do not commit `.env`, virtual environments, build output, caches, logs, or `node_modules`.

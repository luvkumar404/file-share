# Secure File Sharing Backend

FastAPI backend for authenticated file uploads, Cloudinary storage, malware scanning, secure share links, and access logging.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill in `.env`:

```text
DATABASE_URL=
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MAX_FILE_SIZE_MB=10
FRONTEND_URL=http://localhost:5173
```

## Database

```bash
alembic upgrade head
```

Create a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

## Run

```bash
uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## API Overview

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /files`
- `GET /files`
- `GET /files/{file_id}`
- `DELETE /files/{file_id}`
- `POST /shares/files/{file_id}`
- `POST /shares/{token}/download`
- `POST /shares/{share_id}/revoke`

## Notes

- PostgreSQL is used through SQLAlchemy ORM.
- Alembic imports all models through `app.models`.
- ClamAV daemon is tried first through `clamd`; the scanner falls back to `clamscan` if available.
- If ClamAV is unavailable, a clearly marked local-development placeholder allows uploads.

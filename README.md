# Secure File Sharing Backend

A simple FastAPI backend for authenticated file uploads, Cloudinary storage, malware scanning, secure share links, and access logging.

## Features

- User registration and login
- JWT access-token authentication
- Password hashing with bcrypt/passlib
- PostgreSQL database with SQLAlchemy ORM
- Alembic migrations
- Authenticated file upload
- File size and extension validation
- Safe generated file names
- ClamAV malware scanning when available
- Cloudinary storage using authenticated assets
- Owner-only file listing, detail, and delete
- Expiring share links with optional passwords
- Revoked share-link support
- Upload, download, share creation, and delete access logs

## Project Structure

```text
backend/
  app/
    main.py
    core/
    models/
    schemas/
    routes/
    services/
    utils/
  migrations/
  alembic.ini
requirements.txt
.env.example
```

## Setup

1. Create and activate a virtual environment.

```bash
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Create a PostgreSQL database.

```sql
CREATE DATABASE fileshare;
```

4. Copy `.env.example` to `.env` and fill in your values.

```bash
copy .env.example .env
```

Required values:

```text
DATABASE_URL=
JWT_SECRET_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FRONTEND_URL=
```

5. Apply migrations.

```bash
alembic -c backend/alembic.ini upgrade head
```

6. Run the API.

```bash
uvicorn app.main:app --app-dir backend --reload
```

Open the API docs at:

```text
http://127.0.0.1:8000/docs
```

## Malware Scanning

The scanner uses `clamscan` when ClamAV is installed and available in your system path.

If ClamAV is not installed, the placeholder scanner allows uploads so the project can run locally. For production, install ClamAV and keep it updated.

## Example API Routes

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Files

- `POST /files`
- `GET /files`
- `GET /files/{file_id}`
- `DELETE /files/{file_id}`

### Shares

- `POST /shares/files/{file_id}`
- `POST /shares/{token}/download`
- `POST /shares/{share_id}/revoke`

## Notes

- Original filenames are never trusted for storage.
- Uploaded files are stored with generated unique filenames.
- Private Cloudinary asset URLs are not returned from file-management endpoints.
- Public access goes through the share-token download endpoint.
- CORS allows only the `FRONTEND_URL` configured in `.env`.
- Do not commit your `.env` file.

# Apartment Rentals App

A web application for apartment rentals with a public client interface and an admin panel.

## Tech Stack

- **Backend**: Python / Flask, PostgreSQL, JWT authentication
- **Frontend**: Vanilla HTML/CSS/JS + Nginx
- **Infrastructure**: Docker, Docker Compose

## Quick Start

### 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set strong values:

```env
POSTGRES_PASSWORD=strong_db_password
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here
ADMIN_LOGIN=admin
ADMIN_PASSWORD=your-strong-password-here
```

Generate secret keys with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Run

```bash
docker compose up --build
```

The app will be available at [http://localhost](http://localhost).

## Project Structure

```
.
├── backend/           # Flask API
│   ├── app/
│   │   ├── routes/
│   │   │   ├── client.py   # Public API
│   │   │   └── admin.py    # Admin API
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── config.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/          # Static files + Nginx
│   ├── client/        # Client interface
│   ├── admin/         # Admin panel
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/...` | Public API for clients |
| `*` | `/api/admin/...` | Admin API (requires JWT) |

## Stop

```bash
docker compose down
```

To also remove data (database and uploaded files):

```bash
docker compose down -v
```

#!/bin/sh
set -e

echo "Running DB migrations..."
flask --app run:app db upgrade 2>/dev/null || (
  echo "No migrations found, creating tables directly..."
  python -c "from run import app; from app import db; app.app_context().push(); db.create_all()"
)

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 run:app

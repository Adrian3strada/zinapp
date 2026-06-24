#!/bin/sh
set -e

echo "ZinApp API - esperando base de datos"
python scripts/wait_for_db.py

mkdir -p /app/media

echo "ZinApp API - migrate + collectstatic"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "$SEED_DATA" = "true" ] || [ "$SEED_DATA" = "True" ] || [ "$SEED_DATA" = "1" ]; then
  echo "SEED_DATA activo - cargando datos demo"
  python manage.py seed_data
fi

if [ "$RESET_APP_DATA" = "true" ] || [ "$RESET_APP_DATA" = "True" ] || [ "$RESET_APP_DATA" = "1" ]; then
  echo "RESET_APP_DATA activo - vaciando base de datos"
  if [ -n "$RESET_ADMIN_USERNAME" ] && [ -n "$RESET_ADMIN_PASSWORD" ]; then
    python manage.py reset_app_data --confirm --create-admin "$RESET_ADMIN_USERNAME" --admin-password "$RESET_ADMIN_PASSWORD"
  else
    python manage.py reset_app_data --confirm
  fi
fi

echo "Gunicorn en 0.0.0.0:${PORT:-8000}"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}"

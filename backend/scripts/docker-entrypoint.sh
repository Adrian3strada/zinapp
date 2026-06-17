#!/bin/sh
set -e

echo "ZinApp API - esperando base de datos"
python scripts/wait_for_db.py

echo "ZinApp API - migrate + collectstatic"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "$SEED_DATA" = "true" ] || [ "$SEED_DATA" = "True" ] || [ "$SEED_DATA" = "1" ]; then
  echo "SEED_DATA activo - cargando datos demo"
  python manage.py seed_data
fi

echo "Gunicorn en 0.0.0.0:${PORT:-8000}"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}"

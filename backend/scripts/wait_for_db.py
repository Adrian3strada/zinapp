#!/usr/bin/env python
"""Espera a que PostgreSQL acepte conexiones (Docker / Railway cold start)."""
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.db import connection
from django.db.utils import OperationalError


def main() -> int:
    if settings.DATABASES['default']['ENGINE'].endswith('sqlite3'):
        return 0

    max_attempts = int(os.environ.get('DB_WAIT_ATTEMPTS', '30'))
    delay = float(os.environ.get('DB_WAIT_DELAY', '2'))

    for attempt in range(1, max_attempts + 1):
        try:
            connection.ensure_connection()
            connection.close()
            print(f'PostgreSQL listo (intento {attempt}/{max_attempts})')
            return 0
        except OperationalError as exc:
            print(f'Esperando PostgreSQL ({attempt}/{max_attempts}): {exc}')
            time.sleep(delay)

    print('PostgreSQL no respondió a tiempo.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())

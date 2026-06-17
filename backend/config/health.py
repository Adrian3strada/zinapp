from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .app_config import get_public_app_config


@require_GET
def health(_request):
    from django.conf import settings
    from django.db import connection

    db_engine = settings.DATABASES['default']['ENGINE'].split('.')[-1]
    db_ok = False
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        connection.close()

    status = 200 if db_ok else 503
    return JsonResponse(
        {
            'ok': db_ok,
            'database': db_engine,
        },
        status=status,
    )


@require_GET
def app_config(_request):
    return JsonResponse(get_public_app_config())

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .app_config import get_public_app_config


@require_GET
def health(_request):
    from django.db import connection

    db_ok = False
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        connection.close()

    route_info = None
    try:
        from restaurants.geo import driving_route

        # Puntos fijos en Zinapécuaro para verificar proveedores de rutas.
        sample = driving_route(19.860, -100.823, 19.865, -100.825)
        route_info = {
            'ok': not sample.get('is_fallback') and len(sample.get('coordinates') or []) >= 3,
            'is_fallback': bool(sample.get('is_fallback')),
            'points': len(sample.get('coordinates') or []),
            'distance_meters': sample.get('distance_meters'),
        }
    except Exception as exc:
        route_info = {'ok': False, 'error': str(exc)[:120]}

    status = 200 if db_ok else 503
    return JsonResponse(
        {
            'ok': db_ok,
            'routing': route_info,
        },
        status=status,
    )


@require_GET
def app_config(_request):
    return JsonResponse(get_public_app_config())

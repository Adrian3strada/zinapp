from django.conf import settings
from django.core.management import call_command
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


def _cron_authorized(request) -> bool:
    secret = getattr(settings, 'CRON_SECRET', '') or ''
    auth = request.headers.get('Authorization', '')
    return bool(secret and auth == f'Bearer {secret}')


@csrf_exempt
@require_POST
def restaurant_opens_cron(request):
    if not _cron_authorized(request):
        return JsonResponse({'detail': 'No autorizado.'}, status=401)

    call_command('notify_restaurant_opens')
    return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def order_reminders_cron(request):
    if not _cron_authorized(request):
        return JsonResponse({'detail': 'No autorizado.'}, status=401)

    call_command('send_order_reminders')
    return JsonResponse({'ok': True})


@csrf_exempt
@require_POST
def run_all_cron(request):
    if not _cron_authorized(request):
        return JsonResponse({'detail': 'No autorizado.'}, status=401)

    call_command('notify_restaurant_opens')
    call_command('send_order_reminders')
    return JsonResponse({'ok': True})

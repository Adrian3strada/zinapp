from restaurants.models import Restaurant


from .access import can_access_panel


def panel_nav(request):
    if not can_access_panel(request.user):
        return {}
    return {
        'panel_pending_restaurants': Restaurant.objects.filter(is_active=False).count(),
    }

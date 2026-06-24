from restaurants.models import Restaurant


def _can_access_panel(user) -> bool:
    if not user.is_authenticated:
        return False
    return user.is_staff or user.is_superuser or getattr(user, 'is_admin_user', False)


def panel_nav(request):
    if not _can_access_panel(request.user):
        return {}
    return {
        'panel_pending_restaurants': Restaurant.objects.filter(is_active=False).count(),
    }

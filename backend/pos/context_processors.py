"""Contexto POS para navegación por rol."""

from .access import ROLE_PERMISSIONS, get_active_pos_access


def pos_nav(request):
    if not getattr(request, 'path', '').startswith('/pos/'):
        return {}
    if not getattr(request.user, 'is_authenticated', False):
        return {}
    access = get_active_pos_access(request)
    if not access:
        return {}
    return {
        'pos_restaurant': access.restaurant,
        'pos_role': access.role,
        'pos_is_owner': access.is_owner,
        'pos_perms': ROLE_PERMISSIONS.get(access.role, frozenset()),
    }

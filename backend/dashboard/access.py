"""Permisos de acceso al panel web de operaciones."""


def can_access_panel(user) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    if not user.is_active:
        return False
    return bool(
        user.is_staff
        or user.is_superuser
        or getattr(user, 'is_admin_user', False)
    )

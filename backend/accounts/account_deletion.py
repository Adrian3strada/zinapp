"""Permanent account deletion / anonymization for App Store compliance."""

from __future__ import annotations

import secrets

from django.db import transaction

from .models import PasswordResetToken, User


@transaction.atomic
def delete_user_account(user: User) -> None:
    """Remove personal data and permanently disable login.

    Order and delivery history may be retained in anonymized form for
    operational/legal records. The user can no longer sign in.
    """
    if user.is_superuser or user.is_staff:
        raise PermissionError('No se pueden eliminar cuentas de administrador por este medio.')

    user_id = user.pk
    suffix = secrets.token_hex(4)

    if user.avatar:
        user.avatar.delete(save=False)
        user.avatar = None

    user.username = f'deleted_{user_id}_{suffix}'
    user.email = ''
    user.first_name = ''
    user.last_name = ''
    user.phone = ''
    user.address = ''
    user.expo_push_token = ''
    user.google_sub = None
    user.is_active = False
    user.set_unusable_password()
    user.save()

    PasswordResetToken.objects.filter(user_id=user_id).delete()

    for restaurant in user.restaurants.all():
        restaurant.is_active = False
        restaurant.accepting_orders = False
        restaurant.save(update_fields=['is_active', 'accepting_orders', 'updated_at'])

    delivery_profile = getattr(user, 'delivery_profile', None)
    if delivery_profile is not None:
        delivery_profile.is_available = False
        delivery_profile.current_latitude = None
        delivery_profile.current_longitude = None
        delivery_profile.save(
            update_fields=['is_available', 'current_latitude', 'current_longitude', 'updated_at'],
        )

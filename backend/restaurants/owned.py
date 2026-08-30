"""Local activo del dueño. `/mine/` sigue devolviendo un restaurante."""

from __future__ import annotations

from django.db.models import QuerySet

from .models import Restaurant

MAX_OWNED_RESTAURANTS = 8


def owned_restaurants_qs(user) -> QuerySet[Restaurant]:
    if not getattr(user, 'is_authenticated', False):
        return Restaurant.objects.none()
    return Restaurant.objects.filter(owner_id=user.id).order_by('name', 'id')


def get_active_restaurant(user, queryset=None) -> Restaurant | None:
    """El local elegido, o el primero (mismo criterio que `.first()`)."""
    if not getattr(user, 'is_authenticated', False):
        return None
    qs = queryset if queryset is not None else Restaurant.objects.filter(owner_id=user.id)
    active_id = getattr(user, 'active_restaurant_id', None)
    if active_id:
        restaurant = qs.filter(pk=active_id).first()
        if restaurant:
            return restaurant
    return qs.order_by('id').first()


def owner_can_add_restaurant(user) -> tuple[bool, str]:
    count = Restaurant.objects.filter(owner_id=user.id).count()
    if count >= MAX_OWNED_RESTAURANTS:
        return False, f'Puedes tener hasta {MAX_OWNED_RESTAURANTS} locales en esta cuenta.'
    return True, ''


def set_active_restaurant(user, restaurant: Restaurant) -> Restaurant:
    if restaurant.owner_id != user.id:
        raise ValueError('El restaurante no pertenece a este usuario.')
    if user.active_restaurant_id != restaurant.id:
        user.active_restaurant = restaurant
        user.save(update_fields=['active_restaurant'])
    return restaurant

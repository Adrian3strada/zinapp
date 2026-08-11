"""Acceso y roles de ZinApp POS (aislamiento por restaurante)."""

from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q, QuerySet

from restaurants.models import Restaurant

from .models import POSStaffMembership, POSStaffRole

SESSION_RESTAURANT_KEY = 'pos_restaurant_id'


@dataclass(frozen=True)
class PosAccess:
    restaurant: Restaurant
    role: str
    is_owner: bool


def accessible_restaurants_qs(user) -> QuerySet[Restaurant]:
    """Restaurantes con POS habilitado a los que el usuario puede entrar."""
    if not getattr(user, 'is_authenticated', False) or not user.is_active:
        return Restaurant.objects.none()

    owned = Q(owner_id=user.id, pos_enabled=True)
    member = Q(
        pos_memberships__user_id=user.id,
        pos_memberships__is_active=True,
        pos_enabled=True,
    )
    return Restaurant.objects.filter(owned | member).distinct().order_by('name')


def get_membership(user, restaurant: Restaurant) -> POSStaffMembership | None:
    return (
        POSStaffMembership.objects.filter(
            user_id=user.id,
            restaurant_id=restaurant.id,
            is_active=True,
        ).first()
    )


def resolve_pos_role(user, restaurant: Restaurant) -> str | None:
    """Rol efectivo: owner ⇒ admin; si no, membership activa."""
    if not getattr(user, 'is_authenticated', False) or not user.is_active:
        return None
    if not restaurant.pos_enabled:
        return None
    if restaurant.owner_id == user.id:
        return POSStaffRole.ADMIN
    membership = get_membership(user, restaurant)
    if membership:
        return membership.role
    return None


def user_can_access_pos_restaurant(user, restaurant: Restaurant) -> bool:
    return resolve_pos_role(user, restaurant) is not None


def get_session_restaurant_id(request) -> int | None:
    raw = request.session.get(SESSION_RESTAURANT_KEY)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def set_session_restaurant(request, restaurant: Restaurant) -> None:
    request.session[SESSION_RESTAURANT_KEY] = restaurant.id


def clear_session_restaurant(request) -> None:
    request.session.pop(SESSION_RESTAURANT_KEY, None)


def get_active_pos_access(request) -> PosAccess | None:
    """Restaurante activo en sesión + rol, o None si inválido."""
    user = request.user
    restaurant_id = get_session_restaurant_id(request)
    if not restaurant_id:
        return None
    restaurant = (
        Restaurant.objects.filter(pk=restaurant_id, pos_enabled=True)
        .select_related('owner')
        .first()
    )
    if not restaurant:
        return None
    role = resolve_pos_role(user, restaurant)
    if not role:
        return None
    return PosAccess(
        restaurant=restaurant,
        role=role,
        is_owner=restaurant.owner_id == user.id,
    )


# Permisos por rol (FASE 1)
ROLE_PERMISSIONS = {
    POSStaffRole.ADMIN: frozenset({
        'dashboard', 'sale', 'cash', 'ticket', 'orders', 'kitchen', 'reports', 'settings',
    }),
    POSStaffRole.CASHIER: frozenset({
        'dashboard', 'sale', 'cash', 'ticket', 'orders',
    }),
    POSStaffRole.KITCHEN: frozenset({
        'dashboard', 'kitchen', 'orders',
    }),
}


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())

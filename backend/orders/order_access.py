"""Permisos de acceso a pedidos para chat, disputas, etc."""


def user_can_access_order(order, user) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_admin_user:
        return True
    if order.customer_id == user.id:
        return True
    if order.driver_id == user.id:
        return True
    if getattr(user, 'is_restaurant_owner', False) and order.restaurant.owner_id == user.id:
        return True
    return False

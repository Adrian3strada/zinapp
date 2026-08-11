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
    restaurant = getattr(order, 'restaurant', None)
    if restaurant is not None and getattr(restaurant, 'pos_enabled', False):
        try:
            from pos.access import user_can_access_pos_restaurant

            if user_can_access_pos_restaurant(user, restaurant):
                return True
        except Exception:
            pass
    return False

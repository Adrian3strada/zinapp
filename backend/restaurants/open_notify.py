from django.utils import timezone

from accounts.notifications import notify_restaurant_opened


def _minutes_since_midnight(value) -> int:
    return value.hour * 60 + value.minute


def notify_restaurant_opened_if_needed(restaurant, *, manual: bool = False) -> bool:
    """Envía push a favoritos cuando el local abre. Retorna True si notificó."""
    if not restaurant.is_open_now():
        return False

    today = timezone.localdate()
    if not manual and restaurant.last_open_notification_date == today:
        return False

    if not manual and restaurant.opening_time:
        now_local = timezone.localtime()
        delta_min = _minutes_since_midnight(now_local.time()) - _minutes_since_midnight(
            restaurant.opening_time,
        )
        if restaurant.opening_time <= (restaurant.closing_time or restaurant.opening_time):
            if delta_min < 0 or delta_min > 15:
                return False
        elif delta_min < 0:
            return False

    notify_restaurant_opened(restaurant)
    restaurant.last_open_notification_date = today
    restaurant.save(update_fields=['last_open_notification_date'])
    return True

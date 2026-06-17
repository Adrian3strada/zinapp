from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Restaurant
from .open_notify import notify_restaurant_opened_if_needed


@receiver(pre_save, sender=Restaurant)
def cache_restaurant_accepting_orders(sender, instance, **kwargs):
    if instance.pk:
        try:
            previous = Restaurant.objects.values_list('accepting_orders', flat=True).get(pk=instance.pk)
            instance._was_accepting_orders = previous
        except Restaurant.DoesNotExist:
            instance._was_accepting_orders = None
    else:
        instance._was_accepting_orders = None


@receiver(post_save, sender=Restaurant)
def restaurant_accepting_orders_enabled(sender, instance, created, **kwargs):
    if created:
        return
    was_accepting = getattr(instance, '_was_accepting_orders', None)
    if was_accepting is False and instance.accepting_orders:
        notify_restaurant_opened_if_needed(instance, manual=True)

from django.db.models import F
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from accounts.notifications import (
    notify_order_status,
    notify_payment_confirmed,
    notify_shipment_status,
)

from .models import Order, OrderStatus, PaymentStatus, Shipment, ShipmentStatus


@receiver(pre_save, sender=Order)
def assign_order_code(sender, instance, **kwargs):
    if not instance.code:
        from .codes import assign_unique_order_code

        assign_unique_order_code(instance)


@receiver(pre_save, sender=Order)
def cache_previous_order_state(sender, instance, **kwargs):
    if instance.pk:
        try:
            previous = Order.objects.get(pk=instance.pk)
            instance._previous_status = previous.status
            instance._previous_payment_status = previous.payment_status
            if (
                instance.status == OrderStatus.ON_THE_WAY
                and previous.status != OrderStatus.ON_THE_WAY
            ):
                instance.driver_nearby_notified = False
        except Order.DoesNotExist:
            instance._previous_status = None
            instance._previous_payment_status = None
    else:
        instance._previous_status = None
        instance._previous_payment_status = None


@receiver(post_save, sender=Order)
def order_status_changed(sender, instance, created, **kwargs):
    previous = getattr(instance, '_previous_status', None)
    previous_payment = getattr(instance, '_previous_payment_status', None)

    if (
        not created
        and previous != instance.status
        and instance.status == OrderStatus.CANCELLED
        and instance.coupon_id
    ):
        from .models import Coupon

        Coupon.objects.filter(pk=instance.coupon_id, times_used__gt=0).update(
            times_used=F('times_used') - 1,
        )
    if created:
        from restaurants.models import RestaurantFavorite

        RestaurantFavorite.objects.get_or_create(
            user=instance.customer,
            restaurant=instance.restaurant,
        )
    if (
        not created
        and previous_payment != instance.payment_status
        and instance.payment_status == PaymentStatus.PAID
    ):
        notify_payment_confirmed(instance)
    if created or previous != instance.status:
        notify_order_status(instance)


@receiver(pre_save, sender=Shipment)
def cache_previous_shipment_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            previous = Shipment.objects.get(pk=instance.pk).status
            instance._previous_status = previous
            if (
                instance.status == ShipmentStatus.ON_THE_WAY
                and previous != ShipmentStatus.ON_THE_WAY
            ):
                instance.driver_nearby_notified = False
        except Shipment.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=Shipment)
def shipment_status_changed(sender, instance, created, **kwargs):
    previous = getattr(instance, '_previous_status', None)
    if created or previous != instance.status:
        notify_shipment_status(instance)

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef
from django.utils import timezone

from accounts.notifications import (
    notify_pending_order_reminder,
    notify_ready_no_driver,
    notify_review_reminder,
    notify_shipment_pending_reminder,
)
from orders.models import Order, OrderStatus, Review, Shipment, ShipmentStatus

PENDING_REMINDER_MINUTES = 7
READY_NO_DRIVER_MINUTES = 15
REVIEW_REMINDER_HOURS = 1
SHIPMENT_PENDING_MINUTES = 10


class Command(BaseCommand):
    help = 'Recordatorios: pedido pendiente, listo sin repartidor, reseña y envío sin repartidor'

    def handle(self, *args, **options):
        now = timezone.now()
        sent = {
            'pending': 0,
            'ready_no_driver': 0,
            'review': 0,
            'shipment_pending': 0,
        }

        pending_cutoff = now - timedelta(minutes=PENDING_REMINDER_MINUTES)
        pending_orders = Order.objects.filter(
            status=OrderStatus.PENDING,
            pending_reminder_sent=False,
            created_at__lte=pending_cutoff,
        ).select_related('restaurant', 'restaurant__owner', 'customer')

        for order in pending_orders:
            notify_pending_order_reminder(order)
            order.pending_reminder_sent = True
            order.save(update_fields=['pending_reminder_sent'])
            sent['pending'] += 1

        ready_cutoff = now - timedelta(minutes=READY_NO_DRIVER_MINUTES)
        ready_orders = Order.objects.filter(
            status=OrderStatus.READY,
            driver__isnull=True,
            ready_no_driver_reminder_sent=False,
            ready_at__isnull=False,
            ready_at__lte=ready_cutoff,
        ).select_related('restaurant', 'restaurant__owner')

        for order in ready_orders:
            notify_ready_no_driver(order)
            order.ready_no_driver_reminder_sent = True
            order.save(update_fields=['ready_no_driver_reminder_sent'])
            sent['ready_no_driver'] += 1

        review_cutoff = now - timedelta(hours=REVIEW_REMINDER_HOURS)
        has_review = Review.objects.filter(order_id=OuterRef('pk'))
        review_orders = Order.objects.filter(
            status=OrderStatus.DELIVERED,
            review_reminder_sent=False,
            delivered_at__isnull=False,
            delivered_at__lte=review_cutoff,
        ).annotate(has_review=Exists(has_review)).filter(
            has_review=False,
        ).select_related('customer', 'restaurant')

        for order in review_orders:
            notify_review_reminder(order)
            order.review_reminder_sent = True
            order.save(update_fields=['review_reminder_sent'])
            sent['review'] += 1

        shipment_cutoff = now - timedelta(minutes=SHIPMENT_PENDING_MINUTES)
        pending_shipments = Shipment.objects.filter(
            status=ShipmentStatus.PENDING,
            driver__isnull=True,
            pending_reminder_sent=False,
            created_at__lte=shipment_cutoff,
        ).select_related('customer')

        for shipment in pending_shipments:
            notify_shipment_pending_reminder(shipment)
            shipment.pending_reminder_sent = True
            shipment.save(update_fields=['pending_reminder_sent'])
            sent['shipment_pending'] += 1

        self.stdout.write(
            self.style.SUCCESS(
                'Recordatorios enviados — '
                f'pendientes: {sent["pending"]}, '
                f'sin repartidor: {sent["ready_no_driver"]}, '
                f'reseñas: {sent["review"]}, '
                f'envíos: {sent["shipment_pending"]}',
            ),
        )

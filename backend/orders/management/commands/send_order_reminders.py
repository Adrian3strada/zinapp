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
from orders.models import (
    CancellationSource,
    Order,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Review,
    Shipment,
    ShipmentStatus,
)

PENDING_REMINDER_MINUTES = 7
READY_NO_DRIVER_MINUTES = 15
REVIEW_REMINDER_HOURS = 1
SHIPMENT_PENDING_MINUTES = 10
UNPAID_ONLINE_CANCEL_MINUTES = 30


def _claim_flag(model, pk, field_name: str) -> bool:
    """Marca el flag en DB de forma atómica. True = esta corrida “gana” el envío."""
    return model.objects.filter(pk=pk, **{field_name: False}).update(**{field_name: True}) == 1


def _release_flag(model, pk, field_name: str) -> None:
    model.objects.filter(pk=pk).update(**{field_name: False})


class Command(BaseCommand):
    help = 'Recordatorios: pedido pendiente, listo sin repartidor, reseña y envío sin repartidor'

    def handle(self, *args, **options):
        now = timezone.now()
        sent = {
            'pending': 0,
            'ready_no_driver': 0,
            'review': 0,
            'shipment_pending': 0,
            'unpaid_cancelled': 0,
        }

        pending_cutoff = now - timedelta(minutes=PENDING_REMINDER_MINUTES)
        pending_orders = Order.objects.filter(
            status=OrderStatus.PENDING,
            pending_reminder_sent=False,
            created_at__lte=pending_cutoff,
        ).exclude(
            payment_method=PaymentMethod.ONLINE,
            payment_status=PaymentStatus.PENDING,
        ).select_related('restaurant', 'restaurant__owner', 'customer')

        for order in pending_orders:
            if not _claim_flag(Order, order.pk, 'pending_reminder_sent'):
                continue
            if notify_pending_order_reminder(order):
                sent['pending'] += 1
            else:
                _release_flag(Order, order.pk, 'pending_reminder_sent')

        unpaid_cutoff = now - timedelta(minutes=UNPAID_ONLINE_CANCEL_MINUTES)
        unpaid_online = Order.objects.filter(
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.ONLINE,
            payment_status=PaymentStatus.PENDING,
            created_at__lte=unpaid_cutoff,
        )
        cancelled_unpaid = 0
        for order in unpaid_online:
            order.status = OrderStatus.CANCELLED
            order.cancellation_source = CancellationSource.CUSTOMER
            order.save(update_fields=['status', 'cancellation_source', 'updated_at'])
            cancelled_unpaid += 1
        sent['unpaid_cancelled'] = cancelled_unpaid

        ready_cutoff = now - timedelta(minutes=READY_NO_DRIVER_MINUTES)
        ready_orders = Order.objects.filter(
            status=OrderStatus.READY,
            driver__isnull=True,
            ready_no_driver_reminder_sent=False,
            ready_at__isnull=False,
            ready_at__lte=ready_cutoff,
        ).select_related('restaurant', 'restaurant__owner')

        for order in ready_orders:
            if not _claim_flag(Order, order.pk, 'ready_no_driver_reminder_sent'):
                continue
            if notify_ready_no_driver(order):
                sent['ready_no_driver'] += 1
            else:
                _release_flag(Order, order.pk, 'ready_no_driver_reminder_sent')

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
            if not _claim_flag(Order, order.pk, 'review_reminder_sent'):
                continue
            if notify_review_reminder(order):
                sent['review'] += 1
            else:
                _release_flag(Order, order.pk, 'review_reminder_sent')

        shipment_cutoff = now - timedelta(minutes=SHIPMENT_PENDING_MINUTES)
        pending_shipments = Shipment.objects.filter(
            status=ShipmentStatus.PENDING,
            driver__isnull=True,
            pending_reminder_sent=False,
            created_at__lte=shipment_cutoff,
        ).select_related('customer')

        for shipment in pending_shipments:
            if not _claim_flag(Shipment, shipment.pk, 'pending_reminder_sent'):
                continue
            if notify_shipment_pending_reminder(shipment):
                sent['shipment_pending'] += 1
            else:
                _release_flag(Shipment, shipment.pk, 'pending_reminder_sent')

        self.stdout.write(
            self.style.SUCCESS(
                'Recordatorios enviados — '
                f'pendientes: {sent["pending"]}, '
                f'sin repartidor: {sent["ready_no_driver"]}, '
                f'reseñas: {sent["review"]}, '
                f'envíos: {sent["shipment_pending"]}, '
                f'sin pagar cancelados: {sent.get("unpaid_cancelled", 0)}',
            ),
        )

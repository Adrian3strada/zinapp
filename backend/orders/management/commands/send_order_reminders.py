from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from accounts.notifications import (
    notify_driver_stale,
    notify_kitchen_stale,
    notify_pending_order_reminder,
    notify_ready_no_driver,
    notify_ready_no_driver_escalation,
    notify_review_reminder,
    notify_shipment_pending_reminder,
)
from orders.models import (
    CancellationSource,
    Order,
    OrderSource,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Review,
    Shipment,
    ShipmentStatus,
)

PENDING_REMINDER_MINUTES = 8
READY_NO_DRIVER_MINUTES = 15
READY_NO_DRIVER_ESCALATE_MINUTES = 30
REVIEW_REMINDER_HOURS = 1
SHIPMENT_PENDING_MINUTES = 10
UNPAID_ONLINE_CANCEL_MINUTES = 30
DRIVER_STALE_MINUTES = 8
KITCHEN_STALE_GRACE_MINUTES = 5
KITCHEN_STALE_FALLBACK_MINUTES = 20


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
            'ready_no_driver_escalated': 0,
            'review': 0,
            'shipment_pending': 0,
            'unpaid_cancelled': 0,
            'driver_stale': 0,
            'kitchen_stale': 0,
        }

        # Cancelar primero para no mandar recordatorio y cancelación en el mismo tick.
        unpaid_cutoff = now - timedelta(minutes=UNPAID_ONLINE_CANCEL_MINUTES)
        unpaid_orders = Order.objects.filter(
            source=OrderSource.ZINAPP,
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            created_at__lte=unpaid_cutoff,
        ).filter(
            Q(payment_method=PaymentMethod.ONLINE)
            | (
                Q(payment_method=PaymentMethod.TRANSFER)
                & (Q(payment_proof='') | Q(payment_proof__isnull=True))
            )
        ).select_related('customer', 'restaurant', 'restaurant__owner')
        cancelled_unpaid = 0
        for order in unpaid_orders:
            order.status = OrderStatus.CANCELLED
            order.cancellation_source = CancellationSource.PAYMENT_TIMEOUT
            order.save(update_fields=['status', 'cancellation_source', 'updated_at'])
            cancelled_unpaid += 1
        sent['unpaid_cancelled'] = cancelled_unpaid

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

        ready_escalate_cutoff = now - timedelta(minutes=READY_NO_DRIVER_ESCALATE_MINUTES)
        ready_escalations = Order.objects.filter(
            source=OrderSource.ZINAPP,
            status=OrderStatus.READY,
            driver__isnull=True,
            ready_no_driver_escalated=False,
            ready_at__isnull=False,
            ready_at__lte=ready_escalate_cutoff,
        ).select_related('restaurant', 'restaurant__owner', 'customer')
        for order in ready_escalations:
            if not _claim_flag(Order, order.pk, 'ready_no_driver_escalated'):
                continue
            Order.objects.filter(pk=order.pk).update(ready_no_driver_reminder_sent=True)
            if notify_ready_no_driver_escalation(order):
                sent['ready_no_driver_escalated'] += 1
            else:
                _release_flag(Order, order.pk, 'ready_no_driver_escalated')

        ready_cutoff = now - timedelta(minutes=READY_NO_DRIVER_MINUTES)
        ready_orders = Order.objects.filter(
            status=OrderStatus.READY,
            driver__isnull=True,
            ready_no_driver_reminder_sent=False,
            ready_no_driver_escalated=False,
            ready_at__isnull=False,
            ready_at__lte=ready_cutoff,
        ).select_related('restaurant', 'restaurant__owner', 'customer')

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

        stale_cutoff = now - timedelta(minutes=DRIVER_STALE_MINUTES)
        stale_orders = Order.objects.filter(
            status=OrderStatus.ON_THE_WAY,
            driver__isnull=False,
            driver_stale_reminder_sent=False,
            updated_at__lte=stale_cutoff,
        ).select_related('driver', 'driver__delivery_profile', 'restaurant', 'customer')
        for order in stale_orders:
            profile = getattr(order.driver, 'delivery_profile', None)
            loc_at = getattr(profile, 'updated_at', None) if profile else None
            if loc_at and loc_at > stale_cutoff:
                continue
            if not _claim_flag(Order, order.pk, 'driver_stale_reminder_sent'):
                continue
            if notify_driver_stale(order):
                sent['driver_stale'] += 1
            else:
                _release_flag(Order, order.pk, 'driver_stale_reminder_sent')

        stale_shipments = Shipment.objects.filter(
            status=ShipmentStatus.ON_THE_WAY,
            driver__isnull=False,
            driver_stale_reminder_sent=False,
            updated_at__lte=stale_cutoff,
        ).select_related('driver', 'driver__delivery_profile', 'customer')
        for shipment in stale_shipments:
            profile = getattr(shipment.driver, 'delivery_profile', None)
            loc_at = getattr(profile, 'updated_at', None) if profile else None
            if loc_at and loc_at > stale_cutoff:
                continue
            if not _claim_flag(Shipment, shipment.pk, 'driver_stale_reminder_sent'):
                continue
            if notify_driver_stale(shipment):
                sent['driver_stale'] += 1
            else:
                _release_flag(Shipment, shipment.pk, 'driver_stale_reminder_sent')

        kitchen_grace = now - timedelta(minutes=KITCHEN_STALE_GRACE_MINUTES)
        kitchen_fallback = now - timedelta(minutes=KITCHEN_STALE_FALLBACK_MINUTES)
        kitchen_orders = Order.objects.filter(
            source=OrderSource.ZINAPP,
            status__in=[OrderStatus.ACCEPTED, OrderStatus.PREPARING],
            kitchen_stale_reminder_sent=False,
        ).filter(
            Q(estimated_ready_at__isnull=False, estimated_ready_at__lte=kitchen_grace)
            | Q(
                estimated_ready_at__isnull=True,
                accepted_at__isnull=False,
                accepted_at__lte=kitchen_fallback,
            )
            | Q(
                estimated_ready_at__isnull=True,
                accepted_at__isnull=True,
                created_at__lte=kitchen_fallback,
            ),
        ).select_related('restaurant', 'restaurant__owner', 'customer')
        for order in kitchen_orders:
            if not _claim_flag(Order, order.pk, 'kitchen_stale_reminder_sent'):
                continue
            if notify_kitchen_stale(order):
                sent['kitchen_stale'] += 1
            else:
                _release_flag(Order, order.pk, 'kitchen_stale_reminder_sent')

        self.stdout.write(
            self.style.SUCCESS(
                'Recordatorios enviados — '
                f'pendientes: {sent["pending"]}, '
                f'sin repartidor: {sent["ready_no_driver"]}, '
                f'sin repartidor urgente: {sent.get("ready_no_driver_escalated", 0)}, '
                f'reseñas: {sent["review"]}, '
                f'envíos: {sent["shipment_pending"]}, '
                f'sin pagar cancelados: {sent.get("unpaid_cancelled", 0)}, '
                f'repartidor parado: {sent["driver_stale"]}, '
                f'cocina: {sent["kitchen_stale"]}',
            ),
        )

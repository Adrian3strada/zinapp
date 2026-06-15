import logging

from restaurants.geo import haversine_meters

from accounts.notifications import notify_driver_nearby_order, notify_driver_nearby_shipment

logger = logging.getLogger(__name__)

NEARBY_THRESHOLD_METERS = 400


def check_driver_nearby_deliveries(user, latitude: float, longitude: float) -> None:
    if not getattr(user, 'is_driver', False):
        return

    from orders.models import Order, OrderStatus, Shipment, ShipmentStatus

    orders = Order.objects.filter(
        driver=user,
        status=OrderStatus.ON_THE_WAY,
        driver_nearby_notified=False,
        delivery_latitude__isnull=False,
        delivery_longitude__isnull=False,
    ).select_related('customer')

    for order in orders:
        distance = haversine_meters(
            latitude,
            longitude,
            float(order.delivery_latitude),
            float(order.delivery_longitude),
        )
        if distance > NEARBY_THRESHOLD_METERS:
            continue
        notify_driver_nearby_order(order, distance)
        order.driver_nearby_notified = True
        order.save(update_fields=['driver_nearby_notified'])
        logger.info('Nearby push sent for order #%s (%.0f m)', order.id, distance)

    shipments = Shipment.objects.filter(
        driver=user,
        status=ShipmentStatus.ON_THE_WAY,
        driver_nearby_notified=False,
        delivery_latitude__isnull=False,
        delivery_longitude__isnull=False,
    ).select_related('customer')

    for shipment in shipments:
        distance = haversine_meters(
            latitude,
            longitude,
            float(shipment.delivery_latitude),
            float(shipment.delivery_longitude),
        )
        if distance > NEARBY_THRESHOLD_METERS:
            continue
        notify_driver_nearby_shipment(shipment, distance)
        shipment.driver_nearby_notified = True
        shipment.save(update_fields=['driver_nearby_notified'])
        logger.info('Nearby push sent for shipment #%s (%.0f m)', shipment.id, distance)

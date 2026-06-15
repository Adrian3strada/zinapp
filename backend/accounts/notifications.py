import json
import logging
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

STATUS_MESSAGES = {
    'accepted': 'Tu pedido fue aceptado por el restaurante.',
    'preparing': 'El restaurante está preparando tu pedido.',
    'ready': 'Tu pedido está listo para recoger.',
    'on_the_way': '¡Tu pedido va en camino!',
    'delivered': 'Pedido entregado. ¡Buen provecho!',
    'cancelled': 'Tu pedido fue cancelado.',
}

SHIPMENT_STATUS_MESSAGES = {
    'pending': 'Tu envío fue registrado. Buscando repartidor…',
    'picked_up': 'El repartidor va a recoger tu paquete.',
    'on_the_way': '¡Tu paquete va en camino!',
    'delivered': 'Envío entregado correctamente.',
    'cancelled': 'Tu envío fue cancelado.',
}


def send_push_to_user(user, title: str, body: str, data: dict | None = None) -> bool:
    token = getattr(user, 'expo_push_token', '') or ''
    if not token or not token.startswith('ExponentPushToken'):
        return False

    payload = {
        'to': token,
        'title': title,
        'body': body,
        'sound': 'default',
        'data': data or {},
    }
    if getattr(settings, 'DEBUG', False):
        logger.info('Push [%s]: %s — %s', user.username, title, body)

    try:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        logger.warning('Push falló para %s: %s', user.username, exc)
        return False


def notify_order_status(order):
    message = STATUS_MESSAGES.get(order.status)
    if not message:
        return

    title = f'Pedido #{order.id}'
    data = {'orderId': order.id, 'status': order.status}

    send_push_to_user(order.customer, title, message, data)

    if order.status in ('pending', 'ready', 'cancelled') and order.restaurant.owner:
        owner_msg = {
            'pending': f'Nuevo pedido #{order.id} pendiente.',
            'ready': f'Pedido #{order.id} listo — esperando repartidor.',
            'cancelled': f'Pedido #{order.id} cancelado.',
        }.get(order.status)
        if owner_msg:
            send_push_to_user(order.restaurant.owner, title, owner_msg, data)

    if order.status == 'ready':
        from accounts.models import User, UserRole
        drivers = User.objects.filter(
            role=UserRole.DRIVER,
            delivery_profile__is_available=True,
        ).exclude(expo_push_token='')
        for driver in drivers:
            send_push_to_user(
                driver,
                'Entrega disponible',
                f'Pedido #{order.id} listo en {order.restaurant.name}.',
                data,
            )

    if order.driver and order.status in ('on_the_way', 'delivered'):
        driver_msg = {
            'on_the_way': f'Entrega #{order.id} asignada.',
            'delivered': f'Entrega #{order.id} completada.',
        }.get(order.status)
        if driver_msg:
            send_push_to_user(order.driver, title, driver_msg, data)


def notify_shipment_status(shipment):
    message = SHIPMENT_STATUS_MESSAGES.get(shipment.status)
    if not message:
        return

    title = f'Envío #{shipment.id}'
    data = {'shipmentId': shipment.id, 'status': shipment.status, 'type': 'shipment'}

    send_push_to_user(shipment.customer, title, message, data)

    if shipment.status == 'pending':
        from accounts.models import User, UserRole
        drivers = User.objects.filter(
            role=UserRole.DRIVER,
            delivery_profile__is_available=True,
        ).exclude(expo_push_token='')
        for driver in drivers:
            send_push_to_user(
                driver,
                'Envío disponible',
                f'Envío #{shipment.id}: {shipment.description[:60]}',
                data,
            )

    if shipment.driver and shipment.status in ('picked_up', 'on_the_way', 'delivered'):
        driver_msg = {
            'picked_up': f'Envío #{shipment.id} — ve a recoger el paquete.',
            'on_the_way': f'Envío #{shipment.id} — lleva el paquete al destino.',
            'delivered': f'Envío #{shipment.id} completado.',
        }.get(shipment.status)
        if driver_msg:
            send_push_to_user(shipment.driver, title, driver_msg, data)


def _format_nearby_distance(distance_meters: float) -> str:
    if distance_meters < 1000:
        return f'{int(distance_meters)} m'
    return f'{distance_meters / 1000:.1f} km'


def notify_driver_nearby_order(order, distance_meters: float) -> None:
    dist = _format_nearby_distance(distance_meters)
    send_push_to_user(
        order.customer,
        f'Pedido #{order.id}',
        f'¡Tu repartidor está cerca! (~{dist})',
        {
            'orderId': order.id,
            'status': 'on_the_way',
            'type': 'driver_nearby',
        },
    )


def notify_driver_nearby_shipment(shipment, distance_meters: float) -> None:
    dist = _format_nearby_distance(distance_meters)
    send_push_to_user(
        shipment.customer,
        f'Envío #{shipment.id}',
        f'¡Tu paquete está cerca! (~{dist})',
        {
            'shipmentId': shipment.id,
            'status': 'on_the_way',
            'type': 'driver_nearby',
        },
    )

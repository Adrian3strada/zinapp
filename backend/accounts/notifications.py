import json
import logging
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

ORDER_CUSTOMER_MESSAGES = {
    'pending': 'Recibimos tu pedido. El restaurante lo confirmará pronto.',
    'accepted': 'Tu pedido fue aceptado por el restaurante.',
    'preparing': 'El restaurante está preparando tu pedido.',
    'ready': 'Tu pedido está listo. Esperando repartidor.',
    'on_the_way': '¡Tu pedido va en camino!',
    'delivered': 'Pedido entregado. ¡Buen provecho!',
    'cancelled': 'Tu pedido fue cancelado.',
}

ORDER_OWNER_MESSAGES = {
    'pending': 'Nuevo pedido pendiente. Confírmalo cuando puedas.',
    'ready': 'Pedido listo — esperando repartidor.',
    'on_the_way': 'El repartidor recogió el pedido.',
    'delivered': 'Pedido entregado al cliente.',
    'cancelled': 'Pedido cancelado.',
}

SHIPMENT_CUSTOMER_MESSAGES = {
    'pending': 'Tu envío fue registrado. Buscando repartidor…',
    'picked_up': 'El repartidor va a recoger tu paquete.',
    'on_the_way': '¡Tu paquete va en camino!',
    'delivered': 'Envío entregado correctamente.',
    'cancelled': 'Tu envío fue cancelado.',
}


def _driver_name(user) -> str:
    if not user:
        return 'Tu repartidor'
    name = (user.get_full_name() or user.first_name or user.username or '').strip()
    return name or 'Tu repartidor'


def send_push_to_user(
    user,
    title: str,
    body: str,
    data: dict | None = None,
    *,
    channel_id: str = 'orders_v2',
) -> bool:
    token = getattr(user, 'expo_push_token', '') or ''
    if not token or not token.startswith('ExponentPushToken'):
        return False

    payload = {
        'to': token,
        'title': title,
        'body': body,
        'sound': 'alert.wav',
        'priority': 'high',
        'channelId': channel_id,
        'data': data or {},
    }
    payload['android'] = {
        'channelId': channel_id,
        'priority': 'high',
        'sound': 'alert.wav',
        'vibrate': [0, 400, 120, 400, 120, 500, 160, 500],
    }

    try:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            if resp.status != 200:
                return False
            result = json.loads(raw) if raw else {}
            ticket = (result.get('data') or [{}])[0]
            if ticket.get('status') == 'error':
                details = ticket.get('details') or {}
                if details.get('error') == 'DeviceNotRegistered':
                    user.expo_push_token = ''
                    user.save(update_fields=['expo_push_token'])
                logger.warning(
                    'Push rechazado para %s: %s',
                    user.username,
                    details.get('error', ticket),
                )
                return False
            if getattr(settings, 'DEBUG', False):
                logger.info('Push [%s]: %s — %s', user.username, title, body)
            return True
    except Exception as exc:
        logger.warning('Push falló para %s: %s', user.username, exc)
        return False


def _broadcast_to_available_drivers(title: str, body: str, data: dict) -> None:
    from accounts.models import User, UserRole

    drivers = User.objects.filter(
        role=UserRole.DRIVER,
        delivery_profile__is_available=True,
        delivery_profile__verification_status='approved',
    ).exclude(expo_push_token='')
    for driver in drivers:
        send_push_to_user(driver, title, body, data, channel_id='deliveries_v2')


def _order_ref(order) -> str:
    return order.code or f'#{order.id}'


def notify_order_status(order):
    ref = _order_ref(order)
    title = f'Pedido {ref}'
    data = {'orderId': order.id, 'status': order.status}
    status = order.status
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el restaurante'
    total_label = f'${order.total:.2f}'

    customer_msg = ORDER_CUSTOMER_MESSAGES.get(status)
    if status == 'pending':
        customer_msg = (
            f'¡Encargaste en {restaurant_name}! '
            f'Pedido {ref} por {total_label}. '
            f'El restaurante confirmará pronto.'
        )
    elif status == 'on_the_way' and order.driver:
        customer_msg = f'¡Tu pedido va en camino! {_driver_name(order.driver)} te lo lleva.'
    elif status == 'cancelled':
        from orders.models import CancellationSource

        if order.cancellation_source == CancellationSource.RESTAURANT_REJECT:
            customer_msg = (
                f'{restaurant_name} no pudo tomar tu pedido {ref}. '
                f'Prueba otro local.'
            )
        else:
            customer_msg = ORDER_CUSTOMER_MESSAGES['cancelled']
    if customer_msg:
        send_push_to_user(order.customer, title, customer_msg, data, channel_id='orders_v2')

    if order.restaurant and order.restaurant.owner:
        owner_msg = ORDER_OWNER_MESSAGES.get(status)
        if status == 'pending':
            owner_msg = (
                f'¡Ya encargaron! Pedido {ref} por {total_label}. '
                f'Confírmalo en la app.'
            )
        if owner_msg:
            owner_title = f'Pedido {ref}'
            send_push_to_user(order.restaurant.owner, owner_title, owner_msg, data)

    if status == 'ready':
        _broadcast_to_available_drivers(
            'Entrega disponible',
            f'Pedido {ref} listo en {order.restaurant.name}.',
            data,
        )

    if order.driver:
        if status == 'delivered':
            send_push_to_user(
                order.driver,
                title,
                f'Entrega {ref} completada.',
                data,
                channel_id='deliveries_v2',
            )
        elif status == 'cancelled':
            send_push_to_user(
                order.driver,
                title,
                f'El pedido {ref} fue cancelado.',
                data,
                channel_id='deliveries_v2',
            )


def notify_shipment_status(shipment):
    title = f'Envío #{shipment.id}'
    data = {'shipmentId': shipment.id, 'status': shipment.status, 'type': 'shipment'}
    status = shipment.status

    customer_msg = SHIPMENT_CUSTOMER_MESSAGES.get(status)
    if status == 'on_the_way' and shipment.driver:
        customer_msg = f'¡Tu paquete va en camino! {_driver_name(shipment.driver)} te lo lleva.'
    if customer_msg:
        send_push_to_user(shipment.customer, title, customer_msg, data, channel_id='deliveries_v2')

    if status == 'pending':
        _broadcast_to_available_drivers(
            'Envío disponible',
            f'Envío #{shipment.id}: {shipment.description[:60]}',
            data,
        )

    if shipment.driver:
        driver_messages = {
            'picked_up': f'Envío #{shipment.id} — ve a recoger el paquete.',
            'on_the_way': f'Envío #{shipment.id} — lleva el paquete al destino.',
            'delivered': f'Envío #{shipment.id} completado.',
            'cancelled': f'El envío #{shipment.id} fue cancelado.',
        }
        driver_msg = driver_messages.get(status)
        if driver_msg:
            send_push_to_user(shipment.driver, title, driver_msg, data, channel_id='deliveries_v2')


def _format_nearby_distance(distance_meters: float) -> str:
    if distance_meters < 1000:
        return f'{int(distance_meters)} m'
    return f'{distance_meters / 1000:.1f} km'


def notify_driver_nearby_order(order, distance_meters: float) -> None:
    dist = _format_nearby_distance(distance_meters)
    ref = _order_ref(order)
    send_push_to_user(
        order.customer,
        f'Pedido {ref}',
        f'¡Tu repartidor está cerca! (~{dist})',
        {
            'orderId': order.id,
            'status': 'on_the_way',
            'type': 'driver_nearby',
        },
        channel_id='orders_v2',
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
        channel_id='deliveries_v2',
    )


def notify_restaurant_opened(restaurant) -> None:
    from restaurants.models import RestaurantFavorite

    title = f'{restaurant.name} abrió'
    body = f'¡{restaurant.name} ya está recibiendo pedidos! Encarga ahora.'
    data = {
        'restaurantId': restaurant.id,
        'restaurantName': restaurant.name,
        'type': 'restaurant_open',
    }
    favorites = RestaurantFavorite.objects.filter(
        restaurant=restaurant,
    ).select_related('user').exclude(user__expo_push_token='')
    for favorite in favorites:
        send_push_to_user(favorite.user, title, body, data, channel_id='orders_v2')


def notify_payment_confirmed(order) -> None:
    ref = _order_ref(order)
    title = f'Pedido {ref}'
    data = {'orderId': order.id, 'status': order.status, 'type': 'payment_confirmed'}
    total_label = f'${order.total:.2f}'

    send_push_to_user(
        order.customer,
        title,
        f'Pago recibido por {total_label}. Tu pedido sigue en proceso.',
        data,
        channel_id='orders_v2',
    )

    if order.restaurant and order.restaurant.owner:
        send_push_to_user(
            order.restaurant.owner,
            title,
            f'Pago confirmado del pedido {ref} ({total_label}). Ya puedes prepararlo.',
            data,
        )


def notify_pending_order_reminder(order) -> None:
    if not order.restaurant or not order.restaurant.owner:
        return
    ref = _order_ref(order)
    data = {'orderId': order.id, 'status': order.status, 'type': 'pending_reminder'}
    send_push_to_user(
        order.restaurant.owner,
        f'Pedido {ref}',
        f'El pedido {ref} sigue esperando confirmación. Respóndele al cliente.',
        data,
    )


def notify_ready_no_driver(order) -> None:
    ref = _order_ref(order)
    data = {'orderId': order.id, 'status': order.status, 'type': 'ready_no_driver'}
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el local'

    if order.restaurant and order.restaurant.owner:
        send_push_to_user(
            order.restaurant.owner,
            f'Pedido {ref}',
            f'Pedido {ref} listo — aún sin repartidor.',
            data,
        )

    _broadcast_to_available_drivers(
        'Entrega urgente',
        f'Pedido {ref} lleva rato esperando en {restaurant_name}.',
        data,
    )


def notify_review_reminder(order) -> None:
    ref = _order_ref(order)
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el restaurante'
    send_push_to_user(
        order.customer,
        f'Pedido {ref}',
        f'¿Cómo estuvo tu pedido en {restaurant_name}? Déjanos una reseña.',
        {
            'orderId': order.id,
            'status': 'delivered',
            'type': 'review_reminder',
        },
        channel_id='orders_v2',
    )


def notify_shipment_pending_reminder(shipment) -> None:
    send_push_to_user(
        shipment.customer,
        f'Envío #{shipment.id}',
        f'Tu envío #{shipment.id} sigue buscando repartidor. Te avisamos cuando alguien lo tome.',
        {
            'shipmentId': shipment.id,
            'status': 'pending',
            'type': 'shipment_pending_reminder',
        },
        channel_id='deliveries_v2',
    )

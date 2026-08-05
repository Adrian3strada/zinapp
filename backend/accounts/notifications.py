import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

# Errores de ticket Expo que indican token inválido / dispositivo dado de baja.
_INVALID_TOKEN_ERRORS = frozenset({'DeviceNotRegistered'})
_TOKEN_IN_MESSAGE_RE = re.compile(r'ExponentPushToken\[[^\]]*\]')


def _sanitize_provider_message(message) -> str:
    """Quita tokens Expo del mensaje del proveedor para logs seguros."""
    text = str(message or '').strip()
    if not text:
        return ''
    return _TOKEN_IN_MESSAGE_RE.sub('ExponentPushToken[REDACTED]', text)[:500]


def _data_type_name(value) -> str:
    if value is None:
        return 'none'
    if isinstance(value, list):
        return f'list(len={len(value)})'
    if isinstance(value, dict):
        return 'dict'
    return type(value).__name__


def _summarize_expo_response(result) -> dict:
    """Resumen seguro de la respuesta Expo (sin tokens ni payloads sensibles)."""
    if not isinstance(result, dict):
        return {'result_type': type(result).__name__}

    data = result.get('data')
    summary = {
        'result_keys': sorted(str(k) for k in result.keys()),
        'data_type': _data_type_name(data),
    }
    errors = result.get('errors')
    if errors is not None:
        summary['errors_type'] = _data_type_name(errors)
        if isinstance(errors, list):
            summary['errors'] = [
                {
                    'code': err.get('code') if isinstance(err, dict) else None,
                    'message': _sanitize_provider_message(
                        err.get('message') if isinstance(err, dict) else err
                    ),
                }
                for err in errors[:5]
            ]
    return summary


def _extract_push_ticket(result) -> dict | None:
    """
    Expo puede devolver `data` como:
    - lista de tickets (envío múltiple o formato array)
    - un único objeto ticket (un mensaje a un destinatario)
    """
    if not isinstance(result, dict):
        return None

    data = result.get('data')
    if data is None:
        return None

    if isinstance(data, list):
        if not data:
            return None
        first = data[0]
        return first if isinstance(first, dict) else None

    if isinstance(data, dict):
        # Ticket único: tiene status (ok/error).
        if 'status' in data:
            return data
        # Mapa inesperado: primer valor que parezca ticket.
        for value in data.values():
            if isinstance(value, dict) and 'status' in value:
                return value
        return None

    return None


def _ticket_error_code(ticket: dict) -> str | None:
    details = ticket.get('details')
    if isinstance(details, dict):
        error = details.get('error')
        if isinstance(error, str) and error:
            return error
    return None


def _clear_user_push_token(user) -> None:
    """Marca el token como inactivo limpiándolo (no hay campo is_active aparte)."""
    user.expo_push_token = ''
    user.save(update_fields=['expo_push_token'])

# Solo hitos útiles: evita cascada accepted→preparing→ready→en camino→entregado.
ORDER_CUSTOMER_MESSAGES = {
    'pending': 'Recibimos tu pedido. El restaurante lo confirmará pronto.',
    'accepted': 'Tu pedido fue aceptado por el restaurante.',
    'on_the_way': '¡Tu pedido va en camino!',
    'delivered': 'Pedido entregado. ¡Buen provecho!',
    'cancelled': 'Tu pedido fue cancelado.',
}

# Al dueño solo lo que requiere acción (nuevo / cancelado). El resto lo ve en la app.
ORDER_OWNER_MESSAGES = {
    'pending': 'Nuevo pedido pendiente. Confírmalo cuando puedas.',
    'cancelled': 'Pedido cancelado.',
}

SHIPMENT_CUSTOMER_MESSAGES = {
    'pending': 'Tu envío fue registrado. Buscando repartidor…',
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
    channel_id: str = 'orders_v3',
) -> bool:
    """
    True = entregado o omitido de forma permanente (sin token / dispositivo baja).
    False = fallo transitorio; el caller puede reintentar.
    """
    token = getattr(user, 'expo_push_token', '') or ''
    if not token or not token.startswith('ExponentPushToken'):
        logger.info(
            'Push omitido para %s: sin token Expo válido',
            getattr(user, 'username', user),
        )
        return True

    # En Android 8+ el tono lo define el canal (channelId). El sound del
    # payload aplica sobre todo a iOS; no forzar alert.wav en android.* para
    # evitar que FCM trate el push como silencioso si no resuelve el asset.
    payload = {
        'to': token,
        'title': title,
        'body': body,
        'sound': 'alert.wav',
        'priority': 'high',
        'channelId': channel_id,
        'data': data or {},
        'android': {
            'channelId': channel_id,
            'priority': 'high',
            'vibrate': [0, 400, 120, 400, 120, 500, 160, 500],
        },
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
                logger.error(
                    'Push HTTP %s para %s: %s',
                    resp.status,
                    user.username,
                    _sanitize_provider_message(raw),
                )
                return False
            try:
                result = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                logger.error(
                    'Push JSON inválido para %s: data_type=raw preview=%s',
                    user.username,
                    _sanitize_provider_message(raw),
                )
                return False

            summary = _summarize_expo_response(result)
            logger.debug(
                'Push respuesta Expo para %s: %s',
                user.username,
                summary,
            )

            if isinstance(result, dict) and result.get('errors'):
                logger.error(
                    'Push error de solicitud Expo para %s: data_type=%s errors=%s',
                    user.username,
                    summary.get('data_type'),
                    summary.get('errors'),
                )
                return False

            ticket = _extract_push_ticket(result)
            if ticket is None:
                logger.error(
                    'Push respuesta malformada para %s: data_type=%s summary=%s',
                    user.username,
                    summary.get('data_type'),
                    summary,
                )
                return False

            status = ticket.get('status')
            message = _sanitize_provider_message(ticket.get('message'))
            details = ticket.get('details') if isinstance(ticket.get('details'), dict) else {}
            err_code = _ticket_error_code(ticket)

            if status == 'error':
                if err_code in _INVALID_TOKEN_ERRORS:
                    _clear_user_push_token(user)
                    logger.warning(
                        'Push token inválido para %s — marcado inactivo '
                        '(status=%s error=%s message=%s details=%s)',
                        user.username,
                        status,
                        err_code,
                        message,
                        details,
                    )
                    return True
                logger.error(
                    'Push rechazado para %s: data_type=%s status=%s error=%s '
                    'message=%s details=%s',
                    user.username,
                    summary.get('data_type'),
                    status,
                    err_code,
                    message,
                    details,
                )
                return False

            if status != 'ok':
                logger.error(
                    'Push status inesperado para %s: data_type=%s status=%s '
                    'message=%s details=%s',
                    user.username,
                    summary.get('data_type'),
                    status,
                    message,
                    details,
                )
                return False

            if getattr(settings, 'DEBUG', False):
                logger.info('Push [%s]: %s — %s', user.username, title, body)
            return True
    except urllib.error.HTTPError as exc:
        body_preview = ''
        try:
            body_preview = _sanitize_provider_message(exc.read().decode())
        except Exception:
            pass
        logger.error(
            'Push HTTPError para %s: %s %s',
            user.username,
            exc.code,
            body_preview,
            exc_info=True,
        )
        return False
    except Exception:
        logger.exception('Push falló para %s', user.username)
        return False


def _broadcast_to_available_drivers(title: str, body: str, data: dict) -> bool:
    from accounts.models import User, UserRole
    from realtime.broadcast import broadcast_drivers_job

    kind = 'shipment' if data.get('shipmentId') or data.get('type') == 'shipment' else 'order'
    ref_id = data.get('orderId') or data.get('shipmentId') or 0
    try:
        broadcast_drivers_job(kind=kind, ref_id=int(ref_id), title=title, body=body)
    except Exception:
        logger.exception('realtime drivers.job failed')

    drivers = list(User.objects.filter(
        role=UserRole.DRIVER,
        delivery_profile__is_available=True,
        delivery_profile__verification_status='approved',
    ).exclude(expo_push_token=''))
    if not drivers:
        logger.warning('Broadcast drivers: nadie disponible con push token')
        return True
    results = [
        send_push_to_user(driver, title, body, data, channel_id='deliveries_v3')
        for driver in drivers
    ]
    return any(results)


def _order_ref(order) -> str:
    return order.code or f'#{order.id}'


def notify_order_status(order, previous_status=None):
    # En línea sin pagar: el pedido aún no se "realiza" para el restaurante.
    if getattr(order, 'awaits_online_payment', False):
        notify_awaiting_online_payment(order)
        return

    try:
        from realtime.broadcast import broadcast_order_updated

        broadcast_order_updated(order)
    except Exception:
        logger.exception('realtime order.updated failed for order %s', getattr(order, 'id', None))

    ref = _order_ref(order)
    title = f'Pedido {ref}'
    data = {'orderId': order.id, 'status': order.status}
    status = order.status
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el restaurante'
    total_label = f'${order.total:.2f}'

    # Confirmación única: accepted, o salto directo pending→preparing.
    # Sin push en preparing/ready intermedios (evita cascada tediosa).
    if status == 'preparing' and previous_status in (None, 'pending'):
        customer_msg = ORDER_CUSTOMER_MESSAGES['accepted']
    elif status in ('preparing', 'ready'):
        customer_msg = None
    else:
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
        send_push_to_user(order.customer, title, customer_msg, data, channel_id='orders_v3')

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

    # Broadcast a repartidores solo al pasar a ready (una vez por transición).
    if status == 'ready' and previous_status != 'ready':
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
                channel_id='deliveries_v3',
            )
        elif status == 'cancelled':
            send_push_to_user(
                order.driver,
                title,
                f'El pedido {ref} fue cancelado.',
                data,
                channel_id='deliveries_v3',
            )


def notify_shipment_status(shipment, previous_status=None):
    try:
        from realtime.broadcast import broadcast_shipment_updated

        broadcast_shipment_updated(shipment)
    except Exception:
        logger.exception(
            'realtime shipment.updated failed for shipment %s',
            getattr(shipment, 'id', None),
        )

    title = f'Envío #{shipment.id}'
    data = {'shipmentId': shipment.id, 'status': shipment.status, 'type': 'shipment'}
    status = shipment.status

    customer_msg = SHIPMENT_CUSTOMER_MESSAGES.get(status)
    if status == 'on_the_way' and shipment.driver:
        customer_msg = f'¡Tu paquete va en camino! {_driver_name(shipment.driver)} te lo lleva.'
    if customer_msg:
        send_push_to_user(shipment.customer, title, customer_msg, data, channel_id='deliveries_v3')

    # Solo al crear / llegar a pending (no re-broadcast si ya estaba pending).
    if status == 'pending' and previous_status != 'pending':
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
            send_push_to_user(shipment.driver, title, driver_msg, data, channel_id='deliveries_v3')


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
        channel_id='orders_v3',
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
        channel_id='deliveries_v3',
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
        send_push_to_user(favorite.user, title, body, data, channel_id='orders_v3')


def notify_awaiting_online_payment(order) -> None:
    """Pedido en línea sin pagar: no notificar al restaurante.

    Tampoco push inmediato al cliente: ya está en el flujo de pago y un
    aviso concurrente al abrir Stripe ha causado cierres en iOS.
    """
    return


def notify_payment_confirmed(order) -> None:
    """Tras cobrar: el pedido se realiza y el restaurante puede aceptarlo."""
    try:
        from realtime.broadcast import broadcast_order_updated

        broadcast_order_updated(order)
    except Exception:
        logger.exception('realtime order.updated (payment) failed for order %s', getattr(order, 'id', None))

    ref = _order_ref(order)
    title = f'Pedido {ref}'
    data = {'orderId': order.id, 'status': order.status, 'type': 'payment_confirmed'}
    total_label = f'${order.total:.2f}'
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el restaurante'

    send_push_to_user(
        order.customer,
        title,
        f'Pago recibido ({total_label}). {restaurant_name} confirmará pronto.',
        data,
        channel_id='orders_v3',
    )

    if order.restaurant and order.restaurant.owner:
        send_push_to_user(
            order.restaurant.owner,
            title,
            f'¡Nuevo pedido! {ref} por {total_label}. Confírmalo en la app.',
            data,
        )


def notify_pending_order_reminder(order) -> bool:
    if not order.restaurant or not order.restaurant.owner:
        return True
    ref = _order_ref(order)
    data = {'orderId': order.id, 'status': order.status, 'type': 'pending_reminder'}
    return send_push_to_user(
        order.restaurant.owner,
        f'Pedido {ref}',
        f'El pedido {ref} sigue esperando confirmación. Respóndele al cliente.',
        data,
    )


def notify_ready_no_driver(order) -> bool:
    ref = _order_ref(order)
    data = {'orderId': order.id, 'status': order.status, 'type': 'ready_no_driver'}
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el local'

    ok_owner = True
    if order.restaurant and order.restaurant.owner:
        ok_owner = send_push_to_user(
            order.restaurant.owner,
            f'Pedido {ref}',
            f'Pedido {ref} listo — aún sin repartidor.',
            data,
        )

    ok_drivers = _broadcast_to_available_drivers(
        'Entrega urgente',
        f'Pedido {ref} lleva rato esperando en {restaurant_name}.',
        data,
    )
    return ok_owner and ok_drivers


def notify_review_reminder(order) -> bool:
    ref = _order_ref(order)
    restaurant_name = order.restaurant.name if order.restaurant_id else 'el restaurante'
    return send_push_to_user(
        order.customer,
        f'Pedido {ref}',
        f'¿Cómo estuvo tu pedido en {restaurant_name}? Déjanos una reseña.',
        {
            'orderId': order.id,
            'status': 'delivered',
            'type': 'review_reminder',
        },
        channel_id='orders_v3',
    )


def notify_shipment_pending_reminder(shipment) -> bool:
    return send_push_to_user(
        shipment.customer,
        f'Envío #{shipment.id}',
        f'Tu envío #{shipment.id} sigue buscando repartidor. Te avisamos cuando alguien lo tome.',
        {
            'shipmentId': shipment.id,
            'status': 'pending',
            'type': 'shipment_pending_reminder',
        },
        channel_id='deliveries_v3',
    )

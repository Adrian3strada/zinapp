"""Helpers to publish realtime events to Channels groups."""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def user_group(user_id: int) -> str:
    return f'user_{user_id}'


def order_group(order_id: int) -> str:
    return f'order_{order_id}'


def shipment_group(shipment_id: int) -> str:
    return f'shipment_{shipment_id}'


def restaurant_group(restaurant_id: int) -> str:
    return f'restaurant_{restaurant_id}'


DRIVERS_AVAILABLE_GROUP = 'drivers_available'


def _send(group: str, event_type: str, data: dict[str, Any]) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            group,
            {
                'type': 'realtime.event',
                'event': event_type,
                'data': data,
            },
        )
    except Exception:
        logger.exception('realtime broadcast failed group=%s event=%s', group, event_type)


def broadcast_to_group(group: str, event_type: str, data: dict[str, Any]) -> None:
    _send(group, event_type, data)


def broadcast_order_updated(order) -> None:
    data = {
        'orderId': order.id,
        'status': order.status,
        'driverId': order.driver_id,
        'restaurantId': order.restaurant_id,
        'customerId': order.customer_id,
        'code': getattr(order, 'code', '') or '',
    }
    if order.driver_id and hasattr(order, 'driver') and order.driver:
        profile = getattr(order.driver, 'delivery_profile', None)
        if profile and profile.current_latitude is not None:
            data['driverLatitude'] = float(profile.current_latitude)
            data['driverLongitude'] = float(profile.current_longitude)

    _send(order_group(order.id), 'order.updated', data)
    _send(user_group(order.customer_id), 'order.updated', data)
    if order.driver_id:
        _send(user_group(order.driver_id), 'order.updated', data)
    if order.restaurant_id:
        _send(restaurant_group(order.restaurant_id), 'restaurant.orders', {
            **data,
            'kind': 'order',
        })
        owner_id = getattr(getattr(order, 'restaurant', None), 'owner_id', None)
        if owner_id:
            _send(user_group(owner_id), 'restaurant.orders', {
                **data,
                'kind': 'order',
            })


def broadcast_shipment_updated(shipment) -> None:
    data = {
        'shipmentId': shipment.id,
        'status': shipment.status,
        'driverId': shipment.driver_id,
        'customerId': shipment.customer_id,
        'type': 'shipment',
    }
    _send(shipment_group(shipment.id), 'shipment.updated', data)
    _send(user_group(shipment.customer_id), 'shipment.updated', data)
    if shipment.driver_id:
        _send(user_group(shipment.driver_id), 'shipment.updated', data)


def broadcast_order_message(msg) -> None:
    order = msg.order
    data = {
        'orderId': order.id,
        'messageId': msg.id,
        'body': msg.body,
        'senderId': msg.sender_id,
        'senderName': (
            msg.sender.get_full_name()
            or msg.sender.first_name
            or msg.sender.username
        ),
        'createdAt': msg.created_at.isoformat() if msg.created_at else None,
    }
    _send(order_group(order.id), 'order.message', data)


def broadcast_driver_location(driver_user, latitude: float, longitude: float, *, order_ids=None, shipment_ids=None) -> None:
    data = {
        'driverId': driver_user.id,
        'latitude': latitude,
        'longitude': longitude,
    }
    for oid in order_ids or []:
        payload = {**data, 'orderId': oid}
        _send(order_group(oid), 'driver.location', payload)
    for sid in shipment_ids or []:
        payload = {**data, 'shipmentId': sid, 'type': 'shipment'}
        _send(shipment_group(sid), 'driver.location', payload)


def broadcast_drivers_job(*, kind: str, ref_id: int, title: str, body: str = '') -> None:
    data = {
        'kind': kind,
        'id': ref_id,
        'title': title,
        'body': body,
    }
    _send(DRIVERS_AVAILABLE_GROUP, 'drivers.job', data)

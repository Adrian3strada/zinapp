"""Transiciones de estado de pedidos desde el POS (aislado por restaurante)."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from orders.models import (
    CancellationSource,
    Order,
    OrderSource,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
)
from orders.serializers import OrderStatusUpdateSerializer

from ..exceptions import PosError
from ..selectors.orders import order_for_restaurant

ALLOWED_PREP = {10, 15, 20, 25, 30, 40, 45, 60}


def _locked_order(*, restaurant, order_id: int) -> Order:
    order = (
        Order.objects.select_for_update()
        .select_related('restaurant', 'customer')
        .filter(pk=order_id, restaurant=restaurant)
        .first()
    )
    if not order:
        raise PosError('Pedido no encontrado.')
    return order


def _apply_status(order: Order, new_status: str, **context) -> Order:
    serializer = OrderStatusUpdateSerializer(
        data={'status': new_status},
        context={'order': order, **context},
    )
    if not serializer.is_valid():
        errors = serializer.errors.get('status') or serializer.errors
        if isinstance(errors, list):
            message = str(errors[0])
        else:
            message = str(errors)
        raise PosError(message)
    serializer.save()
    order.refresh_from_db()
    return order


@transaction.atomic
def accept_order(*, restaurant, order_id: int, prep_minutes: int = 15) -> Order:
    order = _locked_order(restaurant=restaurant, order_id=order_id)
    if order.status != OrderStatus.PENDING:
        raise PosError('Solo se pueden aceptar pedidos pendientes.')
    if (
        order.payment_method == PaymentMethod.ONLINE
        and order.payment_status != PaymentStatus.PAID
    ):
        raise PosError('El pago en línea aún no está confirmado.')
    try:
        prep = int(prep_minutes)
    except (TypeError, ValueError):
        prep = 15
    if prep not in ALLOWED_PREP:
        raise PosError('Tiempo de preparación no válido.')
    return _apply_status(order, OrderStatus.PREPARING, prep_minutes=prep)


@transaction.atomic
def reject_order(*, restaurant, order_id: int) -> Order:
    order = _locked_order(restaurant=restaurant, order_id=order_id)
    if order.status != OrderStatus.PENDING:
        raise PosError('Solo se pueden rechazar pedidos pendientes.')
    return _apply_status(
        order,
        OrderStatus.CANCELLED,
        cancellation_source=CancellationSource.RESTAURANT_REJECT,
    )


@transaction.atomic
def set_order_status(*, restaurant, order_id: int, new_status: str) -> Order:
    order = _locked_order(restaurant=restaurant, order_id=order_id)

    if order.status == OrderStatus.ON_THE_WAY:
        raise PosError(
            'El pedido ya va en camino. Solo el repartidor puede marcarlo entregado.'
        )

    # Completar en mostrador: POS / takeaway / phone listos → entregado.
    if (
        new_status == OrderStatus.DELIVERED
        and order.status == OrderStatus.READY
        and order.source != OrderSource.ZINAPP
    ):
        order.status = OrderStatus.DELIVERED
        order.delivered_at = timezone.now()
        order.save(update_fields=['status', 'delivered_at', 'updated_at'])
        return order

    if new_status == OrderStatus.DELIVERED and order.source == OrderSource.ZINAPP:
        raise PosError('Los pedidos ZinApp los completa el repartidor.')

    return _apply_status(order, new_status)


def get_order_or_error(*, restaurant, order_id: int) -> Order:
    order = order_for_restaurant(restaurant=restaurant, order_id=order_id)
    if not order:
        raise PosError('Pedido no encontrado.')
    return order

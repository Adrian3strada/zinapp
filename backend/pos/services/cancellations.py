"""Cancelación de ventas POS con reversión de caja e inventario."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from orders.models import CancellationSource, Order, OrderSource, OrderStatus

from ..exceptions import PosError
from ..models import CashMovement, CashMovementType, CashSessionStatus, POSSale
from ..selectors.orders import order_for_restaurant
from .inventory import restore_stock_for_order


@transaction.atomic
def cancel_pos_sale(
    *,
    restaurant,
    order_id: int,
    user,
    reason: str = '',
) -> Order:
    """
    Cancela una venta POS (no borra).
    Si hubo movimiento de efectivo `sale`, crea `cancellation` por el mismo monto.
    Restaura stock si el producto trackea inventario.
    """
    order = (
        Order.objects.select_for_update()
        .select_related('pos_sale', 'restaurant')
        .filter(pk=order_id, restaurant=restaurant)
        .first()
    )
    if not order:
        raise PosError('Venta no encontrada.')
    if order.source != OrderSource.POS:
        raise PosError('Solo se pueden cancelar ventas POS desde esta acción.')
    if order.status == OrderStatus.CANCELLED:
        raise PosError('La venta ya está cancelada.')

    reason = (reason or '').strip()[:255]
    if not reason:
        raise PosError('Indica el motivo de cancelación.')

    pos_sale = getattr(order, 'pos_sale', None)
    if pos_sale is None:
        pos_sale = POSSale.objects.create(order=order)

    sale_movements = list(
        CashMovement.objects.select_for_update().filter(
            order=order,
            type=CashMovementType.SALE,
            restaurant=restaurant,
        )
    )
    for sale_mv in sale_movements:
        session = sale_mv.session
        if session.status != CashSessionStatus.OPEN:
            raise PosError(
                'No se puede cancelar: la caja de esta venta ya está cerrada. '
                'Haz un ajuste manual si es necesario.'
            )
        if CashMovement.objects.filter(
            session=session,
            order=order,
            type=CashMovementType.CANCELLATION,
        ).exists():
            raise PosError('Esta venta ya tiene una cancelación de caja registrada.')
        try:
            CashMovement.objects.create(
                session=session,
                restaurant=restaurant,
                order=order,
                type=CashMovementType.CANCELLATION,
                amount=sale_mv.amount,
                description=f'Cancelación venta {order.display_ref}: {reason}'[:255],
                created_by=user,
            )
        except IntegrityError as exc:
            raise PosError('Cancelación de caja duplicada.') from exc

    restore_stock_for_order(order)

    order.status = OrderStatus.CANCELLED
    order.cancellation_source = CancellationSource.POS
    order.save(update_fields=['status', 'cancellation_source', 'updated_at'])

    pos_sale.cancelled_by = user
    pos_sale.cancelled_at = timezone.now()
    pos_sale.cancel_reason = reason
    pos_sale.save(update_fields=['cancelled_by', 'cancelled_at', 'cancel_reason', 'updated_at'])

    return order_for_restaurant(restaurant=restaurant, order_id=order.id)

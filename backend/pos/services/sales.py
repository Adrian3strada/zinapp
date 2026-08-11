"""Creación atómica de ventas POS (precios siempre desde DB)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from rest_framework import serializers as drf_serializers

from orders.codes import assign_unique_order_code
from orders.models import (
    IdempotencyRecord,
    Order,
    OrderItem,
    OrderSource,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
)
from restaurants.models import Product
from restaurants.options import resolve_selected_options
from restaurants.promotions import calculate_promo_line_total

from ..exceptions import PosError
from ..models import CashMovement, CashMovementType, CashSessionStatus, POSSale
from .cash import get_open_session_for_restaurant
from .inventory import assert_stock_available, decrement_stock_for_lines

POS_SALE_SCOPE = 'pos_sale'
POS_PAYMENT_METHODS = {
    PaymentMethod.CASH,
    PaymentMethod.CARD,
    PaymentMethod.TRANSFER,
    PaymentMethod.OTHER,
}


def _as_decimal(value, field_name: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise PosError(f'{field_name} inválido.') from exc
    return amount.quantize(Decimal('0.01'))


def _idempotency_begin(user, key: str):
    existing = IdempotencyRecord.objects.filter(
        key=key, user=user, scope=POS_SALE_SCOPE,
    ).first()
    if existing:
        if existing.status == IdempotencyRecord.Status.COMPLETED:
            return 'replay', existing
        raise PosError('Tu cobro se está procesando. Espera unos segundos.', code='idempotent_pending')
    try:
        with transaction.atomic():
            IdempotencyRecord.objects.create(
                key=key,
                user=user,
                scope=POS_SALE_SCOPE,
                status=IdempotencyRecord.Status.PENDING,
            )
    except IntegrityError:
        existing = IdempotencyRecord.objects.filter(
            key=key, user=user, scope=POS_SALE_SCOPE,
        ).first()
        if existing and existing.status == IdempotencyRecord.Status.COMPLETED:
            return 'replay', existing
        raise PosError('Tu cobro se está procesando. Espera unos segundos.', code='idempotent_pending')
    return 'new', None


def _idempotency_complete(user, key: str, body: dict, status_code: int = 201):
    IdempotencyRecord.objects.filter(key=key, user=user, scope=POS_SALE_SCOPE).update(
        status=IdempotencyRecord.Status.COMPLETED,
        response_body=body,
        status_code=status_code,
    )


def _idempotency_clear(user, key: str):
    IdempotencyRecord.objects.filter(key=key, user=user, scope=POS_SALE_SCOPE).delete()


def _replay_order(record: IdempotencyRecord) -> Order:
    order_id = (record.response_body or {}).get('order_id')
    if not order_id:
        raise PosError('Respuesta de idempotencia inválida.')
    order = (
        Order.objects.select_related('restaurant', 'pos_sale')
        .prefetch_related('items__product')
        .filter(pk=order_id)
        .first()
    )
    if not order:
        raise PosError('La venta idempotente ya no existe.')
    return order


@transaction.atomic
def create_pos_sale(
    *,
    restaurant,
    user,
    items: list[dict],
    payment_method: str,
    amount_received=None,
    discount_amount=Decimal('0.00'),
    idempotency_key: str | None = None,
) -> Order:
    """
    Crea Order + OrderItems + POSSale (+ CashMovement si efectivo).

    `items`: [{product_id, quantity, option_ids?, notes?}, ...]
    Precios y opciones se resuelven siempre desde la base de datos.
    """
    if not restaurant.pos_enabled:
        raise PosError('El POS no está habilitado para este restaurante.')

    if payment_method not in POS_PAYMENT_METHODS:
        raise PosError('Método de pago no válido para POS.')

    if not items:
        raise PosError('La venta debe tener al menos un producto.')

    key = (idempotency_key or '').strip()
    if key:
        if len(key) > 64:
            raise PosError('Clave de idempotencia inválida.')
        state, record = _idempotency_begin(user, key)
        if state == 'replay':
            return _replay_order(record)

    try:
        order = _create_sale_inner(
            restaurant=restaurant,
            user=user,
            items=items,
            payment_method=payment_method,
            amount_received=amount_received,
            discount_amount=discount_amount,
        )
    except Exception:
        if key:
            _idempotency_clear(user, key)
        raise

    if key:
        _idempotency_complete(user, key, {'order_id': order.id})
    return order


def _create_sale_inner(
    *,
    restaurant,
    user,
    items,
    payment_method,
    amount_received,
    discount_amount,
) -> Order:
    cash_session = None
    if payment_method == PaymentMethod.CASH:
        cash_session = get_open_session_for_restaurant(restaurant)
        if not cash_session or cash_session.status != CashSessionStatus.OPEN:
            raise PosError('Debes abrir una caja antes de cobrar en efectivo.')

    discount = _as_decimal(discount_amount or 0, 'descuento')
    if discount < 0:
        raise PosError('El descuento no puede ser negativo.')

    line_rows = []
    subtotal = Decimal('0.00')

    product_ids = [int(row['product_id']) for row in items]
    products = {
        p.id: p
        for p in Product.objects.filter(
            id__in=product_ids,
            restaurant=restaurant,
        ).prefetch_related('option_groups__options')
    }

    for row in items:
        try:
            product_id = int(row['product_id'])
            quantity = int(row.get('quantity') or 0)
        except (TypeError, ValueError) as exc:
            raise PosError('Producto o cantidad inválidos.') from exc

        if quantity < 1:
            raise PosError('La cantidad debe ser al menos 1.')

        product = products.get(product_id)
        if not product:
            raise PosError('Hay productos que no pertenecen a este restaurante.')
        if not product.is_available:
            raise PosError(f'«{product.name}» no está disponible.')
        assert_stock_available(product, quantity)

        try:
            options_snapshot, options_extra = resolve_selected_options(
                product,
                row.get('option_ids') or [],
            )
        except drf_serializers.ValidationError as exc:
            detail = exc.detail
            if isinstance(detail, dict):
                msg = detail.get('option_ids') or detail
            else:
                msg = detail
            if isinstance(msg, list):
                msg = msg[0]
            raise PosError(str(msg)) from exc

        line_total, _promo = calculate_promo_line_total(product, quantity)
        line_total = (line_total + options_extra * quantity).quantize(Decimal('0.01'))
        notes = (row.get('notes') or '')[:255]
        line_rows.append((product, quantity, options_snapshot, line_total, notes))
        subtotal += line_total

    if discount > subtotal:
        raise PosError('El descuento no puede ser mayor al subtotal.')

    total = (subtotal - discount).quantize(Decimal('0.01'))

    received = None
    change = None
    if payment_method == PaymentMethod.CASH:
        if amount_received is None:
            raise PosError('Indica el efectivo recibido.')
        received = _as_decimal(amount_received, 'efectivo recibido')
        if received < total:
            raise PosError('El efectivo recibido es menor al total.')
        change = (received - total).quantize(Decimal('0.01'))

    order = Order(
        customer=None,
        restaurant=restaurant,
        source=OrderSource.POS,
        created_by=user,
        status=OrderStatus.PREPARING,
        payment_method=payment_method,
        payment_status=PaymentStatus.PAID,
        delivery_address='',
        delivery_fee=Decimal('0.00'),
        tip_amount=Decimal('0.00'),
        discount_amount=discount,
        subtotal=subtotal,
        total=total,
    )
    assign_unique_order_code(order)
    order.save()

    decrement_stock_for_lines(line_rows)

    for product, quantity, options_snapshot, line_total, notes in line_rows:
        unit = (line_total / quantity).quantize(Decimal('0.01')) if quantity else product.price
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=quantity,
            unit_price=unit,
            notes=notes,
            selected_options=options_snapshot,
        )

    # Recalcular por si hay drift; forzar delivery_fee/tip en 0.
    order.delivery_fee = Decimal('0.00')
    order.tip_amount = Decimal('0.00')
    order.discount_amount = discount
    order.recalculate_totals()

    next_folio = (
        POSSale.objects.filter(order__restaurant=restaurant)
        .order_by('-local_folio')
        .values_list('local_folio', flat=True)
        .first()
    )
    local_folio = (next_folio or 0) + 1

    POSSale.objects.create(
        order=order,
        cash_session=cash_session,
        amount_received=received,
        change_given=change,
        local_folio=local_folio,
    )

    if payment_method == PaymentMethod.CASH and cash_session:
        try:
            CashMovement.objects.create(
                session=cash_session,
                restaurant=restaurant,
                order=order,
                type=CashMovementType.SALE,
                amount=order.total,
                description=f'Venta POS {order.display_ref}',
                created_by=user,
            )
        except IntegrityError as exc:
            raise PosError('Movimiento de caja duplicado para esta venta.') from exc

    return (
        Order.objects.select_related('restaurant', 'pos_sale', 'created_by')
        .prefetch_related('items__product')
        .get(pk=order.pk)
    )


def serialize_cart_preview(*, restaurant, items: list[dict], discount_amount=Decimal('0.00')) -> dict:
    """Calcula totales de carrito sin persistir (para UI)."""
    if not items:
        return {
            'subtotal': '0.00',
            'discount_amount': '0.00',
            'total': '0.00',
            'lines': [],
        }

    discount = _as_decimal(discount_amount or 0, 'descuento')
    if discount < 0:
        raise PosError('El descuento no puede ser negativo.')

    product_ids = [int(row['product_id']) for row in items]
    products = {
        p.id: p
        for p in Product.objects.filter(
            id__in=product_ids,
            restaurant=restaurant,
            is_available=True,
        ).prefetch_related('option_groups__options')
    }

    lines = []
    subtotal = Decimal('0.00')
    for row in items:
        product = products.get(int(row['product_id']))
        if not product:
            raise PosError('Producto no disponible.')
        quantity = int(row.get('quantity') or 0)
        if quantity < 1:
            raise PosError('Cantidad inválida.')
        try:
            options_snapshot, options_extra = resolve_selected_options(
                product, row.get('option_ids') or [],
            )
        except drf_serializers.ValidationError as exc:
            raise PosError('Opciones inválidas.') from exc
        line_total, _ = calculate_promo_line_total(product, quantity)
        line_total = (line_total + options_extra * quantity).quantize(Decimal('0.01'))
        subtotal += line_total
        lines.append({
            'product_id': product.id,
            'name': product.name,
            'quantity': quantity,
            'unit_price': str((line_total / quantity).quantize(Decimal('0.01'))),
            'line_total': str(line_total),
            'options': options_snapshot,
            'notes': (row.get('notes') or '')[:255],
        })

    if discount > subtotal:
        raise PosError('El descuento no puede ser mayor al subtotal.')
    total = (subtotal - discount).quantize(Decimal('0.01'))
    return {
        'subtotal': str(subtotal),
        'discount_amount': str(discount),
        'total': str(total),
        'lines': lines,
    }

from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from ..exceptions import PosError
from ..models import CashMovement, CashMovementType, CashRegister, CashSession, CashSessionStatus


def get_or_create_default_register(restaurant) -> CashRegister:
    register = (
        CashRegister.objects.filter(restaurant=restaurant, is_active=True)
        .order_by('id')
        .first()
    )
    if register:
        return register
    return CashRegister.objects.create(
        restaurant=restaurant,
        name='Caja principal',
        is_active=True,
    )


def get_open_session_for_restaurant(restaurant) -> CashSession | None:
    return (
        CashSession.objects.filter(
            restaurant=restaurant,
            status=CashSessionStatus.OPEN,
        )
        .select_related('cash_register', 'opened_by')
        .order_by('-opened_at')
        .first()
    )


def get_open_session_for_register(cash_register: CashRegister) -> CashSession | None:
    return (
        CashSession.objects.filter(
            cash_register=cash_register,
            status=CashSessionStatus.OPEN,
        )
        .select_related('opened_by')
        .first()
    )


@transaction.atomic
def open_cash_session(*, restaurant, user, cash_register_id: int | None, opening_amount: Decimal) -> CashSession:
    if opening_amount < 0:
        raise PosError('El monto inicial no puede ser negativo.')

    if cash_register_id:
        register = CashRegister.objects.filter(
            pk=cash_register_id,
            restaurant=restaurant,
            is_active=True,
        ).first()
        if not register:
            raise PosError('Caja no encontrada o inactiva.')
    else:
        register = get_or_create_default_register(restaurant)

    if get_open_session_for_register(register):
        raise PosError('Esta caja ya tiene una sesión abierta.')

    try:
        return CashSession.objects.create(
            cash_register=register,
            restaurant=restaurant,
            opened_by=user,
            opening_amount=opening_amount.quantize(Decimal('0.01')),
            status=CashSessionStatus.OPEN,
        )
    except IntegrityError as exc:
        raise PosError('Esta caja ya tiene una sesión abierta.') from exc


def compute_expected_cash(session: CashSession) -> Decimal:
    opening = session.opening_amount or Decimal('0.00')
    agg = session.movements.aggregate(
        sales=Sum('amount', filter=models_q_type(CashMovementType.SALE)),
        cash_in=Sum('amount', filter=models_q_type(CashMovementType.CASH_IN)),
        cash_out=Sum('amount', filter=models_q_type(CashMovementType.CASH_OUT)),
        adjustments=Sum('amount', filter=models_q_type(CashMovementType.ADJUSTMENT)),
        cancellations=Sum('amount', filter=models_q_type(CashMovementType.CANCELLATION)),
    )
    sales = agg['sales'] or Decimal('0.00')
    cash_in = agg['cash_in'] or Decimal('0.00')
    cash_out = agg['cash_out'] or Decimal('0.00')
    adjustments = agg['adjustments'] or Decimal('0.00')
    cancellations = agg['cancellations'] or Decimal('0.00')
    # cancellations se registran como montos negativos o positivos a restar
    return (opening + sales + cash_in + adjustments - cash_out - cancellations).quantize(
        Decimal('0.01')
    )


def models_q_type(movement_type: str):
    from django.db.models import Q

    return Q(type=movement_type)


@transaction.atomic
def close_cash_session(*, session: CashSession, user, counted_amount: Decimal) -> CashSession:
    if session.status != CashSessionStatus.OPEN:
        raise PosError('La sesión de caja ya está cerrada.')
    if counted_amount < 0:
        raise PosError('El monto contado no puede ser negativo.')

    session = CashSession.objects.select_for_update().get(pk=session.pk)
    if session.status != CashSessionStatus.OPEN:
        raise PosError('La sesión de caja ya está cerrada.')

    expected = compute_expected_cash(session)
    counted = counted_amount.quantize(Decimal('0.01'))
    session.expected_amount = expected
    session.counted_amount = counted
    session.difference = (counted - expected).quantize(Decimal('0.01'))
    session.closed_by = user
    session.closed_at = timezone.now()
    session.status = CashSessionStatus.CLOSED
    session.save(
        update_fields=[
            'expected_amount', 'counted_amount', 'difference',
            'closed_by', 'closed_at', 'status',
        ]
    )
    return session


@transaction.atomic
def add_manual_movement(
    *,
    session: CashSession,
    restaurant,
    user,
    movement_type: str,
    amount: Decimal,
    description: str = '',
) -> CashMovement:
    if session.status != CashSessionStatus.OPEN:
        raise PosError('La caja no está abierta.')
    if session.restaurant_id != restaurant.id:
        raise PosError('Sesión de caja de otro restaurante.')
    if movement_type not in {
        CashMovementType.CASH_IN,
        CashMovementType.CASH_OUT,
        CashMovementType.ADJUSTMENT,
    }:
        raise PosError('Tipo de movimiento no permitido.')
    if amount <= 0:
        raise PosError('El monto debe ser mayor a cero.')

    return CashMovement.objects.create(
        session=session,
        restaurant=restaurant,
        type=movement_type,
        amount=amount.quantize(Decimal('0.01')),
        description=(description or '')[:255],
        created_by=user,
    )

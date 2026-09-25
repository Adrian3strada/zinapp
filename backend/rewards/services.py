"""Cálculo y consumo de beneficios de envío. Única fuente de verdad (no el cliente)."""

from __future__ import annotations

from calendar import isleap
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from orders.models import Order, OrderSource, OrderStatus
from .models import (
    BenefitKind,
    LoyaltyProgressEvent,
    RedemptionStatus,
    ReferralCredit,
    RewardProgramConfig,
    RewardRedemption,
)

FREE_DELIVERY_COUPON_CODES = frozenset({'ENVIO0'})

BENEFIT_LABELS = {
    BenefitKind.BIRTHDAY: 'Beneficio ZinApp: Envío de cumpleaños',
    BenefitKind.LOYALTY: 'Beneficio ZinApp: Envío gratis',
    BenefitKind.REFERRAL_INVITEE: 'Beneficio ZinApp: Envío de bienvenida',
    BenefitKind.REFERRAL_CREDIT: 'Beneficio ZinApp: Envío por referido',
}


def get_program_config() -> RewardProgramConfig:
    defaults = {
        'birthday_enabled': settings.REWARDS_BIRTHDAY_ENABLED,
        'loyalty_enabled': settings.REWARDS_LOYALTY_ENABLED,
        'loyalty_orders_required': settings.REWARDS_LOYALTY_ORDERS_REQUIRED,
        'delivery_discount_cap': settings.REWARDS_DELIVERY_DISCOUNT_CAP,
    }
    obj, _created = RewardProgramConfig.objects.get_or_create(pk=1, defaults=defaults)
    return obj


def today_local() -> date:
    return timezone.localdate()


def is_birthday_on(dob: date | None, day: date | None = None) -> bool:
    if not dob:
        return False
    day = day or today_local()
    if dob.month == 2 and dob.day == 29:
        if day.month == 2 and day.day == 29:
            return True
        return (not isleap(day.year)) and day.month == 3 and day.day == 1
    return day.month == dob.month and day.day == dob.day


def _shift_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(month=2, day=28, year=day.year - years)


def next_birthday_on_or_after(dob: date, day: date) -> date:
    this = _birthday_in_year(dob, day.year)
    if this >= day:
        return this
    return _birthday_in_year(dob, day.year + 1)


def _birthday_in_year(dob: date, year: int) -> date:
    if dob.month == 2 and dob.day == 29 and not isleap(year):
        return date(year, 3, 1)
    try:
        return dob.replace(year=year)
    except ValueError:
        return date(year, 3, 1)


def days_until_birthday(dob: date, day: date | None = None) -> int:
    day = day or today_local()
    nxt = next_birthday_on_or_after(dob, day)
    return (nxt - day).days


def benefit_label(kind: str | None) -> str | None:
    if not kind:
        return None
    return BENEFIT_LABELS.get(kind)


def is_free_delivery_coupon(coupon) -> bool:
    if not coupon:
        return False
    return (coupon.code or '').upper() in FREE_DELIVERY_COUPON_CODES


def _active_birthday_q(user, year: int):
    return Q(
        user=user,
        kind=BenefitKind.BIRTHDAY,
        year=year,
        status__in=[RedemptionStatus.RESERVED, RedemptionStatus.CONSUMED],
    )


def birthday_used_or_reserved(user, year: int | None = None) -> bool:
    year = year if year is not None else today_local().year
    return RewardRedemption.objects.filter(_active_birthday_q(user, year)).exists()


def last_consumed_loyalty(user) -> RewardRedemption | None:
    return (
        RewardRedemption.objects.filter(
            user=user,
            kind=BenefitKind.LOYALTY,
            status=RedemptionStatus.CONSUMED,
        )
        .order_by('-consumed_at', '-id')
        .first()
    )


def loyalty_events_qs(user):
    qs = LoyaltyProgressEvent.objects.filter(user=user)
    last = last_consumed_loyalty(user)
    if last and last.consumed_at:
        qs = qs.filter(created_at__gt=last.consumed_at)
    return qs


def loyalty_completed_in_cycle(user, required: int) -> int:
    n = loyalty_events_qs(user).count()
    return min(n, required)


def loyalty_unlocked(user, cfg: RewardProgramConfig | None = None) -> bool:
    cfg = cfg or get_program_config()
    if not cfg.loyalty_enabled:
        return False
    if RewardRedemption.objects.filter(
        user=user,
        kind=BenefitKind.LOYALTY,
        status=RedemptionStatus.RESERVED,
    ).exists():
        return False
    return loyalty_events_qs(user).count() >= cfg.loyalty_orders_required


def birthday_available(user, cfg: RewardProgramConfig | None = None) -> bool:
    cfg = cfg or get_program_config()
    if not cfg.birthday_enabled:
        return False
    if not user.date_of_birth:
        return False
    if not is_birthday_on(user.date_of_birth):
        return False
    return not birthday_used_or_reserved(user)


def referral_invitee_available(user) -> bool:
    if not getattr(user, 'referred_by_id', None):
        return False
    return not RewardRedemption.objects.filter(
        user=user,
        kind=BenefitKind.REFERRAL_INVITEE,
        status__in=[RedemptionStatus.RESERVED, RedemptionStatus.CONSUMED],
    ).exists()


def unused_referral_credits(user):
    return ReferralCredit.objects.filter(
        user=user,
        status=ReferralCredit.Status.UNUSED,
    )


def referral_credit_available(user) -> bool:
    if RewardRedemption.objects.filter(
        user=user,
        kind=BenefitKind.REFERRAL_CREDIT,
        status=RedemptionStatus.RESERVED,
    ).exists():
        return False
    return unused_referral_credits(user).exists()


def apply_referral_code(user, code: str):
    """Vincula un cliente a quien lo invitó. No se puede cambiar después."""
    from django.core.exceptions import ValidationError

    from accounts.models import UserRole

    raw = (code or '').strip().upper()
    if not raw:
        raise ValidationError('Indica un código de referido.')
    if getattr(user, 'role', None) != UserRole.CUSTOMER:
        raise ValidationError('Solo clientes pueden usar un código de referido.')
    if getattr(user, 'referred_by_id', None):
        raise ValidationError('Ya usaste un código de referido.')
    referrer = type(user).objects.filter(
        referral_code__iexact=raw,
        role=UserRole.CUSTOMER,
    ).first()
    if not referrer:
        raise ValidationError('Ese código no existe.')
    if referrer.pk == user.pk:
        raise ValidationError('No puedes usar tu propio código.')
    user.referred_by = referrer
    user.save(update_fields=['referred_by'])
    return referrer


def choose_checkout_benefit(user, cfg: RewardProgramConfig | None = None) -> str | None:
    cfg = cfg or get_program_config()
    if birthday_available(user, cfg):
        return BenefitKind.BIRTHDAY
    if referral_invitee_available(user):
        return BenefitKind.REFERRAL_INVITEE
    if loyalty_unlocked(user, cfg):
        return BenefitKind.LOYALTY
    if referral_credit_available(user):
        return BenefitKind.REFERRAL_CREDIT
    return None


def discount_for_fee(fee: Decimal, cfg: RewardProgramConfig | None = None) -> Decimal:
    cfg = cfg or get_program_config()
    cap = cfg.delivery_discount_cap or Decimal('0.00')
    amount = min(max(fee, Decimal('0.00')), max(cap, Decimal('0.00')))
    return amount.quantize(Decimal('0.01'))


def validate_date_of_birth(user, new_date: date | None, *, staff: bool = False) -> date | None:
    """Valida cambio de cumpleaños. Lanza ValidationError de Django."""
    if new_date is None:
        if user and getattr(user, 'date_of_birth', None):
            raise ValidationError('La fecha de cumpleaños no se puede borrar.')
        return None

    today = today_local()
    if new_date > today:
        raise ValidationError('La fecha de cumpleaños no puede ser futura.')

    min_age = settings.REWARDS_MIN_AGE
    if new_date > _shift_years(today, min_age):
        raise ValidationError(f'Debes tener al menos {min_age} años.')

    current = getattr(user, 'date_of_birth', None) if user else None
    if current == new_date:
        return new_date

    if staff:
        return new_date

    if current:
        lock_days = settings.REWARDS_BIRTHDAY_LOCK_DAYS
        until = days_until_birthday(current, today)
        if until <= lock_days:
            raise ValidationError(
                'No puedes cambiar tu cumpleaños tan cerca de la fecha.'
            )

        updated = getattr(user, 'birthday_updated_at', None)
        if updated:
            elapsed = (timezone.now() - updated).days
            if elapsed < settings.REWARDS_BIRTHDAY_CHANGE_DAYS:
                raise ValidationError(
                    'Solo puedes cambiar tu cumpleaños una vez al año.'
                )

    return new_date


def can_edit_birthday(user) -> tuple[bool, str | None]:
    if not getattr(user, 'date_of_birth', None):
        return True, None
    today = today_local()
    lock_days = settings.REWARDS_BIRTHDAY_LOCK_DAYS
    until = days_until_birthday(user.date_of_birth, today)
    if until <= lock_days:
        nxt = next_birthday_on_or_after(user.date_of_birth, today) + timedelta(days=1)
        return False, nxt.isoformat()
    updated = user.birthday_updated_at
    if updated:
        ready = updated + timedelta(days=settings.REWARDS_BIRTHDAY_CHANGE_DAYS)
        if timezone.now() < ready:
            return False, timezone.localtime(ready).date().isoformat()
    return True, None


def user_rewards_payload(user) -> dict:
    cfg = get_program_config()
    required = cfg.loyalty_orders_required
    completed = loyalty_completed_in_cycle(user, required)
    unlocked = loyalty_unlocked(user, cfg)
    remaining = 0 if unlocked else max(required - completed, 0)
    bday = user.date_of_birth
    editable, next_edit = can_edit_birthday(user)
    used = birthday_used_or_reserved(user) if bday else False
    last_bday = (
        RewardRedemption.objects.filter(
            user=user,
            kind=BenefitKind.BIRTHDAY,
            status=RedemptionStatus.CONSUMED,
        )
        .order_by('-consumed_at')
        .first()
    )
    kind = choose_checkout_benefit(user, cfg)
    return {
        'birthday': {
            'date': bday.isoformat() if bday else None,
            'can_edit': editable,
            'next_edit_at': next_edit,
            'is_today': is_birthday_on(bday) if bday else False,
            'available': birthday_available(user, cfg),
            'used_this_year': used,
            'last_used_on': last_bday.consumed_at.isoformat() if last_bday and last_bday.consumed_at else None,
        },
        'loyalty': {
            'completed_in_cycle': completed,
            'required': required,
            'remaining': remaining,
            'unlocked': unlocked,
            'qualifying_orders': loyalty_events_qs(user).count(),
        },
        'referral': {
            'code': getattr(user, 'referral_code', '') or '',
            'referred': bool(getattr(user, 'referred_by_id', None)),
            'invitee_available': referral_invitee_available(user),
            'credits': unused_referral_credits(user).count(),
        },
        'next_checkout': {
            'eligible': bool(kind),
            'type': kind,
            'label': benefit_label(kind),
            'cap': f'{cfg.delivery_discount_cap:.2f}',
        },
        'programs': {
            'birthday_enabled': cfg.birthday_enabled,
            'loyalty_enabled': cfg.loyalty_enabled,
        },
    }


def apply_checkout_benefit(order: Order, *, coupon=None) -> RewardRedemption | None:
    """Reserva un beneficio al confirmar el pedido. No aplica si envío es $0."""
    if order.source != OrderSource.ZINAPP:
        return None
    if not order.customer_id:
        return None
    if order.applied_benefit:
        return None
    fee = order.delivery_fee or Decimal('0.00')
    if fee <= 0:
        return None
    if is_free_delivery_coupon(coupon):
        return None

    cfg = get_program_config()
    amount = discount_for_fee(fee, cfg)
    if amount <= 0:
        return None

    user = type(order.customer).objects.select_for_update().get(pk=order.customer_id)
    kind = choose_checkout_benefit(user, cfg)
    if not kind:
        return None

    credit = None
    if kind == BenefitKind.REFERRAL_CREDIT:
        credit = (
            unused_referral_credits(user)
            .select_for_update()
            .order_by('created_at')
            .first()
        )
        if not credit:
            return None

    year = today_local().year if kind == BenefitKind.BIRTHDAY else None
    try:
        with transaction.atomic():
            redemption = RewardRedemption.objects.create(
                user=user,
                order=order,
                kind=kind,
                status=RedemptionStatus.RESERVED,
                year=year,
                delivery_fee=fee,
                discount_amount=amount,
            )
            if credit:
                credit.status = ReferralCredit.Status.RESERVED
                credit.order = order
                credit.save(update_fields=['status', 'order'])
            order.delivery_discount = amount
            order.applied_benefit = kind
            order.save(update_fields=['delivery_discount', 'applied_benefit', 'updated_at'])
    except IntegrityError:
        return None
    return redemption


def consume_redemption(order: Order) -> None:
    redemption = getattr(order, 'reward_redemption', None)
    if redemption is None:
        try:
            redemption = RewardRedemption.objects.get(order=order)
        except RewardRedemption.DoesNotExist:
            return
    if redemption.status != RedemptionStatus.RESERVED:
        return
    redemption.status = RedemptionStatus.CONSUMED
    redemption.consumed_at = timezone.now()
    redemption.save(update_fields=['status', 'consumed_at'])
    if redemption.kind == BenefitKind.REFERRAL_CREDIT:
        ReferralCredit.objects.filter(
            order=order,
            status=ReferralCredit.Status.RESERVED,
        ).update(status=ReferralCredit.Status.CONSUMED)


def release_redemption(order: Order) -> None:
    redemption = getattr(order, 'reward_redemption', None)
    if redemption is None:
        try:
            redemption = RewardRedemption.objects.get(order=order)
        except RewardRedemption.DoesNotExist:
            return
    if redemption.status != RedemptionStatus.RESERVED:
        return
    redemption.status = RedemptionStatus.RELEASED
    redemption.released_at = timezone.now()
    redemption.save(update_fields=['status', 'released_at'])
    if redemption.kind == BenefitKind.REFERRAL_CREDIT:
        ReferralCredit.objects.filter(
            order=order,
            status=ReferralCredit.Status.RESERVED,
        ).update(status=ReferralCredit.Status.UNUSED, order=None)
    # El pedido conserva el snapshot; el beneficio queda disponible de nuevo.


def grant_referrer_credit(order: Order) -> ReferralCredit | None:
    """Tras la primera entrega ZinApp del invitado, el padrino gana un envío."""
    if order.source != OrderSource.ZINAPP:
        return None
    customer = getattr(order, 'customer', None)
    referrer_id = getattr(customer, 'referred_by_id', None) if customer else None
    if not customer or not referrer_id:
        return None
    prior = Order.objects.filter(
        customer=customer,
        status=OrderStatus.DELIVERED,
        source=OrderSource.ZINAPP,
    ).exclude(pk=order.pk).exists()
    if prior:
        return None
    credit, created = ReferralCredit.objects.get_or_create(
        from_user=customer,
        defaults={'user_id': referrer_id},
    )
    if created:
        try:
            from accounts.notifications import notify_referral_credit

            notify_referral_credit(credit)
        except Exception:
            pass
    return credit if created else None


def record_loyalty_progress(order: Order) -> LoyaltyProgressEvent | None:
    if order.source != OrderSource.ZINAPP:
        return None
    if not order.customer_id:
        return None
    if order.applied_benefit == BenefitKind.LOYALTY:
        return None
    event, _created = LoyaltyProgressEvent.objects.get_or_create(
        order=order,
        defaults={'user_id': order.customer_id},
    )
    return event


def on_order_delivered(order: Order) -> None:
    consume_redemption(order)
    record_loyalty_progress(order)
    grant_referrer_credit(order)


def on_order_cancelled(order: Order) -> None:
    release_redemption(order)

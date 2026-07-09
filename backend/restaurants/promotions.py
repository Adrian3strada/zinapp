from decimal import Decimal

from django.utils import timezone

from .models import Product, ProductPromotion, PromoType


def promo_is_active(promo: ProductPromotion | None, at_time=None) -> bool:
    if not promo or not promo.is_active:
        return False
    moment = at_time or timezone.now()
    return promo.valid_until >= moment


def get_active_promotion(product: Product, at_time=None) -> ProductPromotion | None:
    moment = at_time or timezone.now()
    prefetched = getattr(product, 'active_promotions', None)
    if prefetched is not None:
        for promo in prefetched:
            if promo_is_active(promo, moment):
                return promo
        return None

    promo = (
        ProductPromotion.objects.filter(
            product=product,
            is_active=True,
            valid_until__gte=moment,
        )
        .order_by('-valid_until', '-id')
        .first()
    )
    return promo if promo_is_active(promo, moment) else None


def promo_label(promo: ProductPromotion) -> str:
    if promo.label:
        return promo.label.strip()
    if promo.promo_type == PromoType.TWO_FOR_ONE:
        return '2x1'
    if promo.promo_type == PromoType.PERCENT_OFF and promo.percent_off:
        return f'{promo.percent_off}% OFF'
    if promo.promo_type == PromoType.SPECIAL_PRICE and promo.special_price is not None:
        return 'Precio promo'
    return promo.get_promo_type_display()


def calculate_promo_line_total(
    product: Product,
    quantity: int,
    at_time=None,
) -> tuple[Decimal, ProductPromotion | None]:
    qty = max(int(quantity), 0)
    if qty == 0:
        return Decimal('0.00'), None

    base = product.price * qty
    promo = get_active_promotion(product, at_time=at_time)
    if not promo:
        return base.quantize(Decimal('0.01')), None

    if promo.promo_type == PromoType.TWO_FOR_ONE:
        paid_units = (qty + 1) // 2
        total = product.price * paid_units
    elif promo.promo_type == PromoType.PERCENT_OFF:
        percent = Decimal(promo.percent_off or 0)
        total = base * (Decimal('100') - percent) / Decimal('100')
    elif promo.promo_type == PromoType.SPECIAL_PRICE:
        total = (promo.special_price or Decimal('0')) * qty
    else:
        total = base

    return max(total, Decimal('0.00')).quantize(Decimal('0.01')), promo


def effective_unit_price(product: Product, quantity: int, at_time=None) -> Decimal:
    line_total, _ = calculate_promo_line_total(product, quantity, at_time=at_time)
    if quantity <= 0:
        return product.price
    return (line_total / Decimal(quantity)).quantize(Decimal('0.01'))

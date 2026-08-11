"""Resúmenes de corte de caja y reportes POS."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncHour
from django.utils import timezone

from orders.models import Order, OrderItem, OrderSource, OrderStatus, PaymentMethod, PaymentStatus

from ..models import CashMovementType, CashSession
from .cash import compute_expected_cash, models_q_type


def _money(value) -> Decimal:
    return Decimal(value or 0).quantize(Decimal('0.01'))


def session_orders_qs(session: CashSession):
    """Órdenes POS asociadas a la sesión (por cash_session o ventana temporal)."""
    qs = Order.objects.filter(
        restaurant_id=session.restaurant_id,
        source=OrderSource.POS,
    )
    linked = qs.filter(pos_sale__cash_session=session)
    window = qs.filter(created_at__gte=session.opened_at)
    if session.closed_at:
        window = window.filter(created_at__lte=session.closed_at)
    return (linked | window).distinct()


def build_cash_cut_summary(session: CashSession) -> dict:
    opening = _money(session.opening_amount)
    agg = session.movements.aggregate(
        sales=Sum('amount', filter=models_q_type(CashMovementType.SALE)),
        cash_in=Sum('amount', filter=models_q_type(CashMovementType.CASH_IN)),
        cash_out=Sum('amount', filter=models_q_type(CashMovementType.CASH_OUT)),
        adjustments=Sum('amount', filter=models_q_type(CashMovementType.ADJUSTMENT)),
        cancellations=Sum('amount', filter=models_q_type(CashMovementType.CANCELLATION)),
    )
    sales_cash = _money(agg['sales'])
    cash_in = _money(agg['cash_in'])
    cash_out = _money(agg['cash_out'])
    adjustments = _money(agg['adjustments'])
    cancellations = _money(agg['cancellations'])
    expected = compute_expected_cash(session)

    orders = session_orders_qs(session)
    by_method = {
        PaymentMethod.CASH: Decimal('0.00'),
        PaymentMethod.CARD: Decimal('0.00'),
        PaymentMethod.TRANSFER: Decimal('0.00'),
        PaymentMethod.OTHER: Decimal('0.00'),
    }
    sales_count = 0
    cancelled_count = 0
    discounts = Decimal('0.00')
    total_sold = Decimal('0.00')

    for order in orders.only('status', 'payment_method', 'total', 'discount_amount'):
        if order.status == OrderStatus.CANCELLED:
            cancelled_count += 1
            continue
        sales_count += 1
        discounts += _money(order.discount_amount)
        total_sold += _money(order.total)
        method = order.payment_method
        if method in by_method:
            by_method[method] += _money(order.total)

    counted = session.counted_amount
    difference = session.difference
    if counted is not None:
        counted = _money(counted)
        difference = _money(
            difference if difference is not None else (counted - expected)
        )
    else:
        counted = None
        difference = None

    return {
        'session': session,
        'opening_amount': opening,
        'cash_sales': sales_cash,
        'cash_in': cash_in,
        'cash_out': cash_out,
        'adjustments': adjustments,
        'cancellations': cancellations,
        'expected_amount': expected,
        'counted_amount': counted,
        'difference': difference,
        'payment_breakdown': {
            'cash': by_method[PaymentMethod.CASH],
            'card': by_method[PaymentMethod.CARD],
            'transfer': by_method[PaymentMethod.TRANSFER],
            'other': by_method[PaymentMethod.OTHER],
        },
        'sales_count': sales_count,
        'cancelled_count': cancelled_count,
        'discounts': discounts,
        'total_sold': total_sold,
    }


def build_daily_reports(restaurant, day=None) -> dict:
    day = day or timezone.localdate()
    base = Order.objects.filter(
        restaurant=restaurant,
        created_at__date=day,
    ).exclude(
        payment_method=PaymentMethod.ONLINE,
        payment_status=PaymentStatus.PENDING,
    )

    active_sales = base.exclude(status=OrderStatus.CANCELLED)
    pos_sales = active_sales.filter(source=OrderSource.POS)
    zinapp_sales = active_sales.filter(source=OrderSource.ZINAPP)

    pos_total = _money(pos_sales.aggregate(t=Sum('total'))['t'])
    zinapp_total = _money(zinapp_sales.aggregate(t=Sum('total'))['t'])
    all_total = _money(active_sales.aggregate(t=Sum('total'))['t'])
    count = active_sales.count()
    avg = (all_total / count).quantize(Decimal('0.01')) if count else Decimal('0.00')

    payment_rows = (
        active_sales.values('payment_method')
        .annotate(total=Sum('total'), count=Count('id'))
        .order_by('payment_method')
    )
    labels = dict(PaymentMethod.choices)
    payment_breakdown = [
        {
            'method': row['payment_method'],
            'label': labels.get(row['payment_method'], row['payment_method']),
            'total': _money(row['total']),
            'count': row['count'],
        }
        for row in payment_rows
    ]

    top_raw = (
        OrderItem.objects.filter(order__in=active_sales)
        .values('product_id', 'product__name')
        .annotate(
            qty=Sum('quantity'),
            revenue=Sum(F('unit_price') * F('quantity')),
        )
        .order_by('-qty')[:10]
    )
    top_products = [
        {
            'name': row['product__name'] or f"#{row['product_id']}",
            'qty': row['qty'] or 0,
            'revenue': _money(row['revenue']),
        }
        for row in top_raw
    ]

    by_hour_qs = (
        active_sales.annotate(hour=TruncHour('created_at'))
        .values('hour')
        .annotate(total=Sum('total'), count=Count('id'))
        .order_by('hour')
    )
    sales_by_hour = []
    for row in by_hour_qs:
        hour = row['hour']
        local_hour = timezone.localtime(hour) if hour else None
        sales_by_hour.append({
            'hour': local_hour.strftime('%H:00') if local_hour else '—',
            'total': _money(row['total']),
            'count': row['count'],
        })

    return {
        'day': day,
        'sales_total': all_total,
        'sales_count': count,
        'avg_ticket': avg,
        'pos_total': pos_total,
        'pos_count': pos_sales.count(),
        'zinapp_total': zinapp_total,
        'zinapp_count': zinapp_sales.count(),
        'cancelled_count': base.filter(status=OrderStatus.CANCELLED).count(),
        'payment_breakdown': payment_breakdown,
        'top_products': top_products,
        'sales_by_hour': sales_by_hour,
    }

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import (
    DisputeStatus,
    Order,
    OrderDispute,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    Shipment,
    ShipmentStatus,
)
from restaurants.models import Product, Restaurant

ORDER_TIMELINE = [
    OrderStatus.PENDING,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
]

ORDER_TIMELINE_INDEX = {status: index for index, status in enumerate(ORDER_TIMELINE)}
ZINAPP_PRODUCT_MARKUP_FACTOR = Decimal('1.10')


def get_order_timeline(order: Order):
    if order.status == OrderStatus.CANCELLED:
        return None

    current_index = ORDER_TIMELINE_INDEX.get(order.status, 0)
    steps = []
    for index, status in enumerate(ORDER_TIMELINE):
        if index < current_index:
            state = 'done'
        elif index == current_index:
            state = 'current'
        else:
            state = ''
        steps.append({
            'status': status,
            'label': OrderStatus(status).label,
            'state': state,
        })
    return steps


def _money(value):
    return (value or Decimal('0.00')).quantize(Decimal('0.01'))


def calculate_restaurant_amount(product_sales):
    if not product_sales:
        return Decimal('0.00')
    return (product_sales / ZINAPP_PRODUCT_MARKUP_FACTOR).quantize(Decimal('0.01'))


def _date_range_from_params(params=None):
    params = params or {}
    today = timezone.localdate()
    period = (params.get('period') or 'month').strip()

    if period == 'day':
        return period, today, today
    if period == 'week':
        week_start = today - timedelta(days=today.weekday())
        return period, week_start, today
    if period == 'range':
        start = parse_date(params.get('start') or '')
        end = parse_date(params.get('end') or '')
        if start and end and start <= end:
            return period, start, end
        period = 'month'
    if period == 'all':
        return period, None, None

    month_start = today.replace(day=1)
    return 'month', month_start, today


def _apply_delivered_date_range(qs, start_date, end_date):
    if start_date:
        qs = qs.filter(delivered_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(delivered_at__date__lte=end_date)
    return qs


def get_financial_report(params=None):
    period, start_date, end_date = _date_range_from_params(params)
    delivered_orders = _apply_delivered_date_range(
        Order.objects.filter(
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        ).exclude(dispute__status=DisputeStatus.REFUNDED),
        start_date,
        end_date,
    )
    delivered_shipments = _apply_delivered_date_range(
        Shipment.objects.filter(
            status=ShipmentStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        ),
        start_date,
        end_date,
    )

    product_sales = _money(delivered_orders.aggregate(total=Sum('subtotal'))['total'])
    restaurant_amount = calculate_restaurant_amount(product_sales)
    zinapp_product_commission = _money(product_sales - restaurant_amount)
    order_delivery_fees = _money(delivered_orders.aggregate(total=Sum('delivery_fee'))['total'])
    shipment_delivery_fees = _money(delivered_shipments.aggregate(total=Sum('delivery_fee'))['total'])
    delivery_earnings = _money(order_delivery_fees + shipment_delivery_fees)
    completed_orders = delivered_orders.count()

    item_total = ExpressionWrapper(
        F('unit_price') * F('quantity'),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )
    delivered_items = OrderItem.objects.filter(order__in=delivered_orders).annotate(
        line_total=item_total,
    )
    product_rows = []
    for row in (
        delivered_items
        .values('product_id', 'product__name', 'order__restaurant__name')
        .annotate(
            quantity=Sum('quantity'),
            product_sales=Sum('line_total'),
            orders_count=Count('order', distinct=True),
        )
        .order_by('-product_sales')[:10]
    ):
        row_product_sales = _money(row['product_sales'])
        row_restaurant_amount = calculate_restaurant_amount(row_product_sales)
        product_rows.append({
            **row,
            'product_sales': row_product_sales,
            'restaurant_amount': row_restaurant_amount,
            'zinapp_product_commission': _money(row_product_sales - row_restaurant_amount),
        })

    order_rows = []
    for order in delivered_orders.select_related('restaurant', 'customer').order_by('-delivered_at')[:10]:
        order_product_sales = _money(order.subtotal)
        order_restaurant_amount = calculate_restaurant_amount(order_product_sales)
        order_rows.append({
            'id': order.id,
            'restaurant_name': order.restaurant.name,
            'customer_name': order.customer.get_full_name() or order.customer.username,
            'delivered_at': order.delivered_at,
            'product_sales': order_product_sales,
            'restaurant_amount': order_restaurant_amount,
            'zinapp_product_commission': _money(order_product_sales - order_restaurant_amount),
            'delivery_earnings': _money(order.delivery_fee),
        })

    restaurant_rows = []
    for row in (
        delivered_orders
        .values('restaurant_id', 'restaurant__name')
        .annotate(
            product_sales=Sum('subtotal'),
            delivery_earnings=Sum('delivery_fee'),
            orders_count=Count('id'),
        )
        .order_by('-product_sales')[:10]
    ):
        row_product_sales = _money(row['product_sales'])
        row_restaurant_amount = calculate_restaurant_amount(row_product_sales)
        restaurant_rows.append({
            **row,
            'product_sales': row_product_sales,
            'restaurant_amount': row_restaurant_amount,
            'zinapp_product_commission': _money(row_product_sales - row_restaurant_amount),
            'delivery_earnings': _money(row['delivery_earnings']),
        })

    daily_rows = []
    order_daily = {
        row['day']: row
        for row in (
            delivered_orders
            .annotate(day=TruncDate('delivered_at'))
            .values('day')
            .annotate(
                product_sales=Sum('subtotal'),
                delivery_earnings=Sum('delivery_fee'),
                orders_count=Count('id'),
            )
        )
    }
    shipment_daily = {
        row['day']: _money(row['delivery_earnings'])
        for row in (
            delivered_shipments
            .annotate(day=TruncDate('delivered_at'))
            .values('day')
            .annotate(delivery_earnings=Sum('delivery_fee'))
        )
    }
    for day in sorted(set(order_daily) | set(shipment_daily), reverse=True)[:14]:
        order_row = order_daily.get(day, {})
        row_product_sales = _money(order_row.get('product_sales'))
        row_restaurant_amount = calculate_restaurant_amount(row_product_sales)
        daily_rows.append({
            'day': day,
            'product_sales': row_product_sales,
            'restaurant_amount': row_restaurant_amount,
            'zinapp_product_commission': _money(row_product_sales - row_restaurant_amount),
            'delivery_earnings': _money(
                _money(order_row.get('delivery_earnings'))
                + shipment_daily.get(day, Decimal('0.00')),
            ),
            'orders_count': order_row.get('orders_count', 0),
        })

    return {
        'period': period,
        'start_date': start_date,
        'end_date': end_date,
        'total_ventas_productos': product_sales,
        'monto_correspondiente_restaurantes': restaurant_amount,
        'ganancia_10_por_ciento': zinapp_product_commission,
        'ganancias_envios': delivery_earnings,
        'cantidad_pedidos_completados': completed_orders,
        'order_delivery_fees': order_delivery_fees,
        'shipment_delivery_fees': shipment_delivery_fees,
        'by_product': product_rows,
        'by_order': order_rows,
        'by_restaurant': restaurant_rows,
        'by_day': daily_rows,
    }


def get_dashboard_stats(params=None):
    today = timezone.localdate()

    orders_qs = Order.objects.all()
    orders_today = orders_qs.filter(created_at__date=today)
    financial_report = get_financial_report(params)

    status_counts = {
        row['status']: row['count']
        for row in orders_qs.values('status').annotate(count=Count('id'))
    }

    status_breakdown = [
        {
            'status': choice.value,
            'label': choice.label,
            'count': status_counts.get(choice.value, 0),
        }
        for choice in OrderStatus
    ]

    orders_total = orders_qs.count()
    restaurants_total = Restaurant.objects.count()
    restaurants_pending = Restaurant.objects.filter(is_active=False).count()

    return {
        'users_total': User.objects.count(),
        'users_customers': User.objects.filter(role=UserRole.CUSTOMER).count(),
        'users_restaurants': User.objects.filter(role=UserRole.RESTAURANT).count(),
        'users_drivers': User.objects.filter(role=UserRole.DRIVER).count(),
        'restaurants_active': Restaurant.objects.filter(is_active=True).count(),
        'restaurants_total': restaurants_total,
        'restaurants_pending': restaurants_pending,
        'pending_restaurants': Restaurant.objects.filter(is_active=False).select_related(
            'owner',
        ).order_by('-created_at')[:10],
        'products_total': Product.objects.count(),
        'orders_total': orders_total,
        'orders_today': orders_today.count(),
        'orders_pending': orders_qs.filter(status=OrderStatus.PENDING).count(),
        'orders_active': orders_qs.exclude(
            status__in=[OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        ).count(),
        'orders_delivered_today': orders_qs.filter(
            status=OrderStatus.DELIVERED,
            delivered_at__date=today,
        ).count(),
        'financial_report': financial_report,
        'drivers_available': DeliveryProfile.objects.filter(is_available=True).count(),
        'drivers_total': DeliveryProfile.objects.count(),
        'status_breakdown': status_breakdown,
        'status_breakdown_max': max((s['count'] for s in status_breakdown), default=1),
        'has_order_status_data': orders_total > 0,
        'recent_orders': orders_qs.select_related(
            'customer', 'restaurant', 'driver',
        )[:12],
        'disputes_pending': OrderDispute.objects.filter(status=DisputeStatus.PENDING).count(),
    }

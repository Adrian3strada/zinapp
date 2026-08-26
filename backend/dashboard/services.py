from datetime import timedelta
from decimal import Decimal

from django.db.models import BooleanField, Case, Count, DecimalField, Exists, ExpressionWrapper, F, IntegerField, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce, TruncDate
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import (
    DisputeStatus,
    Order,
    OrderDispute,
    OrderItem,
    OrderSource,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Shipment,
    ShipmentKind,
    ShipmentStatus,
)
from restaurants.models import ProductPromotion, Restaurant

PENDING_STALE_MINUTES = 15
SHIPMENT_ACTIVE_STATUSES = (
    ShipmentStatus.PENDING,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.ON_THE_WAY,
)
DRIVER_BUSY_SHIPMENT_STATUSES = (
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.ON_THE_WAY,
)
ORDER_ACTIVE_STATUSES = (
    OrderStatus.PENDING,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ON_THE_WAY,
)

ORDER_TIMELINE = [
    OrderStatus.PENDING,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
]
SHIPMENT_TIMELINE = [
    ShipmentStatus.PENDING,
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.ON_THE_WAY,
    ShipmentStatus.DELIVERED,
]


def platform_orders_qs():
    """Pedidos de la app ZinApp (excluye POS/mostrador y otros orígenes locales)."""
    return Order.objects.filter(source=OrderSource.ZINAPP)


RESTAURANT_DETAIL_TABS = ('info', 'menu', 'orders', 'promos', 'stats', 'config')

_MONEY_FIELD = DecimalField(max_digits=12, decimal_places=2)


def annotate_restaurant_list(queryset, today=None):
    """Open/closed, pedidos y ventas de hoy, última orden — sin N+1 ni JOINs cruzados."""
    from restaurants.views import annotate_is_open_now

    today = today or timezone.localdate()
    paid_delivered = (
        platform_orders_qs()
        .filter(
            restaurant_id=OuterRef('pk'),
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
            delivered_at__date=today,
        )
        .exclude(disputes__status=DisputeStatus.REFUNDED)
    )
    orders_today_sq = (
        platform_orders_qs()
        .filter(restaurant_id=OuterRef('pk'), created_at__date=today)
        .order_by()
        .values('restaurant_id')
        .annotate(c=Count('id'))
        .values('c')[:1]
    )
    sales_today_sq = (
        paid_delivered
        .order_by()
        .values('restaurant_id')
        .annotate(total=Sum('subtotal'))
        .values('total')[:1]
    )
    last_order_sq = (
        platform_orders_qs()
        .filter(restaurant_id=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )
    return annotate_is_open_now(queryset).annotate(
        orders_today=Coalesce(
            Subquery(orders_today_sq, output_field=IntegerField()),
            Value(0),
        ),
        sales_today=Coalesce(
            Subquery(sales_today_sq, output_field=_MONEY_FIELD),
            Value(Decimal('0.00'), output_field=_MONEY_FIELD),
        ),
        last_order_at=Subquery(last_order_sq),
    )


def annotate_driver_list(queryset, today=None):
    """Disponible/ocupado, entregas de hoy y entrega actual — sin N+1."""
    today = today or timezone.localdate()
    active_order = Order.objects.filter(
        driver_id=OuterRef('user_id'),
        status=OrderStatus.ON_THE_WAY,
        source=OrderSource.ZINAPP,
    )
    active_shipment = Shipment.objects.filter(
        driver_id=OuterRef('user_id'),
        status__in=DRIVER_BUSY_SHIPMENT_STATUSES,
    )
    orders_today_sq = (
        platform_orders_qs()
        .filter(
            driver_id=OuterRef('user_id'),
            status=OrderStatus.DELIVERED,
            delivered_at__date=today,
        )
        .order_by()
        .values('driver_id')
        .annotate(c=Count('id'))
        .values('c')[:1]
    )
    shipments_today_sq = (
        Shipment.objects.filter(
            driver_id=OuterRef('user_id'),
            status=ShipmentStatus.DELIVERED,
            delivered_at__date=today,
        )
        .order_by()
        .values('driver_id')
        .annotate(c=Count('id'))
        .values('c')[:1]
    )
    return queryset.annotate(
        has_active_order=Exists(active_order),
        has_active_shipment=Exists(active_shipment),
        current_order_id=Subquery(active_order.order_by('-updated_at').values('pk')[:1]),
        current_order_code=Subquery(active_order.order_by('-updated_at').values('code')[:1]),
        current_shipment_id=Subquery(
            active_shipment.order_by('-updated_at').values('pk')[:1],
        ),
        orders_delivered_today=Coalesce(
            Subquery(orders_today_sq, output_field=IntegerField()),
            Value(0),
        ),
        shipments_delivered_today=Coalesce(
            Subquery(shipments_today_sq, output_field=IntegerField()),
            Value(0),
        ),
    ).annotate(
        is_busy=Case(
            When(Q(has_active_order=True) | Q(has_active_shipment=True), then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        ),
        deliveries_today=F('orders_delivered_today') + F('shipments_delivered_today'),
    )


DRIVER_DETAIL_TABS = ('info', 'jobs', 'verify')


def get_driver_panel_jobs(profile):
    """Entrega actual y conteos reales de entregas (pedidos ZinApp + envíos)."""
    user = profile.user
    today = timezone.localdate()
    current_order = (
        platform_orders_qs()
        .filter(driver=user, status=OrderStatus.ON_THE_WAY)
        .select_related('restaurant', 'customer')
        .order_by('-updated_at')
        .first()
    )
    current_shipment = (
        Shipment.objects.filter(
            driver=user,
            status__in=DRIVER_BUSY_SHIPMENT_STATUSES,
        )
        .select_related('customer')
        .order_by('-updated_at')
        .first()
    )
    order_counts = platform_orders_qs().filter(driver=user).aggregate(
        delivered_today=Count(
            'id',
            filter=Q(status=OrderStatus.DELIVERED, delivered_at__date=today),
        ),
        delivered_total=Count('id', filter=Q(status=OrderStatus.DELIVERED)),
    )
    shipment_counts = Shipment.objects.filter(driver=user).aggregate(
        delivered_today=Count(
            'id',
            filter=Q(status=ShipmentStatus.DELIVERED, delivered_at__date=today),
        ),
        delivered_total=Count('id', filter=Q(status=ShipmentStatus.DELIVERED)),
    )
    return {
        'today': today,
        'is_busy': bool(current_order or current_shipment),
        'current_order': current_order,
        'current_shipment': current_shipment,
        'recent_orders': list(
            platform_orders_qs()
            .filter(driver=user)
            .select_related('restaurant', 'customer')
            .order_by('-created_at')[:10]
        ),
        'recent_shipments': list(
            Shipment.objects.filter(driver=user)
            .select_related('customer')
            .order_by('-created_at')[:10]
        ),
        'delivered_today': (order_counts['delivered_today'] or 0) + (
            shipment_counts['delivered_today'] or 0
        ),
        'delivered_total': (order_counts['delivered_total'] or 0) + (
            shipment_counts['delivered_total'] or 0
        ),
        'orders_delivered_today': order_counts['delivered_today'] or 0,
        'shipments_delivered_today': shipment_counts['delivered_today'] or 0,
    }


CUSTOMER_DETAIL_TABS = ('info', 'orders', 'shipments')


def annotate_customer_list(queryset):
    """Pedidos de la app y última orden, sin JOINs cruzados."""
    orders_count_sq = (
        platform_orders_qs()
        .filter(customer_id=OuterRef('pk'))
        .order_by()
        .values('customer_id')
        .annotate(c=Count('id'))
        .values('c')[:1]
    )
    last_order_sq = (
        platform_orders_qs()
        .filter(customer_id=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )
    return queryset.annotate(
        orders_count=Coalesce(
            Subquery(orders_count_sq, output_field=IntegerField()),
            Value(0),
        ),
        last_order_at=Subquery(last_order_sq),
    )


def get_customer_panel_activity(customer):
    """Pedidos ZinApp y envíos reales del cliente."""
    today = timezone.localdate()
    orders = platform_orders_qs().filter(customer=customer)
    order_counts = orders.aggregate(
        total=Count('id'),
        today=Count('id', filter=Q(created_at__date=today)),
        active=Count('id', filter=Q(status__in=ORDER_ACTIVE_STATUSES)),
    )
    shipments = Shipment.objects.filter(customer=customer)
    shipment_counts = shipments.aggregate(
        total=Count('id'),
        active=Count('id', filter=Q(status__in=SHIPMENT_ACTIVE_STATUSES)),
    )
    return {
        'orders_count': order_counts['total'] or 0,
        'orders_today': order_counts['today'] or 0,
        'orders_active': order_counts['active'] or 0,
        'shipments_count': shipment_counts['total'] or 0,
        'shipments_active': shipment_counts['active'] or 0,
        'recent_orders': list(
            orders.select_related('restaurant', 'driver').order_by('-created_at')[:10]
        ),
        'recent_shipments': list(
            shipments.select_related('driver').order_by('-created_at')[:10]
        ),
        'orders_list_url': f"{reverse('dashboard:orders')}?customer={customer.pk}",
        'shipments_list_url': f"{reverse('gestion:shipments')}?customer={customer.pk}",
    }


def get_restaurant_panel_stats(restaurant):
    """Pedidos y ventas reales del local (misma definición que el dashboard)."""
    today = timezone.localdate()
    month_start = today.replace(day=1)
    orders = platform_orders_qs().filter(restaurant=restaurant)
    counts = orders.aggregate(
        orders_today=Count('id', filter=Q(created_at__date=today)),
        orders_active=Count('id', filter=Q(status__in=ORDER_ACTIVE_STATUSES)),
        delivered_today=Count(
            'id',
            filter=Q(status=OrderStatus.DELIVERED, delivered_at__date=today),
        ),
        delivered_month=Count(
            'id',
            filter=Q(
                status=OrderStatus.DELIVERED,
                delivered_at__date__gte=month_start,
                delivered_at__date__lte=today,
            ),
        ),
    )
    paid = (
        platform_orders_qs()
        .filter(
            restaurant=restaurant,
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        )
        .exclude(disputes__status=DisputeStatus.REFUNDED)
    )
    sales = paid.aggregate(
        sales_today=Sum('subtotal', filter=Q(delivered_at__date=today)),
        sales_month=Sum(
            'subtotal',
            filter=Q(delivered_at__date__gte=month_start, delivered_at__date__lte=today),
        ),
    )
    return {
        'today': today,
        'month_start': month_start,
        'orders_today': counts['orders_today'] or 0,
        'orders_active': counts['orders_active'] or 0,
        'delivered_today': counts['delivered_today'] or 0,
        'delivered_month': counts['delivered_month'] or 0,
        'sales_today': _money(sales['sales_today']),
        'sales_month': _money(sales['sales_month']),
    }


ORDER_TIMELINE_INDEX = {status: index for index, status in enumerate(ORDER_TIMELINE)}
SHIPMENT_TIMELINE_INDEX = {status: index for index, status in enumerate(SHIPMENT_TIMELINE)}
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
            'at': {
                OrderStatus.PENDING: order.created_at,
                OrderStatus.ACCEPTED: order.accepted_at,
                OrderStatus.READY: order.ready_at,
                OrderStatus.DELIVERED: order.delivered_at,
            }.get(status),
        })
    return steps


def get_shipment_timeline(shipment: Shipment):
    if shipment.status == ShipmentStatus.CANCELLED:
        return None

    current_index = SHIPMENT_TIMELINE_INDEX.get(shipment.status, 0)
    steps = []
    for index, status in enumerate(SHIPMENT_TIMELINE):
        if index < current_index:
            state = 'done'
        elif index == current_index:
            state = 'current'
        else:
            state = ''
        steps.append({
            'status': status,
            'label': ShipmentStatus(status).label,
            'state': state,
            'at': {
                ShipmentStatus.PENDING: shipment.created_at,
                ShipmentStatus.DELIVERED: shipment.delivered_at,
            }.get(status),
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
        platform_orders_qs().filter(
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        ).exclude(disputes__status=DisputeStatus.REFUNDED),
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
            'customer_name': (
                (order.customer.get_full_name() or order.customer.username)
                if order.customer_id and order.customer
                else '—'
            ),
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
    days = (day for day in (set(order_daily) | set(shipment_daily)) if day is not None)
    for day in sorted(days, reverse=True)[:14]:
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

    by_day_max = max((row['product_sales'] for row in daily_rows), default=Decimal('0.00'))
    if by_day_max <= 0:
        by_day_max = Decimal('1.00')

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
        'by_day_chart': list(reversed(daily_rows)),
        'by_day_max': by_day_max,
    }


def _apply_date_on(qs, field, start_date, end_date):
    if start_date:
        qs = qs.filter(**{f'{field}__date__gte': start_date})
    if end_date:
        qs = qs.filter(**{f'{field}__date__lte': end_date})
    return qs


def get_panel_report(params=None):
    """Reportes del panel: reutiliza get_financial_report y agrega conteos reales del mismo periodo."""
    report = dict(get_financial_report(params))
    start_date = report['start_date']
    end_date = report['end_date']

    created_orders = _apply_date_on(platform_orders_qs(), 'created_at', start_date, end_date)
    status_counts = {
        row['status']: row['count']
        for row in created_orders.values('status').annotate(count=Count('id'))
    }
    orders_by_status = [
        {
            'status': choice.value,
            'label': choice.label,
            'count': status_counts.get(choice.value, 0),
        }
        for choice in OrderStatus
    ]
    cancelled_count = _apply_date_on(
        platform_orders_qs().filter(status=OrderStatus.CANCELLED),
        'updated_at',
        start_date,
        end_date,
    ).count()

    delivered_paid = _apply_delivered_date_range(
        platform_orders_qs().filter(
            status=OrderStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        ).exclude(disputes__status=DisputeStatus.REFUNDED),
        start_date,
        end_date,
    )
    payment_rows = []
    for row in (
        delivered_paid
        .values('payment_method')
        .annotate(
            orders_count=Count('id'),
            product_sales=Sum('subtotal'),
        )
        .order_by('-product_sales')
    ):
        method = row['payment_method'] or ''
        try:
            label = PaymentMethod(method).label
        except ValueError:
            label = method or '—'
        payment_rows.append({
            'method': method,
            'label': label,
            'orders_count': row['orders_count'],
            'product_sales': _money(row['product_sales']),
        })

    new_customers = _apply_date_on(
        User.objects.filter(role=UserRole.CUSTOMER),
        'date_joined',
        start_date,
        end_date,
    ).count()
    shipments_completed = _apply_delivered_date_range(
        Shipment.objects.filter(
            status=ShipmentStatus.DELIVERED,
            payment_status=PaymentStatus.PAID,
        ),
        start_date,
        end_date,
    ).count()

    report.update(
        orders_created=created_orders.count(),
        orders_by_status=orders_by_status,
        orders_by_status_max=max((item['count'] for item in orders_by_status), default=1) or 1,
        cancelled_count=cancelled_count,
        by_payment_method=payment_rows,
        new_customers=new_customers,
        shipments_completed=shipments_completed,
    )
    return report


def _kpi_change(current, previous):
    """Comparación vs periodo anterior. None si no hay base real (no inventa %)."""
    current = current or 0
    previous = previous or 0
    if previous <= 0:
        return None
    change = (Decimal(str(current)) - Decimal(str(previous))) / Decimal(str(previous)) * 100
    if change == change.to_integral_value():
        pct = int(change)
    else:
        pct = round(float(change), 1)
    if pct > 0:
        direction = 'up'
    elif pct < 0:
        direction = 'down'
    else:
        direction = 'flat'
    return {'pct': pct, 'direction': direction, 'previous': previous}


def _paid_product_sales_on(day):
    qs = platform_orders_qs().filter(
        status=OrderStatus.DELIVERED,
        payment_status=PaymentStatus.PAID,
        delivered_at__date=day,
    ).exclude(disputes__status=DisputeStatus.REFUNDED)
    return _money(qs.aggregate(total=Sum('subtotal'))['total'])


def _restaurants_open_now_count():
    from restaurants.views import annotate_is_open_now

    return annotate_is_open_now(
        Restaurant.objects.filter(is_active=True, accepting_orders=True),
    ).filter(is_open_now_sort=True).count()


def _attention_items(*, drivers_pending, restaurants_pending, expired_promos_count):
    """Three compact queues for the home dashboard. Counts only; no per-record rows."""
    return [
        {
            'key': 'drivers',
            'title': 'Repartidores por verificar',
            'count': drivers_pending,
            'url': reverse('dashboard:drivers') + '?verification=pending',
            'icon': 'fa-motorcycle',
            'tone': 'warn' if drivers_pending else 'ok',
        },
        {
            'key': 'restaurants',
            'title': 'Locales pendientes de aprobación',
            'count': restaurants_pending,
            'url': reverse('dashboard:restaurants') + '?active=0',
            'icon': 'fa-store',
            'tone': 'warn' if restaurants_pending else 'ok',
        },
        {
            'key': 'promos',
            'title': 'Promociones vencidas',
            'count': expired_promos_count,
            'url': reverse('gestion:promotions') + '?expired=1',
            'icon': 'fa-tags',
            'tone': 'warn' if expired_promos_count else 'ok',
        },
    ]


def get_dashboard_stats(params=None):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    now = timezone.now()
    stale_cutoff = now - timedelta(minutes=PENDING_STALE_MINUTES)

    orders_qs = platform_orders_qs()
    orders_today_qs = orders_qs.filter(created_at__date=today)
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
    orders_total = sum(status_counts.values())

    pending_qs = orders_qs.filter(status=OrderStatus.PENDING)
    stale_pending_count = pending_qs.filter(created_at__lte=stale_cutoff).count()

    restaurants_total = Restaurant.objects.count()
    restaurants_active = Restaurant.objects.filter(is_active=True).count()
    restaurants_pending = Restaurant.objects.filter(is_active=False).count()
    restaurants_open = _restaurants_open_now_count()

    drivers_available = DeliveryProfile.objects.filter(is_available=True).count()
    drivers_total = DeliveryProfile.objects.count()
    drivers_pending = DeliveryProfile.objects.filter(
        verification_status=DeliveryProfile.VerificationStatus.PENDING,
    ).count()
    disputes_pending = OrderDispute.objects.filter(status=DisputeStatus.PENDING).count()

    failed_payments_count = orders_qs.filter(payment_status=PaymentStatus.FAILED).exclude(
        status=OrderStatus.CANCELLED,
    ).count()

    expired_promos_count = ProductPromotion.objects.filter(
        is_active=True,
        valid_until__lt=now,
    ).count()

    active_shipments = Shipment.objects.filter(status__in=SHIPMENT_ACTIVE_STATUSES)
    mandados_active = active_shipments.filter(kind=ShipmentKind.MANDADO).count()
    envios_active = active_shipments.filter(kind=ShipmentKind.COURIER).count()

    orders_today = orders_today_qs.count()
    orders_yesterday = orders_qs.filter(created_at__date=yesterday).count()
    sales_today = _paid_product_sales_on(today)
    sales_yesterday = _paid_product_sales_on(yesterday)
    customers_today = User.objects.filter(role=UserRole.CUSTOMER, date_joined__date=today).count()
    customers_yesterday = User.objects.filter(
        role=UserRole.CUSTOMER,
        date_joined__date=yesterday,
    ).count()
    delivered_today = orders_qs.filter(
        status=OrderStatus.DELIVERED,
        delivered_at__date=today,
    ).count()
    orders_pending = pending_qs.count()
    orders_active = orders_qs.filter(status__in=ORDER_ACTIVE_STATUSES).count()
    attention_items = _attention_items(
        drivers_pending=drivers_pending,
        restaurants_pending=restaurants_pending,
        expired_promos_count=expired_promos_count,
    )

    return {
        'today': today,
        'restaurants_active': restaurants_active,
        'restaurants_total': restaurants_total,
        'restaurants_pending': restaurants_pending,
        'restaurants_open': restaurants_open,
        'orders_total': orders_total,
        'orders_today': orders_today,
        'orders_pending': orders_pending,
        'orders_active': orders_active,
        'orders_delivered_today': delivered_today,
        'sales_today': sales_today,
        'financial_report': financial_report,
        'drivers_available': drivers_available,
        'drivers_total': drivers_total,
        'mandados_active': mandados_active,
        'envios_active': envios_active,
        'customers_today': customers_today,
        'status_breakdown': status_breakdown,
        'status_breakdown_max': max((s['count'] for s in status_breakdown), default=1),
        'has_order_status_data': orders_total > 0,
        'recent_orders': orders_qs.select_related(
            'customer', 'restaurant',
        ).order_by('-created_at')[:8],
        'drivers_pending': drivers_pending,
        'disputes_pending': disputes_pending,
        'stale_pending_count': stale_pending_count,
        'failed_payments_count': failed_payments_count,
        'expired_promos_count': expired_promos_count,
        'attention_items': attention_items,
        'has_attention': any(item['count'] for item in attention_items),
        'kpi_orders_today_change': _kpi_change(orders_today, orders_yesterday),
        'kpi_sales_today_change': _kpi_change(sales_today, sales_yesterday),
        'kpi_customers_today_change': _kpi_change(customers_today, customers_yesterday),
        'kpi_drivers_meta': f'de {drivers_total} en el padrón',
        'kpi_restaurants_meta': f'de {restaurants_active} activos',
    }

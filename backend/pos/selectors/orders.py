from django.db.models import Count, Q, Sum
from django.utils import timezone

from orders.models import Order, OrderSource, OrderStatus, PaymentMethod, PaymentStatus


VISIBLE_PAID = ~Q(
    payment_method=PaymentMethod.ONLINE,
) | Q(payment_status=PaymentStatus.PAID)


def restaurant_orders_base_qs(restaurant):
    return (
        Order.objects.filter(restaurant=restaurant)
        .filter(VISIBLE_PAID)
        .select_related('customer', 'created_by', 'pos_sale', 'driver')
        .prefetch_related('items__product')
        .order_by('-created_at')
    )


FILTER_MAP = {
    'nuevos': Q(status=OrderStatus.PENDING),
    'preparando': Q(status__in=[OrderStatus.ACCEPTED, OrderStatus.PREPARING]),
    'listos': Q(status=OrderStatus.READY),
    'completados': Q(status=OrderStatus.DELIVERED),
    'cancelados': Q(status=OrderStatus.CANCELLED),
    'activos': ~Q(status__in=[OrderStatus.DELIVERED, OrderStatus.CANCELLED]),
}


def orders_for_pos(restaurant, *, status_filter: str = 'activos', source: str = ''):
    qs = restaurant_orders_base_qs(restaurant)
    filt = FILTER_MAP.get(status_filter or 'activos')
    if filt is not None:
        qs = qs.filter(filt)
    if source == OrderSource.ZINAPP:
        qs = qs.filter(source=OrderSource.ZINAPP)
    elif source == OrderSource.POS:
        qs = qs.filter(source=OrderSource.POS)
    elif source:
        qs = qs.filter(source=source)
    return qs


def kitchen_orders_qs(restaurant):
    """Pedidos que cocina debe preparar (ZinApp + POS)."""
    return restaurant_orders_base_qs(restaurant).filter(
        status__in=[
            OrderStatus.PENDING,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
        ]
    ).order_by('created_at')


def preparing_orders_count(restaurant):
    return restaurant_orders_base_qs(restaurant).filter(
        status__in=[OrderStatus.ACCEPTED, OrderStatus.PREPARING],
    ).count()


def pos_sales_today_qs(restaurant):
    today = timezone.localdate()
    return Order.objects.filter(
        restaurant=restaurant,
        source=OrderSource.POS,
        payment_status=PaymentStatus.PAID,
        created_at__date=today,
    ).exclude(status=OrderStatus.CANCELLED)


def pos_sales_today_total(restaurant):
    agg = pos_sales_today_qs(restaurant).aggregate(
        total=Sum('total'),
        count=Count('id'),
    )
    return agg['total'] or 0, agg['count'] or 0


def zinapp_new_orders_count(restaurant):
    return Order.objects.filter(
        restaurant=restaurant,
        source=OrderSource.ZINAPP,
        status=OrderStatus.PENDING,
    ).filter(VISIBLE_PAID).count()


def order_for_restaurant(*, restaurant, order_id: int):
    return (
        Order.objects.filter(pk=order_id, restaurant=restaurant)
        .select_related('restaurant', 'created_by', 'pos_sale', 'customer')
        .prefetch_related('items__product')
        .first()
    )


def status_display_for_pos(order) -> str:
    """Etiquetas orientadas a mostrador (sin cambiar el enum global de delivery)."""
    if order.source != OrderSource.ZINAPP:
        if order.status == OrderStatus.READY:
            return 'Listo en mostrador'
        if order.status == OrderStatus.DELIVERED:
            return 'Entregado al cliente'
    return order.get_status_display()


def serialize_order_card(order) -> dict:
    items = []
    for item in order.items.all():
        items.append({
            'quantity': item.quantity,
            'name': item.product.name if item.product_id else 'Producto',
            'notes': item.notes or '',
            'options': item.selected_options or [],
        })
    customer_name = ''
    if order.customer_id and order.customer:
        customer_name = order.customer.get_full_name() or order.customer.username
    return {
        'id': order.id,
        'code': order.display_ref,
        'status': order.status,
        'status_display': status_display_for_pos(order),
        'source': order.source,
        'source_display': order.get_source_display(),
        'payment_method': order.payment_method,
        'payment_method_display': order.get_payment_method_display(),
        'total': str(order.total),
        'delivery_notes': order.delivery_notes or '',
        'customer_name': customer_name,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'items': items,
    }

from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import DisputeStatus, Order, OrderDispute, OrderStatus
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


def get_dashboard_stats():
    today = timezone.localdate()
    now = timezone.now()

    orders_qs = Order.objects.all()
    orders_today = orders_qs.filter(created_at__date=today)

    revenue_today = orders_qs.filter(
        status=OrderStatus.DELIVERED,
        delivered_at__date=today,
    ).aggregate(total=Sum('total'))['total'] or Decimal('0.00')

    revenue_month = orders_qs.filter(
        status=OrderStatus.DELIVERED,
        delivered_at__year=now.year,
        delivered_at__month=now.month,
    ).aggregate(total=Sum('total'))['total'] or Decimal('0.00')

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
        'revenue_today': revenue_today,
        'revenue_month': revenue_month,
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

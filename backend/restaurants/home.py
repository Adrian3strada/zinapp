"""Inicio agregado del cliente: una sola respuesta para el Home.

No cachea favoritos, pedidos ni cupones. El bloque público (categorías,
abiertos, promociones de platillo, nuevos) puede cachearse unos segundos.
"""

from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, Count, Exists, OuterRef, Prefetch, Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Product,
    ProductFavorite,
    ProductOption,
    ProductOptionGroup,
    ProductPromotion,
    Restaurant,
    RestaurantCategory,
    RestaurantFavorite,
)
from .serializers import (
    HomePromotionSerializer,
    HomeRestaurantSerializer,
    ProductSerializer,
)
from .views import annotate_is_open_now

HOME_CACHE_TTL = 45
HOME_CACHE_VERSION = 2
OPEN_LIMIT = 12
NEW_LIMIT = 8
PROMO_LIMIT = 8
FAVORITE_RESTAURANTS = 8
FAVORITE_PRODUCTS = 8
RECENT_ORDERS = 5
NEW_RESTAURANT_DAYS = 21


def catalog_restaurants():
    return (
        Restaurant.objects.filter(is_active=True)
        .filter(products__is_available=True)
        .annotate(
            available_products=Count(
                'products',
                filter=Q(products__is_available=True),
            ),
        )
        .filter(available_products__gte=1)
        .distinct()
        .prefetch_related('business_hours')
    )


def annotate_home_stats(queryset, now):
    return queryset.annotate(
        rating_average_value=Avg('reviews__restaurant_rating'),
        reviews_count_value=Count('reviews', distinct=True),
        has_active_promo=Exists(
            ProductPromotion.objects.filter(
                restaurant_id=OuterRef('pk'),
                is_active=True,
                valid_until__gte=now,
                product__is_available=True,
            )
        ),
    )


def annotate_restaurant_favorites(queryset, user):
    if not user or not getattr(user, 'is_authenticated', False) or not getattr(user, 'is_customer', False):
        return queryset
    return queryset.annotate(
        is_favorited_flag=Exists(
            RestaurantFavorite.objects.filter(user=user, restaurant_id=OuterRef('pk'))
        ),
    )


def _product_option_prefetch():
    return Prefetch(
        'option_groups',
        queryset=ProductOptionGroup.objects.prefetch_related(
            Prefetch(
                'options',
                queryset=ProductOption.objects.order_by('sort_order', 'id'),
            )
        ).order_by('sort_order', 'id'),
    )


def _serialize_restaurants(qs, request, user, now):
    qs = annotate_home_stats(qs, now)
    qs = annotate_restaurant_favorites(qs, user)
    return HomeRestaurantSerializer(qs, many=True, context={'request': request}).data


def _public_home(request, now):
    host = request.get_host()
    cache_key = f'customer_home:public:v{HOME_CACHE_VERSION}:{host}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    catalog = catalog_restaurants()
    label_map = dict(RestaurantCategory.choices)
    category_rows = (
        catalog.values('category')
        .annotate(restaurant_count=Count('id', distinct=True))
    )
    counts = {row['category']: row['restaurant_count'] for row in category_rows}
    categories = []
    for key, label in RestaurantCategory.choices:
        count = counts.get(key, 0)
        if count < 1:
            continue
        categories.append({
            'key': key,
            'label': label,
            'restaurant_count': count,
        })

    open_qs = annotate_is_open_now(catalog).filter(is_open_now_sort=True).order_by('name')
    open_restaurants = _serialize_restaurants(open_qs[:OPEN_LIMIT], request, None, now)

    cutoff = now - timedelta(days=NEW_RESTAURANT_DAYS)
    new_qs = annotate_is_open_now(
        catalog.filter(created_at__gte=cutoff).order_by('-created_at')
    )
    new_restaurants = _serialize_restaurants(new_qs[:NEW_LIMIT], request, None, now)

    promo_qs = (
        ProductPromotion.objects.filter(
            is_active=True,
            valid_until__gte=now,
            restaurant__is_active=True,
            product__is_available=True,
        )
        .select_related('product', 'restaurant')
        .order_by('-valid_until', '-id')[:PROMO_LIMIT]
    )
    promotions = HomePromotionSerializer(promo_qs, many=True, context={'request': request}).data

    payload = {
        'categories': categories,
        'open_restaurants': open_restaurants,
        'new_restaurants': new_restaurants,
        'promotions': promotions,
    }
    cache.set(cache_key, payload, HOME_CACHE_TTL)
    return payload


def _favorite_products_qs(user):
    return (
        Product.objects.filter(
            favorites__user=user,
            is_available=True,
            restaurant__is_active=True,
        )
        .select_related('restaurant')
        .prefetch_related(_product_option_prefetch())
        .annotate(
            is_favorited_flag=Exists(
                ProductFavorite.objects.filter(user=user, product_id=OuterRef('pk'))
            ),
        )
        .order_by('-favorites__created_at')
        .distinct()
    )


def _recent_orders_payload(user, request):
    from orders.models import Order, OrderSource, OrderStatus

    orders = (
        Order.objects.filter(
            customer=user,
            status=OrderStatus.DELIVERED,
            source=OrderSource.ZINAPP,
        )
        .select_related('restaurant')
        .prefetch_related('items', 'items__product')
        .order_by('-created_at')[:RECENT_ORDERS]
    )
    rows = []
    for order in orders:
        items = list(order.items.all())
        if not items:
            continue
        names = []
        for line in items:
            name = line.product.name if line.product_id else 'Platillo'
            names.append(name)
        summary = ' + '.join(names[:3])
        if len(names) > 3:
            summary = f'{summary} +{len(names) - 3}'
        restaurant = order.restaurant
        image_url = None
        if restaurant and restaurant.image:
            from .serializers import build_image_url
            image_url = build_image_url(restaurant, request)
        rows.append({
            'id': order.id,
            'created_at': order.created_at,
            'restaurant_id': restaurant.id if restaurant else None,
            'restaurant_name': restaurant.name if restaurant else 'Restaurante',
            'restaurant_image_url': image_url,
            'summary': summary,
            'item_count': len(items),
        })
    return rows


def _active_coupons(user):
    if not user or not getattr(user, 'is_authenticated', False) or not getattr(user, 'is_customer', False):
        return []
    from django.db.models import F
    from orders.models import Coupon
    from orders.serializers import CouponPublicSerializer

    now = timezone.now()
    coupons = Coupon.objects.filter(is_active=True).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now),
    ).filter(
        Q(max_uses__isnull=True) | Q(times_used__lt=F('max_uses')),
    )
    return CouponPublicSerializer(coupons, many=True).data


class CustomerHomeView(APIView):
    """GET /api/home/ — catálogo + bloques personalizados si hay cliente."""

    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        public = _public_home(request, now)
        user = request.user
        is_customer = bool(
            user
            and getattr(user, 'is_authenticated', False)
            and getattr(user, 'is_customer', False)
        )

        favorite_restaurants = []
        favorite_products = []
        recent_orders = []
        coupons = []
        open_restaurants = [dict(row) for row in public['open_restaurants']]
        new_restaurants = [dict(row) for row in public['new_restaurants']]

        if is_customer:
            fav_rest_qs = annotate_is_open_now(
                catalog_restaurants().filter(favorites__user=user).order_by(
                    '-favorites__created_at',
                )
            )
            favorite_restaurants = _serialize_restaurants(
                fav_rest_qs[:FAVORITE_RESTAURANTS],
                request,
                user,
                now,
            )
            fav_products = _favorite_products_qs(user)[:FAVORITE_PRODUCTS]
            favorite_products = ProductSerializer(
                fav_products,
                many=True,
                context={'request': request},
            ).data
            recent_orders = _recent_orders_payload(user, request)
            coupons = _active_coupons(user)

            # Reaplicar is_favorited en bloques públicos cacheados (no personalizados).
            fav_rest_ids = set(
                RestaurantFavorite.objects.filter(user=user).values_list('restaurant_id', flat=True)
            )
            for row in open_restaurants:
                row['is_favorited'] = row['id'] in fav_rest_ids
            for row in new_restaurants:
                row['is_favorited'] = row['id'] in fav_rest_ids

        return Response({
            'categories': public['categories'],
            'open_restaurants': open_restaurants,
            'new_restaurants': new_restaurants,
            'promotions': public['promotions'],
            'coupons': coupons,
            'favorites': {
                'restaurants': favorite_restaurants,
                'products': favorite_products,
            },
            'recent_orders': recent_orders,
        })

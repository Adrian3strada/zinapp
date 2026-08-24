"""Búsqueda unificada de comida y servicios locales."""

from __future__ import annotations

import unicodedata

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from local_services.models import LocalService, LocalServiceCategory
from local_services.serializers import LocalServiceSerializer

from .home import (
    _product_option_prefetch,
    annotate_home_stats,
    annotate_restaurant_favorites,
    catalog_restaurants,
)
from .models import Product, ProductFavorite, RestaurantCategory
from .serializers import HomeRestaurantSerializer, ProductSerializer
from .views import annotate_is_open_now

SEARCH_LIMIT_RESTAURANTS = 10
SEARCH_LIMIT_PRODUCTS = 10
SEARCH_LIMIT_SERVICES = 8
MIN_QUERY_LEN = 2

# Sinónimos para que «veterinario» encuentre la categoría Mascotas, etc.
# No inventa negocios: solo amplía el filtro de categorías reales.
SERVICE_ALIASES = {
    'veterinario': 'pets',
    'veterinaria': 'pets',
    'vet': 'pets',
    'mascota': 'pets',
    'mascotas': 'pets',
    'perro': 'pets',
    'gato': 'pets',
    'plomero': 'plumbing',
    'plomeria': 'plumbing',
    'electricista': 'electrical',
    'mecanico': 'auto',
    'mecanica': 'auto',
    'albanil': 'construction',
    'albanileria': 'construction',
    'estetica': 'beauty',
    'salon': 'beauty',
    'barberia': 'beauty',
    'jardinero': 'garden',
    'lavanderia': 'laundry',
}


def fold(value: str) -> str:
    return unicodedata.normalize('NFD', value or '').encode('ascii', 'ignore').decode('ascii').lower().strip()


def matching_food_categories(query: str) -> list[dict]:
    needle = fold(query)
    rows = []
    for key, label in RestaurantCategory.choices:
        hay = f'{fold(key.replace("_", " "))} {fold(label)}'
        if needle in hay or fold(key) in needle:
            rows.append({'key': key, 'label': label})
    return rows


def matching_service_category_keys(query: str) -> list[str]:
    needle = fold(query)
    keys = []
    for key, label in LocalServiceCategory.choices:
        hay = f'{fold(key)} {fold(label)}'
        if needle in hay or fold(key) in needle:
            keys.append(key)
    for alias, key in SERVICE_ALIASES.items():
        if needle == alias or alias in needle or needle in alias:
            if key not in keys:
                keys.append(key)
    return keys


class CustomerSearchView(APIView):
    """GET /api/search/?q= — restaurantes, platillos, categorías y servicios."""

    permission_classes = [AllowAny]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()[:80]
        if len(query) < MIN_QUERY_LEN:
            return Response({
                'q': query,
                'categories': [],
                'restaurants': [],
                'products': [],
                'services': [],
            })

        now = timezone.now()
        user = request.user if getattr(request.user, 'is_authenticated', False) else None
        food_categories = matching_food_categories(query)
        food_keys = [row['key'] for row in food_categories]

        restaurant_q = (
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(products__name__icontains=query)
            | Q(products__description__icontains=query)
        )
        if food_keys:
            restaurant_q |= Q(category__in=food_keys)

        restaurants_qs = annotate_is_open_now(
            catalog_restaurants().filter(restaurant_q).distinct()
        )
        restaurants_qs = annotate_home_stats(restaurants_qs, now)
        restaurants_qs = annotate_restaurant_favorites(restaurants_qs, user)
        restaurants_qs = restaurants_qs.order_by('-is_open_now_sort', 'name')[:SEARCH_LIMIT_RESTAURANTS]
        restaurants = HomeRestaurantSerializer(
            restaurants_qs, many=True, context={'request': request},
        ).data

        products_qs = (
            Product.objects.filter(
                is_available=True,
                restaurant__is_active=True,
            )
            .filter(Q(name__icontains=query) | Q(description__icontains=query))
            .select_related('restaurant')
            .prefetch_related(_product_option_prefetch())
        )
        if user and getattr(user, 'is_customer', False):
            products_qs = products_qs.annotate(
                is_favorited_flag=Exists(
                    ProductFavorite.objects.filter(user=user, product_id=OuterRef('pk'))
                ),
            )
        products = ProductSerializer(
            products_qs.order_by('name')[:SEARCH_LIMIT_PRODUCTS],
            many=True,
            context={'request': request},
        ).data

        service_q = (
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(address__icontains=query)
        )
        service_keys = matching_service_category_keys(query)
        if service_keys:
            service_q |= Q(category__in=service_keys)
        services_qs = LocalService.objects.filter(is_active=True).filter(service_q).order_by(
            'sort_order', 'name',
        )[:SEARCH_LIMIT_SERVICES]
        services = LocalServiceSerializer(services_qs, many=True, context={'request': request}).data

        return Response({
            'q': query,
            'categories': food_categories,
            'restaurants': restaurants,
            'products': products,
            'services': services,
        })

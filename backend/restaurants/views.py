from django.db.models import BooleanField, Case, Count, F, Prefetch, Q, Value, When
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from accounts.permissions import IsAdmin, IsRestaurantOwner

from .geo import ZINAPECUARO_BOUNDS, geocode_address, is_in_coverage, driving_route
from .models import Product, ProductPromotion, Restaurant
from .serializers import (
    ProductPromotionSerializer,
    ProductSerializer,
    RestaurantDetailSerializer,
    RestaurantPublicDetailSerializer,
    RestaurantPublicSerializer,
    RestaurantSerializer,
)


def annotate_is_open_now(queryset, now_time=None):
    """Marca restaurantes abiertos ahora (misma lógica que Restaurant.is_open_now)."""
    now = now_time or timezone.localtime().time()
    open_schedule = (
        Q(opening_time__isnull=True)
        | Q(closing_time__isnull=True)
        | (
            Q(opening_time__lte=F('closing_time'))
            & Q(opening_time__lte=now)
            & Q(closing_time__gte=now)
        )
        | (
            Q(opening_time__gt=F('closing_time'))
            & (Q(opening_time__lte=now) | Q(closing_time__gte=now))
        )
    )
    return queryset.annotate(
        is_open_now_sort=Case(
            When(
                Q(is_active=True, accepting_orders=True) & open_schedule,
                then=Value(True),
            ),
            default=Value(False),
            output_field=BooleanField(),
        ),
    )


@extend_schema(exclude=True)
class GeocodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        address = (request.data.get('address') or '').strip()
        if not address:
            return Response(
                {'detail': 'Indica una dirección.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = geocode_address(address)
        if not result:
            return Response(
                {
                    'detail': (
                        'No se encontró la dirección. Escribe colonia y calle '
                        '(ej. Félix Ireta, Las Galeras, Av. Hidalgo 64).'
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result)


@extend_schema(exclude=True)
class CoverageCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            lat = float(request.data.get('latitude'))
            lon = float(request.data.get('longitude'))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Coordenadas inválidas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'in_coverage': is_in_coverage(lat, lon)})


@extend_schema(exclude=True)
class CoverageBoundsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'label': 'Zinapécuaro, Michoacán',
            'bounds': ZINAPECUARO_BOUNDS,
            'center': {
                'latitude': (ZINAPECUARO_BOUNDS['min_lat'] + ZINAPECUARO_BOUNDS['max_lat']) / 2,
                'longitude': (ZINAPECUARO_BOUNDS['min_lon'] + ZINAPECUARO_BOUNDS['max_lon']) / 2,
            },
        })


@extend_schema(exclude=True)
class RouteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            lat1 = float(request.data.get('from_latitude'))
            lon1 = float(request.data.get('from_longitude'))
            lat2 = float(request.data.get('to_latitude'))
            lon2 = float(request.data.get('to_longitude'))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Coordenadas inválidas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        route = driving_route(lat1, lon1, lat2, lon2)
        return Response(route)


class RestaurantViewSet(viewsets.ModelViewSet):
    queryset = Restaurant.objects.select_related('owner').prefetch_related('products')
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        user = self.request.user
        # Restaurant owners receive their private setup/payment fields only
        # through the dedicated authenticated ``mine`` endpoint. Keeping the
        # regular catalog public serializer prevents one owner from reading
        # another owner's banking data.
        can_view_private_data = user.is_authenticated and getattr(user, 'is_admin_user', False)
        if not can_view_private_data and self.action == 'retrieve':
            return RestaurantPublicDetailSerializer
        if not can_view_private_data and self.action == 'list':
            return RestaurantPublicSerializer
        if self.action == 'retrieve':
            return RestaurantDetailSerializer
        return RestaurantSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            if getattr(self.request.user, 'is_admin_user', False):
                return [IsAdmin()]
            return [IsRestaurantOwner()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset

        if not user.is_authenticated:
            return queryset.filter(is_active=True)

        if getattr(user, 'is_admin_user', False):
            return queryset

        if user.is_restaurant_owner:
            if self.action in ('list', 'retrieve'):
                return queryset.filter(Q(is_active=True) | Q(owner=user))
            return queryset.filter(owner=user)

        return queryset.filter(is_active=True)

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        user = self.request.user
        if (not user.is_authenticated or user.is_customer) and self.action == 'list':
            qs = qs.filter(
                products__is_available=True,
            ).annotate(
                available_products=Count('products', filter=Q(products__is_available=True)),
            ).filter(available_products__gte=1).distinct()
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        category = request.query_params.get('category')
        if category and category != 'all':
            queryset = queryset.filter(category=category)
        # Catálogo cliente: abiertos primero, luego por nombre.
        queryset = annotate_is_open_now(queryset).order_by('-is_open_now_sort', 'name')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        if (
            self.request.user.is_restaurant_owner
            and not getattr(self.request.user, 'is_admin_user', False)
        ):
            serializer.save(owner=self.request.user)
        else:
            serializer.save()

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        if not request.user.is_restaurant_owner:
            return Response(
                {'detail': 'Solo para dueños de restaurante.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        now = timezone.now()
        restaurant = (
            Restaurant.objects.filter(owner=request.user)
            .prefetch_related(
                Prefetch(
                    'products',
                    queryset=Product.objects.order_by('name').prefetch_related(
                        Prefetch(
                            'promotions',
                            queryset=ProductPromotion.objects.filter(
                                is_active=True,
                                valid_until__gte=now,
                            ).order_by('-valid_until', '-id'),
                            to_attr='active_promotions',
                        ),
                    ),
                ),
            )
            .first()
        )
        if not restaurant:
            return Response({'detail': 'No tienes restaurante registrado.'}, status=404)
        serializer = RestaurantDetailSerializer(restaurant, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='toggle-favorite')
    def toggle_favorite(self, request, pk=None):
        if not request.user.is_customer:
            return Response(
                {'detail': 'Solo los clientes pueden guardar favoritos.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        from .models import RestaurantFavorite

        restaurant = self.get_object()
        favorite = RestaurantFavorite.objects.filter(
            user=request.user,
            restaurant=restaurant,
        ).first()
        if favorite:
            favorite.delete()
            return Response({'is_favorited': False})
        RestaurantFavorite.objects.create(user=request.user, restaurant=restaurant)
        return Response({'is_favorited': True})


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('restaurant', 'restaurant__owner')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        # `featured` lleva permission_classes en @action, pero get_permissions
        # lo ignora: hay que listarlo aquí o el inicio no carga platillos.
        if self.action in ('list', 'retrieve', 'featured'):
            return [AllowAny()]
        if getattr(self.request.user, 'is_admin_user', False):
            return [IsAdmin()]
        return [IsRestaurantOwner()]

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset
        restaurant_id = self.request.query_params.get('restaurant')

        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)

        if not user.is_authenticated:
            return queryset.filter(is_available=True, restaurant__is_active=True)

        if getattr(user, 'is_admin_user', False):
            return queryset

        if user.is_restaurant_owner:
            if self.action in ('list', 'retrieve'):
                return queryset.filter(
                    Q(is_available=True) | Q(restaurant__owner=user)
                )
            return queryset.filter(restaurant__owner=user)

        return queryset.filter(is_available=True, restaurant__is_active=True)

    def perform_create(self, serializer):
        restaurant = serializer.validated_data['restaurant']
        if (
            self.request.user.is_restaurant_owner
            and restaurant.owner != self.request.user
            and not getattr(self.request.user, 'is_admin_user', False)
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No puedes agregar productos a este restaurante.')
        serializer.save()

    @action(detail=False, methods=['get'], url_path='featured', permission_classes=[AllowAny])
    def featured(self, request):
        """Muestra platillos de distintos restaurantes (inicio de la app)."""
        try:
            limit = min(max(int(request.query_params.get('limit', 8)), 1), 12)
        except (TypeError, ValueError):
            limit = 8

        qs = (
            self.get_queryset()
            .filter(is_available=True, restaurant__is_active=True)
            .select_related('restaurant')
            .order_by('-updated_at')[:80]
        )
        products = list(qs)
        products.sort(
            key=lambda p: (
                0 if p.restaurant.is_open_now() else 1,
                0 if p.image else 1,
                -p.pk,
            )
        )

        picked = []
        seen_restaurants = set()
        # Primero un platillo por sucursal (diversidad).
        for product in products:
            if product.restaurant_id in seen_restaurants:
                continue
            seen_restaurants.add(product.restaurant_id)
            picked.append(product)
            if len(picked) >= limit:
                break

        serializer = self.get_serializer(picked, many=True)
        return Response(serializer.data)


class ProductPromotionViewSet(viewsets.ModelViewSet):
    queryset = ProductPromotion.objects.select_related('product', 'restaurant', 'restaurant__owner')
    serializer_class = ProductPromotionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if getattr(self.request.user, 'is_admin_user', False):
            return [IsAdmin()]
        return [IsRestaurantOwner()]

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset
        restaurant_id = self.request.query_params.get('restaurant')
        product_id = self.request.query_params.get('product')

        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        if product_id:
            queryset = queryset.filter(product_id=product_id)

        if not user.is_authenticated:
            from django.utils import timezone
            return queryset.filter(
                is_active=True,
                valid_until__gte=timezone.now(),
                restaurant__is_active=True,
            )

        if getattr(user, 'is_admin_user', False):
            return queryset

        if user.is_restaurant_owner:
            return queryset.filter(restaurant__owner=user)

        from django.utils import timezone
        return queryset.filter(
            is_active=True,
            valid_until__gte=timezone.now(),
            restaurant__is_active=True,
        )

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        if not request.user.is_restaurant_owner:
            return Response(
                {'detail': 'Solo para dueños de restaurante.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if not restaurant:
            return Response({'detail': 'No tienes restaurante registrado.'}, status=404)
        promos = self.get_queryset().filter(restaurant=restaurant)
        serializer = self.get_serializer(promos, many=True)
        return Response(serializer.data)

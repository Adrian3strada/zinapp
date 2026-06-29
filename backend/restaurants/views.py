from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsRestaurantOwner

from .geo import ZINAPECUARO_BOUNDS, geocode_address, is_in_coverage, driving_route
from .models import Product, Restaurant
from .serializers import ProductSerializer, RestaurantDetailSerializer, RestaurantSerializer


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
        if self.action == 'retrieve':
            return RestaurantDetailSerializer
        return RestaurantSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            if self.request.user.is_admin_user:
                return [IsAdmin()]
            return [IsRestaurantOwner()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset

        if not user.is_authenticated:
            return queryset.filter(is_active=True)

        if user.is_admin_user:
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
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        if self.request.user.is_restaurant_owner and not self.request.user.is_admin_user:
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
        restaurant = Restaurant.objects.filter(owner=request.user).first()
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
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.request.user.is_admin_user:
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

        if user.is_admin_user:
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
            and not self.request.user.is_admin_user
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No puedes agregar productos a este restaurante.')
        serializer.save()

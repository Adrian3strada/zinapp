from django.db.models import Avg
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .fields import CoordinateField
from .geo import geocode_address, is_in_coverage
from .models import Product, Restaurant
from .setup import restaurant_setup_status


def build_image_url(obj, request):
    if not obj.image:
        return None
    if request:
        return request.build_absolute_uri(obj.image.url)
    return obj.image.url


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'restaurant', 'name', 'description', 'price',
            'image', 'image_url', 'is_available', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_image_url(self, obj):
        return build_image_url(obj, self.context.get('request'))


class RestaurantSerializer(serializers.ModelSerializer):
    owner_detail = UserSerializer(source='owner', read_only=True)
    products_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    has_transfer_info = serializers.SerializerMethodField()
    setup_status = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = (
            'id', 'owner', 'owner_detail', 'name', 'category', 'description', 'address',
            'phone', 'whatsapp', 'bank_name', 'account_holder', 'clabe', 'has_transfer_info',
            'image', 'image_url', 'latitude', 'longitude', 'is_active',
            'accepting_orders', 'opening_time', 'closing_time', 'is_open', 'is_favorited',
            'rating_average',
            'reviews_count', 'products_count', 'setup_status',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'setup_status')
        extra_kwargs = {
            'latitude': {'required': False, 'allow_null': True},
            'longitude': {'required': False, 'allow_null': True},
        }

    latitude = CoordinateField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = CoordinateField(max_digits=9, decimal_places=6, required=False, allow_null=True)

    def validate_clabe(self, value):
        clabe = (value or '').strip()
        if not clabe:
            return ''
        digits = ''.join(c for c in clabe if c.isdigit())
        if len(digits) != 18:
            raise serializers.ValidationError('La CLABE debe tener 18 dígitos.')
        return digits

    def get_has_transfer_info(self, obj):
        return bool((obj.clabe or '').strip())

    def get_products_count(self, obj):
        return obj.products.filter(is_available=True).count()

    def get_image_url(self, obj):
        return build_image_url(obj, self.context.get('request'))

    def get_is_open(self, obj):
        return obj.is_open_now()

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if not getattr(user, 'is_customer', False):
            return False
        return obj.favorites.filter(user=user).exists()

    def get_rating_average(self, obj):
        agg = obj.reviews.aggregate(avg=Avg('restaurant_rating'))
        avg = agg['avg']
        return round(float(avg), 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.count()

    def get_setup_status(self, obj):
        return restaurant_setup_status(obj)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if (
            user
            and getattr(user, 'is_authenticated', False)
            and user.is_restaurant_owner
            and not user.is_admin_user
            and 'is_active' in attrs
        ):
            raise serializers.ValidationError({
                'is_active': 'Solo el administrador puede activar tu local en la app.',
            })
        return attrs

    def update(self, instance, validated_data):
        address_changed = (
            'address' in validated_data
            and validated_data['address'].strip() != (instance.address or '').strip()
        )
        coords_provided = 'latitude' in validated_data and 'longitude' in validated_data
        had_coords = instance.latitude is not None and instance.longitude is not None

        restaurant = super().update(instance, validated_data)

        if coords_provided:
            return restaurant

        if address_changed and not had_coords:
            geo = geocode_address(restaurant.address)
            if geo:
                restaurant.latitude = geo['latitude']
                restaurant.longitude = geo['longitude']
                restaurant.save(update_fields=['latitude', 'longitude', 'updated_at'])

        return restaurant


class RestaurantDetailSerializer(RestaurantSerializer):
    products = ProductSerializer(many=True, read_only=True)

    class Meta(RestaurantSerializer.Meta):
        fields = RestaurantSerializer.Meta.fields + ('products',)

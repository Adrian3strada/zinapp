from django.db.models import Avg
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .geo import is_in_coverage
from .models import Product, Restaurant


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

    class Meta:
        model = Restaurant
        fields = (
            'id', 'owner', 'owner_detail', 'name', 'category', 'description', 'address',
            'phone', 'whatsapp', 'bank_name', 'account_holder', 'clabe', 'has_transfer_info',
            'image', 'image_url', 'latitude', 'longitude', 'is_active',
            'accepting_orders', 'opening_time', 'closing_time', 'is_open', 'is_favorited',
            'rating_average',
            'reviews_count', 'products_count',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

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
        if not request or not getattr(request.user, 'is_customer', False):
            return False
        return obj.favorites.filter(user=request.user).exists()

    def get_rating_average(self, obj):
        agg = obj.reviews.aggregate(avg=Avg('restaurant_rating'))
        avg = agg['avg']
        return round(float(avg), 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.count()


class RestaurantDetailSerializer(RestaurantSerializer):
    products = ProductSerializer(many=True, read_only=True)

    class Meta(RestaurantSerializer.Meta):
        fields = RestaurantSerializer.Meta.fields + ('products',)

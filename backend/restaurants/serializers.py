from django.db.models import Avg
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .fields import CoordinateField
from .geo import geocode_address, is_in_coverage
from .models import Product, ProductOption, ProductOptionGroup, ProductPromotion, PromoType, Restaurant
from .promotions import get_active_promotion, promo_label
from .setup import restaurant_setup_status


def build_image_url(obj, request):
    if not obj.image:
        return None
    if request:
        return request.build_absolute_uri(obj.image.url)
    return obj.image.url


class ProductOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductOption
        fields = ('id', 'name', 'price_delta', 'is_available', 'sort_order')
        read_only_fields = ('id',)


class ProductOptionGroupSerializer(serializers.ModelSerializer):
    options = ProductOptionSerializer(many=True, read_only=True)

    class Meta:
        model = ProductOptionGroup
        fields = ('id', 'name', 'min_select', 'max_select', 'sort_order', 'options')
        read_only_fields = ('id',)


class ProductOptionGroupsReplaceSerializer(serializers.Serializer):
    groups = serializers.ListField(child=serializers.DictField(), allow_empty=True)


class ProductPromotionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    promo_type_display = serializers.CharField(source='get_promo_type_display', read_only=True)
    is_currently_active = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()

    class Meta:
        model = ProductPromotion
        fields = (
            'id', 'restaurant', 'product', 'product_name', 'promo_type', 'promo_type_display',
            'percent_off', 'special_price', 'label', 'display_label', 'valid_until',
            'is_active', 'is_currently_active', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'restaurant', 'created_at', 'updated_at')

    def get_is_currently_active(self, obj):
        return obj.is_currently_active()

    def get_display_label(self, obj):
        return promo_label(obj)

    def validate_product(self, product):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_restaurant_owner and not user.is_admin_user:
            if product.restaurant.owner != user:
                raise serializers.ValidationError('Este platillo no es de tu restaurante.')
        return product

    def validate(self, attrs):
        promo_type = attrs.get('promo_type') or getattr(self.instance, 'promo_type', None)
        percent_off = attrs.get('percent_off', getattr(self.instance, 'percent_off', None))
        special_price = attrs.get('special_price', getattr(self.instance, 'special_price', None))
        valid_until = attrs.get('valid_until') or getattr(self.instance, 'valid_until', None)

        if promo_type == PromoType.PERCENT_OFF:
            if percent_off is None or percent_off < 1 or percent_off > 99:
                raise serializers.ValidationError({
                    'percent_off': 'Indica un porcentaje entre 1 y 99.',
                })
        elif promo_type == PromoType.SPECIAL_PRICE:
            if special_price is None or special_price <= 0:
                raise serializers.ValidationError({
                    'special_price': 'Indica un precio promocional mayor a 0.',
                })
        elif promo_type == PromoType.TWO_FOR_ONE:
            attrs['percent_off'] = None
            attrs['special_price'] = None

        from django.utils import timezone
        if valid_until and valid_until <= timezone.now():
            raise serializers.ValidationError({
                'valid_until': 'La promo debe terminar en una fecha futura.',
            })
        return attrs

    def create(self, validated_data):
        product = validated_data['product']
        validated_data['restaurant'] = product.restaurant
        ProductPromotion.objects.filter(
            product=product,
            is_active=True,
        ).update(is_active=False)
        return super().create(validated_data)


class ProductPromotionPublicSerializer(serializers.ModelSerializer):
    display_label = serializers.SerializerMethodField()
    promo_type_display = serializers.CharField(source='get_promo_type_display', read_only=True)

    class Meta:
        model = ProductPromotion
        fields = (
            'id', 'promo_type', 'promo_type_display', 'percent_off', 'special_price',
            'label', 'display_label', 'valid_until',
        )

    def get_display_label(self, obj):
        return promo_label(obj)


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    active_promotion = serializers.SerializerMethodField()
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    option_groups = ProductOptionGroupSerializer(many=True, read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Product
        fields = (
            'id', 'restaurant', 'restaurant_name', 'name', 'description', 'category',
            'category_display', 'price',
            'image', 'image_url', 'is_available', 'active_promotion', 'option_groups',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'active_promotion',
            'restaurant_name', 'option_groups', 'category_display',
        )

    def validate_price(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('El precio debe ser mayor a 0.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        restaurant = attrs.get('restaurant') or getattr(self.instance, 'restaurant', None)
        if (
            user
            and getattr(user, 'is_authenticated', False)
            and user.is_restaurant_owner
            and not user.is_admin_user
            and restaurant
            and restaurant.owner != user
        ):
            raise serializers.ValidationError({
                'restaurant': 'No puedes modificar productos de otro restaurante.',
            })
        return attrs

    def get_image_url(self, obj):
        return build_image_url(obj, self.context.get('request'))

    def get_active_promotion(self, obj):
        promo = get_active_promotion(obj)
        if not promo:
            return None
        return ProductPromotionPublicSerializer(promo).data


class RestaurantSerializer(serializers.ModelSerializer):
    owner_detail = UserSerializer(source='owner', read_only=True)
    products_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    setup_status = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = (
            'id', 'owner', 'owner_detail', 'name', 'category', 'description', 'address',
            'phone', 'whatsapp',
            'image', 'image_url', 'latitude', 'longitude', 'location_pinned', 'is_active',
            'accepting_orders', 'opening_time', 'closing_time', 'is_open', 'is_favorited',
            'rating_average',
            'reviews_count', 'products_count', 'setup_status',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'setup_status', 'location_pinned')
        extra_kwargs = {
            'latitude': {'required': False, 'allow_null': True},
            'longitude': {'required': False, 'allow_null': True},
        }

    latitude = CoordinateField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = CoordinateField(max_digits=9, decimal_places=6, required=False, allow_null=True)

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
            if (
                restaurant.latitude is not None
                and restaurant.longitude is not None
                and not restaurant.location_pinned
            ):
                restaurant.location_pinned = True
                restaurant.save(update_fields=['location_pinned', 'updated_at'])
            return restaurant

        if address_changed and not had_coords:
            geo = geocode_address(restaurant.address)
            if geo:
                restaurant.latitude = geo['latitude']
                restaurant.longitude = geo['longitude']
                restaurant.save(update_fields=['latitude', 'longitude', 'updated_at'])

        return restaurant


class RestaurantDetailSerializer(RestaurantSerializer):
    products = serializers.SerializerMethodField()

    class Meta(RestaurantSerializer.Meta):
        fields = RestaurantSerializer.Meta.fields + ('products',)

    def get_products(self, obj):
        products = obj.products.all()
        if hasattr(obj, '_prefetched_objects_cache') and 'products' in obj._prefetched_objects_cache:
            products = obj._prefetched_objects_cache['products']
        return ProductSerializer(products, many=True, context=self.context).data


class RestaurantPublicSerializer(serializers.ModelSerializer):
    """Fields safe to expose through the unauthenticated restaurant catalog."""

    products_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    rating_average = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = (
            'id', 'name', 'category', 'description', 'address', 'phone', 'whatsapp',
            'image', 'image_url', 'latitude', 'longitude', 'is_active',
            'accepting_orders', 'opening_time', 'closing_time', 'is_open',
            'is_favorited', 'rating_average', 'reviews_count', 'products_count',
        )

    def get_products_count(self, obj):
        return obj.products.filter(is_available=True).count()

    def get_image_url(self, obj):
        return build_image_url(obj, self.context.get('request'))

    def get_is_open(self, obj):
        return obj.is_open_now()

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(
            user
            and getattr(user, 'is_authenticated', False)
            and getattr(user, 'is_customer', False)
            and obj.favorites.filter(user=user).exists()
        )

    def get_rating_average(self, obj):
        avg = obj.reviews.aggregate(avg=Avg('restaurant_rating'))['avg']
        return round(float(avg), 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.count()


class RestaurantPublicDetailSerializer(RestaurantPublicSerializer):
    products = serializers.SerializerMethodField()

    class Meta(RestaurantPublicSerializer.Meta):
        fields = RestaurantPublicSerializer.Meta.fields + ('products',)

    def get_products(self, obj):
        products = obj.products.all()
        if hasattr(obj, '_prefetched_objects_cache') and 'products' in obj._prefetched_objects_cache:
            products = obj._prefetched_objects_cache['products']
        return ProductSerializer(products, many=True, context=self.context).data

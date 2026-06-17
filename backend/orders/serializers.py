from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserSerializer
from restaurants.fields import CoordinateField
from restaurants.geo import is_in_coverage, round_coordinate
from restaurants.serializers import ProductSerializer, RestaurantSerializer

from .models import Coupon, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, Review, Shipment, ShipmentSize, ShipmentStatus, get_shipment_fee


class OrderItemSerializer(serializers.ModelSerializer):
    product_detail = ProductSerializer(source='product', read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            'id', 'product', 'product_detail', 'quantity',
            'unit_price', 'subtotal', 'notes',
        )
        read_only_fields = ('id', 'unit_price')


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class ReviewSerializer(serializers.ModelSerializer):
    customer_detail = UserSerializer(source='customer', read_only=True)

    class Meta:
        model = Review
        fields = (
            'id', 'order', 'customer', 'customer_detail', 'restaurant', 'driver',
            'restaurant_rating', 'driver_rating', 'comment', 'created_at',
        )
        read_only_fields = ('id', 'customer', 'restaurant', 'driver', 'created_at')


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = (
            'id', 'code', 'description', 'discount_percent', 'discount_fixed',
            'min_order_amount', 'is_active', 'expires_at', 'max_uses', 'times_used',
            'created_at',
        )
        read_only_fields = ('id', 'times_used', 'created_at')


class CouponPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = (
            'id', 'code', 'description', 'discount_percent', 'discount_fixed',
            'min_order_amount', 'expires_at',
        )


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate(self, attrs):
        code = attrs['code'].strip().upper()
        try:
            coupon = Coupon.objects.get(code__iexact=code)
        except Coupon.DoesNotExist:
            raise serializers.ValidationError({'code': 'Cupón no válido.'})

        now = timezone.now()
        if not coupon.is_active:
            raise serializers.ValidationError({'code': 'Cupón inactivo.'})
        if coupon.expires_at and coupon.expires_at < now:
            raise serializers.ValidationError({'code': 'Cupón expirado.'})
        if coupon.max_uses and coupon.times_used >= coupon.max_uses:
            raise serializers.ValidationError({'code': 'Cupón agotado.'})
        if attrs['subtotal'] < coupon.min_order_amount:
            raise serializers.ValidationError({
                'code': f'Mínimo de pedido: ${coupon.min_order_amount}.',
            })

        discount = coupon.calculate_discount(attrs['subtotal'])
        attrs['coupon'] = coupon
        attrs['discount_amount'] = discount
        return attrs


class OrderSerializer(serializers.ModelSerializer):
    customer_detail = UserSerializer(source='customer', read_only=True)
    restaurant_detail = RestaurantSerializer(source='restaurant', read_only=True)
    driver_detail = UserSerializer(source='driver', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    review = ReviewSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    driver_location_updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id', 'customer', 'customer_detail', 'restaurant', 'restaurant_detail',
            'driver', 'driver_detail', 'status', 'status_display',
            'payment_method', 'payment_method_display', 'payment_status',
            'payment_status_display', 'delivery_address',
            'delivery_latitude', 'delivery_longitude', 'delivery_notes',
            'driver_latitude', 'driver_longitude', 'driver_location_updated_at',
            'coupon', 'discount_amount', 'subtotal', 'delivery_fee', 'total',
            'items', 'review',
            'created_at', 'updated_at', 'accepted_at', 'ready_at', 'delivered_at',
        )
        read_only_fields = (
            'id', 'customer', 'restaurant', 'driver', 'status', 'subtotal',
            'delivery_fee', 'total', 'payment_status', 'payment_method',
            'discount_amount', 'delivery_address', 'delivery_latitude',
            'delivery_longitude', 'coupon',
            'created_at', 'updated_at', 'accepted_at', 'ready_at',
            'delivered_at', 'driver_latitude', 'driver_longitude',
            'driver_location_updated_at',
        )

    def _driver_profile(self, obj):
        if not obj.driver:
            return None
        return getattr(obj.driver, 'delivery_profile', None)

    def get_driver_latitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_latitude if profile else None

    def get_driver_longitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_longitude if profile else None

    def get_driver_location_updated_at(self, obj):
        profile = self._driver_profile(obj)
        if not profile or not profile.current_latitude or not profile.current_longitude:
            return None
        return profile.updated_at


class OrderCreateSerializer(serializers.Serializer):
    restaurant_id = serializers.IntegerField()
    delivery_address = serializers.CharField()
    delivery_latitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    delivery_longitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    delivery_notes = serializers.CharField(required=False, allow_blank=True, default='')
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    coupon_code = serializers.CharField(required=False, allow_blank=True, default='')
    items = OrderItemCreateSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('El pedido debe tener al menos un producto.')
        return value

    def validate(self, attrs):
        from django.conf import settings
        from restaurants.geo import geocode_address

        address = attrs['delivery_address']
        lat = attrs.get('delivery_latitude')
        lon = attrs.get('delivery_longitude')

        if lat is None or lon is None:
            geo = geocode_address(address)
            if geo:
                attrs['delivery_latitude'] = geo['latitude']
                attrs['delivery_longitude'] = geo['longitude']
                lat = geo['latitude']
                lon = geo['longitude']

        if lat is not None:
            attrs['delivery_latitude'] = round_coordinate(lat)
            lat = attrs['delivery_latitude']
        if lon is not None:
            attrs['delivery_longitude'] = round_coordinate(lon)
            lon = attrs['delivery_longitude']

        if lat is not None and lon is not None and not is_in_coverage(float(lat), float(lon)):
            geo = geocode_address(address)
            if geo and is_in_coverage(geo['latitude'], geo['longitude']):
                attrs['delivery_latitude'] = geo['latitude']
                attrs['delivery_longitude'] = geo['longitude']
            elif not settings.DEBUG:
                raise serializers.ValidationError({
                    'delivery_address': (
                        'La dirección está fuera de la zona de cobertura de Zinapécuaro.'
                    ),
                })
            else:
                attrs['delivery_latitude'] = None
                attrs['delivery_longitude'] = None

        if lat is None or lon is None:
            if not settings.DEBUG:
                raise serializers.ValidationError({
                    'delivery_address': (
                        'No se pudo ubicar la dirección. Usa «Buscar dirección en mapa».'
                    ),
                })

        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from restaurants.models import Product, Restaurant

        customer = self.context['request'].user
        coupon_code = (validated_data.pop('coupon_code', '') or '').strip()
        payment_method = validated_data['payment_method']
        payment_status = (
            PaymentStatus.PENDING
            if payment_method == PaymentMethod.ONLINE
            else PaymentStatus.PAID
        )

        try:
            restaurant = Restaurant.objects.get(
                id=validated_data['restaurant_id'],
                is_active=True,
            )
        except Restaurant.DoesNotExist:
            raise serializers.ValidationError({
                'restaurant_id': 'Restaurante no encontrado o inactivo.',
            })

        line_items = []
        subtotal = Decimal('0')
        for item_data in validated_data['items']:
            try:
                product = Product.objects.get(
                    id=item_data['product_id'],
                    restaurant=restaurant,
                    is_available=True,
                )
            except Product.DoesNotExist:
                raise serializers.ValidationError({
                    'items': f'Producto {item_data["product_id"]} no disponible.',
                })
            line_items.append((product, item_data))
            subtotal += product.price * item_data['quantity']

        coupon_data = None
        if coupon_code:
            coupon_serializer = CouponValidateSerializer(
                data={'code': coupon_code, 'subtotal': subtotal},
            )
            coupon_serializer.is_valid(raise_exception=True)
            coupon_data = coupon_serializer.validated_data

        with transaction.atomic():
            order = Order.objects.create(
                customer=customer,
                restaurant=restaurant,
                delivery_address=validated_data['delivery_address'],
                delivery_latitude=validated_data.get('delivery_latitude'),
                delivery_longitude=validated_data.get('delivery_longitude'),
                delivery_notes=validated_data.get('delivery_notes', ''),
                payment_method=payment_method,
                payment_status=payment_status,
            )

            for product, item_data in line_items:
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=item_data['quantity'],
                    unit_price=product.price,
                    notes=item_data.get('notes', ''),
                )

            order.recalculate_totals()

            if coupon_data:
                coupon = Coupon.objects.select_for_update().get(pk=coupon_data['coupon'].pk)
                order.coupon = coupon
                order.discount_amount = coupon_data['discount_amount']
                order.save(update_fields=['coupon', 'discount_amount', 'updated_at'])
                coupon.times_used += 1
                coupon.save(update_fields=['times_used'])
                order.recalculate_totals()

        return order


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ('order', 'restaurant_rating', 'driver_rating', 'comment')

    def validate_order(self, order):
        user = self.context['request'].user
        if order.customer != user:
            raise serializers.ValidationError('No es tu pedido.')
        if order.status != OrderStatus.DELIVERED:
            raise serializers.ValidationError('Solo puedes calificar pedidos entregados.')
        if hasattr(order, 'review'):
            raise serializers.ValidationError('Ya calificaste este pedido.')
        return order

    def validate_restaurant_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('La calificación debe ser de 1 a 5.')
        return value

    def validate_driver_rating(self, value):
        if value is not None and (value < 1 or value > 5):
            raise serializers.ValidationError('La calificación debe ser de 1 a 5.')
        return value

    def create(self, validated_data):
        from django.db import IntegrityError

        order = validated_data['order']
        try:
            return Review.objects.create(
            order=order,
            customer=order.customer,
            restaurant=order.restaurant,
            driver=order.driver,
            restaurant_rating=validated_data['restaurant_rating'],
            driver_rating=validated_data.get('driver_rating'),
            comment=validated_data.get('comment', ''),
            )
        except IntegrityError:
            raise serializers.ValidationError({'order': 'Ya calificaste este pedido.'})


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=OrderStatus.choices)

    VALID_TRANSITIONS = {
        OrderStatus.PENDING: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
        OrderStatus.ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
        OrderStatus.PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
        OrderStatus.READY: [OrderStatus.CANCELLED],
        OrderStatus.ON_THE_WAY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        OrderStatus.DELIVERED: [],
        OrderStatus.CANCELLED: [],
    }

    def validate_status(self, value):
        order = self.context['order']
        current = order.status
        allowed = self.VALID_TRANSITIONS.get(current, [])
        if value not in allowed:
            raise serializers.ValidationError(
                f'No se puede cambiar de {current} a {value}.'
            )
        return value

    def save(self):
        order = self.context['order']
        new_status = self.validated_data['status']
        now = timezone.now()

        order.status = new_status
        if new_status == OrderStatus.CANCELLED:
            source = self.context.get('cancellation_source')
            if source:
                order.cancellation_source = source
        if new_status == OrderStatus.ACCEPTED:
            order.accepted_at = now
        elif new_status == OrderStatus.READY:
            order.ready_at = now
        elif new_status == OrderStatus.DELIVERED:
            order.delivered_at = now

        order.save()
        return order


def _validate_address_coords(attrs, prefix, errors_field):
    from django.conf import settings
    from restaurants.geo import geocode_address, is_in_coverage, round_coordinate

    address_key = f'{prefix}_address'
    lat_key = f'{prefix}_latitude'
    lon_key = f'{prefix}_longitude'

    address = attrs[address_key]
    lat = attrs.get(lat_key)
    lon = attrs.get(lon_key)

    if lat is None or lon is None:
        geo = geocode_address(address)
        if geo:
            attrs[lat_key] = geo['latitude']
            attrs[lon_key] = geo['longitude']
            lat = geo['latitude']
            lon = geo['longitude']

    if lat is not None:
        attrs[lat_key] = round_coordinate(lat)
        lat = attrs[lat_key]
    if lon is not None:
        attrs[lon_key] = round_coordinate(lon)
        lon = attrs[lon_key]

    if lat is not None and lon is not None and not is_in_coverage(float(lat), float(lon)):
        geo = geocode_address(address)
        if geo and is_in_coverage(geo['latitude'], geo['longitude']):
            attrs[lat_key] = geo['latitude']
            attrs[lon_key] = geo['longitude']
        elif not settings.DEBUG:
            raise serializers.ValidationError({
                errors_field: 'La dirección está fuera de la zona de cobertura de Zinapécuaro.',
            })
        else:
            attrs[lat_key] = None
            attrs[lon_key] = None

    if attrs.get(lat_key) is None or attrs.get(lon_key) is None:
        if not settings.DEBUG:
            raise serializers.ValidationError({
                errors_field: 'No se pudo ubicar la dirección. Usa el mapa o «Buscar dirección».',
            })

    return attrs


class ShipmentSerializer(serializers.ModelSerializer):
    customer_detail = UserSerializer(source='customer', read_only=True)
    driver_detail = UserSerializer(source='driver', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    size_display = serializers.CharField(source='get_size_display', read_only=True)
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    driver_location_updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = (
            'id', 'customer', 'customer_detail', 'driver', 'driver_detail',
            'status', 'status_display', 'description', 'size', 'size_display',
            'pickup_address', 'pickup_latitude', 'pickup_longitude', 'pickup_notes',
            'delivery_address', 'delivery_latitude', 'delivery_longitude', 'delivery_notes',
            'payment_method', 'payment_method_display', 'payment_status', 'payment_status_display',
            'delivery_fee', 'total',
            'driver_latitude', 'driver_longitude', 'driver_location_updated_at',
            'created_at', 'updated_at', 'delivered_at',
        )
        read_only_fields = fields

    def _driver_profile(self, obj):
        if not obj.driver:
            return None
        return getattr(obj.driver, 'delivery_profile', None)

    def get_driver_latitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_latitude if profile else None

    def get_driver_longitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_longitude if profile else None

    def get_driver_location_updated_at(self, obj):
        profile = self._driver_profile(obj)
        if not profile or not profile.current_latitude or not profile.current_longitude:
            return None
        return profile.updated_at


class ShipmentCreateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=200)
    size = serializers.ChoiceField(choices=ShipmentSize.choices)
    pickup_address = serializers.CharField()
    pickup_latitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    pickup_longitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    pickup_notes = serializers.CharField(required=False, allow_blank=True, default='')
    delivery_address = serializers.CharField()
    delivery_latitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    delivery_longitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    delivery_notes = serializers.CharField(required=False, allow_blank=True, default='')
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)

    def validate(self, attrs):
        attrs = _validate_address_coords(attrs, 'pickup', 'pickup_address')
        attrs = _validate_address_coords(attrs, 'delivery', 'delivery_address')
        if not attrs.get('description', '').strip():
            raise serializers.ValidationError({'description': 'Indica qué vas a enviar.'})
        return attrs

    def create(self, validated_data):
        customer = self.context['request'].user
        payment_method = validated_data['payment_method']
        payment_status = (
            PaymentStatus.PENDING
            if payment_method == PaymentMethod.ONLINE
            else PaymentStatus.PAID
        )
        size = validated_data['size']
        delivery_fee = get_shipment_fee(size)

        return Shipment.objects.create(
            customer=customer,
            description=validated_data['description'].strip(),
            size=size,
            pickup_address=validated_data['pickup_address'],
            pickup_latitude=validated_data.get('pickup_latitude'),
            pickup_longitude=validated_data.get('pickup_longitude'),
            pickup_notes=validated_data.get('pickup_notes', ''),
            delivery_address=validated_data['delivery_address'],
            delivery_latitude=validated_data.get('delivery_latitude'),
            delivery_longitude=validated_data.get('delivery_longitude'),
            delivery_notes=validated_data.get('delivery_notes', ''),
            payment_method=payment_method,
            payment_status=payment_status,
            delivery_fee=delivery_fee,
            total=delivery_fee,
        )


class _DriverLocationMixin:
    def _driver_profile(self, obj):
        if not obj.driver:
            return None
        return getattr(obj.driver, 'delivery_profile', None)

    def get_driver_latitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_latitude if profile else None

    def get_driver_longitude(self, obj):
        profile = self._driver_profile(obj)
        return profile.current_longitude if profile else None

    def get_driver_location_updated_at(self, obj):
        profile = self._driver_profile(obj)
        if not profile or not profile.current_latitude or not profile.current_longitude:
            return None
        return profile.updated_at


class OrderActiveSerializer(_DriverLocationMixin, serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    driver_location_updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id', 'status', 'status_display', 'restaurant_name',
            'delivery_address', 'delivery_latitude', 'delivery_longitude',
            'driver_latitude', 'driver_longitude', 'driver_location_updated_at',
        )


class ShipmentActiveSerializer(_DriverLocationMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    driver_latitude = serializers.SerializerMethodField()
    driver_longitude = serializers.SerializerMethodField()
    driver_location_updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = (
            'id', 'status', 'status_display', 'description',
            'delivery_latitude', 'delivery_longitude',
            'driver_latitude', 'driver_longitude', 'driver_location_updated_at',
        )


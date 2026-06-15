from datetime import time

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from restaurants.fields import CoordinateField
from restaurants.geo import geocode_address
from restaurants.models import Restaurant

from .models import DeliveryProfile, PasswordResetToken, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'avatar', 'avatar_url',
            'date_joined', 'expo_push_token',
        )
        read_only_fields = ('id', 'role', 'date_joined', 'expo_push_token', 'avatar_url')

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    restaurant_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    restaurant_address = serializers.CharField(required=False, allow_blank=True, write_only=True)
    restaurant_phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    restaurant_description = serializers.CharField(required=False, allow_blank=True, write_only=True)
    vehicle_type = serializers.ChoiceField(
        choices=DeliveryProfile.VehicleType.choices,
        required=False,
        allow_blank=True,
        write_only=True,
    )
    license_plate = serializers.CharField(
        required=False, allow_blank=True, write_only=True, max_length=20
    )

    class Meta:
        model = User
        fields = (
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone', 'address',
            'restaurant_name', 'restaurant_address', 'restaurant_phone',
            'restaurant_description', 'vehicle_type', 'license_plate',
        )

    def validate_username(self, value):
        username = value.strip().lower()
        if not username:
            raise serializers.ValidationError('El usuario no puede estar vacío.')
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError('Este nombre de usuario ya está ocupado.')
        return username

    def validate_role(self, value):
        if value == UserRole.ADMIN:
            raise serializers.ValidationError(
                'No se puede registrar como administrador.'
            )
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError(
                {'password_confirm': 'Las contraseñas no coinciden.'}
            )
        email = attrs.get('email', '')
        if email:
            attrs['email'] = email.strip().lower()

        if attrs.get('role') == UserRole.RESTAURANT:
            name = (attrs.get('restaurant_name') or '').strip()
            address = (attrs.get('restaurant_address') or '').strip()
            if not name:
                raise serializers.ValidationError(
                    {'restaurant_name': 'Indica el nombre de tu restaurante.'}
                )
            if not address:
                raise serializers.ValidationError(
                    {'restaurant_address': 'Indica la dirección del restaurante.'}
                )
            phone = (attrs.get('phone') or '').strip()
            if not phone:
                raise serializers.ValidationError(
                    {'phone': 'Indica tu teléfono de contacto.'}
                )

        if attrs.get('role') == UserRole.DRIVER:
            phone = (attrs.get('phone') or '').strip()
            if not phone:
                raise serializers.ValidationError(
                    {'phone': 'Indica tu teléfono para coordinar entregas.'}
                )
            vehicle_type = (attrs.get('vehicle_type') or '').strip()
            if not vehicle_type:
                raise serializers.ValidationError(
                    {'vehicle_type': 'Selecciona tu tipo de vehículo.'}
                )
            if vehicle_type in (
                DeliveryProfile.VehicleType.MOTORCYCLE,
                DeliveryProfile.VehicleType.CAR,
            ):
                plate = (attrs.get('license_plate') or '').strip()
                if not plate:
                    raise serializers.ValidationError(
                        {'license_plate': 'Indica las placas de tu vehículo.'}
                    )

        return attrs

    def create(self, validated_data):
        restaurant_name = validated_data.pop('restaurant_name', '').strip()
        restaurant_address = validated_data.pop('restaurant_address', '').strip()
        restaurant_phone = validated_data.pop('restaurant_phone', '').strip()
        restaurant_description = validated_data.pop('restaurant_description', '').strip()
        vehicle_type = validated_data.pop('vehicle_type', '').strip()
        license_plate = validated_data.pop('license_plate', '').strip()
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        if user.role == UserRole.DRIVER:
            DeliveryProfile.objects.create(
                user=user,
                vehicle_type=vehicle_type or DeliveryProfile.VehicleType.MOTORCYCLE,
                license_plate=license_plate,
                is_available=False,
            )

        if user.role == UserRole.RESTAURANT:
            geo = geocode_address(restaurant_address)
            Restaurant.objects.create(
                owner=user,
                name=restaurant_name,
                address=restaurant_address,
                phone=restaurant_phone or user.phone,
                description=restaurant_description,
                latitude=geo['latitude'] if geo else None,
                longitude=geo['longitude'] if geo else None,
                opening_time=time(9, 0),
                closing_time=time(22, 0),
            )

        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField()

    def validate_username(self, value):
        username = value.strip().lower()
        if not User.objects.filter(username=username).exists():
            raise serializers.ValidationError('No existe una cuenta con ese usuario.')
        return username


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate(self, attrs):
        try:
            token = PasswordResetToken.objects.select_related('user').get(
                token=attrs['token'],
                used=False,
            )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError({'token': 'Token inválido o expirado.'})
        if token.expires_at < timezone.now():
            raise serializers.ValidationError({'token': 'Token expirado.'})
        attrs['reset_token'] = token
        return attrs


class PushTokenSerializer(serializers.Serializer):
    expo_push_token = serializers.CharField(max_length=255)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class DeliveryProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    current_latitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    current_longitude = CoordinateField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )

    class Meta:
        model = DeliveryProfile
        fields = (
            'id', 'user', 'vehicle_type', 'license_plate', 'is_available',
            'current_latitude', 'current_longitude', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')

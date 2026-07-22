from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from restaurants.fields import CoordinateField
from restaurants.models import Restaurant

from .models import DeliveryProfile, PasswordResetToken, User, UserRole
from .setup import driver_setup_status
from .username import normalize_username


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


class OrderParticipantUserSerializer(serializers.ModelSerializer):
    """Datos de contacto visibles entre cliente y repartidor en un pedido."""

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name',
            'role', 'phone', 'address', 'avatar_url',
        )
        read_only_fields = fields

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url


class OrderDriverDeliverySerializer(serializers.ModelSerializer):
    vehicle_type_display = serializers.CharField(
        source='get_vehicle_type_display', read_only=True,
    )

    class Meta:
        model = DeliveryProfile
        fields = ('vehicle_type', 'vehicle_type_display', 'license_plate')
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=True)
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

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if not email:
            raise serializers.ValidationError('El correo es obligatorio.')
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Este correo ya está registrado.')
        return email

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
        attrs['email'] = (attrs.get('email') or '').strip().lower()

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
                verification_status=DeliveryProfile.VerificationStatus.PENDING,
            )

        if user.role == UserRole.RESTAURANT:
            Restaurant.objects.create(
                owner=user,
                name=restaurant_name,
                address=restaurant_address,
                phone=restaurant_phone or user.phone,
                description=restaurant_description,
                opening_time=None,
                closing_time=None,
                is_active=False,
                accepting_orders=False,
            )

        return user


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    confirmation = serializers.CharField(write_only=True)

    def validate_confirmation(self, value):
        if (value or '').strip().upper() != 'ELIMINAR':
            raise serializers.ValidationError(
                'Escribe ELIMINAR para confirmar que quieres borrar tu cuenta.',
            )
        return value

    def validate_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Contraseña incorrecta.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual no es correcta.')
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    """Acepta identifier (usuario o email) o username (compat)."""

    identifier = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        raw = (attrs.get('identifier') or attrs.get('username') or '').strip().lower()
        if not raw:
            raise serializers.ValidationError(
                {'identifier': 'Indica tu usuario o correo.'}
            )
        # No revelar si el usuario existe (anti-enumeración).
        attrs['identifier'] = raw
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate(self, attrs):
        code = (attrs.get('token') or '').strip().upper()
        try:
            token = PasswordResetToken.objects.select_related('user').get(
                token=code,
                used=False,
            )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError({'token': 'Código inválido o expirado.'})
        if token.expires_at < timezone.now():
            raise serializers.ValidationError({'token': 'Código expirado.'})
        attrs['reset_token'] = token
        return attrs


class PushTokenSerializer(serializers.Serializer):
    expo_push_token = serializers.CharField(max_length=255, allow_blank=True)


DEMO_USERNAMES = frozenset({
    'cliente1',
    'repartidor1',
    'rest_pizzas',
    'rest_shukrani',
    'rest_jardines',
    'admin_zinapp',
})


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(trim_whitespace=True, allow_blank=False)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = normalize_username(attrs.get(self.username_field) or '')
        if not username:
            raise AuthenticationFailed(
                'Usuario o contraseña incorrectos.',
                code='authorization',
            )

        existing = User.objects.filter(username__iexact=username).first()
        if existing:
            if not existing.is_active:
                raise AuthenticationFailed(
                    'Tu cuenta está desactivada. Contacta soporte o al administrador de ZinApp.',
                    code='account_inactive',
                )
            attrs[self.username_field] = existing.username
        else:
            attrs[self.username_field] = username

        if not getattr(settings, 'DEMO_ACCOUNTS_ENABLED', True) and username in DEMO_USERNAMES:
            raise AuthenticationFailed(
                'Las cuentas de demostración están desactivadas. Crea una cuenta nueva o contacta soporte.',
                code='demo_disabled',
            )
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class DeliveryProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    identity_document_url = serializers.SerializerMethodField()
    setup_status = serializers.SerializerMethodField()
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
            'verification_status', 'identity_document', 'identity_document_url',
            'review_notes', 'reviewed_at', 'setup_status',
            'current_latitude', 'current_longitude', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'user', 'verification_status', 'review_notes', 'reviewed_at',
            'identity_document_url', 'setup_status', 'created_at', 'updated_at',
        )

    def get_identity_document_url(self, obj):
        if not obj.identity_document:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.identity_document.url)
        return obj.identity_document.url

    def get_setup_status(self, obj):
        return driver_setup_status(obj)

    def validate(self, attrs):
        if attrs.get('is_available'):
            profile = self.instance
            if profile is None:
                return attrs
            candidate = DeliveryProfile(
                user=profile.user,
                vehicle_type=attrs.get('vehicle_type', profile.vehicle_type),
                license_plate=attrs.get('license_plate', profile.license_plate),
                identity_document=attrs.get('identity_document', profile.identity_document),
                verification_status=profile.verification_status,
            )
            if not driver_setup_status(candidate)['ready_for_deliveries']:
                raise serializers.ValidationError({
                    'is_available': (
                        'Completa tu perfil y espera la aprobación de ZinApp '
                        'antes de activar tu disponibilidad.'
                    ),
                })
        return attrs

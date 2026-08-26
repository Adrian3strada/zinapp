from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from restaurants.fields import CoordinateField
from restaurants.models import Restaurant

from .models import DeliveryProfile, PasswordResetToken, User, UserRole
from .phone import validate_optional_mx_phone, validate_required_mx_phone
from .setup import driver_setup_status
from .username import normalize_username

# Solo avatar de usuario (no productos / restaurantes / documentos).
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
ALLOWED_AVATAR_CONTENT_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
}


def absolute_media_url(file_field, request):
    """URL absoluta raíz (/media/...), nunca relativa al path del endpoint."""
    if not file_field:
        return None
    url = file_field.url
    if url and not url.startswith(('http://', 'https://', '/')):
        url = f'/{url}'
    if request:
        return request.build_absolute_uri(url)
    return url


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    auth_provider = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'avatar', 'avatar_url',
            'date_joined',
            'has_usable_password', 'auth_provider',
        )
        read_only_fields = (
            'id', 'role', 'date_joined',
            'avatar_url', 'has_usable_password', 'auth_provider',
        )

    def get_avatar_url(self, obj):
        return absolute_media_url(obj.avatar, self.context.get('request'))

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def get_auth_provider(self, obj):
        return 'google' if obj.google_sub else 'password'

    def validate_avatar(self, value):
        if not value:
            return value
        name = (getattr(value, 'name', '') or '').lower()
        ext = ''
        if '.' in name:
            ext = '.' + name.rsplit('.', 1)[-1]
        content_type = (getattr(value, 'content_type', None) or '').lower()
        if ext and ext not in ALLOWED_AVATAR_EXTENSIONS:
            raise serializers.ValidationError(
                'Formato no permitido. Usa JPG, PNG o WebP.',
            )
        if content_type and content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
            raise serializers.ValidationError(
                'Formato no permitido. Usa JPG, PNG o WebP.',
            )
        size = getattr(value, 'size', None)
        if size is not None and size > MAX_AVATAR_BYTES:
            raise serializers.ValidationError(
                'La imagen es demasiado grande (máximo 5 MB).',
            )
        return value

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if not email:
            raise serializers.ValidationError('El correo es obligatorio.')
        qs = User.objects.filter(email__iexact=email)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Este correo ya está registrado.')
        return email

    def validate_phone(self, value):
        try:
            return validate_required_mx_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_first_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return name

    def validate_last_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('El apellido es obligatorio.')
        return name


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
        return absolute_media_url(obj.avatar, self.context.get('request'))


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
    first_name = serializers.CharField(required=True, allow_blank=False)
    last_name = serializers.CharField(required=True, allow_blank=False)
    phone = serializers.CharField(required=True, allow_blank=False)
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

    def validate_phone(self, value):
        try:
            return validate_required_mx_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_first_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('El nombre es obligatorio.')
        return name

    def validate_last_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('El apellido es obligatorio.')
        return name

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

        # Teléfono ya validado/normalizado en validate_phone; reforzar presencia.
        phone = (attrs.get('phone') or '').strip()
        if not phone:
            raise serializers.ValidationError(
                {'phone': 'El teléfono es obligatorio para operar en ZinApp.'}
            )

        restaurant_phone = attrs.get('restaurant_phone')
        if restaurant_phone is not None:
            try:
                attrs['restaurant_phone'] = validate_optional_mx_phone(restaurant_phone)
            except ValueError as exc:
                raise serializers.ValidationError({'restaurant_phone': str(exc)}) from exc

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

        if attrs.get('role') == UserRole.DRIVER:
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

        with transaction.atomic():
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
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    confirmation = serializers.CharField(write_only=True)

    def validate_confirmation(self, value):
        if (value or '').strip().upper() != 'ELIMINAR':
            raise serializers.ValidationError(
                'Escribe ELIMINAR para confirmar que quieres borrar tu cuenta.',
            )
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        if user.has_usable_password():
            password = attrs.get('password') or ''
            if not password or not user.check_password(password):
                raise serializers.ValidationError({'password': 'Contraseña incorrecta.'})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate(self, attrs):
        user = self.context['request'].user
        if user.has_usable_password():
            old = attrs.get('old_password') or ''
            if not old:
                raise serializers.ValidationError(
                    {'old_password': 'Indica tu contraseña actual.'},
                )
            if not user.check_password(old):
                raise serializers.ValidationError(
                    {'old_password': 'La contraseña actual no es correcta.'},
                )
        return attrs


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
        # iOS Mail / teclado a veces pegan espacios o caracteres invisibles.
        raw = (attrs.get('token') or '').upper()
        code = ''.join(ch for ch in raw if ch.isalnum())
        if len(code) != 8:
            raise serializers.ValidationError(
                {'token': 'El código tiene 8 caracteres. Copia el del correo más reciente.'}
            )

        token = (
            PasswordResetToken.objects.select_related('user')
            .filter(token=code, used=False)
            .first()
        )
        if token is None:
            used_token = (
                PasswordResetToken.objects.select_related('user')
                .filter(token=code, used=True)
                .order_by('-created_at')
                .first()
            )
            if used_token is not None:
                # Doble toque / reintento: si la contraseña ya quedó aplicada, éxito.
                attrs['reset_token'] = used_token
                attrs['token'] = code
                attrs['already_used'] = True
                return attrs
            raise serializers.ValidationError(
                {
                    'token': (
                        'Código inválido. Solicita uno nuevo en Recuperar contraseña '
                        'y usa solo el del correo más reciente.'
                    )
                }
            )

        if token.expires_at < timezone.now():
            raise serializers.ValidationError(
                {'token': 'Código expirado. Solicita uno nuevo en Recuperar contraseña.'}
            )
        attrs['reset_token'] = token
        attrs['token'] = code
        attrs['already_used'] = False
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
        raw = (attrs.get(self.username_field) or '').strip()
        if not raw:
            raise AuthenticationFailed(
                'Usuario o contraseña incorrectos.',
                code='authorization',
            )

        username_key = normalize_username(raw)
        existing = None
        if username_key:
            existing = User.objects.filter(username__iexact=username_key).first()
        if existing is None and '@' in raw:
            existing = User.objects.filter(email__iexact=raw.lower()).first()

        if existing:
            if not existing.is_active:
                raise AuthenticationFailed(
                    'Tu cuenta está desactivada. Contacta soporte o al administrador de ZinApp.',
                    code='account_inactive',
                )
            attrs[self.username_field] = existing.username
            throttle_key = existing.username
        else:
            attrs[self.username_field] = username_key or raw.lower()
            throttle_key = username_key or raw.lower()

        if not getattr(settings, 'DEMO_ACCOUNTS_ENABLED', True) and throttle_key in DEMO_USERNAMES:
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

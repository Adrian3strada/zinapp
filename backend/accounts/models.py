import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models

REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def generate_referral_code() -> str:
    return ''.join(secrets.choice(REFERRAL_ALPHABET) for _ in range(6))


class UserRole(models.TextChoices):
    CUSTOMER = 'customer', 'Cliente'
    RESTAURANT = 'restaurant', 'Restaurante'
    DRIVER = 'driver', 'Repartidor'
    ADMIN = 'admin', 'Administrador'


class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
    )
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    expo_push_token = models.CharField(max_length=255, blank=True)
    # Subject de Google OAuth (vincula «Continuar con Google»).
    google_sub = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        unique=True,
        help_text='ID estable de la cuenta Google (sub del id_token).',
    )
    active_restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text='Local que el dueño opera ahora en la app.',
    )
    date_of_birth = models.DateField(
        null=True,
        blank=True,
        help_text='Cumpleaños del cliente (beneficio de envío gratis ese día).',
    )
    birthday_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Último cambio de fecha de cumpleaños (antiabuso).',
    )
    referral_code = models.CharField(
        max_length=12,
        unique=True,
        blank=True,
        help_text='Código para invitar amigos (envío gratis para ambos).',
    )
    referred_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referrals',
        help_text='Cliente que invitó a esta cuenta.',
    )

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def save(self, *args, **kwargs):
        if not self.referral_code:
            for _ in range(24):
                code = generate_referral_code()
                qs = User.objects.filter(referral_code=code)
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
                if not qs.exists():
                    self.referral_code = code
                    break
            else:
                self.referral_code = secrets.token_hex(4).upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_customer(self):
        return self.role == UserRole.CUSTOMER

    @property
    def is_restaurant_owner(self):
        return self.role == UserRole.RESTAURANT

    @property
    def is_driver(self):
        return self.role == UserRole.DRIVER

    @property
    def is_admin_user(self):
        return self.role == UserRole.ADMIN or self.is_superuser


class DeliveryProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        APPROVED = 'approved', 'Aprobado'
        REJECTED = 'rejected', 'Rechazado'

    class VehicleType(models.TextChoices):
        BICYCLE = 'bicycle', 'Bicicleta'
        MOTORCYCLE = 'motorcycle', 'Motocicleta'
        CAR = 'car', 'Automóvil'

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='delivery_profile',
        limit_choices_to={'role': UserRole.DRIVER},
    )
    vehicle_type = models.CharField(
        max_length=20,
        choices=VehicleType.choices,
        default=VehicleType.MOTORCYCLE,
    )
    license_plate = models.CharField(max_length=20, blank=True)
    is_available = models.BooleanField(default=True)
    verification_status = models.CharField(
        max_length=12,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    identity_document = models.ImageField(
        upload_to='driver_documents/',
        blank=True,
        null=True,
    )
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='reviewed_delivery_profiles',
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    current_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    current_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Perfil de repartidor'
        verbose_name_plural = 'Perfiles de repartidor'

    def __str__(self):
        return f'Repartidor: {self.user.username}'


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_tokens')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Token de recuperación'
        verbose_name_plural = 'Tokens de recuperación'


class AuditLog(models.Model):
    class Action(models.TextChoices):
        ORDER_STATUS_UPDATED = 'order_status_updated', 'Estado de pedido actualizado'
        ORDER_ACCEPTED = 'order_accepted', 'Pedido aceptado'
        ORDER_REJECTED = 'order_rejected', 'Pedido rechazado'
        ORDER_CANCELLED = 'order_cancelled', 'Pedido cancelado'
        PAYMENT_CONFIRMED = 'payment_confirmed', 'Pago confirmado'
        MP_WEBHOOK_PAID = 'mp_webhook_paid', 'Pago confirmado por Mercado Pago'
        STRIPE_WEBHOOK_PAID = 'stripe_webhook_paid', 'Pago confirmado por Stripe'
        SHIPMENT_ACCEPTED = 'shipment_accepted', 'Envío aceptado'
        SHIPMENT_STATUS_UPDATED = 'shipment_status_updated', 'Estado de envío actualizado'
        DRIVER_VERIFICATION_UPDATED = 'driver_verification_updated', 'Verificación de repartidor actualizada'
        DISPUTE_UPDATED = 'dispute_updated', 'Disputa actualizada'
        PANEL_ENTITY_UPDATED = 'panel_entity_updated', 'Entidad del panel actualizada'
        PANEL_ENTITY_DEACTIVATED = 'panel_entity_deactivated', 'Entidad del panel desactivada'

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=64, choices=Action.choices)
    object_type = models.CharField(max_length=80)
    object_id = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Registro de auditoría'
        verbose_name_plural = 'Registros de auditoría'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['object_type', 'object_id']),
        ]

    def __str__(self):
        return f'{self.action} {self.object_type}:{self.object_id}'

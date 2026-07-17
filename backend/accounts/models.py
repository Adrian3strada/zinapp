from django.contrib.auth.models import AbstractUser
from django.db import models


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

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

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
        SHIPMENT_ACCEPTED = 'shipment_accepted', 'Envío aceptado'
        SHIPMENT_STATUS_UPDATED = 'shipment_status_updated', 'Estado de envío actualizado'
        DRIVER_VERIFICATION_UPDATED = 'driver_verification_updated', 'Verificación de repartidor actualizada'

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

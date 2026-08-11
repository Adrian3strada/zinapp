from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class POSStaffRole(models.TextChoices):
    ADMIN = 'admin', 'Administrador'
    CASHIER = 'cashier', 'Cajero'
    KITCHEN = 'kitchen', 'Cocina'


class POSStaffMembership(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pos_memberships',
    )
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='pos_memberships',
    )
    role = models.CharField(
        max_length=20,
        choices=POSStaffRole.choices,
        default=POSStaffRole.CASHIER,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Membership POS'
        verbose_name_plural = 'Memberships POS'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'restaurant'],
                name='pos_staff_unique_user_restaurant',
            ),
        ]
        indexes = [
            models.Index(fields=['restaurant', 'is_active']),
        ]

    def __str__(self):
        return f'{self.user_id} @ {self.restaurant_id} ({self.role})'


class CashRegister(models.Model):
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='cash_registers',
    )
    name = models.CharField(max_length=80, default='Caja principal')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Caja registradora'
        verbose_name_plural = 'Cajas registradoras'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} — {self.restaurant.name}'


class CashSessionStatus(models.TextChoices):
    OPEN = 'open', 'Abierta'
    CLOSED = 'closed', 'Cerrada'


class CashSession(models.Model):
    cash_register = models.ForeignKey(
        CashRegister,
        on_delete=models.CASCADE,
        related_name='sessions',
    )
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='cash_sessions',
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='pos_cash_sessions_opened',
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_cash_sessions_closed',
    )
    opening_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0.00'),
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    expected_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    counted_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    difference = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=CashSessionStatus.choices,
        default=CashSessionStatus.OPEN,
        db_index=True,
    )

    class Meta:
        verbose_name = 'Sesión de caja'
        verbose_name_plural = 'Sesiones de caja'
        ordering = ['-opened_at']
        constraints = [
            models.UniqueConstraint(
                fields=['cash_register'],
                condition=Q(status='open'),
                name='pos_one_open_session_per_register',
            ),
        ]
        indexes = [
            models.Index(fields=['restaurant', 'status']),
        ]

    def __str__(self):
        return f'Sesión {self.pk} ({self.status}) — {self.cash_register}'


class CashMovementType(models.TextChoices):
    SALE = 'sale', 'Venta'
    CASH_IN = 'cash_in', 'Entrada'
    CASH_OUT = 'cash_out', 'Retiro'
    ADJUSTMENT = 'adjustment', 'Ajuste'
    CANCELLATION = 'cancellation', 'Cancelación'


class CashMovement(models.Model):
    session = models.ForeignKey(
        CashSession,
        on_delete=models.CASCADE,
        related_name='movements',
    )
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='cash_movements',
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_movements',
    )
    type = models.CharField(max_length=20, choices=CashMovementType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_cash_movements',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Movimiento de caja'
        verbose_name_plural = 'Movimientos de caja'
        ordering = ['-created_at']
        constraints = [
            # Evita doble movimiento de venta para el mismo pedido en la misma sesión.
            models.UniqueConstraint(
                fields=['session', 'order', 'type'],
                condition=Q(order__isnull=False, type='sale'),
                name='pos_unique_sale_movement_per_order_session',
            ),
            models.UniqueConstraint(
                fields=['session', 'order', 'type'],
                condition=Q(order__isnull=False, type='cancellation'),
                name='pos_unique_cancellation_movement_per_order_session',
            ),
        ]
        indexes = [
            models.Index(fields=['restaurant', 'created_at']),
            models.Index(fields=['session', 'type']),
        ]

    def __str__(self):
        return f'{self.type} {self.amount} (session={self.session_id})'


class POSSale(models.Model):
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='pos_sale',
    )
    cash_session = models.ForeignKey(
        CashSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_sales',
    )
    amount_received = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    change_given = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pos_sales_cancelled',
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=255, blank=True)
    local_folio = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Folio local secuencial por restaurante (opcional).',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Venta POS'
        verbose_name_plural = 'Ventas POS'
        ordering = ['-created_at']

    def __str__(self):
        return f'POSSale order={self.order_id}'

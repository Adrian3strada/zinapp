from decimal import Decimal

from django.conf import settings
from django.db import models


class OrderStatus(models.TextChoices):
    PENDING = 'pending', 'Pendiente'
    ACCEPTED = 'accepted', 'Aceptado'
    PREPARING = 'preparing', 'Preparando'
    READY = 'ready', 'Listo para recoger'
    ON_THE_WAY = 'on_the_way', 'En camino'
    DELIVERED = 'delivered', 'Entregado'
    CANCELLED = 'cancelled', 'Cancelado'


class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Efectivo'
    TRANSFER = 'transfer', 'Transferencia'
    ONLINE = 'online', 'Pago en línea'


class PaymentStatus(models.TextChoices):
    PENDING = 'pending', 'Pendiente'
    PAID = 'paid', 'Pagado'
    FAILED = 'failed', 'Fallido'


class CancellationSource(models.TextChoices):
    RESTAURANT_REJECT = 'restaurant_reject', 'Rechazo restaurante'
    CUSTOMER = 'customer', 'Cliente'


class Coupon(models.Model):
    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=200, blank=True)
    discount_percent = models.PositiveIntegerField(default=0)
    discount_fixed = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    min_order_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    times_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cupón'
        verbose_name_plural = 'Cupones'
        ordering = ['code']

    def __str__(self):
        return self.code.upper()

    def calculate_discount(self, subtotal: Decimal) -> Decimal:
        if self.discount_percent:
            return (subtotal * Decimal(self.discount_percent) / Decimal('100')).quantize(
                Decimal('0.01')
            )
        return min(self.discount_fixed, subtotal)


class Review(models.Model):
    order = models.OneToOneField(
        'Order',
        on_delete=models.CASCADE,
        related_name='review',
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='driver_reviews',
    )
    restaurant_rating = models.PositiveSmallIntegerField()
    driver_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Reseña'
        verbose_name_plural = 'Reseñas'
        ordering = ['-created_at']

    def __str__(self):
        return f'Reseña pedido #{self.order_id}'


class Order(models.Model):
    code = models.CharField(
        max_length=8,
        unique=True,
        db_index=True,
        blank=True,
        default='',
        verbose_name='Código',
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
    )
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='orders',
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deliveries',
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    mercadopago_payment_id = models.CharField(max_length=80, blank=True, db_index=True)
    mercadopago_status = models.CharField(max_length=40, blank=True)
    mercadopago_payload = models.JSONField(default=dict, blank=True)
    cancellation_source = models.CharField(
        max_length=20,
        choices=CancellationSource.choices,
        blank=True,
        default='',
    )
    pending_reminder_sent = models.BooleanField(default=False)
    ready_no_driver_reminder_sent = models.BooleanField(default=False)
    review_reminder_sent = models.BooleanField(default=False)
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00')
    )
    delivery_address = models.TextField()
    delivery_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    delivery_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    delivery_notes = models.TextField(blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('25.00'))
    tip_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Propina para el repartidor.',
    )
    scheduled_for = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Entrega programada (opcional).',
    )
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    driver_nearby_notified = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']

    def __str__(self):
        ref = self.code or str(self.id or '…')
        return f'Pedido {ref} - {self.get_status_display()}'

    @property
    def display_ref(self) -> str:
        return self.code or f'#{self.id}'

    def recalculate_totals(self):
        self.subtotal = sum(item.subtotal for item in self.items.all())
        discount = self.discount_amount or Decimal('0.00')
        tip = self.tip_amount or Decimal('0.00')
        self.total = max(
            self.subtotal + self.delivery_fee + tip - discount,
            Decimal('0.00'),
        )
        self.save(update_fields=['subtotal', 'total', 'updated_at'])

    def ensure_code(self) -> str:
        """Asigna y persiste código si falta (p. ej. pedidos previos a la migración)."""
        if self.code:
            return self.code
        from .codes import assign_unique_order_code

        assign_unique_order_code(self)
        if self.pk:
            updated = Order.objects.filter(pk=self.pk, code='').update(code=self.code)
            if not updated:
                self.refresh_from_db(fields=['code'])
        return self.code


class OrderMessage(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='order_messages',
    )
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensaje de pedido'
        verbose_name_plural = 'Mensajes de pedido'
        ordering = ['created_at']

    def __str__(self):
        return f'Mensaje pedido #{self.order_id} — {self.sender_id}'


class DisputeStatus(models.TextChoices):
    PENDING = 'pending', 'Pendiente'
    APPROVED = 'approved', 'Aprobada'
    REJECTED = 'rejected', 'Rechazada'
    REFUNDED = 'refunded', 'Reembolsada'


class OrderDispute(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='disputes',
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='order_disputes',
    )
    reason = models.TextField(max_length=2000)
    requested_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=DisputeStatus.choices,
        default=DisputeStatus.PENDING,
    )
    admin_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Disputa / reembolso'
        verbose_name_plural = 'Disputas / reembolsos'
        ordering = ['-created_at']

    def __str__(self):
        return f'Disputa pedido #{self.order_id} — {self.get_status_display()}'


class ShipmentStatus(models.TextChoices):
    PENDING = 'pending', 'Pendiente'
    PICKED_UP = 'picked_up', 'Recogido'
    ON_THE_WAY = 'on_the_way', 'En camino'
    DELIVERED = 'delivered', 'Entregado'
    CANCELLED = 'cancelled', 'Cancelado'


class ShipmentSize(models.TextChoices):
    SMALL = 'small', 'Chico'
    MEDIUM = 'medium', 'Mediano'
    LARGE = 'large', 'Grande'


SHIPMENT_SIZE_FEES = {
    ShipmentSize.SMALL: Decimal('25.00'),
    ShipmentSize.MEDIUM: Decimal('45.00'),
    ShipmentSize.LARGE: Decimal('70.00'),
}


def get_shipment_fee(size: str) -> Decimal:
    return SHIPMENT_SIZE_FEES.get(size, SHIPMENT_SIZE_FEES[ShipmentSize.SMALL])


class Shipment(models.Model):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shipments',
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipment_deliveries',
    )
    status = models.CharField(
        max_length=20,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.PENDING,
    )
    description = models.CharField(max_length=200)
    size = models.CharField(
        max_length=10,
        choices=ShipmentSize.choices,
        default=ShipmentSize.SMALL,
    )
    pickup_address = models.TextField()
    pickup_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    pickup_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    pickup_notes = models.TextField(blank=True)
    delivery_address = models.TextField()
    delivery_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    delivery_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    delivery_notes = models.TextField(blank=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('25.00'))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('25.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    driver_nearby_notified = models.BooleanField(default=False)
    pending_reminder_sent = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Envío'
        verbose_name_plural = 'Envíos'
        ordering = ['-created_at']

    def __str__(self):
        return f'Envío #{self.id} - {self.get_status_display()}'


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        'restaurants.Product',
        on_delete=models.PROTECT,
        related_name='order_items',
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.CharField(max_length=255, blank=True)
    # Snapshot de sabores/toppings elegidos: [{id, group, name, price_delta}, ...]
    selected_options = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = 'Item de pedido'
        verbose_name_plural = 'Items de pedido'

    def __str__(self):
        return f'{self.quantity}x {self.product.name}'

    @property
    def subtotal(self):
        return self.unit_price * self.quantity


class IdempotencyRecord(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        COMPLETED = 'completed', 'Completado'

    key = models.CharField(max_length=64)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='idempotency_records',
    )
    scope = models.CharField(max_length=32)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    response_body = models.JSONField(default=dict, blank=True)
    status_code = models.PositiveSmallIntegerField(default=201)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Idempotencia'
        verbose_name_plural = 'Idempotencia'
        constraints = [
            models.UniqueConstraint(
                fields=['key', 'user', 'scope'],
                name='orders_idempotency_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.scope}:{self.key[:12]}…'

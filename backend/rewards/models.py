from decimal import Decimal

from django.conf import settings
from django.db import models


class BenefitKind(models.TextChoices):
    BIRTHDAY = 'birthday', 'Cumpleaños'
    LOYALTY = 'loyalty', 'Lealtad'
    REFERRAL_INVITEE = 'referral_invitee', 'Bienvenida referido'
    REFERRAL_CREDIT = 'referral_credit', 'Crédito por referido'


class RedemptionStatus(models.TextChoices):
    RESERVED = 'reserved', 'Reservado'
    CONSUMED = 'consumed', 'Utilizado'
    RELEASED = 'released', 'Liberado'


class RewardProgramConfig(models.Model):
    """Singleton editable en el panel. pk=1."""

    birthday_enabled = models.BooleanField(default=True)
    loyalty_enabled = models.BooleanField(default=True)
    loyalty_orders_required = models.PositiveSmallIntegerField(default=5)
    delivery_discount_cap = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('35.00'),
        help_text='Tope máximo del descuento de envío (MXN).',
    )

    class Meta:
        verbose_name = 'Configuración de beneficios'
        verbose_name_plural = 'Configuración de beneficios'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Beneficios ZinApp'


class LoyaltyProgressEvent(models.Model):
    """Un pedido entregado que suma al ciclo de lealtad. unique(order) evita doble conteo."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='loyalty_progress_events',
    )
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='loyalty_progress_event',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Progreso de lealtad'
        verbose_name_plural = 'Progresos de lealtad'

    def __str__(self):
        return f'{self.user_id} · pedido {self.order_id}'


class RewardRedemption(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reward_redemptions',
    )
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='reward_redemption',
    )
    kind = models.CharField(max_length=20, choices=BenefitKind.choices, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=RedemptionStatus.choices,
        default=RedemptionStatus.RESERVED,
        db_index=True,
    )
    year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Año calendario del cumpleaños (solo kind=birthday).',
    )
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    reserved_at = models.DateTimeField(auto_now_add=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-reserved_at']
        verbose_name = 'Redención de beneficio'
        verbose_name_plural = 'Redenciones de beneficio'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'kind', 'year'],
                condition=models.Q(
                    kind='birthday',
                    status__in=['reserved', 'consumed'],
                ),
                name='uniq_active_birthday_year',
            ),
            models.UniqueConstraint(
                fields=['user', 'kind'],
                condition=models.Q(
                    kind='referral_invitee',
                    status__in=['reserved', 'consumed'],
                ),
                name='uniq_active_referral_invitee',
            ),
        ]

    def __str__(self):
        return f'{self.user_id} {self.kind} {self.status} pedido {self.order_id}'


class ReferralCredit(models.Model):
    class Status(models.TextChoices):
        UNUSED = 'unused', 'Disponible'
        RESERVED = 'reserved', 'Reservado'
        CONSUMED = 'consumed', 'Utilizado'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='referral_credits',
        help_text='Quien invitó y recibe el envío gratis.',
    )
    from_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='referral_credit_granted',
        help_text='Invitado cuya primera entrega genera el crédito.',
    )
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='referral_credits',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNUSED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Crédito de referido'
        verbose_name_plural = 'Créditos de referido'

    def __str__(self):
        return f'{self.user_id} ← {self.from_user_id} {self.status}'

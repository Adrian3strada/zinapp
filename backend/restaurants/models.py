from django.conf import settings
from django.db import models
from django.utils import timezone


class RestaurantCategory(models.TextChoices):
    GENERAL = 'general', 'General'
    PIZZAS = 'pizzas', 'Pizzas'
    MAKIS = 'makis', 'Makis'
    MEXICANA = 'mexicana', 'Mexicana'


class ProductCategory(models.TextChoices):
    ENTRADAS = 'entradas', 'Entradas'
    COMIDA = 'comida', 'Comida'
    BEBIDAS = 'bebidas', 'Bebidas'
    POSTRES = 'postres', 'Postres'
    EXTRAS = 'extras', 'Extras'


# Orden de secciones en el menú del cliente
PRODUCT_CATEGORY_ORDER = (
    ProductCategory.ENTRADAS,
    ProductCategory.COMIDA,
    ProductCategory.BEBIDAS,
    ProductCategory.POSTRES,
    ProductCategory.EXTRAS,
)


class Restaurant(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='restaurants',
    )
    name = models.CharField(max_length=150)
    category = models.CharField(
        max_length=20,
        choices=RestaurantCategory.choices,
        default=RestaurantCategory.GENERAL,
    )
    description = models.TextField(blank=True)
    address = models.TextField()
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(
        max_length=20,
        blank=True,
        help_text='WhatsApp de contacto del negocio (opcional; si vacío, usa teléfono).',
    )
    bank_name = models.CharField(max_length=80, blank=True)
    account_holder = models.CharField(max_length=120, blank=True)
    clabe = models.CharField(max_length=18, blank=True)
    image = models.ImageField(upload_to='restaurants/', blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_pinned = models.BooleanField(
        default=False,
        help_text='True cuando el dueño confirmó la ubicación exacta en el mapa.',
    )
    is_active = models.BooleanField(default=False)
    accepting_orders = models.BooleanField(default=False)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    last_open_notification_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Restaurante'
        verbose_name_plural = 'Restaurantes'
        ordering = ['name']

    def __str__(self):
        return self.name

    def is_open_now(self) -> bool:
        if not self.is_active or not self.accepting_orders:
            return False
        if not self.opening_time or not self.closing_time:
            return True
        now = timezone.localtime().time()
        if self.opening_time <= self.closing_time:
            return self.opening_time <= now <= self.closing_time
        return now >= self.opening_time or now <= self.closing_time


class RestaurantFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='restaurant_favorites',
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='favorites',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Restaurante favorito'
        verbose_name_plural = 'Restaurantes favoritos'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'restaurant'],
                name='unique_restaurant_favorite',
            ),
        ]

    def __str__(self):
        return f'{self.user.username} → {self.restaurant.name}'


class Product(models.Model):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='products',
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=20,
        choices=ProductCategory.choices,
        default=ProductCategory.COMIDA,
        help_text='Sección del menú (comida, bebidas, postres, etc.).',
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} - {self.restaurant.name}'


class ProductOptionGroup(models.Model):
    """Grupo de opciones de un platillo (Sabor, Tamaño, Toppings…)."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='option_groups',
    )
    name = models.CharField(max_length=80)
    min_select = models.PositiveSmallIntegerField(
        default=1,
        help_text='Mínimo de opciones a elegir (0 = opcional).',
    )
    max_select = models.PositiveSmallIntegerField(
        default=1,
        help_text='Máximo de opciones (1 = una sola).',
    )
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Grupo de opciones'
        verbose_name_plural = 'Grupos de opciones'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.product.name} / {self.name}'


class ProductOption(models.Model):
    group = models.ForeignKey(
        ProductOptionGroup,
        on_delete=models.CASCADE,
        related_name='options',
    )
    name = models.CharField(max_length=80)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Opción de producto'
        verbose_name_plural = 'Opciones de producto'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.group.name}: {self.name}'


class PromoType(models.TextChoices):
    TWO_FOR_ONE = 'two_for_one', '2x1'
    PERCENT_OFF = 'percent_off', 'Porcentaje de descuento'
    SPECIAL_PRICE = 'special_price', 'Precio especial'


class ProductPromotion(models.Model):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='promotions',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='promotions',
    )
    promo_type = models.CharField(max_length=20, choices=PromoType.choices)
    percent_off = models.PositiveSmallIntegerField(null=True, blank=True)
    special_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    label = models.CharField(max_length=40, blank=True)
    valid_until = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Promoción'
        verbose_name_plural = 'Promociones'
        ordering = ['-valid_until', '-id']

    def __str__(self):
        return f'{self.product.name} — {self.get_promo_type_display()}'

    def is_currently_active(self) -> bool:
        from .promotions import promo_is_active

        return promo_is_active(self)

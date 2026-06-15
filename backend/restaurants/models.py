from django.conf import settings
from django.db import models


class RestaurantCategory(models.TextChoices):
    GENERAL = 'general', 'General'
    PIZZAS = 'pizzas', 'Pizzas'
    MAKIS = 'makis', 'Makis'
    MEXICANA = 'mexicana', 'Mexicana'


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
    image = models.ImageField(upload_to='restaurants/', blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    accepting_orders = models.BooleanField(default=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Restaurante'
        verbose_name_plural = 'Restaurantes'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='products',
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
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

from django.contrib import admin

from .models import Product, Restaurant


class ProductInline(admin.TabularInline):
    model = Product
    extra = 1


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'phone', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'owner__username', 'address')
    inlines = [ProductInline]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'restaurant', 'price', 'is_available')
    list_filter = ('is_available', 'restaurant')
    search_fields = ('name', 'restaurant__name')

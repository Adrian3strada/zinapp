from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from accounts.models import DeliveryProfile, PasswordResetToken, User
from dashboard.panel_admin import panel_admin
from orders.models import Coupon, Order, OrderItem, Review, Shipment
from restaurants.models import Product, Restaurant


class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'phone', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'email', 'phone')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Información adicional', {'fields': ('role', 'phone', 'address', 'expo_push_token')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Información adicional', {'fields': ('role', 'phone', 'address')}),
    )


class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'expires_at', 'used', 'created_at')
    search_fields = ('user__username', 'token')


class DeliveryProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'is_available', 'updated_at')
    list_filter = ('vehicle_type', 'is_available')
    search_fields = ('user__username', 'license_plate')


class ProductInline(admin.TabularInline):
    model = Product
    extra = 1


class RestaurantAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'phone', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'owner__username', 'address')
    inlines = [ProductInline]


class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'restaurant', 'price', 'is_available')
    list_filter = ('is_available', 'restaurant')
    search_fields = ('name', 'restaurant__name')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'unit_price', 'notes')


class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'code', 'customer', 'restaurant', 'driver', 'status',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer__username', 'restaurant__name')
    inlines = [OrderItemInline]
    readonly_fields = ('code', 'subtotal', 'total', 'created_at', 'updated_at')


class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price')
    search_fields = ('order__id', 'product__name')


class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_percent', 'discount_fixed', 'is_active', 'times_used')
    search_fields = ('code',)


class ReviewAdmin(admin.ModelAdmin):
    list_display = ('order', 'restaurant', 'restaurant_rating', 'driver_rating', 'created_at')
    search_fields = ('order__id', 'restaurant__name')


class ShipmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'customer', 'driver', 'status', 'size', 'description',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'size', 'payment_method', 'created_at')
    search_fields = ('customer__username', 'description', 'pickup_address', 'delivery_address')
    readonly_fields = ('total', 'created_at', 'updated_at', 'delivered_at')


panel_admin.register(User, UserAdmin)
panel_admin.register(PasswordResetToken, PasswordResetTokenAdmin)
panel_admin.register(DeliveryProfile, DeliveryProfileAdmin)
panel_admin.register(Restaurant, RestaurantAdmin)
panel_admin.register(Product, ProductAdmin)
panel_admin.register(Order, OrderAdmin)
panel_admin.register(OrderItem, OrderItemAdmin)
panel_admin.register(Coupon, CouponAdmin)
panel_admin.register(Review, ReviewAdmin)
panel_admin.register(Shipment, ShipmentAdmin)

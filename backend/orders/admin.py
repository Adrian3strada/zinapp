from django.contrib import admin

from .models import Coupon, Order, OrderItem, Review, Shipment


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'unit_price', 'notes')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'code', 'customer', 'restaurant', 'driver', 'status',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer__username', 'restaurant__name')
    inlines = [OrderItemInline]
    readonly_fields = ('code', 'subtotal', 'total', 'created_at', 'updated_at')


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price')
    search_fields = ('order__id', 'product__name')


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_percent', 'discount_fixed', 'is_active', 'times_used')
    search_fields = ('code',)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('order', 'restaurant', 'restaurant_rating', 'driver_rating', 'created_at')
    search_fields = ('order__id', 'restaurant__name')


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'customer', 'driver', 'status', 'size', 'description',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'size', 'payment_method', 'created_at')
    search_fields = ('customer__username', 'description', 'pickup_address', 'delivery_address')
    readonly_fields = ('total', 'created_at', 'updated_at', 'delivered_at')

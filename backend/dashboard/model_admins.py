from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from accounts.models import AuditLog, DeliveryProfile, PasswordResetToken, User
from dashboard.access import can_access_panel
from dashboard.panel_admin import panel_admin
from local_services.models import LocalService
from orders.models import Coupon, Order, OrderDispute, OrderItem, Review, Shipment
from restaurants.models import Product, ProductPromotion, Restaurant


class PanelModelAdmin(admin.ModelAdmin):
    """Grant console access to any user who can open the operations panel."""

    def has_module_permission(self, request):
        return can_access_panel(request.user)

    def has_view_permission(self, request, obj=None):
        return can_access_panel(request.user)

    def has_add_permission(self, request):
        return can_access_panel(request.user)

    def has_change_permission(self, request, obj=None):
        return can_access_panel(request.user)

    def has_delete_permission(self, request, obj=None):
        return can_access_panel(request.user)


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

    def has_module_permission(self, request):
        return can_access_panel(request.user)

    def has_view_permission(self, request, obj=None):
        return can_access_panel(request.user)

    def has_add_permission(self, request):
        return can_access_panel(request.user)

    def has_change_permission(self, request, obj=None):
        return can_access_panel(request.user)

    def has_delete_permission(self, request, obj=None):
        return can_access_panel(request.user)


class PasswordResetTokenAdmin(PanelModelAdmin):
    list_display = ('user', 'token', 'expires_at', 'used', 'created_at')
    search_fields = ('user__username', 'token')


class DeliveryProfileAdmin(PanelModelAdmin):
    list_display = ('user', 'vehicle_type', 'verification_status', 'is_available', 'updated_at')
    list_filter = ('vehicle_type', 'verification_status', 'is_available')
    search_fields = ('user__username', 'license_plate')
    readonly_fields = ('reviewed_by', 'reviewed_at', 'created_at', 'updated_at')


class AuditLogAdmin(PanelModelAdmin):
    list_display = ('created_at', 'action', 'actor', 'object_type', 'object_id', 'ip_address')
    list_filter = ('action', 'object_type', 'created_at')
    search_fields = ('actor__username', 'object_type', 'object_id')
    readonly_fields = (
        'actor', 'action', 'object_type', 'object_id',
        'metadata', 'ip_address', 'user_agent', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ProductInline(admin.TabularInline):
    model = Product
    extra = 1


class RestaurantAdmin(PanelModelAdmin):
    list_display = ('name', 'owner', 'phone', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'owner__username', 'address')
    inlines = [ProductInline]


class ProductAdmin(PanelModelAdmin):
    list_display = ('name', 'restaurant', 'category', 'price', 'is_available')
    list_filter = ('is_available', 'category', 'restaurant')
    search_fields = ('name', 'restaurant__name')


class ProductPromotionAdmin(PanelModelAdmin):
    list_display = (
        'product', 'restaurant', 'promo_type', 'percent_off',
        'special_price', 'valid_until', 'is_active',
    )
    list_filter = ('promo_type', 'is_active', 'restaurant')
    search_fields = ('product__name', 'restaurant__name', 'label')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product', 'quantity', 'unit_price', 'notes')


class OrderAdmin(PanelModelAdmin):
    list_display = (
        'id', 'code', 'customer', 'restaurant', 'driver', 'status',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer__username', 'restaurant__name')
    inlines = [OrderItemInline]
    readonly_fields = ('code', 'subtotal', 'total', 'created_at', 'updated_at')


class OrderItemAdmin(PanelModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price', 'notes')
    search_fields = ('order__id', 'product__name', 'notes')


class OrderDisputeAdmin(PanelModelAdmin):
    list_display = (
        'id', 'order', 'customer', 'status', 'requested_amount',
        'resolved_at', 'created_at',
    )
    list_filter = ('status', 'created_at')
    search_fields = ('order__code', 'customer__username', 'reason')
    readonly_fields = ('order', 'customer', 'reason', 'requested_amount', 'created_at', 'updated_at')


class CouponAdmin(PanelModelAdmin):
    list_display = ('code', 'discount_percent', 'discount_fixed', 'is_active', 'times_used')
    search_fields = ('code',)


class ReviewAdmin(PanelModelAdmin):
    list_display = ('order', 'restaurant', 'restaurant_rating', 'driver_rating', 'created_at')
    search_fields = ('order__id', 'restaurant__name')


class ShipmentAdmin(PanelModelAdmin):
    list_display = (
        'id', 'customer', 'driver', 'status', 'size', 'description',
        'payment_method', 'total', 'created_at',
    )
    list_filter = ('status', 'size', 'payment_method', 'created_at')
    search_fields = ('customer__username', 'description', 'pickup_address', 'delivery_address')
    readonly_fields = ('total', 'created_at', 'updated_at', 'delivered_at')


class LocalServiceAdmin(PanelModelAdmin):
    list_display = ('name', 'category', 'phone', 'whatsapp', 'is_active', 'sort_order', 'updated_at')
    list_filter = ('is_active', 'category')
    search_fields = ('name', 'description', 'phone', 'whatsapp')
    ordering = ('sort_order', 'name')


panel_admin.register(User, UserAdmin)
panel_admin.register(PasswordResetToken, PasswordResetTokenAdmin)
panel_admin.register(DeliveryProfile, DeliveryProfileAdmin)
panel_admin.register(AuditLog, AuditLogAdmin)
panel_admin.register(Restaurant, RestaurantAdmin)
panel_admin.register(Product, ProductAdmin)
panel_admin.register(ProductPromotion, ProductPromotionAdmin)
panel_admin.register(Order, OrderAdmin)
panel_admin.register(OrderItem, OrderItemAdmin)
panel_admin.register(OrderDispute, OrderDisputeAdmin)
panel_admin.register(Coupon, CouponAdmin)
panel_admin.register(Review, ReviewAdmin)
panel_admin.register(Shipment, ShipmentAdmin)
panel_admin.register(LocalService, LocalServiceAdmin)

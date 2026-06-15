from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import DeliveryProfile, PasswordResetToken, User


@admin.register(User)
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


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'expires_at', 'used', 'created_at')
    search_fields = ('user__username', 'token')


@admin.register(DeliveryProfile)
class DeliveryProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'is_available', 'updated_at')
    list_filter = ('vehicle_type', 'is_available')
    search_fields = ('user__username', 'license_plate')

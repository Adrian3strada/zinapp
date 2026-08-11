from django.contrib import admin

from .models import (
    CashMovement,
    CashRegister,
    CashSession,
    POSSale,
    POSStaffMembership,
)


@admin.register(POSStaffMembership)
class POSStaffMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'restaurant', 'role', 'is_active', 'updated_at')
    list_filter = ('role', 'is_active', 'restaurant')
    search_fields = ('user__username', 'restaurant__name')
    raw_id_fields = ('user', 'restaurant')


@admin.register(CashRegister)
class CashRegisterAdmin(admin.ModelAdmin):
    list_display = ('name', 'restaurant', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'restaurant__name')
    raw_id_fields = ('restaurant',)


@admin.register(CashSession)
class CashSessionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'cash_register', 'restaurant', 'status',
        'opened_by', 'opened_at', 'closed_at',
    )
    list_filter = ('status',)
    raw_id_fields = ('cash_register', 'restaurant', 'opened_by', 'closed_by')


@admin.register(CashMovement)
class CashMovementAdmin(admin.ModelAdmin):
    list_display = ('id', 'type', 'amount', 'session', 'restaurant', 'created_at')
    list_filter = ('type',)
    raw_id_fields = ('session', 'restaurant', 'order', 'created_by')


@admin.register(POSSale)
class POSSaleAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'cash_session', 'local_folio', 'created_at')
    raw_id_fields = ('order', 'cash_session', 'cancelled_by')

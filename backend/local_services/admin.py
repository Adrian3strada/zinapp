from django.contrib import admin

from .models import LocalService


@admin.register(LocalService)
class LocalServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'whatsapp', 'is_active', 'sort_order', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description', 'phone', 'whatsapp')
    ordering = ('sort_order', 'name')

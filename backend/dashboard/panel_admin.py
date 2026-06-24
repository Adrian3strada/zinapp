from urllib.parse import urlencode

from django.contrib.admin import AdminSite
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.urls import reverse


class PanelAdminSite(AdminSite):
    """Admin de Django integrado al panel de operaciones (sin /admin/ público)."""

    site_header = 'ZinApp — Gestión de datos'
    site_title = 'ZinApp Panel'
    index_title = 'Catálogo y registros del sistema'
    enable_nav_sidebar = False

    def has_permission(self, request):
        user = request.user
        return user.is_active and user.is_authenticated and (
            user.is_staff or user.is_superuser or getattr(user, 'is_admin_user', False)
        )

    def login(self, request, extra_context=None):
        login_url = reverse('dashboard:login')
        next_url = request.GET.get('next') or '/panel/gestion/'
        if '/login' in next_url:
            next_url = '/panel/gestion/'
        return redirect(f'{login_url}?{urlencode({"next": next_url})}')

    def logout(self, request, extra_context=None):
        logout(request)
        return redirect('dashboard:login')

    def each_context(self, request):
        context = super().each_context(request)
        context['nav'] = 'gestion'
        context['page_title'] = 'Gestión de datos'
        return context


panel_admin = PanelAdminSite(name='admin')

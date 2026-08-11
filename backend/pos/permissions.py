"""Mixins de autorización para vistas POS."""

from __future__ import annotations

from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy

from .access import (
    accessible_restaurants_qs,
    get_active_pos_access,
    role_has_permission,
)


class PosLoginRequiredMixin(LoginRequiredMixin):
    login_url = reverse_lazy('pos:login')


class PosAccessMixin(PosLoginRequiredMixin):
    """Exige sesión POS con restaurante válido y permiso de vista."""

    pos_permission: str | None = 'dashboard'
    allowed_roles: tuple[str, ...] | None = None

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()

        restaurants = accessible_restaurants_qs(request.user)
        if not restaurants.exists():
            logout(request)
            messages.error(
                request,
                'Tu cuenta no tiene acceso a ZinApp POS o el POS no está habilitado.',
            )
            return redirect(self.login_url)

        access = get_active_pos_access(request)
        if access is None:
            if restaurants.count() == 1:
                from .access import set_session_restaurant

                set_session_restaurant(request, restaurants.first())
                access = get_active_pos_access(request)
            else:
                return redirect('pos:select_restaurant')

        if access is None:
            return redirect('pos:select_restaurant')

        if self.pos_permission and not role_has_permission(access.role, self.pos_permission):
            messages.error(request, 'No tienes permiso para esta sección del POS.')
            return redirect('pos:dashboard')

        if self.allowed_roles and access.role not in self.allowed_roles:
            messages.error(request, 'No tienes permiso para esta sección del POS.')
            return redirect('pos:dashboard')

        self.pos_access = access
        self.pos_restaurant = access.restaurant
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        access = getattr(self, 'pos_access', None)
        if access:
            ctx['pos_restaurant'] = access.restaurant
            ctx['pos_role'] = access.role
            ctx['pos_is_owner'] = access.is_owner
        return ctx

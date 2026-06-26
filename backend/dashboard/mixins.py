from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy

from .access import can_access_panel


class PanelAccessMixin(LoginRequiredMixin, UserPassesTestMixin):
    login_url = reverse_lazy('dashboard:login')

    def test_func(self):
        return can_access_panel(self.request.user)

    def handle_no_permission(self):
        if self.request.user.is_authenticated and not can_access_panel(self.request.user):
            logout(self.request)
            messages.error(
                self.request,
                'Esta cuenta no tiene acceso al panel. Usa un usuario administrador.',
            )
            return redirect(self.login_url)
        return super().handle_no_permission()

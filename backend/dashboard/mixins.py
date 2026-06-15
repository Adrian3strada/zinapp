from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.urls import reverse_lazy


class PanelAccessMixin(LoginRequiredMixin, UserPassesTestMixin):
    login_url = reverse_lazy('dashboard:login')

    def test_func(self):
        user = self.request.user
        return user.is_authenticated and (
            user.is_staff or user.is_superuser or user.is_admin_user
        )

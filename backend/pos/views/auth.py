from django.contrib.auth import logout
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie

from ..access import (
    accessible_restaurants_qs,
    clear_session_restaurant,
    set_session_restaurant,
    user_can_access_pos_restaurant,
)
from ..forms import PosLoginForm


@method_decorator(ensure_csrf_cookie, name='dispatch')
class PosLoginView(LoginView):
    template_name = 'pos/login.html'
    authentication_form = PosLoginForm
    redirect_authenticated_user = False

    def get_success_url(self):
        return reverse_lazy('pos:post_login')

    def form_valid(self, form):
        user = form.get_user()
        restaurants = accessible_restaurants_qs(user)
        if not restaurants.exists():
            form.add_error(
                None,
                'Esta cuenta no tiene acceso a ZinApp POS, o ningún restaurante '
                'tiene el POS habilitado.',
            )
            return self.form_invalid(form)
        return super().form_valid(form)

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated and accessible_restaurants_qs(request.user).exists():
            return redirect('pos:post_login')
        # Si venía logueado (p. ej. panel admin), cierra sesión y recarga el login
        # en un GET limpio para no reutilizar cookie/token CSRF viejos.
        if request.user.is_authenticated:
            logout(request)
            return redirect('pos:login')
        return super().dispatch(request, *args, **kwargs)


class PosLogoutView(View):
    def get(self, request):
        clear_session_restaurant(request)
        logout(request)
        return redirect('pos:login')

    def post(self, request):
        return self.get(request)


class PosPostLoginView(View):
    """Elige restaurante automáticamente si solo hay uno."""

    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('pos:login')
        restaurants = list(accessible_restaurants_qs(request.user))
        if not restaurants:
            logout(request)
            return redirect('pos:login')
        if len(restaurants) == 1:
            set_session_restaurant(request, restaurants[0])
            return redirect('pos:dashboard')
        return redirect('pos:select_restaurant')


class PosSelectRestaurantView(View):
    template_name = 'pos/select_restaurant.html'

    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('pos:login')
        restaurants = list(accessible_restaurants_qs(request.user))
        if not restaurants:
            logout(request)
            return redirect('pos:login')
        if len(restaurants) == 1:
            set_session_restaurant(request, restaurants[0])
            return redirect('pos:dashboard')
        return render(request, self.template_name, {'restaurants': restaurants})

    def post(self, request):
        if not request.user.is_authenticated:
            return redirect('pos:login')
        try:
            restaurant_id = int(request.POST.get('restaurant_id') or 0)
        except (TypeError, ValueError):
            restaurant_id = 0
        restaurant = accessible_restaurants_qs(request.user).filter(pk=restaurant_id).first()
        if not restaurant or not user_can_access_pos_restaurant(request.user, restaurant):
            return redirect('pos:select_restaurant')
        set_session_restaurant(request, restaurant)
        return redirect('pos:dashboard')

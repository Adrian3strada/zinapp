from django.contrib.auth import logout
from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Count, Q
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.views.generic import DetailView, ListView, TemplateView

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import Order, OrderStatus
from restaurants.models import Restaurant

from .mixins import PanelAccessMixin
from .services import get_dashboard_stats, get_order_timeline


class PanelLoginView(LoginView):
    template_name = 'dashboard/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('dashboard:home')


class PanelLogoutView(LogoutView):
    next_page = reverse_lazy('dashboard:login')


def panel_logout(request):
    logout(request)
    return redirect('dashboard:login')


class DashboardHomeView(PanelAccessMixin, TemplateView):
    template_name = 'dashboard/home.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(get_dashboard_stats())
        ctx['page_title'] = 'Resumen'
        ctx['nav'] = 'home'
        return ctx


class OrderListView(PanelAccessMixin, ListView):
    model = Order
    template_name = 'dashboard/orders/list.html'
    context_object_name = 'orders'
    paginate_by = 25

    def get_queryset(self):
        qs = Order.objects.select_related('customer', 'restaurant', 'driver')
        status = self.request.GET.get('status', '').strip()
        if status and status in OrderStatus.values:
            qs = qs.filter(status=status)
        search = self.request.GET.get('q', '').strip()
        if search:
            if search.isdigit():
                qs = qs.filter(Q(id=int(search)) | Q(customer__username__icontains=search))
            else:
                qs = qs.filter(
                    Q(customer__username__icontains=search)
                    | Q(restaurant__name__icontains=search)
                    | Q(delivery_address__icontains=search)
                )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = 'Pedidos'
        ctx['nav'] = 'orders'
        ctx['status_filter'] = self.request.GET.get('status', '')
        ctx['search_query'] = self.request.GET.get('q', '')
        ctx['status_choices'] = OrderStatus.choices
        return ctx


class OrderDetailView(PanelAccessMixin, DetailView):
    model = Order
    template_name = 'dashboard/orders/detail.html'
    context_object_name = 'order'

    def get_queryset(self):
        return Order.objects.select_related(
            'customer', 'restaurant', 'restaurant__owner', 'driver', 'coupon',
        ).prefetch_related('items', 'items__product')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = f'Pedido #{self.object.id}'
        ctx['nav'] = 'orders'
        ctx['timeline_steps'] = get_order_timeline(self.object)
        return ctx


class RestaurantListView(PanelAccessMixin, ListView):
    model = Restaurant
    template_name = 'dashboard/restaurants/list.html'
    context_object_name = 'restaurants'
    paginate_by = 20

    def get_queryset(self):
        return Restaurant.objects.select_related('owner').annotate(
            product_count=Count('products'),
            order_count=Count('orders'),
        ).order_by('name')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = 'Restaurantes'
        ctx['nav'] = 'restaurants'
        return ctx


class UserListView(PanelAccessMixin, ListView):
    model = User
    template_name = 'dashboard/users/list.html'
    context_object_name = 'users'
    paginate_by = 30

    def get_queryset(self):
        qs = User.objects.order_by('-date_joined')
        role = self.request.GET.get('role', '').strip()
        if role and role in UserRole.values:
            qs = qs.filter(role=role)
        search = self.request.GET.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = 'Usuarios'
        ctx['nav'] = 'users'
        ctx['role_filter'] = self.request.GET.get('role', '')
        ctx['role_choices'] = UserRole.choices
        ctx['search_query'] = self.request.GET.get('q', '')
        return ctx


class DriverListView(PanelAccessMixin, ListView):
    model = DeliveryProfile
    template_name = 'dashboard/drivers/list.html'
    context_object_name = 'drivers'
    paginate_by = 20

    def get_queryset(self):
        qs = DeliveryProfile.objects.select_related('user').order_by('-updated_at')
        if self.request.GET.get('available') == '1':
            qs = qs.filter(is_available=True)
        elif self.request.GET.get('available') == '0':
            qs = qs.filter(is_available=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = 'Repartidores'
        ctx['nav'] = 'drivers'
        ctx['available_filter'] = self.request.GET.get('available', '')
        return ctx

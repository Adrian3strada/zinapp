from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View
from django.views.generic import DetailView, ListView, TemplateView

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import Order, OrderStatus
from restaurants.models import Restaurant
from restaurants.setup import restaurant_setup_status

from .access import can_access_panel
from .mixins import PanelAccessMixin
from .page_context import page_context
from .services import get_dashboard_stats, get_order_timeline


class PanelLoginView(LoginView):
    template_name = 'dashboard/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        next_url = self.request.GET.get('next') or self.request.POST.get('next')
        if next_url and url_has_allowed_host_and_scheme(
            next_url,
            allowed_hosts={self.request.get_host()},
            require_https=self.request.is_secure(),
        ):
            return next_url
        return reverse_lazy('dashboard:home')

    def form_valid(self, form):
        user = form.get_user()
        if not can_access_panel(user):
            form.add_error(
                None,
                'Esta cuenta no tiene acceso al panel. Usa un usuario administrador.',
            )
            return self.form_invalid(form)
        return super().form_valid(form)

    def dispatch(self, request, *args, **kwargs):
        if (
            request.user.is_authenticated
            and can_access_panel(request.user)
            and self.redirect_authenticated_user
        ):
            return redirect(self.get_success_url())
        if request.user.is_authenticated and not can_access_panel(request.user):
            logout(request)
        return super().dispatch(request, *args, **kwargs)


class PanelLogoutView(LogoutView):
    next_page = reverse_lazy('dashboard:login')


def panel_logout(request):
    logout(request)
    return redirect('dashboard:login')


class DashboardHomeView(PanelAccessMixin, TemplateView):
    template_name = 'dashboard/home.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context('Resumen', 'home'))
        ctx.update(get_dashboard_stats())
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
        ctx.update(page_context(
            'Pedidos',
            'orders',
            subtitle='Consulta y da seguimiento a todos los pedidos de la plataforma.',
        ))
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
        ctx.update(page_context(
            f'Pedido #{self.object.id}',
            'orders',
            breadcrumbs=[
                {'label': 'Pedidos', 'url': reverse('dashboard:orders')},
                {'label': f'#{self.object.id}', 'url': None},
            ],
        ))
        ctx['timeline_steps'] = get_order_timeline(self.object)
        return ctx


class RestaurantListView(PanelAccessMixin, ListView):
    model = Restaurant
    template_name = 'dashboard/restaurants/list.html'
    context_object_name = 'restaurants'
    paginate_by = 20

    def get_queryset(self):
        qs = Restaurant.objects.select_related('owner').annotate(
            product_count=Count('products'),
            available_product_count=Count('products', filter=Q(products__is_available=True)),
            order_count=Count('orders'),
        ).order_by('-created_at')
        search = self.request.GET.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(owner__username__icontains=search),
            )
        active = self.request.GET.get('active', '').strip()
        if active == '1':
            qs = qs.filter(is_active=True)
        elif active == '0':
            qs = qs.filter(is_active=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        pending = Restaurant.objects.filter(is_active=False).count()
        ctx.update(page_context(
            'Restaurantes',
            'restaurants',
            subtitle='Activa locales nuevos, pausa pedidos y edita datos del negocio.',
        ))
        ctx['restaurants_total'] = Restaurant.objects.count()
        ctx['restaurants_pending'] = pending
        ctx['search_query'] = self.request.GET.get('q', '')
        ctx['active_filter'] = self.request.GET.get('active', '')
        return ctx


class RestaurantDetailView(PanelAccessMixin, DetailView):
    model = Restaurant
    template_name = 'dashboard/restaurants/detail.html'
    context_object_name = 'restaurant'

    def get_queryset(self):
        return Restaurant.objects.select_related('owner').prefetch_related('products')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        restaurant = self.object
        ctx.update(page_context(
            restaurant.name,
            'restaurants',
            breadcrumbs=[
                {'label': 'Restaurantes', 'url': reverse('dashboard:restaurants')},
                {'label': restaurant.name, 'url': None},
            ],
        ))
        ctx['setup'] = restaurant_setup_status(restaurant)
        ctx['products'] = restaurant.products.all().order_by('name')
        return ctx


class RestaurantToggleActiveView(PanelAccessMixin, View):
    def post(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk)
        setup = restaurant_setup_status(restaurant)
        activating = not restaurant.is_active

        if activating and not setup['complete']:
            messages.error(
                request,
                f'«{restaurant.name}» aún no está listo: el dueño debe completar '
                f'menú, logo, CLABE, horario y ubicación en la app '
                f'({setup["done_count"]}/{setup["total_count"]}).',
            )
            return redirect(reverse('dashboard:restaurant-detail', kwargs={'pk': pk}))

        restaurant.is_active = not restaurant.is_active
        if restaurant.is_active:
            restaurant.accepting_orders = True
        else:
            restaurant.accepting_orders = False
        restaurant.save(update_fields=['is_active', 'accepting_orders', 'updated_at'])
        state = 'activado y visible en la app' if restaurant.is_active else 'desactivado'
        messages.success(request, f'«{restaurant.name}» {state}.')
        return redirect(reverse('dashboard:restaurant-detail', kwargs={'pk': pk}))


class RestaurantToggleOrdersView(PanelAccessMixin, View):
    def post(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk)
        if not restaurant.is_active:
            messages.error(
                request,
                f'«{restaurant.name}» está pendiente de activación. Actívalo primero.',
            )
            return redirect(reverse('dashboard:restaurant-detail', kwargs={'pk': pk}))
        restaurant.accepting_orders = not restaurant.accepting_orders
        restaurant.save(update_fields=['accepting_orders', 'updated_at'])
        state = 'recibiendo pedidos' if restaurant.accepting_orders else 'pausado'
        messages.success(request, f'«{restaurant.name}» ahora está {state}.')
        return redirect(reverse('dashboard:restaurant-detail', kwargs={'pk': pk}))


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
        ctx.update(page_context(
            'Usuarios',
            'users',
            subtitle='Cuentas de clientes, dueños de negocio, repartidores y administradores.',
        ))
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
        ctx.update(page_context(
            'Repartidores',
            'drivers',
            subtitle='Disponibilidad, vehículo y ubicación de quienes entregan pedidos.',
        ))
        ctx['available_filter'] = self.request.GET.get('available', '')
        return ctx

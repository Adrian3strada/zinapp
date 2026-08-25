from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.views import LoginView, LogoutView
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.dateparse import parse_date
from django.views import View
from django.views.generic import DetailView, ListView, TemplateView

from accounts.audit import write_audit_log
from accounts.models import AuditLog, DeliveryProfile, User, UserRole
from orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from restaurants.models import Restaurant
from restaurants.setup import restaurant_setup_status
from accounts.setup import driver_setup_status

from .access import can_access_panel
from .mixins import PanelAccessMixin
from .page_context import page_context
from .services import (
    DRIVER_DETAIL_TABS,
    RESTAURANT_DETAIL_TABS,
    annotate_driver_list,
    annotate_restaurant_list,
    calculate_restaurant_amount,
    get_dashboard_stats,
    get_driver_panel_jobs,
    get_order_timeline,
    get_panel_report,
    get_restaurant_panel_stats,
    platform_orders_qs,
)


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
        ctx.update(page_context(
            'Dashboard',
            'home',
            subtitle='Operación de hoy',
        ))
        ctx.update(get_dashboard_stats(self.request.GET))
        return ctx


class ReportsView(PanelAccessMixin, TemplateView):
    template_name = 'dashboard/reports.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Reportes',
            'reports',
            subtitle='Ventas cobradas, pedidos, cancelados y clientes nuevos. Mismos criterios que el resumen del dashboard.',
        ))
        ctx['report'] = get_panel_report(self.request.GET)
        return ctx


class OrderListView(PanelAccessMixin, ListView):
    model = Order
    template_name = 'dashboard/orders/list.html'
    context_object_name = 'orders'
    paginate_by = 25

    def get_queryset(self):
        qs = platform_orders_qs().select_related(
            'customer', 'restaurant', 'driver',
        )
        get = self.request.GET
        status = get.get('status', '').strip()
        if status and status in OrderStatus.values:
            qs = qs.filter(status=status)
        payment = get.get('payment', '').strip()
        if payment and payment in PaymentStatus.values:
            qs = qs.filter(payment_status=payment)
        method = get.get('method', '').strip()
        if method and method in PaymentMethod.values:
            qs = qs.filter(payment_method=method)
        restaurant_id = get.get('restaurant', '').strip()
        if restaurant_id.isdigit():
            qs = qs.filter(restaurant_id=int(restaurant_id))
        driver = get.get('driver', '').strip()
        if driver == 'none':
            qs = qs.filter(driver__isnull=True)
        elif driver.isdigit():
            qs = qs.filter(driver_id=int(driver), driver__role=UserRole.DRIVER)
        customer_id = get.get('customer', '').strip()
        if customer_id.isdigit():
            qs = qs.filter(customer_id=int(customer_id), customer__role=UserRole.CUSTOMER)
        date_from = parse_date(get.get('date_from') or '')
        date_to = parse_date(get.get('date_to') or '')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        when = get.get('when', '').strip()
        if when == 'scheduled':
            qs = qs.filter(scheduled_for__isnull=False)
        elif when == 'asap':
            qs = qs.filter(scheduled_for__isnull=True)
        search = get.get('q', '').strip()
        if search:
            lookup = (
                Q(code__icontains=search)
                | Q(customer__username__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(restaurant__name__icontains=search)
                | Q(driver__username__icontains=search)
                | Q(delivery_address__icontains=search)
            )
            if search.isdigit():
                lookup |= Q(id=int(search))
            qs = qs.filter(lookup)
        sort = get.get('sort', '').strip()
        if sort == 'oldest':
            qs = qs.order_by('created_at')
        elif sort == 'total':
            qs = qs.order_by('-total', '-created_at')
        else:
            qs = qs.order_by('-created_at')
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        get = self.request.GET
        status = get.get('status', '').strip()
        payment = get.get('payment', '').strip()
        method = get.get('method', '').strip()
        restaurant = get.get('restaurant', '').strip()
        driver = get.get('driver', '').strip()
        customer = get.get('customer', '').strip()
        date_from = get.get('date_from', '').strip()
        date_to = get.get('date_to', '').strip()
        when = get.get('when', '').strip()
        sort = get.get('sort', '').strip()
        search = get.get('q', '').strip()
        has_filters = any([
            status, payment, method, restaurant, driver, customer,
            date_from, date_to, when, search, sort and sort != 'newest',
        ])
        ctx.update(page_context(
            'Pedidos',
            'orders',
            subtitle='Pedidos de la app ZinApp. Las ventas POS quedan en el local.',
        ))
        ctx.update(
            status_filter=status,
            payment_filter=payment,
            method_filter=method,
            restaurant_filter=restaurant,
            driver_filter=driver,
            customer_filter=customer,
            date_from=date_from,
            date_to=date_to,
            when_filter=when,
            sort=sort or 'newest',
            search_query=search,
            has_filters=has_filters,
            status_choices=OrderStatus.choices,
            payment_choices=PaymentStatus.choices,
            method_choices=PaymentMethod.choices,
            restaurants=Restaurant.objects.order_by('name').only('id', 'name'),
            drivers=User.objects.filter(role=UserRole.DRIVER).order_by('username').only(
                'id', 'username', 'first_name', 'last_name',
            ),
        )
        return ctx


class OrderDetailView(PanelAccessMixin, DetailView):
    model = Order
    template_name = 'dashboard/orders/detail.html'
    context_object_name = 'order'

    def get_queryset(self):
        return platform_orders_qs().select_related(
            'customer',
            'restaurant',
            'restaurant__owner',
            'driver',
            'driver__delivery_profile',
            'coupon',
        ).prefetch_related('items', 'items__product', 'disputes')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        order = self.object
        ref = order.display_ref
        ctx.update(page_context(
            f'Pedido {ref}',
            'orders',
            subtitle=f'{order.restaurant.name} · {timezone.localtime(order.created_at).strftime("%d/%m/%Y %H:%M")}',
            breadcrumbs=[
                {'label': 'Pedidos', 'url': reverse('dashboard:orders')},
                {'label': ref, 'url': None},
            ],
        ))
        ctx['timeline_steps'] = get_order_timeline(order)
        order_product_sales = order.subtotal
        order_restaurant_amount = calculate_restaurant_amount(order_product_sales)
        ctx['financial_breakdown'] = {
            'total_ventas_productos': order_product_sales,
            'monto_correspondiente_restaurantes': order_restaurant_amount,
            'ganancia_10_por_ciento': order_product_sales - order_restaurant_amount,
            'ganancias_envios': order.delivery_fee,
        }
        ctx['order_disputes'] = list(order.disputes.all())
        driver_profile = None
        if order.driver_id:
            try:
                driver_profile = order.driver.delivery_profile
            except DeliveryProfile.DoesNotExist:
                driver_profile = None
        ctx['driver_profile'] = driver_profile
        ctx['audit_logs'] = list(
            AuditLog.objects.filter(
                object_type='Order',
                object_id=str(order.pk),
            ).select_related('actor')[:8]
        )
        return ctx


class RestaurantListView(PanelAccessMixin, ListView):
    model = Restaurant
    template_name = 'dashboard/restaurants/list.html'
    context_object_name = 'restaurants'
    paginate_by = 20

    def get_queryset(self):
        qs = annotate_restaurant_list(
            Restaurant.objects.select_related('owner'),
        ).order_by('-created_at')
        get = self.request.GET
        search = get.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(owner__username__icontains=search)
                | Q(owner__first_name__icontains=search)
                | Q(owner__last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(address__icontains=search)
            )
        active = get.get('active', '').strip()
        if active == '1':
            qs = qs.filter(is_active=True)
        elif active == '0':
            qs = qs.filter(is_active=False)
        if get.get('open', '').strip() == '1':
            qs = qs.filter(is_open_now_sort=True)
        if get.get('paused', '').strip() == '1':
            qs = qs.filter(is_active=True, accepting_orders=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        get = self.request.GET
        pending = Restaurant.objects.filter(is_active=False).count()
        ctx.update(page_context(
            'Restaurantes',
            'restaurants',
            subtitle='Activa locales, mira quién está abierto y sigue pedidos de hoy.',
        ))
        ctx['restaurants_total'] = Restaurant.objects.count()
        ctx['restaurants_pending'] = pending
        ctx['search_query'] = get.get('q', '')
        ctx['active_filter'] = get.get('active', '')
        ctx['open_filter'] = get.get('open', '')
        ctx['paused_filter'] = get.get('paused', '')
        ctx['has_filters'] = bool(
            ctx['search_query'].strip()
            or ctx['active_filter']
            or ctx['open_filter']
            or ctx['paused_filter']
        )
        return ctx


class RestaurantDetailView(PanelAccessMixin, DetailView):
    model = Restaurant
    template_name = 'dashboard/restaurants/detail.html'
    context_object_name = 'restaurant'

    def get_queryset(self):
        return Restaurant.objects.select_related('owner').prefetch_related('business_hours')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        restaurant = self.object
        tab = (self.request.GET.get('tab') or 'info').strip()
        if tab not in RESTAURANT_DETAIL_TABS:
            tab = 'info'
        ctx.update(page_context(
            restaurant.name,
            'restaurants',
            breadcrumbs=[
                {'label': 'Restaurantes', 'url': reverse('dashboard:restaurants')},
                {'label': restaurant.name, 'url': None},
            ],
        ))
        ctx['tab'] = tab
        ctx['setup'] = restaurant_setup_status(restaurant)
        ctx['is_open_now'] = restaurant.is_open_now()
        ctx['business_hours'] = restaurant.business_hours.all()
        if tab == 'menu':
            ctx['products'] = restaurant.products.all().order_by('category', 'name')
        elif tab == 'orders':
            ctx['recent_orders'] = (
                platform_orders_qs()
                .filter(restaurant=restaurant)
                .select_related('customer', 'driver')
                .order_by('-created_at')[:15]
            )
        elif tab == 'promos':
            from restaurants.models import ProductPromotion
            from restaurants.promotions import promo_is_active

            promos = list(
                ProductPromotion.objects.filter(restaurant=restaurant)
                .select_related('product')
                .order_by('-is_active', '-valid_until')
            )
            for promo in promos:
                promo.currently_active = promo_is_active(promo)
            ctx['promotions'] = promos
        elif tab == 'stats':
            ctx['stats'] = get_restaurant_panel_stats(restaurant)
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
                f'menú, logo, horario y ubicación en la app '
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


class RestaurantTogglePosView(PanelAccessMixin, View):
    def post(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk)
        restaurant.pos_enabled = not restaurant.pos_enabled
        restaurant.save(update_fields=['pos_enabled', 'updated_at'])
        if restaurant.pos_enabled:
            messages.success(
                request,
                f'POS activado para «{restaurant.name}». El dueño puede entrar en /pos/login/.',
            )
        else:
            messages.success(request, f'POS desactivado para «{restaurant.name}».')
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
        else:
            qs = qs.exclude(role=UserRole.CUSTOMER)
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
            'Cuentas',
            'users',
            subtitle='Administradores, dueños y personal. Los clientes se gestionan en Clientes.',
        ))
        role = self.request.GET.get('role', '').strip()
        search = self.request.GET.get('q', '').strip()
        ctx['role_filter'] = role
        ctx['role_choices'] = UserRole.choices
        ctx['search_query'] = search
        ctx['has_filters'] = bool(role or search)
        return ctx


class DriverListView(PanelAccessMixin, ListView):
    model = DeliveryProfile
    template_name = 'dashboard/drivers/list.html'
    context_object_name = 'drivers'
    paginate_by = 20

    def get_queryset(self):
        qs = annotate_driver_list(
            DeliveryProfile.objects.select_related('user'),
        ).order_by('-updated_at')
        get = self.request.GET
        status = get.get('status', '').strip()
        if status == 'available':
            qs = qs.filter(is_available=True, is_busy=False)
        elif status == 'busy':
            qs = qs.filter(is_busy=True)
        elif status == 'offline':
            qs = qs.filter(is_available=False, is_busy=False)
        elif get.get('available') == '1':
            qs = qs.filter(is_available=True)
        elif get.get('available') == '0':
            qs = qs.filter(is_available=False)
        verification = get.get('verification', '').strip()
        if verification in DeliveryProfile.VerificationStatus.values:
            qs = qs.filter(verification_status=verification)
        search = get.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__phone__icontains=search)
                | Q(license_plate__icontains=search)
            )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        get = self.request.GET
        ctx.update(page_context(
            'Repartidores',
            'drivers',
            subtitle='Quién está disponible, quién va en camino y las entregas de hoy.',
        ))
        ctx['status_filter'] = get.get('status', '')
        ctx['available_filter'] = get.get('available', '')
        ctx['verification_filter'] = get.get('verification', '')
        ctx['drivers_pending'] = DeliveryProfile.objects.filter(
            verification_status=DeliveryProfile.VerificationStatus.PENDING,
        ).count()
        ctx['search_query'] = get.get('q', '')
        ctx['has_filters'] = bool(
            ctx['search_query'].strip()
            or ctx['status_filter']
            or ctx['available_filter']
            or ctx['verification_filter']
        )
        return ctx


class DriverDetailView(PanelAccessMixin, DetailView):
    model = DeliveryProfile
    template_name = 'dashboard/drivers/detail.html'
    context_object_name = 'profile'

    def get_queryset(self):
        return DeliveryProfile.objects.select_related('user', 'reviewed_by')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        profile = self.object
        display_name = profile.user.get_full_name() or profile.user.username
        tab = (self.request.GET.get('tab') or '').strip()
        if tab not in DRIVER_DETAIL_TABS:
            if profile.verification_status == DeliveryProfile.VerificationStatus.PENDING:
                tab = 'verify'
            else:
                tab = 'info'
        ctx.update(page_context(
            display_name,
            'drivers',
            breadcrumbs=[
                {'label': 'Repartidores', 'url': reverse('dashboard:drivers')},
                {'label': display_name, 'url': None},
            ],
        ))
        jobs = get_driver_panel_jobs(profile)
        ctx['tab'] = tab
        ctx['setup'] = driver_setup_status(profile)
        ctx['is_busy'] = jobs['is_busy']
        ctx['jobs'] = jobs
        if tab == 'jobs':
            ctx.update(jobs)
        return ctx


class DriverReviewView(PanelAccessMixin, View):
    def post(self, request, pk):
        profile = get_object_or_404(DeliveryProfile, pk=pk)
        setup = driver_setup_status(profile)
        decision = request.POST.get('decision')
        notes = (request.POST.get('review_notes') or '').strip()
        if decision == 'approved' and not setup['complete']:
            messages.error(
                request,
                f'«{profile.user.username}» debe completar el checklist '
                f'({setup["done_count"]}/{setup["total_count"]}) antes de aprobarlo.',
            )
        elif decision in (
            DeliveryProfile.VerificationStatus.APPROVED,
            DeliveryProfile.VerificationStatus.REJECTED,
        ):
            profile.verification_status = decision
            profile.review_notes = notes
            profile.reviewed_by = request.user
            profile.reviewed_at = timezone.now()
            if decision == DeliveryProfile.VerificationStatus.REJECTED:
                profile.is_available = False
            profile.save(update_fields=[
                'verification_status', 'review_notes', 'reviewed_by',
                'reviewed_at', 'is_available', 'updated_at',
            ])
            write_audit_log(
                action=AuditLog.Action.DRIVER_VERIFICATION_UPDATED,
                obj=profile,
                request=request,
                metadata={'verification_status': decision},
            )
            messages.success(
                request,
                f'«{profile.user.username}» fue '
                f'{"aprobado" if decision == "approved" else "rechazado"}.',
            )
        else:
            messages.error(request, 'Selecciona una decisión válida.')
        return redirect(reverse('dashboard:driver-detail', kwargs={'pk': pk}))

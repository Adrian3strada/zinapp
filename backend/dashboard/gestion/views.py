from django.contrib import messages
from django.contrib.auth import authenticate
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, TemplateView, UpdateView

from accounts.models import DeliveryProfile, User, UserRole
from local_services.models import LocalService
from orders.models import Coupon, Order, OrderStatus, Review, Shipment, ShipmentStatus
from orders.models import DisputeStatus, OrderDispute
from restaurants.models import Product, Restaurant

from ..mixins import PanelAccessMixin
from .forms import (
    CouponForm,
    DisputeResolveForm,
    DriverProfileForm,
    LocalServiceForm,
    OrderAdminForm,
    ProductForm,
    RestaurantForm,
    ShipmentStatusForm,
    UserCreateForm,
    UserEditForm,
)


def _verify_app_login(user, password: str) -> bool:
    if not password or not user:
        return False
    user.refresh_from_db()
    if not user.is_active or not user.check_password(password):
        return False
    return authenticate(username=user.username, password=password) is not None


class GestionHubView(PanelAccessMixin, TemplateView):
    template_name = 'dashboard/gestion/hub.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['page_title'] = 'Gestión de datos'
        ctx['nav'] = 'gestion'
        ctx['stats'] = {
            'users': User.objects.count(),
            'restaurants': Restaurant.objects.count(),
            'products': Product.objects.count(),
            'orders': Order.objects.count(),
            'coupons': Coupon.objects.filter(is_active=True).count(),
            'shipments': Shipment.objects.exclude(status=ShipmentStatus.DELIVERED).count(),
            'reviews': Review.objects.count(),
            'drivers': DeliveryProfile.objects.filter(is_available=True).count(),
            'local_services': LocalService.objects.filter(is_active=True).count(),
            'disputes_pending': OrderDispute.objects.filter(status=DisputeStatus.PENDING).count(),
        }
        from orders.mercadopago import mercadopago_enabled
        ctx['mercadopago_enabled'] = mercadopago_enabled()
        return ctx


class CouponListView(PanelAccessMixin, ListView):
    model = Coupon
    template_name = 'dashboard/gestion/coupon_list.html'
    context_object_name = 'coupons'
    paginate_by = 20

    def get_queryset(self):
        qs = Coupon.objects.order_by('-created_at')
        if self.request.GET.get('active') == '1':
            qs = qs.filter(is_active=True)
        elif self.request.GET.get('active') == '0':
            qs = qs.filter(is_active=False)
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(description__icontains=q))
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_title='Cupones', nav='gestion', active_filter=self.request.GET.get('active', ''))
        ctx['search_query'] = self.request.GET.get('q', '')
        return ctx


class CouponCreateView(PanelAccessMixin, CreateView):
    model = Coupon
    form_class = CouponForm
    template_name = 'dashboard/gestion/coupon_form.html'
    success_url = reverse_lazy('gestion:coupons')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Nuevo cupón', nav='gestion', form_title='Crear cupón',
            back_url=reverse('gestion:coupons'), back_label='Cupones',
            cancel_url=reverse('gestion:coupons'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Cupón «{form.instance.code}» creado.')
        return super().form_valid(form)


class CouponUpdateView(PanelAccessMixin, UpdateView):
    model = Coupon
    form_class = CouponForm
    template_name = 'dashboard/gestion/coupon_form.html'
    success_url = reverse_lazy('gestion:coupons')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=f'Editar {self.object.code}', nav='gestion', form_title='Editar cupón',
            back_url=reverse('gestion:coupons'), back_label='Cupones',
            cancel_url=reverse('gestion:coupons'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Cupón actualizado.')
        return super().form_valid(form)


class CouponDeleteView(PanelAccessMixin, DeleteView):
    model = Coupon
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:coupons')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Eliminar cupón',
            nav='gestion',
            object_label=self.object.code,
            cancel_url=reverse('gestion:coupon-edit', kwargs={'pk': self.object.pk}),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Cupón «{self.object.code}» eliminado.')
        return super().form_valid(form)


class ProductListView(PanelAccessMixin, ListView):
    model = Product
    template_name = 'dashboard/gestion/product_list.html'
    context_object_name = 'products'
    paginate_by = 25

    def get_queryset(self):
        qs = Product.objects.select_related('restaurant').order_by('restaurant__name', 'name')
        restaurant_id = self.request.GET.get('restaurant', '').strip()
        if restaurant_id.isdigit():
            qs = qs.filter(restaurant_id=int(restaurant_id))
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(restaurant__name__icontains=q))
        if self.request.GET.get('available') == '1':
            qs = qs.filter(is_available=True)
        elif self.request.GET.get('available') == '0':
            qs = qs.filter(is_available=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Productos',
            nav='gestion',
            restaurants=Restaurant.objects.order_by('name'),
            restaurant_filter=self.request.GET.get('restaurant', ''),
            available_filter=self.request.GET.get('available', ''),
            search_query=self.request.GET.get('q', ''),
        )
        return ctx


class ProductCreateView(PanelAccessMixin, CreateView):
    model = Product
    form_class = ProductForm
    template_name = 'dashboard/gestion/product_form.html'
    success_url = reverse_lazy('gestion:products')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Nuevo producto', nav='gestion', form_title='Crear producto',
            back_url=reverse('gestion:products'), back_label='Productos',
            cancel_url=reverse('gestion:products'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Producto «{form.instance.name}» creado.')
        return super().form_valid(form)


class ProductUpdateView(PanelAccessMixin, UpdateView):
    model = Product
    form_class = ProductForm
    template_name = 'dashboard/gestion/product_form.html'
    success_url = reverse_lazy('gestion:products')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=self.object.name, nav='gestion', form_title='Editar producto',
            back_url=reverse('gestion:products'), back_label='Productos',
            cancel_url=reverse('gestion:products'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Producto actualizado.')
        return super().form_valid(form)


class ProductDeleteView(PanelAccessMixin, DeleteView):
    model = Product
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:products')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Eliminar producto',
            nav='gestion',
            object_label=self.object.name,
            cancel_url=reverse('gestion:product-edit', kwargs={'pk': self.object.pk}),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Producto «{self.object.name}» eliminado.')
        return super().form_valid(form)


class ShipmentListView(PanelAccessMixin, ListView):
    model = Shipment
    template_name = 'dashboard/gestion/shipment_list.html'
    context_object_name = 'shipments'
    paginate_by = 20

    def get_queryset(self):
        qs = Shipment.objects.select_related('customer', 'driver').order_by('-created_at')
        status = self.request.GET.get('status', '').strip()
        if status and status in ShipmentStatus.values:
            qs = qs.filter(status=status)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Envíos',
            nav='gestion',
            status_filter=self.request.GET.get('status', ''),
            status_choices=ShipmentStatus.choices,
        )
        return ctx


class ShipmentDetailView(PanelAccessMixin, UpdateView):
    model = Shipment
    form_class = ShipmentStatusForm
    template_name = 'dashboard/gestion/shipment_detail.html'
    context_object_name = 'shipment'

    def get_queryset(self):
        return Shipment.objects.select_related('customer', 'driver')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_title=f'Envío #{self.object.pk}', nav='gestion')
        return ctx

    def get_success_url(self):
        return reverse('gestion:shipment-detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        messages.success(self.request, 'Envío actualizado.')
        return super().form_valid(form)


class DisputeListView(PanelAccessMixin, ListView):
    model = OrderDispute
    template_name = 'dashboard/gestion/dispute_list.html'
    context_object_name = 'disputes'
    paginate_by = 20

    def get_queryset(self):
        qs = OrderDispute.objects.select_related(
            'order', 'order__customer', 'order__restaurant', 'customer',
        ).order_by('-created_at')
        status = self.request.GET.get('status', '').strip()
        if status and status in DisputeStatus.values:
            qs = qs.filter(status=status)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Disputas',
            nav='gestion',
            status_filter=self.request.GET.get('status', ''),
            status_choices=DisputeStatus.choices,
            pending_count=OrderDispute.objects.filter(status=DisputeStatus.PENDING).count(),
        )
        return ctx


class DisputeDetailView(PanelAccessMixin, UpdateView):
    model = OrderDispute
    form_class = DisputeResolveForm
    template_name = 'dashboard/gestion/dispute_detail.html'
    context_object_name = 'dispute'

    def get_queryset(self):
        return OrderDispute.objects.select_related(
            'order', 'order__customer', 'order__restaurant', 'customer',
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_title=f'Disputa #{self.object.pk}', nav='gestion')
        return ctx

    def get_success_url(self):
        return reverse('gestion:dispute-detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        dispute = self.get_object()
        was_pending = dispute.status == DisputeStatus.PENDING
        response = super().form_valid(form)
        dispute.refresh_from_db()
        if was_pending and dispute.status != DisputeStatus.PENDING and not dispute.resolved_at:
            from django.utils import timezone
            from orders.models import PaymentStatus

            dispute.resolved_at = timezone.now()
            dispute.save(update_fields=['resolved_at', 'updated_at'])
            if dispute.status == DisputeStatus.REFUNDED:
                order = dispute.order
                order.payment_status = PaymentStatus.PAID
                order.save(update_fields=['payment_status', 'updated_at'])
        messages.success(self.request, 'Disputa actualizada.')
        return response


class ReviewListView(PanelAccessMixin, ListView):
    model = Review
    template_name = 'dashboard/gestion/review_list.html'
    context_object_name = 'reviews'
    paginate_by = 25

    def get_queryset(self):
        return Review.objects.select_related(
            'customer', 'restaurant', 'driver', 'order',
        ).order_by('-created_at')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_title='Reseñas', nav='gestion')
        agg = Review.objects.aggregate(
            avg_restaurant=Avg('restaurant_rating'),
            avg_driver=Avg('driver_rating'),
        )
        ctx['avg_restaurant'] = agg['avg_restaurant']
        ctx['avg_driver'] = agg['avg_driver']
        return ctx


class UserCreateView(PanelAccessMixin, CreateView):
    model = User
    form_class = UserCreateForm
    template_name = 'dashboard/gestion/user_form.html'
    success_url = reverse_lazy('dashboard:users')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Nuevo usuario', nav='gestion', form_title='Crear usuario',
            back_url=reverse('dashboard:users'), back_label='Usuarios',
            cancel_url=reverse('dashboard:users'),
        )
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        password = form.cleaned_data.get('password1')
        if password and self.object and not self.object.check_password(password):
            self.object.set_password(password)
            self.object.save(update_fields=['password'])
        if password and not _verify_app_login(self.object, password):
            messages.error(
                self.request,
                f'Usuario «{self.object.username}» creado, pero la verificación de acceso falló. '
                'Edita el usuario y vuelve a guardar la contraseña.',
            )
        else:
            messages.success(
                self.request,
                f'Usuario «{self.object.username}» creado. En la app entra con ese usuario '
                'y la contraseña que definiste (sin correo).',
            )
        return response


class UserEditView(PanelAccessMixin, UpdateView):
    model = User
    form_class = UserEditForm
    template_name = 'dashboard/gestion/user_form.html'
    success_url = reverse_lazy('dashboard:users')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=self.object.username, nav='gestion', form_title='Editar usuario',
            back_url=reverse('dashboard:users'), back_label='Usuarios',
            cancel_url=reverse('dashboard:users'),
        )
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        password = form.cleaned_data.get('new_password1')
        if password and self.object and not self.object.check_password(password):
            self.object.set_password(password)
            self.object.save(update_fields=['password'])
        if password:
            if _verify_app_login(self.object, password):
                messages.success(
                    self.request,
                    'Usuario actualizado. Ya puede entrar en la app con la nueva contraseña.',
                )
            else:
                messages.error(
                    self.request,
                    'Usuario guardado, pero la verificación de acceso falló. '
                    'Usa una contraseña de al menos 8 caracteres (no solo números).',
                )
        else:
            messages.success(self.request, 'Usuario actualizado.')
        return response


class DriverEditView(PanelAccessMixin, UpdateView):
    model = DeliveryProfile
    form_class = DriverProfileForm
    template_name = 'dashboard/gestion/driver_form.html'

    def get_success_url(self):
        return reverse('dashboard:drivers')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=self.object.user.username,
            nav='gestion',
            form_title='Editar repartidor',
            back_url=reverse('dashboard:drivers'),
            back_label='Repartidores',
            cancel_url=reverse('dashboard:drivers'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Perfil de repartidor actualizado.')
        return super().form_valid(form)


class OrderEditView(PanelAccessMixin, UpdateView):
    model = Order
    form_class = OrderAdminForm
    template_name = 'dashboard/gestion/order_form.html'

    def get_queryset(self):
        return Order.objects.select_related('customer', 'restaurant', 'driver')

    def get_success_url(self):
        return reverse('dashboard:order-detail', kwargs={'pk': self.object.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        order = self.object
        ctx.update(
            page_title=f'Pedido #{order.pk}',
            nav='gestion',
            form_title=f'Editar pedido #{order.pk}',
            back_url=reverse('dashboard:order-detail', kwargs={'pk': order.pk}),
            back_label='Detalle del pedido',
            cancel_url=reverse('dashboard:order-detail', kwargs={'pk': order.pk}),
            order=order,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Pedido actualizado.')
        return super().form_valid(form)


class RestaurantListView(PanelAccessMixin, ListView):
    model = Restaurant
    template_name = 'dashboard/gestion/restaurant_list.html'
    context_object_name = 'restaurants'
    paginate_by = 20

    def get_queryset(self):
        qs = Restaurant.objects.select_related('owner').order_by('-created_at')
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(owner__username__icontains=q))
        if self.request.GET.get('active') == '1':
            qs = qs.filter(is_active=True)
        elif self.request.GET.get('active') == '0':
            qs = qs.filter(is_active=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Restaurantes (gestión)',
            nav='gestion',
            search_query=self.request.GET.get('q', ''),
            active_filter=self.request.GET.get('active', ''),
        )
        return ctx


class RestaurantCreateView(PanelAccessMixin, CreateView):
    model = Restaurant
    form_class = RestaurantForm
    template_name = 'dashboard/gestion/restaurant_form.html'
    success_url = reverse_lazy('gestion:restaurants')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Nuevo restaurante',
            nav='gestion',
            form_title='Crear restaurante',
            back_url=reverse('gestion:restaurants'),
            back_label='Restaurantes',
            cancel_url=reverse('gestion:restaurants'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Restaurante «{form.instance.name}» creado (pendiente de activar).')
        return super().form_valid(form)


class RestaurantUpdateView(PanelAccessMixin, UpdateView):
    model = Restaurant
    form_class = RestaurantForm
    template_name = 'dashboard/gestion/restaurant_form.html'
    success_url = reverse_lazy('gestion:restaurants')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=self.object.name,
            nav='gestion',
            form_title='Editar restaurante',
            back_url=reverse('gestion:restaurants'),
            back_label='Restaurantes',
            cancel_url=reverse('gestion:restaurants'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Restaurante actualizado.')
        return super().form_valid(form)


class LocalServiceListView(PanelAccessMixin, ListView):
    model = LocalService
    template_name = 'dashboard/gestion/local_service_list.html'
    context_object_name = 'services'
    paginate_by = 20

    def get_queryset(self):
        qs = LocalService.objects.order_by('sort_order', 'name')
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        if self.request.GET.get('active') == '1':
            qs = qs.filter(is_active=True)
        elif self.request.GET.get('active') == '0':
            qs = qs.filter(is_active=False)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Servicios locales',
            nav='gestion',
            search_query=self.request.GET.get('q', ''),
            active_filter=self.request.GET.get('active', ''),
        )
        return ctx


class LocalServiceCreateView(PanelAccessMixin, CreateView):
    model = LocalService
    form_class = LocalServiceForm
    template_name = 'dashboard/gestion/local_service_form.html'
    success_url = reverse_lazy('gestion:local-services')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Nuevo servicio',
            nav='gestion',
            form_title='Publicar negocio de servicios',
            back_url=reverse('gestion:local-services'),
            back_label='Servicios',
            cancel_url=reverse('gestion:local-services'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Servicio «{form.instance.name}» publicado.')
        return super().form_valid(form)


class LocalServiceUpdateView(PanelAccessMixin, UpdateView):
    model = LocalService
    form_class = LocalServiceForm
    template_name = 'dashboard/gestion/local_service_form.html'
    success_url = reverse_lazy('gestion:local-services')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title=self.object.name,
            nav='gestion',
            form_title='Editar servicio',
            back_url=reverse('gestion:local-services'),
            back_label='Servicios',
            cancel_url=reverse('gestion:local-services'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Servicio actualizado.')
        return super().form_valid(form)


class ReviewDeleteView(PanelAccessMixin, DeleteView):
    model = Review
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:reviews')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(
            page_title='Eliminar reseña',
            nav='gestion',
            object_label=f'Reseña del pedido #{self.object.order_id}',
            cancel_url=reverse('gestion:reviews'),
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Reseña eliminada.')
        return super().form_valid(form)


class UserDeactivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.is_superuser:
            messages.error(request, 'No puedes desactivar un superusuario.')
            return redirect('dashboard:users')
        user.is_active = False
        user.save(update_fields=['is_active'])
        messages.success(request, f'Usuario «{user.username}» desactivado.')
        return redirect('dashboard:users')

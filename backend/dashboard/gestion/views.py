import logging

from django.contrib import messages
from django.contrib.auth import authenticate
from django.db.models.deletion import ProtectedError
from django.db.models import Avg, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.generic import CreateView, DeleteView, ListView, UpdateView

from accounts.audit import write_audit_log
from accounts.models import AuditLog, DeliveryProfile, User, UserRole
from accounts.setup import driver_setup_status
from local_services.models import LocalService
from orders.models import Coupon, Order, OrderStatus, Review, Shipment, ShipmentStatus
from orders.models import DisputeStatus, OrderDispute
from restaurants.models import Product, ProductPromotion, Restaurant

from ..mixins import PanelAccessMixin
from ..page_context import page_context
from .forms import (
    CouponForm,
    DisputeResolveForm,
    DriverProfileForm,
    LocalServiceForm,
    OrderAdminForm,
    ProductForm,
    ProductPromotionForm,
    RestaurantForm,
    ShipmentStatusForm,
    UserCreateForm,
    UserEditForm,
)

logger = logging.getLogger('dashboard')


def _verify_app_login(user, password: str) -> bool:
    if not password or not user:
        return False
    user.refresh_from_db()
    if not user.is_active or not user.check_password(password):
        return False
    return authenticate(username=user.username, password=password) is not None


def _changed_metadata(form, old_values):
    changes = {}
    for field in form.changed_data:
        if field.startswith('new_password'):
            continue
        changes[field] = {
            'old': str(old_values.get(field, '')),
            'new': str(getattr(form.instance, field, '')),
        }
    return changes


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
        ctx.update(page_context(
            'Cupones',
            'coupons',
            subtitle='Códigos de descuento para promociones y campañas.',
        ))
        ctx['active_filter'] = self.request.GET.get('active', '')
        ctx['search_query'] = self.request.GET.get('q', '')
        return ctx


class CouponCreateView(PanelAccessMixin, CreateView):
    model = Coupon
    form_class = CouponForm
    template_name = 'dashboard/gestion/coupon_form.html'
    success_url = reverse_lazy('gestion:coupons')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Nuevo cupón',
            'coupons',
            breadcrumbs=[
                {'label': 'Cupones', 'url': reverse('gestion:coupons')},
                {'label': 'Nuevo', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Crear cupón',
            back_url=reverse('gestion:coupons'),
            back_label='Cupones',
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
        ctx.update(page_context(
            f'Editar {self.object.code}',
            'coupons',
            breadcrumbs=[
                {'label': 'Cupones', 'url': reverse('gestion:coupons')},
                {'label': self.object.code, 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar cupón',
            back_url=reverse('gestion:coupons'),
            back_label='Cupones',
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
        ctx.update(page_context(
            'Eliminar cupón',
            'coupons',
            breadcrumbs=[
                {'label': 'Cupones', 'url': reverse('gestion:coupons')},
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
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
        ctx.update(page_context(
            'Productos',
            'products',
            subtitle='Platillos del menú de cada restaurante.',
        ))
        ctx.update(
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
        ctx.update(page_context(
            'Nuevo producto',
            'products',
            breadcrumbs=[
                {'label': 'Productos', 'url': reverse('gestion:products')},
                {'label': 'Nuevo', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Crear producto',
            back_url=reverse('gestion:products'),
            back_label='Productos',
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
        ctx.update(page_context(
            self.object.name,
            'products',
            breadcrumbs=[
                {'label': 'Productos', 'url': reverse('gestion:products')},
                {'label': self.object.name, 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar producto',
            back_url=reverse('gestion:products'),
            back_label='Productos',
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
        has_history = self.object.order_items.exists()
        ctx.update(page_context(
            'Eliminar producto',
            'products',
            breadcrumbs=[
                {'label': 'Productos', 'url': reverse('gestion:products')},
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
            object_label=self.object.name,
            cancel_url=reverse('gestion:product-edit', kwargs={'pk': self.object.pk}),
            has_history=has_history,
            deactivate_instead=has_history,
            confirm_message=(
                f'El producto «{self.object.name}» tiene historial de pedidos. '
                'Se desactivará para ocultarlo del menú sin perder el historial.'
                if has_history else None
            ),
            confirm_button_label='Sí, desactivar' if has_history else 'Sí, eliminar',
        )
        return ctx

    def form_valid(self, form):
        product = self.object
        if product.order_items.exists():
            product.is_available = False
            product.save(update_fields=['is_available', 'updated_at'])
            write_audit_log(
                action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                obj=product,
                request=self.request,
                metadata={'reason': 'product_has_order_history'},
            )
            messages.warning(
                self.request,
                f'Producto «{product.name}» desactivado porque tiene historial de pedidos.',
            )
            return redirect('gestion:products')
        try:
            name = product.name
            response = super().form_valid(form)
            messages.success(self.request, f'Producto «{name}» eliminado.')
            return response
        except ProtectedError:
            product.is_available = False
            product.save(update_fields=['is_available', 'updated_at'])
            write_audit_log(
                action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                obj=product,
                request=self.request,
                metadata={'reason': 'protected_error'},
            )
            messages.warning(
                self.request,
                f'Producto «{product.name}» desactivado porque está protegido por historial.',
            )
            return redirect('gestion:products')


class ProductPromotionListView(PanelAccessMixin, ListView):
    model = ProductPromotion
    template_name = 'dashboard/gestion/promotion_list.html'
    context_object_name = 'promotions'
    paginate_by = 25

    def get_queryset(self):
        qs = ProductPromotion.objects.select_related(
            'restaurant', 'product',
        ).order_by('-is_active', '-valid_until', '-id')
        restaurant_id = self.request.GET.get('restaurant', '').strip()
        if restaurant_id.isdigit():
            qs = qs.filter(restaurant_id=int(restaurant_id))
        active = self.request.GET.get('active', '')
        if active == '1':
            qs = qs.filter(is_active=True)
        elif active == '0':
            qs = qs.filter(is_active=False)
        q = self.request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(product__name__icontains=q)
                | Q(restaurant__name__icontains=q)
                | Q(label__icontains=q)
            )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Promociones',
            'promotions',
            subtitle='Promos activas y programadas para productos del catálogo.',
        ))
        ctx.update(
            restaurants=Restaurant.objects.order_by('name'),
            restaurant_filter=self.request.GET.get('restaurant', ''),
            active_filter=self.request.GET.get('active', ''),
            search_query=self.request.GET.get('q', ''),
        )
        return ctx


class ProductPromotionCreateView(PanelAccessMixin, CreateView):
    model = ProductPromotion
    form_class = ProductPromotionForm
    template_name = 'dashboard/gestion/promotion_form.html'
    success_url = reverse_lazy('gestion:promotions')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Nueva promoción',
            'promotions',
            breadcrumbs=[
                {'label': 'Promociones', 'url': reverse('gestion:promotions')},
                {'label': 'Nueva', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Crear promoción',
            back_url=reverse('gestion:promotions'),
            back_label='Promociones',
            cancel_url=reverse('gestion:promotions'),
        )
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        write_audit_log(
            action=AuditLog.Action.PANEL_ENTITY_UPDATED,
            obj=self.object,
            request=self.request,
            metadata={'entity': 'ProductPromotion', 'operation': 'create'},
        )
        messages.success(self.request, 'Promoción creada.')
        return response


class ProductPromotionUpdateView(PanelAccessMixin, UpdateView):
    model = ProductPromotion
    form_class = ProductPromotionForm
    template_name = 'dashboard/gestion/promotion_form.html'
    success_url = reverse_lazy('gestion:promotions')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            f'Editar promoción #{self.object.pk}',
            'promotions',
            breadcrumbs=[
                {'label': 'Promociones', 'url': reverse('gestion:promotions')},
                {'label': f'#{self.object.pk}', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar promoción',
            back_url=reverse('gestion:promotions'),
            back_label='Promociones',
            cancel_url=reverse('gestion:promotions'),
        )
        return ctx

    def form_valid(self, form):
        old_values = {
            field: getattr(self.object, field, '')
            for field in ('product', 'promo_type', 'percent_off', 'special_price', 'valid_until', 'is_active')
        }
        response = super().form_valid(form)
        write_audit_log(
            action=AuditLog.Action.PANEL_ENTITY_UPDATED,
            obj=self.object,
            request=self.request,
            metadata={'entity': 'ProductPromotion', 'changes': _changed_metadata(form, old_values)},
        )
        messages.success(self.request, 'Promoción actualizada.')
        return response


class ProductPromotionDeleteView(PanelAccessMixin, DeleteView):
    model = ProductPromotion
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:promotions')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Quitar promoción',
            'promotions',
            breadcrumbs=[
                {'label': 'Promociones', 'url': reverse('gestion:promotions')},
                {'label': 'Quitar', 'url': None},
            ],
        ))
        ctx.update(
            object_label=str(self.object),
            cancel_url=reverse('gestion:promotion-edit', kwargs={'pk': self.object.pk}),
        )
        return ctx

    def form_valid(self, form):
        promotion = self.object
        if promotion.is_active:
            promotion.is_active = False
            promotion.save(update_fields=['is_active', 'updated_at'])
            write_audit_log(
                action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                obj=promotion,
                request=self.request,
                metadata={'entity': 'ProductPromotion'},
            )
            messages.warning(self.request, 'Promoción desactivada.')
            return redirect('gestion:promotions')
        label = str(promotion)
        response = super().form_valid(form)
        messages.success(self.request, f'Promoción «{label}» eliminada.')
        return response


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
        search = self.request.GET.get('q', '').strip()
        if search:
            if search.isdigit():
                qs = qs.filter(Q(id=int(search)) | Q(customer__username__icontains=search))
            else:
                qs = qs.filter(
                    Q(customer__username__icontains=search)
                    | Q(description__icontains=search)
                    | Q(pickup_address__icontains=search)
                    | Q(delivery_address__icontains=search)
                )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Envíos',
            'shipments',
            subtitle='Paquetes y entregas independientes de pedidos de comida.',
        ))
        ctx.update(
            status_filter=self.request.GET.get('status', ''),
            status_choices=ShipmentStatus.choices,
            search_query=self.request.GET.get('q', ''),
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
        ctx.update(page_context(
            f'Envío #{self.object.pk}',
            'shipments',
            breadcrumbs=[
                {'label': 'Envíos', 'url': reverse('gestion:shipments')},
                {'label': f'#{self.object.pk}', 'url': None},
            ],
        ))
        return ctx

    def get_success_url(self):
        return reverse('gestion:shipment-detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        old_status = self.object.status
        old_driver_id = self.object.driver_id
        response = super().form_valid(form)
        write_audit_log(
            action=AuditLog.Action.SHIPMENT_STATUS_UPDATED,
            obj=self.object,
            request=self.request,
            metadata={
                'from_status': old_status,
                'to_status': self.object.status,
                'from_driver_id': old_driver_id,
                'to_driver_id': self.object.driver_id,
                'source': 'panel',
            },
        )
        messages.success(self.request, 'Envío actualizado.')
        return response


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
        search = self.request.GET.get('q', '').strip()
        if search:
            if search.isdigit():
                qs = qs.filter(Q(id=int(search)) | Q(order_id=int(search)))
            else:
                qs = qs.filter(
                    Q(customer__username__icontains=search)
                    | Q(order__restaurant__name__icontains=search)
                )
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Disputas',
            'disputes',
            subtitle='Solicitudes de reembolso de clientes en pedidos entregados o cancelados.',
        ))
        ctx.update(
            status_filter=self.request.GET.get('status', ''),
            status_choices=DisputeStatus.choices,
            pending_count=OrderDispute.objects.filter(status=DisputeStatus.PENDING).count(),
            search_query=self.request.GET.get('q', ''),
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
        ctx.update(page_context(
            f'Disputa #{self.object.pk}',
            'disputes',
            breadcrumbs=[
                {'label': 'Disputas', 'url': reverse('gestion:disputes')},
                {'label': f'#{self.object.pk}', 'url': None},
            ],
        ))
        return ctx

    def get_success_url(self):
        return reverse('gestion:dispute-detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        dispute = self.get_object()
        was_pending = dispute.status == DisputeStatus.PENDING
        old_status = dispute.status
        response = super().form_valid(form)
        dispute.refresh_from_db()
        if was_pending and dispute.status != DisputeStatus.PENDING and not dispute.resolved_at:
            dispute.resolved_at = timezone.now()
            dispute.save(update_fields=['resolved_at', 'updated_at'])
        # Do not mutate order.payment_status on refund: PaymentStatus has no
        # refunded state and marking PAID would hide the dispute outcome.
        write_audit_log(
            action=AuditLog.Action.DISPUTE_UPDATED,
            obj=dispute,
            request=self.request,
            metadata={
                'from_status': old_status,
                'to_status': dispute.status,
                'order_id': dispute.order_id,
                'requested_amount': str(dispute.requested_amount),
                'order_payment_status': dispute.order.payment_status,
            },
        )
        if dispute.status == DisputeStatus.REFUNDED:
            messages.success(
                self.request,
                'Disputa marcada como reembolsada. El estado de pago del pedido no se modificó; '
                'registra el reembolso en Mercado Pago u otro canal si aplica.',
            )
        else:
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
        ctx.update(page_context(
            'Reseñas',
            'reviews',
            subtitle='Calificaciones de clientes sobre restaurantes y repartidores.',
        ))
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

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        role = self.request.GET.get('role', '').strip()
        valid_roles = {value for value, _label in UserRole.choices}
        if role in valid_roles:
            initial['role'] = role
        return initial

    def get_success_url(self):
        if self.object and self.object.role == UserRole.DRIVER:
            return reverse('dashboard:drivers')
        return super().get_success_url()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        creating_driver = (
            self.request.GET.get('role') == UserRole.DRIVER
            or self.request.POST.get('role') == UserRole.DRIVER
        )
        if creating_driver:
            ctx.update(page_context(
                'Nuevo repartidor',
                'drivers',
                breadcrumbs=[
                    {'label': 'Repartidores', 'url': reverse('dashboard:drivers')},
                    {'label': 'Nuevo', 'url': None},
                ],
            ))
            ctx.update(
                form_title='Dar de alta repartidor',
                back_url=reverse('dashboard:drivers'),
                back_label='Repartidores',
                cancel_url=reverse('dashboard:drivers'),
                form_is_multipart=True,
            )
        else:
            ctx.update(page_context(
                'Nuevo usuario',
                'users',
                breadcrumbs=[
                    {'label': 'Usuarios', 'url': reverse('dashboard:users')},
                    {'label': 'Nuevo', 'url': None},
                ],
            ))
            ctx.update(
                form_title='Crear usuario',
                back_url=reverse('dashboard:users'),
                back_label='Usuarios',
                cancel_url=reverse('dashboard:users'),
                form_is_multipart=True,
            )
        return ctx

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
        except OSError as exc:
            logger.exception('User create failed writing media')
            form.add_error(None, f'Error al guardar archivos: {exc}')
            return self.form_invalid(form)

        password = form.cleaned_data.get('password1')
        if password and self.object and not self.object.check_password(password):
            self.object.set_password(password)
            self.object.save(update_fields=['password'])

        if self.object.role == UserRole.DRIVER:
            self._maybe_approve_driver(form)

        if password and not _verify_app_login(self.object, password):
            messages.error(
                self.request,
                f'Usuario «{self.object.username}» creado, pero la verificación de acceso falló. '
                'Edita el usuario y vuelve a guardar la contraseña.',
            )
        elif self.object.role == UserRole.DRIVER:
            profile = getattr(self.object, 'delivery_profile', None)
            status = (
                profile.get_verification_status_display()
                if profile else 'Pendiente'
            )
            messages.success(
                self.request,
                f'Repartidor «{self.object.username}» creado ({status}). '
                'En la app entra con ese usuario y la contraseña que definiste.',
            )
        else:
            messages.success(
                self.request,
                f'Usuario «{self.object.username}» creado. En la app entra con ese usuario '
                'y la contraseña que definiste (sin correo).',
            )
        return response

    def _maybe_approve_driver(self, form):
        if not form.cleaned_data.get('approve_driver'):
            return
        try:
            profile = self.object.delivery_profile
        except DeliveryProfile.DoesNotExist:
            return
        setup = driver_setup_status(profile)
        if not setup['complete']:
            messages.warning(
                self.request,
                'El repartidor quedó pendiente: falta foto, INE, teléfono o placas '
                'para poder aprobarlo.',
            )
            return
        profile.verification_status = DeliveryProfile.VerificationStatus.APPROVED
        profile.reviewed_by = self.request.user
        profile.reviewed_at = timezone.now()
        profile.review_notes = (profile.review_notes or '').strip() or 'Alta desde panel.'
        profile.is_available = True
        profile.save(update_fields=[
            'verification_status', 'reviewed_by', 'reviewed_at',
            'review_notes', 'is_available', 'updated_at',
        ])
        write_audit_log(
            action=AuditLog.Action.DRIVER_VERIFICATION_UPDATED,
            obj=profile,
            request=self.request,
            metadata={
                'entity': 'DeliveryProfile',
                'operation': 'approve_on_create',
                'to_status': profile.verification_status,
            },
        )


class UserEditView(PanelAccessMixin, UpdateView):
    model = User
    form_class = UserEditForm
    template_name = 'dashboard/gestion/user_form.html'
    success_url = reverse_lazy('dashboard:users')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            self.object.username,
            'users',
            breadcrumbs=[
                {'label': 'Usuarios', 'url': reverse('dashboard:users')},
                {'label': self.object.username, 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar usuario',
            back_url=reverse('dashboard:users'),
            back_label='Usuarios',
            cancel_url=reverse('dashboard:users'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
        except OSError as exc:
            logger.exception('User edit failed writing media')
            form.add_error('avatar', 'No se pudo guardar el archivo. Intenta de nuevo.')
            messages.error(self.request, f'Error al guardar archivos: {exc}')
            return self.form_invalid(form)
        password = form.cleaned_data.get('new_password1')
        if password:
            self.object.refresh_from_db()
            if not self.object.is_active:
                messages.error(
                    self.request,
                    'Contraseña guardada, pero el usuario quedó INACTIVO y no podrá entrar a la app. '
                    'Marca «Activo» y guarda de nuevo.',
                )
            elif _verify_app_login(self.object, password):
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


class UserDeleteView(PanelAccessMixin, DeleteView):
    model = User
    template_name = 'dashboard/gestion/user_confirm_delete.html'
    success_url = reverse_lazy('dashboard:users')

    def _deletion_blockers(self, user):
        blockers = []
        checks = (
            ('pedidos como cliente', user.orders),
            ('envíos como cliente', user.shipments),
            ('negocios registrados', user.restaurants),
            ('entregas de pedidos', user.deliveries),
            ('entregas de envíos', user.shipment_deliveries),
        )
        for label, manager in checks:
            if manager.exists():
                blockers.append(label)
        return blockers

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        is_current_user = self.object.pk == self.request.user.pk
        is_protected = self.object.is_superuser or is_current_user
        blockers = self._deletion_blockers(self.object)
        ctx.update(page_context(
            'Eliminar usuario',
            'users',
            breadcrumbs=[
                {'label': 'Usuarios', 'url': reverse('dashboard:users')},
                {'label': self.object.username, 'url': reverse('gestion:user-edit', kwargs={'pk': self.object.pk})},
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
            object_label=self.object.username,
            cancel_url=reverse('gestion:user-edit', kwargs={'pk': self.object.pk}),
            can_delete=not is_protected and not blockers,
            blockers=blockers,
            is_current_user=is_current_user,
            is_protected=is_protected,
        )
        return ctx

    def form_valid(self, form):
        user = self.object
        if user.is_superuser or user.pk == self.request.user.pk:
            messages.error(
                self.request,
                f'No se puede eliminar «{user.username}».',
            )
            return redirect('gestion:user-edit', pk=user.pk)

        blockers = self._deletion_blockers(user)
        if blockers:
            if user.is_active:
                user.is_active = False
                user.save(update_fields=['is_active'])
                write_audit_log(
                    action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                    obj=user,
                    request=self.request,
                    metadata={'reason': 'user_has_history', 'blockers': blockers},
                )
                messages.warning(
                    self.request,
                    f'Usuario «{user.username}» desactivado porque tiene historial '
                    f'({", ".join(blockers)}). Conserva sus datos operativos.',
                )
            else:
                messages.error(
                    self.request,
                    f'No se puede eliminar «{user.username}» porque tiene historial '
                    f'({", ".join(blockers)}). Ya está inactivo.',
                )
            return redirect('gestion:user-edit', pk=user.pk)

        username = user.username
        response = super().form_valid(form)
        messages.success(self.request, f'Usuario «{username}» eliminado.')
        return response


class DriverEditView(PanelAccessMixin, UpdateView):
    model = DeliveryProfile
    form_class = DriverProfileForm
    template_name = 'dashboard/gestion/driver_form.html'

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_success_url(self):
        return reverse('dashboard:drivers')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        profile = self.object
        ctx.update(page_context(
            profile.user.username,
            'drivers',
            breadcrumbs=[
                {'label': 'Repartidores', 'url': reverse('dashboard:drivers')},
                {'label': profile.user.username, 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar repartidor',
            back_url=reverse('dashboard:drivers'),
            back_label='Repartidores',
            cancel_url=reverse('dashboard:drivers'),
            form_is_multipart=True,
            driver_user=profile.user,
            driver_avatar=profile.user.avatar,
            verification_status=profile.get_verification_status_display(),
            verification_status_code=profile.verification_status,
            review_notes=profile.review_notes,
            reviewed_at=profile.reviewed_at,
            reviewed_by=profile.reviewed_by,
            identity_document=profile.identity_document,
            driver_detail_url=reverse('dashboard:driver-detail', kwargs={'pk': profile.pk}),
        )
        return ctx

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
        except OSError as exc:
            logger.exception('Driver profile update failed writing media')
            form.add_error(
                'identity_document',
                'No se pudo guardar el archivo. Intenta de nuevo.',
            )
            messages.error(self.request, f'Error al guardar archivos: {exc}')
            return self.form_invalid(form)
        write_audit_log(
            action=AuditLog.Action.PANEL_ENTITY_UPDATED,
            obj=self.object,
            request=self.request,
            metadata={'entity': 'DeliveryProfile', 'changes': list(form.changed_data)},
        )
        messages.success(self.request, 'Perfil de repartidor actualizado.')
        return response


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
        ctx.update(page_context(
            f'Pedido #{order.pk}',
            'orders',
            breadcrumbs=[
                {'label': 'Pedidos', 'url': reverse('dashboard:orders')},
                {'label': f'#{order.pk}', 'url': reverse('dashboard:order-detail', kwargs={'pk': order.pk})},
                {'label': 'Editar', 'url': None},
            ],
        ))
        ctx.update(
            form_title=f'Editar pedido #{order.pk}',
            back_url=reverse('dashboard:order-detail', kwargs={'pk': order.pk}),
            back_label='Detalle del pedido',
            cancel_url=reverse('dashboard:order-detail', kwargs={'pk': order.pk}),
            order=order,
        )
        return ctx

    def form_valid(self, form):
        old_status = self.object.status
        old_driver_id = self.object.driver_id
        response = super().form_valid(form)
        write_audit_log(
            action=AuditLog.Action.ORDER_STATUS_UPDATED,
            obj=self.object,
            request=self.request,
            metadata={
                'from_status': old_status,
                'to_status': self.object.status,
                'from_driver_id': old_driver_id,
                'to_driver_id': self.object.driver_id,
                'source': 'panel',
            },
        )
        messages.success(self.request, 'Pedido actualizado.')
        return response


class RestaurantCreateView(PanelAccessMixin, CreateView):
    model = Restaurant
    form_class = RestaurantForm
    template_name = 'dashboard/gestion/restaurant_form.html'
    success_url = reverse_lazy('dashboard:restaurants')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Nuevo restaurante',
            'restaurants',
            breadcrumbs=[
                {'label': 'Restaurantes', 'url': reverse('dashboard:restaurants')},
                {'label': 'Nuevo', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Crear restaurante',
            back_url=reverse('dashboard:restaurants'),
            back_label='Restaurantes',
            cancel_url=reverse('dashboard:restaurants'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, f'Restaurante «{form.instance.name}» creado (pendiente de activar).')
        return super().form_valid(form)


class RestaurantUpdateView(PanelAccessMixin, UpdateView):
    model = Restaurant
    form_class = RestaurantForm
    template_name = 'dashboard/gestion/restaurant_form.html'
    success_url = reverse_lazy('dashboard:restaurants')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            self.object.name,
            'restaurants',
            breadcrumbs=[
                {'label': 'Restaurantes', 'url': reverse('dashboard:restaurants')},
                {'label': self.object.name, 'url': reverse('dashboard:restaurant-detail', kwargs={'pk': self.object.pk})},
                {'label': 'Editar', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar restaurante',
            back_url=reverse('dashboard:restaurant-detail', kwargs={'pk': self.object.pk}),
            back_label='Detalle del local',
            cancel_url=reverse('dashboard:restaurant-detail', kwargs={'pk': self.object.pk}),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        messages.success(self.request, 'Restaurante actualizado.')
        return super().form_valid(form)


class RestaurantDeleteView(PanelAccessMixin, DeleteView):
    model = Restaurant
    template_name = 'dashboard/gestion/restaurant_confirm_delete.html'
    success_url = reverse_lazy('dashboard:restaurants')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        orders_count = self.object.orders.count()
        ctx.update(page_context(
            'Eliminar restaurante',
            'restaurants',
            breadcrumbs=[
                {'label': 'Restaurantes', 'url': reverse('dashboard:restaurants')},
                {
                    'label': self.object.name,
                    'url': reverse('dashboard:restaurant-detail', kwargs={'pk': self.object.pk}),
                },
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
            object_label=self.object.name,
            orders_count=orders_count,
            can_delete=orders_count == 0,
            cancel_url=reverse('dashboard:restaurant-detail', kwargs={'pk': self.object.pk}),
        )
        return ctx

    def form_valid(self, form):
        restaurant = self.object
        orders_count = restaurant.orders.count()
        if orders_count:
            messages.error(
                self.request,
                f'No se puede eliminar «{restaurant.name}» porque tiene {orders_count} pedido(s). '
                'Desactiva el local para ocultarlo de la app sin perder el historial.',
            )
            return redirect('dashboard:restaurant-detail', pk=restaurant.pk)

        name = restaurant.name
        response = super().form_valid(form)
        messages.success(self.request, f'Restaurante «{name}» eliminado.')
        return response


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
        ctx.update(page_context(
            'Servicios locales',
            'local-services',
            subtitle='Negocios de servicios visibles en la app (barberías, talleres, etc.).',
        ))
        ctx.update(
            search_query=self.request.GET.get('q', ''),
            active_filter=self.request.GET.get('active', ''),
        )
        return ctx


class LocalServiceCreateView(PanelAccessMixin, CreateView):
    model = LocalService
    form_class = LocalServiceForm
    template_name = 'dashboard/gestion/local_service_form.html'
    success_url = reverse_lazy('gestion:local-services')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Nuevo servicio',
            'local-services',
            breadcrumbs=[
                {'label': 'Servicios locales', 'url': reverse('gestion:local-services')},
                {'label': 'Nuevo', 'url': None},
            ],
        ))
        ctx.update(
            form_title='Publicar negocio de servicios',
            back_url=reverse('gestion:local-services'),
            back_label='Servicios',
            cancel_url=reverse('gestion:local-services'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
        except OSError as exc:
            logger.exception('LocalService create failed writing media')
            form.add_error(
                'logo',
                'No se pudo guardar el logo. Intenta de nuevo o deja el logo vacío.',
            )
            messages.error(self.request, f'Error al guardar archivos: {exc}')
            return self.form_invalid(form)
        except Exception:
            logger.exception('LocalService create failed')
            raise
        messages.success(self.request, f'Servicio «{self.object.name}» publicado.')
        return response


class LocalServiceUpdateView(PanelAccessMixin, UpdateView):
    model = LocalService
    form_class = LocalServiceForm
    template_name = 'dashboard/gestion/local_service_form.html'
    success_url = reverse_lazy('gestion:local-services')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method == 'POST':
            kwargs['files'] = self.request.FILES
        return kwargs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            self.object.name,
            'local-services',
            breadcrumbs=[
                {'label': 'Servicios locales', 'url': reverse('gestion:local-services')},
                {'label': self.object.name, 'url': None},
            ],
        ))
        ctx.update(
            form_title='Editar servicio',
            back_url=reverse('gestion:local-services'),
            back_label='Servicios',
            cancel_url=reverse('gestion:local-services'),
            form_is_multipart=True,
        )
        return ctx

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
        except OSError as exc:
            logger.exception('LocalService update failed writing media')
            form.add_error(
                'logo',
                'No se pudo guardar el logo. Intenta de nuevo o deja el logo vacío.',
            )
            messages.error(self.request, f'Error al guardar archivos: {exc}')
            return self.form_invalid(form)
        messages.success(self.request, 'Servicio actualizado.')
        return response


class LocalServiceActivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        service = get_object_or_404(LocalService, pk=pk)
        service.is_active = True
        service.save(update_fields=['is_active', 'updated_at'])
        write_audit_log(
            action=AuditLog.Action.PANEL_ENTITY_UPDATED,
            obj=service,
            request=request,
            metadata={'entity': 'LocalService', 'operation': 'activate'},
        )
        messages.success(request, f'Servicio «{service.name}» visible en la app.')
        return redirect('gestion:local-services')


class LocalServiceDeactivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        service = get_object_or_404(LocalService, pk=pk)
        service.is_active = False
        service.save(update_fields=['is_active', 'updated_at'])
        write_audit_log(
            action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
            obj=service,
            request=request,
            metadata={'entity': 'LocalService', 'operation': 'deactivate'},
        )
        messages.success(request, f'Servicio «{service.name}» oculto de la app.')
        return redirect('gestion:local-services')


class LocalServiceDeleteView(PanelAccessMixin, DeleteView):
    model = LocalService
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:local-services')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        deactivate_instead = self.object.is_active
        ctx.update(page_context(
            'Eliminar servicio',
            'local-services',
            breadcrumbs=[
                {'label': 'Servicios locales', 'url': reverse('gestion:local-services')},
                {'label': self.object.name, 'url': reverse('gestion:local-service-edit', kwargs={'pk': self.object.pk})},
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
            object_label=self.object.name,
            cancel_url=reverse('gestion:local-service-edit', kwargs={'pk': self.object.pk}),
            deactivate_instead=deactivate_instead,
            confirm_message=(
                f'El servicio «{self.object.name}» está visible. '
                'Se ocultará de la app. Para borrarlo del todo, desactívalo primero y vuelve a confirmar.'
                if deactivate_instead else None
            ),
            confirm_button_label='Sí, ocultar' if deactivate_instead else 'Sí, eliminar',
        )
        return ctx

    def form_valid(self, form):
        service = self.object
        if service.is_active:
            service.is_active = False
            service.save(update_fields=['is_active', 'updated_at'])
            write_audit_log(
                action=AuditLog.Action.PANEL_ENTITY_DEACTIVATED,
                obj=service,
                request=self.request,
                metadata={'entity': 'LocalService', 'operation': 'deactivate_via_delete'},
            )
            messages.warning(
                self.request,
                f'Servicio «{service.name}» oculto. Confirma de nuevo si quieres eliminarlo permanentemente.',
            )
            return redirect('gestion:local-services')
        name = service.name
        response = super().form_valid(form)
        messages.success(self.request, f'Servicio «{name}» eliminado.')
        return response


class ReviewDeleteView(PanelAccessMixin, DeleteView):
    model = Review
    template_name = 'dashboard/gestion/confirm_delete.html'
    success_url = reverse_lazy('gestion:reviews')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Eliminar reseña',
            'reviews',
            breadcrumbs=[
                {'label': 'Reseñas', 'url': reverse('gestion:reviews')},
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx.update(
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


class UserActivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        user.is_active = True
        user.save(update_fields=['is_active'])
        messages.success(
            request,
            f'Usuario «{user.username}» activado. Ya puede entrar en la app.',
        )
        return redirect('dashboard:users')

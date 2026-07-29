"""Vistas del módulo Clientes — solo users con role=customer."""

from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from accounts.models import DeliveryProfile, User, UserRole
from dashboard.mixins import PanelAccessMixin
from dashboard.page_context import page_context
from orders.models import Order
from restaurants.models import Restaurant

from .forms import CustomerCreateForm, CustomerEditForm

SORT_CHOICES = {
    'joined': '-date_joined',
    '-joined': 'date_joined',
    'name': 'first_name',
    '-name': '-first_name',
    'username': 'username',
    '-username': '-username',
    'email': 'email',
    '-email': '-email',
    'orders': 'orders_count',
    '-orders': '-orders_count',
}


def customer_queryset():
    return User.objects.filter(role=UserRole.CUSTOMER)


class CustomerQuerysetMixin:
    """Garantiza que pk manipulados de otros roles den 404."""

    def get_queryset(self):
        return customer_queryset()


class CustomerListView(PanelAccessMixin, ListView):
    template_name = 'dashboard/customers/list.html'
    context_object_name = 'customers'
    paginate_by = 25

    def get_queryset(self):
        qs = customer_queryset().annotate(orders_count=Count('orders'))
        search = self.request.GET.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        active = self.request.GET.get('active', '').strip()
        if active == '1':
            qs = qs.filter(is_active=True)
        elif active == '0':
            qs = qs.filter(is_active=False)

        sort_key = self.request.GET.get('sort', 'joined').strip()
        order = SORT_CHOICES.get(sort_key, '-date_joined')
        return qs.order_by(order, '-id')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Clientes',
            'customers',
            subtitle='Cuentas de clientes de la app. Sin datos de restaurantes ni repartidores.',
        ))
        ctx['search_query'] = self.request.GET.get('q', '')
        ctx['active_filter'] = self.request.GET.get('active', '')
        ctx['sort'] = self.request.GET.get('sort', 'joined')
        ctx['sort_choices'] = [
            ('joined', 'Más recientes'),
            ('-joined', 'Más antiguos'),
            ('name', 'Nombre A–Z'),
            ('-name', 'Nombre Z–A'),
            ('username', 'Usuario A–Z'),
            ('orders', 'Menos pedidos'),
            ('-orders', 'Más pedidos'),
        ]
        return ctx


class CustomerDetailView(PanelAccessMixin, CustomerQuerysetMixin, DetailView):
    template_name = 'dashboard/customers/detail.html'
    context_object_name = 'customer'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        customer = self.object
        display = customer.get_full_name() or customer.username
        ctx.update(page_context(
            display,
            'customers',
            breadcrumbs=[
                {'label': 'Clientes', 'url': reverse('dashboard:customers')},
                {'label': display, 'url': None},
            ],
        ))
        orders = (
            Order.objects.filter(customer=customer)
            .select_related('restaurant', 'driver')
            .order_by('-created_at')
        )
        ctx['orders_count'] = orders.count()
        ctx['recent_orders'] = orders[:10]
        ctx['orders_list_url'] = (
            f"{reverse('dashboard:orders')}?customer={customer.pk}"
        )
        return ctx


class CustomerCreateView(PanelAccessMixin, CreateView):
    form_class = CustomerCreateForm
    template_name = 'dashboard/customers/form_create.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(page_context(
            'Nuevo cliente',
            'customers',
            breadcrumbs=[
                {'label': 'Clientes', 'url': reverse('dashboard:customers')},
                {'label': 'Nuevo', 'url': None},
            ],
        ))
        ctx['cancel_url'] = reverse('dashboard:customers')
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        user = self.object
        messages.success(
            self.request,
            f'Cliente «{user.username}» creado correctamente.',
        )
        return response

    def get_success_url(self):
        return reverse('dashboard:customer-detail', kwargs={'pk': self.object.pk})


class CustomerUpdateView(PanelAccessMixin, CustomerQuerysetMixin, UpdateView):
    form_class = CustomerEditForm
    template_name = 'dashboard/customers/form_edit.html'
    context_object_name = 'customer'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        display = self.object.get_full_name() or self.object.username
        ctx.update(page_context(
            f'Editar · {display}',
            'customers',
            breadcrumbs=[
                {'label': 'Clientes', 'url': reverse('dashboard:customers')},
                {
                    'label': display,
                    'url': reverse('dashboard:customer-detail', kwargs={'pk': self.object.pk}),
                },
                {'label': 'Editar', 'url': None},
            ],
        ))
        ctx['cancel_url'] = reverse(
            'dashboard:customer-detail', kwargs={'pk': self.object.pk},
        )
        return ctx

    def form_valid(self, form):
        # Snapshot: no deben aparecer perfiles de otros roles.
        before_driver = DeliveryProfile.objects.filter(user=self.object).exists()
        before_rest = Restaurant.objects.filter(owner=self.object).exists()
        response = super().form_valid(form)
        self.object.refresh_from_db()
        if self.object.role != UserRole.CUSTOMER:
            self.object.role = UserRole.CUSTOMER
            self.object.save(update_fields=['role'])
        after_driver = DeliveryProfile.objects.filter(user=self.object).exists()
        after_rest = Restaurant.objects.filter(owner=self.object).exists()
        if after_driver != before_driver or after_rest != before_rest:
            messages.error(
                self.request,
                'Se detectó un cambio inesperado en perfiles relacionados. Revisa el cliente.',
            )
        else:
            messages.success(self.request, 'Cliente actualizado.')
        return response

    def get_success_url(self):
        return reverse('dashboard:customer-detail', kwargs={'pk': self.object.pk})


class CustomerActivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        customer = get_object_or_404(customer_queryset(), pk=pk)
        customer.is_active = True
        customer.save(update_fields=['is_active'])
        messages.success(
            request,
            f'Cliente «{customer.username}» activado. Ya puede entrar en la app.',
        )
        next_url = request.POST.get('next') or reverse(
            'dashboard:customer-detail', kwargs={'pk': pk},
        )
        return redirect(next_url)


class CustomerDeactivateView(PanelAccessMixin, View):
    def post(self, request, pk):
        customer = get_object_or_404(customer_queryset(), pk=pk)
        customer.is_active = False
        customer.save(update_fields=['is_active'])
        messages.success(request, f'Cliente «{customer.username}» desactivado.')
        next_url = request.POST.get('next') or reverse(
            'dashboard:customer-detail', kwargs={'pk': pk},
        )
        return redirect(next_url)


class CustomerDeleteView(PanelAccessMixin, CustomerQuerysetMixin, DeleteView):
    template_name = 'dashboard/customers/confirm_delete.html'
    context_object_name = 'customer'
    success_url = reverse_lazy('dashboard:customers')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        display = self.object.get_full_name() or self.object.username
        ctx.update(page_context(
            f'Eliminar · {display}',
            'customers',
            breadcrumbs=[
                {'label': 'Clientes', 'url': reverse('dashboard:customers')},
                {
                    'label': display,
                    'url': reverse('dashboard:customer-detail', kwargs={'pk': self.object.pk}),
                },
                {'label': 'Eliminar', 'url': None},
            ],
        ))
        ctx['orders_count'] = Order.objects.filter(customer=self.object).count()
        ctx['can_delete'] = ctx['orders_count'] == 0
        return ctx

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        orders_count = Order.objects.filter(customer=self.object).count()
        if orders_count > 0:
            messages.error(
                request,
                f'No se puede eliminar «{self.object.username}»: tiene {orders_count} '
                f'pedido(s). Desactiva la cuenta en su lugar.',
            )
            return redirect('dashboard:customer-detail', pk=self.object.pk)
        confirm = (request.POST.get('confirm_username') or '').strip()
        if confirm != self.object.username:
            messages.error(
                request,
                'Escribe el nombre de usuario exacto para confirmar la eliminación.',
            )
            return redirect('dashboard:customer-delete', pk=self.object.pk)
        messages.success(request, f'Cliente «{self.object.username}» eliminado.')
        return super().post(request, *args, **kwargs)

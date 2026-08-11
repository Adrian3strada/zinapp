import json
import uuid
from decimal import Decimal

from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views import View

from orders.models import PaymentMethod

from ..exceptions import PosError
from ..forms import PosCheckoutForm
from ..permissions import PosAccessMixin
from ..selectors.cash import open_sessions_for_restaurant
from ..selectors.orders import order_for_restaurant
from ..selectors.products import category_choices_for_restaurant, products_for_pos
from ..services.sales import create_pos_sale, serialize_cart_preview


class PosSaleView(PosAccessMixin, View):
    template_name = 'pos/sale.html'
    pos_permission = 'sale'

    def get(self, request):
        restaurant = self.pos_restaurant
        search = request.GET.get('q', '')
        category = request.GET.get('category', '')
        products = products_for_pos(restaurant, search=search, category=category)
        # Serializar opciones para JS
        catalog = []
        for p in products:
            groups = []
            for g in p.option_groups.all():
                groups.append({
                    'id': g.id,
                    'name': g.name,
                    'min_select': g.min_select,
                    'max_select': g.max_select,
                    'options': [
                        {
                            'id': o.id,
                            'name': o.name,
                            'price_delta': str(o.price_delta),
                            'is_available': o.is_available,
                        }
                        for o in g.options.all()
                        if o.is_available
                    ],
                })
            catalog.append({
                'id': p.id,
                'name': p.name,
                'price': str(p.price),
                'category': p.category,
                'track_inventory': p.track_inventory,
                'stock_quantity': p.stock_quantity,
                'groups': groups,
            })
        return render(request, self.template_name, {
            'pos_restaurant': restaurant,
            'pos_role': self.pos_access.role,
            'categories': category_choices_for_restaurant(restaurant),
            'products': products,
            'catalog_json': json.dumps(catalog),
            'active_category': category,
            'search': search,
            'cash_open': open_sessions_for_restaurant(restaurant).exists(),
            'idempotency_key': str(uuid.uuid4()),
            'payment_methods': [
                (PaymentMethod.CASH, 'Efectivo'),
                (PaymentMethod.CARD, 'Tarjeta'),
                (PaymentMethod.TRANSFER, 'Transferencia'),
                (PaymentMethod.OTHER, 'Otro'),
            ],
        })

    def post(self, request):
        form = PosCheckoutForm(request.POST)
        if not form.is_valid():
            messages.error(request, 'Datos de cobro inválidos.')
            return redirect('pos:sale')

        try:
            cart = json.loads(form.cleaned_data['cart_json'])
            if not isinstance(cart, list):
                raise ValueError('cart')
        except (json.JSONDecodeError, ValueError, TypeError):
            messages.error(request, 'Carrito inválido.')
            return redirect('pos:sale')

        try:
            order = create_pos_sale(
                restaurant=self.pos_restaurant,
                user=request.user,
                items=cart,
                payment_method=form.cleaned_data['payment_method'],
                amount_received=form.cleaned_data.get('amount_received'),
                discount_amount=form.cleaned_data.get('discount_amount') or Decimal('0.00'),
                idempotency_key=form.cleaned_data['idempotency_key'],
            )
        except PosError as exc:
            messages.error(request, exc.message)
            return redirect('pos:sale')

        messages.success(request, f'Venta {order.display_ref} registrada.')
        from django.urls import reverse
        return redirect(f"{reverse('pos:ticket', kwargs={'order_id': order.id})}?autoprint=1")


class PosCartPreviewView(PosAccessMixin, View):
    """POST JSON → totales calculados en servidor."""

    pos_permission = 'sale'

    def post(self, request):
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'JSON inválido'}, status=400)
        items = payload.get('items') or []
        discount = payload.get('discount_amount') or '0'
        try:
            preview = serialize_cart_preview(
                restaurant=self.pos_restaurant,
                items=items,
                discount_amount=Decimal(str(discount)),
            )
        except PosError as exc:
            return JsonResponse({'detail': exc.message}, status=400)
        return JsonResponse(preview)


class PosTicketView(PosAccessMixin, View):
    template_name = 'pos/ticket.html'
    pos_permission = 'ticket'

    def get(self, request, order_id):
        order = order_for_restaurant(restaurant=self.pos_restaurant, order_id=order_id)
        if not order:
            messages.error(request, 'Venta no encontrada.')
            return redirect('pos:dashboard')
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'order': order,
            'pos_sale': getattr(order, 'pos_sale', None),
            'autoprint': request.GET.get('autoprint') == '1',
        })


class PosKitchenTicketView(PosAccessMixin, View):
    """Ticket de cocina (sin precios, foco en preparación)."""

    template_name = 'pos/ticket_kitchen.html'
    pos_permission = 'ticket'

    def get(self, request, order_id):
        order = order_for_restaurant(restaurant=self.pos_restaurant, order_id=order_id)
        if not order:
            messages.error(request, 'Pedido no encontrado.')
            return redirect('pos:dashboard')
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'order': order,
            'autoprint': request.GET.get('autoprint') == '1',
        })

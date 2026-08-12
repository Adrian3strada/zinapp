from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views import View

from orders.models import OrderSource, OrderStatus

from ..exceptions import PosError
from ..permissions import PosAccessMixin
from ..selectors.orders import (
    kitchen_orders_qs,
    order_for_restaurant,
    orders_for_pos,
    serialize_order_card,
)
from ..services import orders as order_services
from ..services.cancellations import cancel_pos_sale


STATUS_FILTERS = [
    ('activos', 'Activos'),
    ('nuevos', 'Nuevos'),
    ('preparando', 'Preparando'),
    ('listos', 'Listos'),
    ('completados', 'Completados'),
    ('cancelados', 'Cancelados'),
]


class PosOrdersView(PosAccessMixin, View):
    template_name = 'pos/orders.html'
    pos_permission = 'orders'

    def get(self, request):
        status_filter = request.GET.get('status', 'activos')
        source = request.GET.get('source', '')
        orders = list(
            orders_for_pos(
                self.pos_restaurant,
                status_filter=status_filter,
                source=source,
            )[:100]
        )
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'pos_role': self.pos_access.role,
            'orders': orders,
            'status_filter': status_filter,
            'source_filter': source,
            'status_filters': STATUS_FILTERS,
            'realtime_restaurant_id': self.pos_restaurant.id,
        })


class PosOrdersFeedView(PosAccessMixin, View):
    """JSON para refresh/polling y actualización WS."""

    pos_permission = 'orders'

    def get(self, request):
        status_filter = request.GET.get('status', 'activos')
        source = request.GET.get('source', '')
        orders = orders_for_pos(
            self.pos_restaurant,
            status_filter=status_filter,
            source=source,
        )[:100]
        return JsonResponse({
            'orders': [serialize_order_card(o) for o in orders],
        })


class PosKitchenView(PosAccessMixin, View):
    template_name = 'pos/kitchen.html'
    pos_permission = 'kitchen'

    def get(self, request):
        orders = list(kitchen_orders_qs(self.pos_restaurant)[:80])
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'pos_role': self.pos_access.role,
            'orders': orders,
            'realtime_restaurant_id': self.pos_restaurant.id,
        })


class PosKitchenFeedView(PosAccessMixin, View):
    pos_permission = 'kitchen'

    def get(self, request):
        orders = kitchen_orders_qs(self.pos_restaurant)[:80]
        return JsonResponse({
            'orders': [serialize_order_card(o) for o in orders],
        })


class PosOrderActionView(PosAccessMixin, View):
    """POST acciones: accept / reject / status / cancel_pos."""

    pos_permission = 'orders'

    def post(self, request, order_id):
        # `pos_action` (no usar name="action": en el DOM pisa form.action).
        action = (
            request.POST.get('pos_action')
            or request.POST.get('action')
            or ''
        ).strip()
        next_url = request.POST.get('next') or request.META.get('HTTP_REFERER') or ''
        wants_json = (
            request.headers.get('Accept', '').find('application/json') >= 0
            or request.GET.get('format') == 'json'
        )

        try:
            if action == 'accept':
                order = order_services.accept_order(
                    restaurant=self.pos_restaurant,
                    order_id=order_id,
                    prep_minutes=request.POST.get('prep_minutes', 15),
                )
                msg = f'Pedido {order.display_ref} aceptado.'
            elif action == 'reject':
                order = order_services.reject_order(
                    restaurant=self.pos_restaurant,
                    order_id=order_id,
                )
                msg = f'Pedido {order.display_ref} rechazado.'
            elif action == 'cancel_pos':
                order = cancel_pos_sale(
                    restaurant=self.pos_restaurant,
                    order_id=order_id,
                    user=request.user,
                    reason=request.POST.get('reason') or '',
                )
                msg = f'Venta {order.display_ref} cancelada.'
            elif action == 'status':
                new_status = (request.POST.get('status') or '').strip()
                if new_status not in {
                    OrderStatus.PREPARING,
                    OrderStatus.READY,
                    OrderStatus.DELIVERED,
                    OrderStatus.CANCELLED,
                }:
                    raise PosError('Estado no válido.')
                order = order_services.set_order_status(
                    restaurant=self.pos_restaurant,
                    order_id=order_id,
                    new_status=new_status,
                )
                msg = f'Pedido {order.display_ref} → {order.get_status_display()}.'
            else:
                raise PosError('Acción no válida.')
        except PosError as exc:
            if wants_json:
                return JsonResponse({'detail': exc.message}, status=400)
            messages.error(request, exc.message)
            return redirect(next_url or 'pos:orders')

        if wants_json:
            return JsonResponse({
                'ok': True,
                'message': msg,
                'order': serialize_order_card(order),
            })
        messages.success(request, msg)
        return redirect(next_url or 'pos:orders')


class PosKitchenActionView(PosOrderActionView):
    """Misma lógica de acciones, permiso cocina."""

    pos_permission = 'kitchen'


class PosSaleCancelView(PosAccessMixin, View):
    """Cancelación de venta POS desde ticket u órdenes."""

    pos_permission = 'sale'
    template_name = 'pos/sale_cancel.html'

    def get(self, request, order_id):
        order = order_for_restaurant(restaurant=self.pos_restaurant, order_id=order_id)
        if not order or order.source != OrderSource.POS:
            messages.error(request, 'Venta POS no encontrada.')
            return redirect('pos:orders')
        if order.status == OrderStatus.CANCELLED:
            messages.error(request, 'La venta ya está cancelada.')
            return redirect('pos:ticket', order_id=order.id)
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'order': order,
        })

    def post(self, request, order_id):
        try:
            order = cancel_pos_sale(
                restaurant=self.pos_restaurant,
                order_id=order_id,
                user=request.user,
                reason=request.POST.get('reason') or '',
            )
        except PosError as exc:
            messages.error(request, exc.message)
            return redirect('pos:sale_cancel', order_id=order_id)
        messages.success(request, f'Venta {order.display_ref} cancelada.')
        return redirect('pos:orders')

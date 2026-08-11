import time

from django.http import JsonResponse
from django.views import View

from realtime.tickets import TicketStoreUnavailable, create_ws_ticket, ticket_ttl_seconds

from ..permissions import PosAccessMixin


class PosWebsocketTicketView(PosAccessMixin, View):
    """
    Ticket WS de un solo uso para el POS (auth por sesión Django).
    Reutiliza el mismo store Redis/locmem que /api/realtime/ws-ticket/.
    """

    pos_permission = 'dashboard'

    def post(self, request):
        # Sesión POS: validez razonable (8h) o lifetime de session cookie.
        auth_expires_at = time.time() + 8 * 3600
        try:
            age = request.session.get_expiry_age()
            if age and age > 0:
                auth_expires_at = time.time() + float(age)
        except Exception:
            pass

        try:
            issued = create_ws_ticket(
                user_id=request.user.id,
                auth_expires_at=auth_expires_at,
            )
        except TicketStoreUnavailable:
            return JsonResponse(
                {'detail': 'Servicio de tickets no disponible. Usando fallback.'},
                status=503,
            )
        except ValueError:
            return JsonResponse({'detail': 'Sesión expirada.'}, status=401)

        return JsonResponse(
            {
                'ticket': issued['ticket'],
                'expires_in': issued['expires_in'],
                'auth_expires_at': issued['auth_expires_at'],
                'ws_path': '/ws/v1/',
                'restaurant_id': self.pos_restaurant.id,
                'fallback_poll_seconds': 45,
            },
            status=201,
        )

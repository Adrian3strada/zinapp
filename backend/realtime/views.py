import logging
import time

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from realtime.tickets import TicketStoreUnavailable, create_ws_ticket, ticket_ttl_seconds

logger = logging.getLogger(__name__)


class WebsocketTicketView(APIView):
    """
    Emite un ticket de un solo uso para conectar al WebSocket.
    Requiere Bearer JWT; el ticket vive <= WS_TICKET_TTL_SECONDS.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_authenticated or not user.is_active:
            return Response({'detail': 'Usuario inactivo.'}, status=status.HTTP_403_FORBIDDEN)

        auth_expires_at = self._auth_expires_at(request)
        try:
            issued = create_ws_ticket(user_id=user.id, auth_expires_at=auth_expires_at)
        except TicketStoreUnavailable:
            logger.warning('ws ticket endpoint: store unavailable')
            return Response(
                {'detail': 'Servicio de tickets no disponible. Intenta de nuevo.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError:
            return Response(
                {'detail': 'Sesión expirada. Vuelve a iniciar sesión.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(
            {
                'ticket': issued['ticket'],
                'expires_in': issued['expires_in'],
                'auth_expires_at': issued['auth_expires_at'],
                'ws_path': '/ws/v1/',
            },
            status=status.HTTP_201_CREATED,
        )

    def _auth_expires_at(self, request) -> float:
        """Fin de sesión WS = exp del access JWT (o ahora + lifetime configurado)."""
        header = request.META.get('HTTP_AUTHORIZATION') or ''
        if header.lower().startswith('bearer '):
            raw = header.split(' ', 1)[1].strip()
            try:
                access = AccessToken(raw)
                exp = access.get('exp')
                if exp is not None:
                    return float(exp)
            except (TokenError, ValueError, TypeError):
                pass

        lifetime = getattr(settings, 'SIMPLE_JWT', {}).get('ACCESS_TOKEN_LIFETIME')
        if lifetime is not None:
            return time.time() + float(lifetime.total_seconds())
        return time.time() + float(ticket_ttl_seconds())

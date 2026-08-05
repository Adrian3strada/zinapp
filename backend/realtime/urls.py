from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from realtime.views import WebsocketTicketView

urlpatterns = [
    # csrf_exempt explícito: clientes móviles/API no envían Referer;
    # la auth es JWT Bearer (igual que el resto de /api/).
    path(
        'ws-ticket/',
        csrf_exempt(WebsocketTicketView.as_view()),
        name='realtime-ws-ticket',
    ),
]

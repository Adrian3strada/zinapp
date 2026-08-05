from django.urls import path

from realtime.views import WebsocketTicketView

urlpatterns = [
    path('ws-ticket/', WebsocketTicketView.as_view(), name='realtime-ws-ticket'),
]

from django.urls import path

from .views import auth, cash, dashboard, orders, realtime, reports, sale

app_name = 'pos'

urlpatterns = [
    # Auth
    path('login/', auth.PosLoginView.as_view(), name='login'),
    path('logout/', auth.PosLogoutView.as_view(), name='logout'),
    path('post-login/', auth.PosPostLoginView.as_view(), name='post_login'),
    path('restaurante/', auth.PosSelectRestaurantView.as_view(), name='select_restaurant'),

    # Páginas UI
    path('', dashboard.PosDashboardView.as_view(), name='dashboard'),
    path('venta/', sale.PosSaleView.as_view(), name='sale'),
    path('venta/preview/', sale.PosCartPreviewView.as_view(), name='cart_preview'),
    path('venta/<int:order_id>/ticket/', sale.PosTicketView.as_view(), name='ticket'),
    path(
        'venta/<int:order_id>/ticket/cocina/',
        sale.PosKitchenTicketView.as_view(),
        name='ticket_kitchen',
    ),
    path('venta/<int:order_id>/cancelar/', orders.PosSaleCancelView.as_view(), name='sale_cancel'),
    path('caja/', cash.PosCashView.as_view(), name='cash'),
    path('caja/abrir/', cash.PosCashOpenView.as_view(), name='cash_open'),
    path('caja/cerrar/', cash.PosCashCloseView.as_view(), name='cash_close'),
    path('caja/movimiento/', cash.PosCashMovementView.as_view(), name='cash_movement'),
    path('caja/corte/', cash.PosCashCutView.as_view(), name='cash_cut'),
    path('pedidos/', orders.PosOrdersView.as_view(), name='orders'),
    path('cocina/', orders.PosKitchenView.as_view(), name='kitchen'),
    path('reportes/', reports.PosReportsView.as_view(), name='reports'),

    # API estable para JS (feeds / acciones) — evita plantillas frágiles con /0/
    path('api/ws-ticket/', realtime.PosWebsocketTicketView.as_view(), name='ws_ticket'),
    path('api/orders/feed/', orders.PosOrdersFeedView.as_view(), name='orders_feed'),
    path(
        'api/orders/<int:order_id>/action/',
        orders.PosOrderActionView.as_view(),
        name='order_action',
    ),
    path('api/kitchen/feed/', orders.PosKitchenFeedView.as_view(), name='kitchen_feed'),
    path(
        'api/kitchen/<int:order_id>/action/',
        orders.PosKitchenActionView.as_view(),
        name='kitchen_action',
    ),

    # Alias legacy (misma vista) por si hay bookmarks / caché vieja
    path('pedidos/feed/', orders.PosOrdersFeedView.as_view()),
    path('pedidos/<int:order_id>/accion/', orders.PosOrderActionView.as_view()),
    path('cocina/feed/', orders.PosKitchenFeedView.as_view()),
    path('cocina/<int:order_id>/accion/', orders.PosKitchenActionView.as_view()),
]

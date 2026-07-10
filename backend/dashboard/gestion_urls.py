from django.urls import path
from django.views.generic import RedirectView

from .gestion import views as gestion_views

app_name = 'gestion'

urlpatterns = [
    path('', RedirectView.as_view(pattern_name='dashboard:home', permanent=False), name='home'),
    path('cupones/', gestion_views.CouponListView.as_view(), name='coupons'),
    path('cupones/nuevo/', gestion_views.CouponCreateView.as_view(), name='coupon-create'),
    path('cupones/<int:pk>/', gestion_views.CouponUpdateView.as_view(), name='coupon-edit'),
    path('cupones/<int:pk>/eliminar/', gestion_views.CouponDeleteView.as_view(), name='coupon-delete'),
    path('productos/', gestion_views.ProductListView.as_view(), name='products'),
    path('productos/nuevo/', gestion_views.ProductCreateView.as_view(), name='product-create'),
    path('productos/<int:pk>/', gestion_views.ProductUpdateView.as_view(), name='product-edit'),
    path('productos/<int:pk>/eliminar/', gestion_views.ProductDeleteView.as_view(), name='product-delete'),
    path('envios/', gestion_views.ShipmentListView.as_view(), name='shipments'),
    path('envios/<int:pk>/', gestion_views.ShipmentDetailView.as_view(), name='shipment-detail'),
    path('disputas/', gestion_views.DisputeListView.as_view(), name='disputes'),
    path('disputas/<int:pk>/', gestion_views.DisputeDetailView.as_view(), name='dispute-detail'),
    path('pedidos/<int:pk>/editar/', gestion_views.OrderEditView.as_view(), name='order-edit'),
    path(
        'restaurantes/',
        RedirectView.as_view(pattern_name='dashboard:restaurants', permanent=False),
        name='restaurants',
    ),
    path('restaurantes/nuevo/', gestion_views.RestaurantCreateView.as_view(), name='restaurant-create'),
    path('restaurantes/<int:pk>/', gestion_views.RestaurantUpdateView.as_view(), name='restaurant-edit'),
    path('servicios/', gestion_views.LocalServiceListView.as_view(), name='local-services'),
    path('servicios/nuevo/', gestion_views.LocalServiceCreateView.as_view(), name='local-service-create'),
    path('servicios/<int:pk>/', gestion_views.LocalServiceUpdateView.as_view(), name='local-service-edit'),
    path('resenas/', gestion_views.ReviewListView.as_view(), name='reviews'),
    path('resenas/<int:pk>/eliminar/', gestion_views.ReviewDeleteView.as_view(), name='review-delete'),
    path('usuarios/nuevo/', gestion_views.UserCreateView.as_view(), name='user-create'),
    path('usuarios/<int:pk>/', gestion_views.UserEditView.as_view(), name='user-edit'),
    path('usuarios/<int:pk>/desactivar/', gestion_views.UserDeactivateView.as_view(), name='user-deactivate'),
    path('usuarios/<int:pk>/activar/', gestion_views.UserActivateView.as_view(), name='user-activate'),
    path('repartidores/<int:pk>/', gestion_views.DriverEditView.as_view(), name='driver-edit'),
]

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminStatsView,
    CouponViewSet,
    MercadoPagoWebhookView,
    OrderDisputeViewSet,
    OrderViewSet,
    ReviewViewSet,
    ShipmentViewSet,
)

router = DefaultRouter()
router.register('orders', OrderViewSet, basename='order')
router.register('shipments', ShipmentViewSet, basename='shipment')
router.register('coupons', CouponViewSet, basename='coupon')
router.register('reviews', ReviewViewSet, basename='review')
router.register('disputes', OrderDisputeViewSet, basename='dispute')

urlpatterns = [
    path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('payments/mercadopago/webhook/', MercadoPagoWebhookView.as_view(), name='mp-webhook'),
    path('', include(router.urls)),
]

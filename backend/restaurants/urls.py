from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CoverageBoundsView, CoverageCheckView, GeocodeView, ProductViewSet, RestaurantViewSet, RouteView

router = DefaultRouter()
router.register('restaurants', RestaurantViewSet, basename='restaurant')
router.register('products', ProductViewSet, basename='product')

urlpatterns = [
    path('geocode/', GeocodeView.as_view(), name='geocode'),
    path('route/', RouteView.as_view(), name='route'),
    path('coverage/check/', CoverageCheckView.as_view(), name='coverage-check'),
    path('coverage/bounds/', CoverageBoundsView.as_view(), name='coverage-bounds'),
    path('', include(router.urls)),
]

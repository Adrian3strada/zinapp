from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .home import CustomerFavoritesView, CustomerHomeView
from .search import CustomerSearchView
from .views import (
    CoverageBoundsView,
    CoverageCheckView,
    GeocodeView,
    ProductPromotionViewSet,
    ProductViewSet,
    RestaurantViewSet,
    RouteView,
)

router = DefaultRouter()
router.register('restaurants', RestaurantViewSet, basename='restaurant')
router.register('products', ProductViewSet, basename='product')
router.register('promotions', ProductPromotionViewSet, basename='promotion')

urlpatterns = [
    path('home/', CustomerHomeView.as_view(), name='customer-home'),
    path('favorites/', CustomerFavoritesView.as_view(), name='customer-favorites'),
    path('search/', CustomerSearchView.as_view(), name='customer-search'),
    path('geocode/', GeocodeView.as_view(), name='geocode'),
    path('route/', RouteView.as_view(), name='route'),
    path('coverage/check/', CoverageCheckView.as_view(), name='coverage-check'),
    path('coverage/bounds/', CoverageBoundsView.as_view(), name='coverage-bounds'),
    path('', include(router.urls)),
]

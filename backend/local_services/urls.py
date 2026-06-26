from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LocalServiceViewSet

router = DefaultRouter()
router.register('local-services', LocalServiceViewSet, basename='local-service')

urlpatterns = [
    path('', include(router.urls)),
]

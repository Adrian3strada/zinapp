from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChangePasswordView,
    DeliveryProfileViewSet,
    ForgotPasswordView,
    LoginView,
    MeView,
    PushTokenView,
    RegisterView,
    ResetPasswordView,
    ThrottledTokenRefreshView,
    UserViewSet,
)

router = DefaultRouter()
router.register('users', UserViewSet, basename='user')
router.register('delivery-profiles', DeliveryProfileViewSet, basename='delivery-profile')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', ThrottledTokenRefreshView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('push-token/', PushTokenView.as_view(), name='push-token'),
    path('', include(router.urls)),
]

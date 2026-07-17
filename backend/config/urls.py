from django.conf import settings
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.media_views import serve_media
from dashboard.panel_admin import panel_admin

from .cron_views import order_reminders_cron, restaurant_opens_cron, run_all_cron
from .health import app_config, health
from .landing_views import LandingView
from .legal_views import PrivacyPolicyView
from .webapp_views import webapp_serve

# Rutas que NO deben caer en la SPA (API, panel, legal, media, legacy /app/)
_WEBAPP_EXCLUDE = r'api/|admin/|panel/|privacidad/|media/|app/'

urlpatterns = [
    # Normaliza accesos compartidos sin la diagonal final antes de que caigan en la SPA.
    path('panel', RedirectView.as_view(url='/panel/', permanent=False)),
    path('app', RedirectView.as_view(url='/app/', permanent=False)),
    path('privacidad', RedirectView.as_view(url='/privacidad/', permanent=False)),
    path('admin/', RedirectView.as_view(url='/panel/gestion/', permanent=True)),
    path('panel/', include([
        path('gestion/sistema/', panel_admin.urls),
        path('gestion/', include('dashboard.gestion_urls')),
        path('', include('dashboard.urls')),
    ])),
    path('privacidad/', PrivacyPolicyView.as_view(), name='privacy-policy'),
    path('api/health/', health, name='health'),
    path('api/config/', app_config, name='app-config'),
    path('api/cron/restaurant-opens/', restaurant_opens_cron, name='cron-restaurant-opens'),
    path('api/cron/order-reminders/', order_reminders_cron, name='cron-order-reminders'),
    path('api/cron/run/', run_all_cron, name='cron-run-all'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('restaurants.urls')),
    path('api/', include('local_services.urls')),
    path('api/', include('orders.urls')),
    # App web en /app/ (ruta canónica)
    path('app/', webapp_serve, name='webapp-root'),
    re_path(r'^app/(?P<path>.*)$', webapp_serve, name='webapp'),
    # Landing pública (links de tiendas + WhatsApp)
    path('', LandingView.as_view(), name='landing'),
    re_path(rf'^(?P<path>(?!{_WEBAPP_EXCLUDE}).+)$', webapp_serve, name='webapp-catch'),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    ]

if settings.DEBUG or settings.SERVE_MEDIA:
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            serve_media,
        ),
    ]

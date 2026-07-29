from django.conf import settings
from django.http import Http404
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.media_views import serve_media
from dashboard.panel_admin import panel_admin

from .cron_views import order_reminders_cron, restaurant_opens_cron, run_all_cron
from .health import app_config, health
from .landing_views import LandingView, robots_txt, sitemap_xml
from .legal_views import PrivacyPolicyView
from .webapp_views import webapp_serve


def _public_not_found(request, path=''):
    """Rutas desconocidas fuera de /app/ → 404 real (no SPA)."""
    raise Http404()


urlpatterns = [
    # Normaliza accesos compartidos (301 para SEO).
    path('panel', RedirectView.as_view(url='/panel/', permanent=True)),
    path('app', RedirectView.as_view(url='/app/', permanent=True)),
    path('privacidad', RedirectView.as_view(url='/privacidad/', permanent=True)),
    path('robots.txt', robots_txt, name='robots-txt'),
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),
    path(
        'favicon.ico',
        RedirectView.as_view(url='/static/dashboard/img/logo-on-blue.png', permanent=True),
    ),
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
    # App web solo bajo /app/ (evita URLs delgadas duplicadas fuera de /app/).
    path('app/', webapp_serve, name='webapp-root'),
    re_path(r'^app/(?P<path>.*)$', webapp_serve, name='webapp'),
    # Landing pública
    path('', LandingView.as_view(), name='landing'),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    ]

# Siempre registrar /media/: el test runner fuerza DEBUG=False tras importar
# settings, así que condicionar aquí deja la ruta ausente en CI. La vista
# serve_media decide con settings actuales (DEBUG / SERVE_MEDIA).
urlpatterns += [
    re_path(
        r'^media/(?P<path>.*)$',
        serve_media,
    ),
]

# Catch-all al final: 404 en vez de servir la SPA en rutas públicas inventadas.
urlpatterns += [
    re_path(r'^(?P<path>.+)$', _public_not_found, name='public-404'),
]

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from .cron_views import order_reminders_cron, restaurant_opens_cron, run_all_cron
from .health import app_config, health

urlpatterns = [
    path('admin/', admin.site.urls),
    path('panel/', include('dashboard.urls')),
    path('api/health/', health, name='health'),
    path('api/config/', app_config, name='app-config'),
    path('api/cron/restaurant-opens/', restaurant_opens_cron, name='cron-restaurant-opens'),
    path('api/cron/order-reminders/', order_reminders_cron, name='cron-order-reminders'),
    path('api/cron/run/', run_all_cron, name='cron-run-all'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('restaurants.urls')),
    path('api/', include('orders.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVE_MEDIA:
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]

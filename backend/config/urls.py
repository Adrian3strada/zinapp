from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from .health import health

urlpatterns = [
    path('admin/', admin.site.urls),
    path('panel/', include('dashboard.urls')),
    path('api/health/', health, name='health'),
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

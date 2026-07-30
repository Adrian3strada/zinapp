"""Redirige el host público de Railway/Render a SITE_URL (canonical).

Solo afecta rutas de la landing / SEO público. No toca API, panel, app web,
media, static, health ni webhooks.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpResponsePermanentRedirect

from .seo import get_site_url

# Rutas públicas de marketing/SEO que no deben competir en hosts alias.
_LANDING_EXACT = frozenset({
    '/',
    '/privacidad',
    '/privacidad/',
    '/robots.txt',
    '/sitemap.xml',
})


def _normalize_host(host: str) -> str:
    return (host or '').split(':')[0].strip().lower()


def _is_alias_host(host: str, canonical_host: str) -> bool:
    if not host or host == canonical_host:
        return False
    configured = getattr(settings, 'CANONICAL_REDIRECT_HOSTS', None) or []
    if configured:
        return host in {h.lower() for h in configured if h}
    # Por defecto: dominios públicos típicos de PaaS (no localhost).
    return host.endswith('.railway.app') or host.endswith('.onrender.com')


def _is_landing_path(path: str) -> bool:
    if path in _LANDING_EXACT:
        return True
    # Solo la raíz de privacidad; no otras rutas.
    return path.rstrip('/') == '/privacidad'


class CanonicalHostRedirectMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'DEBUG', False):
            return self.get_response(request)

        if not getattr(settings, 'CANONICAL_HOST_REDIRECT', True):
            return self.get_response(request)

        canonical = get_site_url()
        canonical_host = _normalize_host(urlsplit(canonical).hostname or '')
        if not canonical_host:
            return self.get_response(request)

        request_host = _normalize_host(request.get_host())
        if not _is_alias_host(request_host, canonical_host):
            return self.get_response(request)

        path = request.path or '/'
        if not _is_landing_path(path):
            return self.get_response(request)

        # Normaliza /privacidad → /privacidad/
        if path == '/privacidad':
            path = '/privacidad/'

        target = f'{canonical}{path}'
        qs = request.META.get('QUERY_STRING')
        if qs:
            target = f'{target}?{qs}'

        return HttpResponsePermanentRedirect(target)

"""Helpers SEO: URL canónica del sitio público."""

from django.conf import settings


def get_site_url() -> str:
    """Origen público sin diagonal final (ej. https://zinapp.com.mx)."""
    raw = (getattr(settings, 'SITE_URL', None) or '').strip().rstrip('/')
    if raw:
        return raw
    landing_app = (getattr(settings, 'LANDING_APP_URL', None) or '').strip()
    if landing_app.startswith('http://') or landing_app.startswith('https://'):
        # https://zinapp.com.mx/app/ → https://zinapp.com.mx
        from urllib.parse import urlsplit

        parts = urlsplit(landing_app)
        if parts.scheme and parts.netloc:
            return f'{parts.scheme}://{parts.netloc}'
    return 'https://zinapp.com.mx'

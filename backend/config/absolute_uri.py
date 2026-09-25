from urllib.parse import urlparse, urlunparse

from django.conf import settings


def upgrade_public_media_url(absolute: str, site_url: str | None = None) -> str:
    """Si el sitio público es HTTPS, no devolver media en HTTP para ese host."""
    if not absolute:
        return absolute
    site = (site_url if site_url is not None else getattr(settings, 'SITE_URL', '') or '').rstrip('/')
    if not site.startswith('https://'):
        return absolute
    parsed = urlparse(absolute)
    if parsed.scheme != 'http' or not parsed.hostname:
        return absolute
    site_host = urlparse(site).hostname
    if not site_host:
        return absolute
    public_hosts = {site_host, f'www.{site_host}'}
    if site_host.startswith('www.'):
        public_hosts.add(site_host[4:])
    if parsed.hostname not in public_hosts:
        return absolute
    return urlunparse(parsed._replace(scheme='https'))


def public_absolute_uri(request, url: str) -> str:
    if request:
        absolute = request.build_absolute_uri(url)
    else:
        absolute = url
    return upgrade_public_media_url(absolute)

"""Helpers SEO: URL canónica del sitio público y correos de contacto."""

from django.conf import settings

# Buzón actual de avisos ARCO. Se usa solo si PRIVACY_EMAIL y SUPPORT_EMAIL
# están vacíos, para no romper el aviso de privacidad publicado.
LEGACY_PRIVACY_EMAIL = 'adrianestradachavez123@gmail.com'


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


def get_support_email() -> str:
    """soporte@… cuando esté configurado."""
    return (getattr(settings, 'SUPPORT_EMAIL', None) or '').strip()


def get_contact_email() -> str:
    """hola@… o, si no hay, el correo de soporte. Vacío = no mostrar en landing."""
    hello = (getattr(settings, 'CONTACT_EMAIL', None) or '').strip()
    return hello or get_support_email()


def get_privacy_email() -> str:
    """privacidad@… con fallback seguro al buzón que ya recibe solicitudes ARCO."""
    privacy = (getattr(settings, 'PRIVACY_EMAIL', None) or '').strip()
    return privacy or get_support_email() or LEGACY_PRIVACY_EMAIL

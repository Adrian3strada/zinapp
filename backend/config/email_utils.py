from django.conf import settings


def email_smtp_configured() -> bool:
    return bool(
        getattr(settings, 'EMAIL_HOST', '')
        and getattr(settings, 'EMAIL_HOST_USER', '')
        and getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    )


def email_reset_enabled() -> bool:
    """True si se intentará enviar correo (SMTP real o consola en DEBUG)."""
    if email_smtp_configured():
        return True
    backend = getattr(settings, 'EMAIL_BACKEND', '') or ''
    return bool(settings.DEBUG and 'console' in backend)

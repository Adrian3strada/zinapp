from django.conf import settings


def email_reset_enabled() -> bool:
    return bool(getattr(settings, 'EMAIL_HOST', '') and getattr(settings, 'EMAIL_HOST_USER', ''))

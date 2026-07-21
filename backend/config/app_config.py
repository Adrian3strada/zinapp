"""Configuración pública expuesta a la app móvil."""

from django.conf import settings

from orders.mercadopago import mercadopago_enabled

from .email_utils import email_reset_enabled, email_smtp_configured


def get_public_app_config() -> dict:
    return {
        'online_payments_enabled': mercadopago_enabled(),
        'support_whatsapp': settings.SUPPORT_WHATSAPP,
        # WhatsApp solo si no hay SMTP real (consola DEBUG no cuenta como correo real).
        'password_reset_via_whatsapp': bool(settings.SUPPORT_WHATSAPP) and not email_smtp_configured(),
        'password_reset_email_enabled': email_smtp_configured() or email_reset_enabled(),
        'coverage_label': 'Zinapécuaro, Michoacán',
    }



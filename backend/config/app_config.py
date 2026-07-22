"""Configuración pública expuesta a la app móvil."""

from django.conf import settings

from orders.mercadopago import mercadopago_enabled

from .email_utils import email_delivery_configured, email_reset_enabled


def get_public_app_config() -> dict:
    return {
        'online_payments_enabled': mercadopago_enabled(),
        'support_whatsapp': settings.SUPPORT_WHATSAPP,
        # WhatsApp solo si no hay entrega real (consola DEBUG no cuenta).
        'password_reset_via_whatsapp': (
            bool(settings.SUPPORT_WHATSAPP) and not email_delivery_configured()
        ),
        'password_reset_email_enabled': email_reset_enabled(),
        'coverage_label': 'Zinapécuaro, Michoacán',
    }



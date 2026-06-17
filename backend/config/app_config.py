"""Configuración pública expuesta a la app móvil."""

from orders.mercadopago import mercadopago_enabled


def get_public_app_config() -> dict:
    return {
        'online_payments_enabled': mercadopago_enabled(),
        'support_whatsapp': '4431234567',
        'coverage_label': 'Zinapécuaro, Michoacán',
    }

"""Configuración pública expuesta a la app móvil."""

from django.conf import settings

from accounts.google_auth import google_sign_in_enabled
from orders.stripe_payments import stripe_enabled, stripe_publishable_key

from .email_utils import email_delivery_configured, email_reset_enabled


def get_public_app_config() -> dict:
    return {
        'online_payments_enabled': stripe_enabled(),
        'stripe_publishable_key': stripe_publishable_key() if stripe_enabled() else '',
        'support_whatsapp': settings.SUPPORT_WHATSAPP,
        # WhatsApp solo si no hay entrega real (consola DEBUG no cuenta).
        'password_reset_via_whatsapp': (
            bool(settings.SUPPORT_WHATSAPP) and not email_delivery_configured()
        ),
        'password_reset_email_enabled': email_reset_enabled(),
        'google_sign_in_enabled': google_sign_in_enabled(),
        'coverage_label': 'Zinapécuaro, Michoacán',
        'delivery_fee': f'{settings.DELIVERY_FEE:.2f}',
        'rewards': _public_rewards_block(),
    }


def _public_rewards_block() -> dict:
    try:
        from rewards.services import get_program_config

        cfg = get_program_config()
        return {
            'birthday_enabled': cfg.birthday_enabled,
            'loyalty_enabled': cfg.loyalty_enabled,
            'loyalty_orders_required': cfg.loyalty_orders_required,
            'delivery_discount_cap': f'{cfg.delivery_discount_cap:.2f}',
        }
    except Exception:
        return {
            'birthday_enabled': settings.REWARDS_BIRTHDAY_ENABLED,
            'loyalty_enabled': settings.REWARDS_LOYALTY_ENABLED,
            'loyalty_orders_required': settings.REWARDS_LOYALTY_ORDERS_REQUIRED,
            'delivery_discount_cap': f'{settings.REWARDS_DELIVERY_DISCOUNT_CAP:.2f}',
        }



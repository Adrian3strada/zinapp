"""Integración Stripe Checkout. Configura STRIPE_SECRET_KEY en .env."""

from __future__ import annotations

import logging
from decimal import Decimal

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)


def stripe_enabled() -> bool:
    key = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''
    return bool(key.strip())


def _configure_stripe() -> str | None:
    key = (getattr(settings, 'STRIPE_SECRET_KEY', '') or '').strip()
    if not key:
        return None
    stripe.api_key = key
    return key


def create_checkout_session(order) -> dict | None:
    """Crea una Checkout Session y devuelve {session_id, payment_url}."""
    if not _configure_stripe():
        return None

    success_url = (getattr(settings, 'STRIPE_SUCCESS_URL', '') or '').strip()
    cancel_url = (getattr(settings, 'STRIPE_CANCEL_URL', '') or '').strip()
    back_url = (getattr(settings, 'STRIPE_BACK_URL', '') or '').strip()
    if not success_url:
        success_url = back_url or 'https://zinapp.com.mx/app/'
    if not cancel_url:
        cancel_url = back_url or success_url

    # Stripe usa centavos (o la menor unidad); MXN = centavos.
    amount_cents = int((Decimal(str(order.total)) * 100).quantize(Decimal('1')))
    if amount_cents < 1:
        logger.warning('Stripe: total inválido pedido #%s', order.id)
        return None

    restaurant_name = getattr(getattr(order, 'restaurant', None), 'name', '') or 'ZinApp'
    title = f'Pedido {order.display_ref} — {restaurant_name}'

    try:
        session = stripe.checkout.Session.create(
            mode='payment',
            payment_method_types=['card'],
            line_items=[
                {
                    'quantity': 1,
                    'price_data': {
                        'currency': 'mxn',
                        'unit_amount': amount_cents,
                        'product_data': {
                            'name': title,
                        },
                    },
                }
            ],
            client_reference_id=str(order.id),
            metadata={
                'order_id': str(order.id),
                'type': 'order',
            },
            payment_intent_data={
                'metadata': {
                    'order_id': str(order.id),
                    'type': 'order',
                },
            },
            success_url=success_url,
            cancel_url=cancel_url,
            locale='es',
        )
        url = getattr(session, 'url', None)
        if not url:
            return None
        return {
            'session_id': session.id,
            'payment_url': url,
            'payment_intent': getattr(session, 'payment_intent', None) or '',
        }
    except Exception as exc:
        logger.warning('Stripe Checkout falló pedido #%s: %s', order.id, exc)
        return None


def construct_webhook_event(payload: bytes, sig_header: str):
    """Verifica la firma del webhook y devuelve el Event de Stripe."""
    secret = (getattr(settings, 'STRIPE_WEBHOOK_SECRET', '') or '').strip()
    if not secret:
        raise ValueError('STRIPE_WEBHOOK_SECRET no configurado')
    if not _configure_stripe():
        raise ValueError('STRIPE_SECRET_KEY no configurado')
    return stripe.Webhook.construct_event(payload, sig_header, secret)

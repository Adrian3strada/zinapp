"""Integración Stripe Checkout. Configura STRIPE_SECRET_KEY en .env."""

from __future__ import annotations

import logging
from decimal import Decimal

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)


def stripe_enabled() -> bool:
    key = getattr(settings, 'STRIPE_SECRET_KEY', '') or ''
    return bool(key.strip())


def stripe_publishable_key() -> str:
    return (getattr(settings, 'STRIPE_PUBLISHABLE_KEY', '') or '').strip()


def _configure_stripe() -> str | None:
    key = (getattr(settings, 'STRIPE_SECRET_KEY', '') or '').strip()
    if not key:
        return None
    stripe.api_key = key
    return key


def _order_line_item(order, amount_cents: int) -> dict:
    restaurant_name = getattr(getattr(order, 'restaurant', None), 'name', '') or 'ZinApp'
    title = f'Pedido {order.display_ref} — {restaurant_name}'
    return {
        'quantity': 1,
        'price_data': {
            'currency': 'mxn',
            'unit_amount': amount_cents,
            'product_data': {
                'name': title,
            },
        },
    }


def create_checkout_session(order, *, embedded: bool = False) -> dict | None:
    """Crea Checkout Session.

    - embedded=False → {session_id, payment_url} (redirige)
    - embedded=True  → {session_id, client_secret} (formulario en la app)
    """
    if not _configure_stripe():
        return None

    success_url = (getattr(settings, 'STRIPE_SUCCESS_URL', '') or '').strip()
    cancel_url = (getattr(settings, 'STRIPE_CANCEL_URL', '') or '').strip()
    back_url = (getattr(settings, 'STRIPE_BACK_URL', '') or '').strip()
    if not success_url:
        success_url = back_url or 'https://zinapp.com.mx/app/'
    if not cancel_url:
        cancel_url = back_url or success_url

    amount_cents = int((Decimal(str(order.total)) * 100).quantize(Decimal('1')))
    if amount_cents < 1:
        logger.warning('Stripe: total inválido pedido #%s', order.id)
        return None

    common = {
        'mode': 'payment',
        'payment_method_types': ['card'],
        'line_items': [_order_line_item(order, amount_cents)],
        'client_reference_id': str(order.id),
        'metadata': {
            'order_id': str(order.id),
            'type': 'order',
        },
        'payment_intent_data': {
            'metadata': {
                'order_id': str(order.id),
                'type': 'order',
            },
        },
        'locale': 'es',
    }

    try:
        if embedded:
            # El formulario vive dentro de ZinApp (misma pantalla).
            parts = urlsplit(success_url or 'https://zinapp.com.mx/app/')
            query = dict(parse_qsl(parts.query, keep_blank_values=True))
            query['stripe_return'] = '1'
            query['order_id'] = str(order.id)
            path = parts.path or '/'
            return_url = urlunsplit((
                parts.scheme,
                parts.netloc,
                path,
                urlencode(query),
                parts.fragment,
            ))

            session = stripe.checkout.Session.create(
                **common,
                ui_mode='embedded',
                return_url=return_url,
            )
            client_secret = getattr(session, 'client_secret', None)
            if not client_secret:
                return None
            return {
                'session_id': session.id,
                'client_secret': client_secret,
                'payment_intent': getattr(session, 'payment_intent', None) or '',
                'embedded': True,
            }

        session = stripe.checkout.Session.create(
            **common,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        url = getattr(session, 'url', None)
        if not url:
            return None
        return {
            'session_id': session.id,
            'payment_url': url,
            'payment_intent': getattr(session, 'payment_intent', None) or '',
            'embedded': False,
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

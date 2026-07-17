"""Integración Mercado Pago (Checkout Pro). Configura MERCADOPAGO_ACCESS_TOKEN en .env."""

import json
import logging
import hashlib
import hmac
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

MP_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences'
MP_PAYMENT_URL = 'https://api.mercadopago.com/v1/payments'


def mercadopago_enabled() -> bool:
    token = getattr(settings, 'MERCADOPAGO_ACCESS_TOKEN', '') or ''
    return bool(token.strip())


def verify_webhook_signature(request, payment_id: str) -> bool:
    """Verify Mercado Pago's v1 webhook signature when a secret is configured.

    The secret is optional only for backward compatibility with existing
    deployments. Production integrations must set MERCADOPAGO_WEBHOOK_SECRET.
    """
    secret = (getattr(settings, 'MERCADOPAGO_WEBHOOK_SECRET', '') or '').strip()
    if not secret:
        return False

    signature = request.headers.get('x-signature', '')
    request_id = request.headers.get('x-request-id', '')
    values = dict(
        part.strip().split('=', 1)
        for part in signature.split(',')
        if '=' in part
    )
    timestamp = values.get('ts', '')
    received_hash = values.get('v1', '')
    if not timestamp or not received_hash:
        return False

    manifest = f'id:{payment_id};request-id:{request_id};ts:{timestamp};'
    expected_hash = hmac.new(
        secret.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(received_hash, expected_hash)


def create_checkout_preference(order) -> dict | None:
    token = getattr(settings, 'MERCADOPAGO_ACCESS_TOKEN', '')
    if not token:
        return None

    back_url = getattr(settings, 'MERCADOPAGO_BACK_URL', '') or ''
    notification_url = getattr(settings, 'MERCADOPAGO_WEBHOOK_URL', '') or ''

    payload = {
        'items': [{
            'id': str(order.id),
            'title': f'Pedido {order.display_ref} — {order.restaurant.name}',
            'quantity': 1,
            'unit_price': float(order.total),
            'currency_id': 'MXN',
        }],
        'external_reference': str(order.id),
        'metadata': {'order_id': order.id, 'type': 'order'},
        'statement_descriptor': 'ZINAPP',
    }
    if back_url:
        payload['back_urls'] = {
            'success': back_url,
            'pending': back_url,
            'failure': back_url,
        }
        payload['auto_return'] = 'approved'
    if notification_url:
        payload['notification_url'] = notification_url

    try:
        req = urllib.request.Request(
            MP_PREFERENCES_URL,
            data=json.dumps(payload).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            return {
                'preference_id': data.get('id'),
                'init_point': data.get('init_point') or data.get('sandbox_init_point'),
            }
    except Exception as exc:
        logger.warning('Mercado Pago preference falló pedido #%s: %s', order.id, exc)
        return None


def fetch_payment(payment_id: str) -> dict | None:
    token = getattr(settings, 'MERCADOPAGO_ACCESS_TOKEN', '')
    if not token or not payment_id:
        return None
    try:
        req = urllib.request.Request(
            f'{MP_PAYMENT_URL}/{payment_id}',
            headers={'Authorization': f'Bearer {token}'},
            method='GET',
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        logger.warning('Mercado Pago payment %s: %s', payment_id, exc)
        return None

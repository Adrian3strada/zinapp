"""One-time WebSocket connect tickets (Redis; locmem only for local/tests)."""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TICKET_KEY_PREFIX = 'ws_ticket:'


class TicketStoreUnavailable(Exception):
    """Cache/Redis no disponible para tickets WS."""


def ticket_ttl_seconds() -> int:
    return max(5, int(getattr(settings, 'WS_TICKET_TTL_SECONDS', 60)))


def _tickets_require_redis() -> bool:
    return bool(getattr(settings, 'WS_TICKETS_REQUIRE_REDIS', not settings.DEBUG))


def _redis_conn():
    """Conexión Redis cruda o None si no hay REDIS_URL."""
    if not getattr(settings, 'REDIS_URL', '').strip():
        return None
    try:
        from django_redis import get_redis_connection

        return get_redis_connection('default')
    except Exception as exc:
        raise TicketStoreUnavailable(str(exc)) from exc


def create_ws_ticket(*, user_id: int, auth_expires_at: float) -> dict[str, Any]:
    """
    Crea un ticket de un solo uso (TTL corto).
    auth_expires_at: unix timestamp de fin de sesión autenticada WS.
    """
    ttl = ticket_ttl_seconds()
    now = time.time()
    if auth_expires_at <= now:
        raise ValueError('auth_expires_at must be in the future')

    if _tickets_require_redis() and not getattr(settings, 'REDIS_URL', '').strip():
        raise TicketStoreUnavailable('REDIS_URL required for WebSocket tickets')

    payload = {
        'user_id': int(user_id),
        'auth_expires_at': float(auth_expires_at),
        'created_at': now,
    }
    ticket = secrets.token_urlsafe(32)
    key = f'{TICKET_KEY_PREFIX}{ticket}'
    raw = json.dumps(payload, separators=(',', ':'))

    conn = _redis_conn()
    try:
        if conn is not None:
            ok = conn.set(key, raw, ex=ttl, nx=True)
            if not ok:
                ticket = secrets.token_urlsafe(32)
                key = f'{TICKET_KEY_PREFIX}{ticket}'
                ok = conn.set(key, raw, ex=ttl, nx=True)
                if not ok:
                    raise TicketStoreUnavailable('ticket key collision')
        else:
            # LocMem / tests sin Redis
            if not cache.add(key, payload, timeout=ttl):
                ticket = secrets.token_urlsafe(32)
                key = f'{TICKET_KEY_PREFIX}{ticket}'
                if not cache.add(key, payload, timeout=ttl):
                    raise TicketStoreUnavailable('ticket key collision')
    except TicketStoreUnavailable:
        raise
    except Exception as exc:
        logger.warning('ws ticket create failed (store unavailable)')
        raise TicketStoreUnavailable(str(exc)) from exc

    return {
        'ticket': ticket,
        'expires_in': ttl,
        'auth_expires_at': auth_expires_at,
    }


def consume_ws_ticket(ticket: str) -> dict[str, Any] | None:
    """Lee y borra el ticket. None = inválido, reutilizado o vencido."""
    if not ticket or not isinstance(ticket, str):
        return None
    ticket = ticket.strip()
    if not ticket or len(ticket) > 200:
        return None

    if _tickets_require_redis() and not getattr(settings, 'REDIS_URL', '').strip():
        raise TicketStoreUnavailable('REDIS_URL required for WebSocket tickets')

    key = f'{TICKET_KEY_PREFIX}{ticket}'
    conn = _redis_conn()
    try:
        if conn is not None:
            getdel = getattr(conn, 'getdel', None)
            if callable(getdel):
                raw = getdel(key)
            else:
                pipe = conn.pipeline()
                pipe.get(key)
                pipe.delete(key)
                raw, _deleted = pipe.execute()
            if raw is None:
                return None
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8')
            data = json.loads(raw)
        else:
            data = cache.get(key)
            if data is None:
                return None
            cache.delete(key)
    except TicketStoreUnavailable:
        raise
    except Exception as exc:
        logger.warning('ws ticket consume failed (store unavailable)')
        raise TicketStoreUnavailable(str(exc)) from exc

    if not isinstance(data, dict) or 'user_id' not in data:
        return None
    return data

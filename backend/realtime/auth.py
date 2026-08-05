"""WebSocket auth: one-time ticket (preferred) or legacy JWT query (opt-in)."""

from __future__ import annotations

import logging
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from realtime.tickets import TicketStoreUnavailable, consume_ws_ticket

logger = logging.getLogger(__name__)


@database_sync_to_async
def _active_user(user_id: int):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None
    if not user.is_active:
        return None
    return user


@database_sync_to_async
def _user_from_legacy_jwt(raw_token: str):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        access = AccessToken(raw_token)
        user_id = access.get('user_id')
        if not user_id:
            return None, None
        user = User.objects.get(pk=user_id)
        if not user.is_active:
            return None, None
        exp = access.get('exp')
        return user, float(exp) if exp is not None else None
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError, TypeError, ValueError):
        return None, None


class JwtAuthMiddleware(BaseMiddleware):
    """
    Resuelve scope['user'] y scope['ws_auth_expires_at'] desde:
    1) ?ticket= (un solo uso, Redis)
    2) ?token= solo si WS_LEGACY_JWT_QUERY_AUTH=true
    """

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        ticket = (query.get('ticket') or [None])[0]
        legacy_token = (query.get('token') or [None])[0]

        scope['user'] = AnonymousUser()
        scope['ws_auth_expires_at'] = None
        scope['ws_auth_error'] = None

        if ticket:
            try:
                payload = await sync_to_async(consume_ws_ticket)(ticket)
            except TicketStoreUnavailable:
                scope['ws_auth_error'] = 'store_unavailable'
                payload = None
            if payload:
                user = await _active_user(int(payload['user_id']))
                if user is None:
                    scope['ws_auth_error'] = 'inactive_or_missing'
                else:
                    scope['user'] = user
                    scope['ws_auth_expires_at'] = float(payload.get('auth_expires_at') or 0)
            else:
                if scope.get('ws_auth_error') is None:
                    scope['ws_auth_error'] = 'invalid_ticket'
        elif legacy_token and getattr(settings, 'WS_LEGACY_JWT_QUERY_AUTH', False):
            user, exp = await _user_from_legacy_jwt(legacy_token)
            if user is None:
                scope['ws_auth_error'] = 'invalid_legacy_token'
            else:
                scope['user'] = user
                scope['ws_auth_expires_at'] = exp
        else:
            scope['ws_auth_error'] = 'missing_ticket'

        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)

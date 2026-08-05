"""JWT auth for WebSocket connections (query ?token=access)."""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _user_from_token(raw_token: str):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        access = AccessToken(raw_token)
        user_id = access.get('user_id')
        if not user_id:
            return AnonymousUser()
        return User.objects.get(pk=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError, TypeError):
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        raw = (query.get('token') or [None])[0]
        if raw:
            scope['user'] = await _user_from_token(raw)
        else:
            scope['user'] = AnonymousUser()
        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)

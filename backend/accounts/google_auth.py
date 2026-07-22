"""Verificación de Google ID tokens para Continuar con Google."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from rest_framework import serializers

logger = logging.getLogger(__name__)

TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
GOOGLE_ISSUERS = {'https://accounts.google.com', 'accounts.google.com'}


def google_oauth_client_ids() -> list[str]:
    raw = getattr(settings, 'GOOGLE_OAUTH_CLIENT_IDS', None)
    if raw is None:
        raw = []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(',') if part.strip()]
    return [str(x).strip() for x in raw if str(x).strip()]


def google_sign_in_enabled() -> bool:
    return bool(google_oauth_client_ids())


def verify_google_id_token(id_token: str) -> dict:
    """
    Valida un id_token de Google vía tokeninfo.
    Devuelve claims (sub, email, email_verified, given_name, family_name, …).
    """
    token = (id_token or '').strip()
    if not token:
        raise serializers.ValidationError({'id_token': 'Falta el token de Google.'})

    audiences = google_oauth_client_ids()
    if not audiences:
        raise serializers.ValidationError(
            {'detail': 'Inicio con Google no está configurado en el servidor.'},
        )

    url = f'{TOKENINFO_URL}?{urllib.parse.urlencode({"id_token": token})}'
    req = urllib.request.Request(
        url,
        headers={'Accept': 'application/json', 'User-Agent': 'ZinApp/1.0'},
        method='GET',
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            claims = json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = ''
        try:
            body = exc.read().decode('utf-8', errors='replace')[:300]
        except Exception:
            pass
        logger.warning('Google tokeninfo HTTP %s: %s', exc.code, body)
        raise serializers.ValidationError(
            {'id_token': 'Token de Google inválido o expirado.'},
        ) from exc
    except urllib.error.URLError as exc:
        logger.warning('Google tokeninfo red: %s', exc.reason)
        raise serializers.ValidationError(
            {'detail': 'No se pudo verificar Google. Intenta de nuevo.'},
        ) from exc
    except json.JSONDecodeError as exc:
        raise serializers.ValidationError(
            {'id_token': 'Respuesta inválida de Google.'},
        ) from exc

    aud = claims.get('aud') or ''
    if aud not in audiences:
        raise serializers.ValidationError(
            {'id_token': 'Token de Google no emitido para esta app.'},
        )

    iss = claims.get('iss') or ''
    if iss not in GOOGLE_ISSUERS:
        raise serializers.ValidationError(
            {'id_token': 'Emisor de Google no reconocido.'},
        )

    sub = (claims.get('sub') or '').strip()
    email = (claims.get('email') or '').strip().lower()
    email_verified = str(claims.get('email_verified', '')).lower() in ('true', '1')

    if not sub:
        raise serializers.ValidationError({'id_token': 'Token de Google incompleto.'})
    if not email or not email_verified:
        raise serializers.ValidationError(
            {'id_token': 'Tu cuenta de Google debe tener un correo verificado.'},
        )

    return {
        'sub': sub,
        'email': email,
        'email_verified': True,
        'given_name': (claims.get('given_name') or '').strip()[:150],
        'family_name': (claims.get('family_name') or '').strip()[:150],
        'name': (claims.get('name') or '').strip()[:150],
        'picture': (claims.get('picture') or '').strip(),
    }

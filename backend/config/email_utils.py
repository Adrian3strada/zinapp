"""Envío de correo de la app (Resend HTTP preferido; SMTP como respaldo)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from email.utils import parseaddr

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

RESEND_API_URL = 'https://api.resend.com/emails'


def email_smtp_configured() -> bool:
    return bool(
        getattr(settings, 'EMAIL_HOST', '')
        and getattr(settings, 'EMAIL_HOST_USER', '')
        and getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    )


def resend_api_key() -> str:
    """API key de Resend (HTTP). Compat: EMAIL_HOST_PASSWORD con host Resend."""
    explicit = (getattr(settings, 'RESEND_API_KEY', '') or '').strip()
    if explicit:
        return explicit
    host = (getattr(settings, 'EMAIL_HOST', '') or '').lower()
    password = (getattr(settings, 'EMAIL_HOST_PASSWORD', '') or '').strip()
    if password and 'resend.com' in host:
        return password
    return ''


def email_delivery_configured() -> bool:
    """True si hay canal real (Resend HTTP o SMTP), no consola DEBUG."""
    return bool(resend_api_key()) or email_smtp_configured()


def email_reset_enabled() -> bool:
    """True si se intentará enviar correo (entrega real o consola en DEBUG)."""
    if email_delivery_configured():
        return True
    backend = getattr(settings, 'EMAIL_BACKEND', '') or ''
    return bool(settings.DEBUG and 'console' in backend)


def _parse_from_header(from_email: str) -> tuple[str, str | None]:
    name, addr = parseaddr(from_email or '')
    if not addr:
        addr = (from_email or '').strip() or 'onboarding@resend.dev'
    return addr, (name.strip() or None)


def send_via_resend_http(
    *,
    subject: str,
    message: str,
    recipient_list: list[str],
    from_email: str | None = None,
    api_key: str | None = None,
) -> str:
    """Envía correo por API HTTP de Resend. Devuelve el id del mensaje."""
    key = (api_key or resend_api_key()).strip()
    if not key:
        raise RuntimeError('RESEND_API_KEY no configurada')

    from_raw = from_email or settings.DEFAULT_FROM_EMAIL
    from_addr, from_name = _parse_from_header(from_raw)
    from_value = f'{from_name} <{from_addr}>' if from_name else from_addr

    payload = {
        'from': from_value,
        'to': list(recipient_list),
        'subject': subject,
        'text': message,
    }
    req = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ZinApp/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            data = json.loads(raw) if raw else {}
            msg_id = data.get('id') or ''
            logger.info('Resend HTTP ok to=%s id=%s', recipient_list, msg_id)
            return msg_id
    except urllib.error.HTTPError as exc:
        body = ''
        try:
            body = exc.read().decode('utf-8', errors='replace')[:500]
        except Exception:
            pass
        raise RuntimeError(f'Resend HTTP {exc.code}: {body or exc.reason}') from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f'Resend HTTP red: {exc.reason}') from exc


def send_app_email(
    *,
    subject: str,
    message: str,
    recipient_list: list[str],
    from_email: str | None = None,
) -> None:
    """
    Preferencia: Resend HTTP (evita cuelgues SMTP en Railway).
    Si no hay key Resend, usa Django send_mail (SMTP/consola).
    """
    if resend_api_key():
        send_via_resend_http(
            subject=subject,
            message=message,
            recipient_list=recipient_list,
            from_email=from_email,
        )
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_list,
        fail_silently=False,
    )

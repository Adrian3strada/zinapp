from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from .models import AuditLog


def _client_ip(request) -> str | None:
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '') if request else ''
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') if request else None


def write_audit_log(
    *,
    action: str,
    obj: Any,
    request=None,
    actor=None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Record security-relevant actions without interrupting user workflows."""
    try:
        user = actor
        if user is None and request is not None:
            user = getattr(request, 'user', None)
        if user is not None and not getattr(user, 'is_authenticated', False):
            user = None

        AuditLog.objects.create(
            actor=user if isinstance(user, get_user_model()) else None,
            action=action,
            object_type=obj.__class__.__name__,
            object_id=str(getattr(obj, 'pk', '')),
            metadata=metadata or {},
            ip_address=_client_ip(request),
            user_agent=(request.META.get('HTTP_USER_AGENT', '') if request else '')[:1000],
        )
    except Exception:
        # Audit logging must never break order, payment or delivery flows.
        return

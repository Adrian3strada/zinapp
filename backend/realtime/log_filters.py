"""Redacta tickets/JWT de mensajes de log (query strings, etc.)."""

from __future__ import annotations

import logging
import re

_SENSITIVE_QS = re.compile(
    r'([?&](?:ticket|token|access_token|refresh_token|authorization)=)([^&\s]*)',
    re.IGNORECASE,
)
_BEARER = re.compile(r'(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)', re.IGNORECASE)


def redact_secrets(text: str) -> str:
    if not text:
        return text
    text = _SENSITIVE_QS.sub(r'\1[REDACTED]', text)
    text = _BEARER.sub(r'\1[REDACTED]', text)
    return text


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                record.msg = redact_secrets(record.msg)
            if record.args:
                if isinstance(record.args, dict):
                    record.args = {
                        k: redact_secrets(v) if isinstance(v, str) else v
                        for k, v in record.args.items()
                    }
                elif isinstance(record.args, tuple):
                    record.args = tuple(
                        redact_secrets(a) if isinstance(a, str) else a for a in record.args
                    )
        except Exception:
            pass
        return True

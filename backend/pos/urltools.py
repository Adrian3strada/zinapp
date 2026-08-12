"""Helpers de URLs POS resistentes a placeholders frágiles."""

from django.urls import reverse

_SENTINEL = 987654321


def reverse_id_template(viewname: str, *, id_kw: str = 'order_id') -> str:
    """Devuelve una URL con `__ID__` en lugar del pk (para JS)."""
    raw = reverse(viewname, kwargs={id_kw: _SENTINEL})
    return raw.replace(str(_SENTINEL), '__ID__')

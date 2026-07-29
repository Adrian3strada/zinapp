"""Validación y normalización de teléfonos MX (10 dígitos)."""

from __future__ import annotations

import re

_PHONE_DIGITS_RE = re.compile(r'\D+')


def digits_only(value: str | None) -> str:
    return _PHONE_DIGITS_RE.sub('', value or '')


def normalize_mx_phone(value: str | None) -> str:
    """Devuelve solo dígitos nacionales (sin +52 / 521)."""
    digits = digits_only(value)
    if digits.startswith('521') and len(digits) >= 13:
        digits = digits[3:]
    elif digits.startswith('52') and len(digits) >= 12:
        digits = digits[2:]
    return digits


def validate_required_mx_phone(value: str | None) -> str:
    """
    Exige teléfono MX de 10 dígitos.
    Rechaza vacío, solo espacios y formatos inválidos.
    Devuelve el número normalizado (10 dígitos).
    """
    if value is None or not str(value).strip():
        raise ValueError('El teléfono es obligatorio.')
    digits = normalize_mx_phone(str(value))
    if len(digits) != 10:
        raise ValueError('Usa un teléfono de 10 dígitos (ej. 4431234567).')
    if digits == '0000000000':
        raise ValueError('Indica un teléfono válido.')
    return digits


def validate_optional_mx_phone(value: str | None) -> str:
    """Vacío → ''; si hay valor, debe ser MX válido."""
    if value is None or not str(value).strip():
        return ''
    return validate_required_mx_phone(value)

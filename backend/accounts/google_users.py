"""Helpers para crear/vincular usuarios desde Google Sign-In."""

from __future__ import annotations

import re
import secrets

from django.db import IntegrityError, transaction

from .models import User, UserRole
from .username import normalize_username


def _base_username_from_email(email: str) -> str:
    local = (email.split('@', 1)[0] or 'user').lower()
    local = re.sub(r'[^a-z0-9._-]+', '', local).strip('._-')
    if not local:
        local = 'user'
    return normalize_username(local)[:30]


def unique_username_for_email(email: str) -> str:
    base = _base_username_from_email(email)
    candidate = base
    for _ in range(40):
        if not User.objects.filter(username__iexact=candidate).exists():
            return candidate
        suffix = secrets.token_hex(2)
        candidate = f'{base[:24]}_{suffix}'
    return f'user_{secrets.token_hex(6)}'


@transaction.atomic
def get_or_create_user_from_google(claims: dict) -> User:
    """
    Resuelve usuario por google_sub o email verificado.
    Altas nuevas siempre como cliente.
    """
    sub = claims['sub']
    email = claims['email']

    user = User.objects.filter(google_sub=sub).first()
    if user:
        if not user.is_active:
            raise ValueError('account_inactive')
        return user

    user = User.objects.filter(email__iexact=email).first()
    if user:
        if not user.is_active:
            raise ValueError('account_inactive')
        if user.google_sub and user.google_sub != sub:
            raise ValueError('google_conflict')
        updates = []
        if not user.google_sub:
            user.google_sub = sub
            updates.append('google_sub')
        if not user.first_name and claims.get('given_name'):
            user.first_name = claims['given_name']
            updates.append('first_name')
        if not user.last_name and claims.get('family_name'):
            user.last_name = claims['family_name']
            updates.append('last_name')
        if updates:
            user.save(update_fields=updates)
        return user

    username = unique_username_for_email(email)
    try:
        user = User(
            username=username,
            email=email,
            first_name=claims.get('given_name') or '',
            last_name=claims.get('family_name') or '',
            role=UserRole.CUSTOMER,
            google_sub=sub,
        )
        user.set_unusable_password()
        user.save()
    except IntegrityError:
        # Carrera rara: reintenta por sub/email.
        user = (
            User.objects.filter(google_sub=sub).first()
            or User.objects.filter(email__iexact=email).first()
        )
        if not user:
            raise
        if not user.is_active:
            raise ValueError('account_inactive')
        if not user.google_sub:
            user.google_sub = sub
            user.save(update_fields=['google_sub'])
    return user

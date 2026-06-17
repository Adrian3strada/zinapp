from django.db import IntegrityError, transaction
from rest_framework.response import Response

from .models import IdempotencyRecord

IDEMPOTENCY_HEADER = 'Idempotency-Key'


def idempotent_create(request, scope: str, builder):
    """
    Evita pedidos/envíos duplicados si el cliente reenvía la misma solicitud.
    Requiere cabecera Idempotency-Key (UUID del cliente).
    """
    key = (request.headers.get(IDEMPOTENCY_HEADER) or '').strip()
    if not key or len(key) > 64:
        return builder()

    user = request.user

    existing = IdempotencyRecord.objects.filter(
        key=key,
        user=user,
        scope=scope,
    ).first()
    if existing:
        if existing.status == IdempotencyRecord.Status.COMPLETED:
            return Response(existing.response_body, status=existing.status_code)
        return Response(
            {'detail': 'Tu solicitud se está procesando. Espera unos segundos.'},
            status=409,
        )

    try:
        with transaction.atomic():
            IdempotencyRecord.objects.create(
                key=key,
                user=user,
                scope=scope,
                status=IdempotencyRecord.Status.PENDING,
            )
    except IntegrityError:
        existing = IdempotencyRecord.objects.filter(
            key=key,
            user=user,
            scope=scope,
        ).first()
        if existing and existing.status == IdempotencyRecord.Status.COMPLETED:
            return Response(existing.response_body, status=existing.status_code)
        return Response(
            {'detail': 'Tu solicitud se está procesando. Espera unos segundos.'},
            status=409,
        )

    try:
        response = builder()
    except Exception:
        IdempotencyRecord.objects.filter(key=key, user=user, scope=scope).delete()
        raise

    if 200 <= response.status_code < 300:
        IdempotencyRecord.objects.filter(key=key, user=user, scope=scope).update(
            status=IdempotencyRecord.Status.COMPLETED,
            response_body=response.data,
            status_code=response.status_code,
        )
    else:
        IdempotencyRecord.objects.filter(key=key, user=user, scope=scope).delete()

    return response

"""Checklist de validación requerido para que un repartidor opere."""

from .models import DeliveryProfile


def driver_setup_status(profile: DeliveryProfile) -> dict:
    has_plate = (
        profile.vehicle_type == DeliveryProfile.VehicleType.BICYCLE
        or bool((profile.license_plate or '').strip())
    )
    steps = [
        {'key': 'phone', 'label': 'Teléfono de contacto', 'done': bool(profile.user.phone.strip())},
        {'key': 'vehicle', 'label': 'Tipo de vehículo', 'done': bool(profile.vehicle_type)},
        {'key': 'plate', 'label': 'Placas del vehículo', 'done': has_plate},
        {'key': 'photo', 'label': 'Foto de perfil', 'done': bool(profile.user.avatar)},
        {'key': 'identity', 'label': 'Foto de INE', 'done': bool(profile.identity_document)},
    ]
    done_count = sum(step['done'] for step in steps)
    complete = done_count == len(steps)
    return {
        'steps': steps,
        'done_count': done_count,
        'total_count': len(steps),
        'complete': complete,
        'is_approved': profile.verification_status == DeliveryProfile.VerificationStatus.APPROVED,
        'ready_for_deliveries': complete
        and profile.verification_status == DeliveryProfile.VerificationStatus.APPROVED,
    }

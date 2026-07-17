from accounts.models import DeliveryProfile
from orders.models import DisputeStatus, OrderDispute
from restaurants.models import Restaurant

from .access import can_access_panel


def panel_nav(request):
    if not can_access_panel(request.user):
        return {}
    return {
        'panel_pending_restaurants': Restaurant.objects.filter(is_active=False).count(),
        'panel_pending_drivers': DeliveryProfile.objects.filter(
            verification_status=DeliveryProfile.VerificationStatus.PENDING,
        ).count(),
        'panel_pending_disputes': OrderDispute.objects.filter(
            status=DisputeStatus.PENDING,
        ).count(),
    }

from ..models import CashRegister, CashSession, CashSessionStatus


def registers_for_restaurant(restaurant):
    return CashRegister.objects.filter(restaurant=restaurant, is_active=True).order_by('name')


def open_sessions_for_restaurant(restaurant):
    return (
        CashSession.objects.filter(restaurant=restaurant, status=CashSessionStatus.OPEN)
        .select_related('cash_register', 'opened_by')
        .order_by('-opened_at')
    )


def session_for_restaurant(*, restaurant, session_id: int):
    return (
        CashSession.objects.filter(pk=session_id, restaurant=restaurant)
        .select_related('cash_register', 'opened_by', 'closed_by')
        .first()
    )

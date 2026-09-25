"""Tickets de reembolso cuando ya hay una transferencia confirmada."""

from orders.models import (
    DisputeStatus,
    Order,
    OrderDispute,
    PaymentMethod,
    PaymentStatus,
)


def open_paid_transfer_refund_ticket(order: Order, reason: str) -> OrderDispute | None:
    """Crea (o reusa) una disputa para que ops devuelva el SPEI a mano."""
    if (
        order.payment_method != PaymentMethod.TRANSFER
        or order.payment_status != PaymentStatus.PAID
        or not order.customer_id
    ):
        return None
    existing = order.disputes.filter(
        status__in=[DisputeStatus.PENDING, DisputeStatus.APPROVED],
    ).first()
    if existing:
        return existing
    dispute = OrderDispute.objects.create(
        order=order,
        customer_id=order.customer_id,
        reason=reason,
        requested_amount=order.total,
    )
    try:
        from accounts.notifications import notify_ops_refund_ticket

        notify_ops_refund_ticket(order, dispute)
    except Exception:
        pass
    return dispute

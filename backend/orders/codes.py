import secrets

# Sin 0/O, 1/I/L para leerlos bien en WhatsApp o por teléfono.
ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
ORDER_CODE_LENGTH = 6


def generate_order_code(length: int = ORDER_CODE_LENGTH) -> str:
    return ''.join(secrets.choice(ORDER_CODE_ALPHABET) for _ in range(length))


def assign_unique_order_code(order) -> None:
    """Asigna un código único al pedido si aún no tiene."""
    if order.code:
        return

    from .models import Order

    for _ in range(32):
        code = generate_order_code()
        if Order.objects.filter(code=code).exists():
            continue
        order.code = code
        return

    raise RuntimeError('No se pudo generar un código único para el pedido.')

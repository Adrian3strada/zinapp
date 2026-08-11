"""Inventario ligero para POS (opcional por producto)."""

from __future__ import annotations

from django.db import transaction
from django.db.models import F

from restaurants.models import Product

from ..exceptions import PosError


def assert_stock_available(product: Product, quantity: int) -> None:
    if not product.track_inventory:
        return
    if quantity < 1:
        raise PosError('Cantidad inválida.')
    if product.stock_quantity < quantity:
        raise PosError(
            f'«{product.name}» no tiene suficiente stock '
            f'(disponible: {product.stock_quantity}).'
        )


@transaction.atomic
def decrement_stock_for_lines(line_rows: list[tuple]) -> None:
    """
    line_rows: iterable de (product, quantity, ...)
    Bloquea filas de producto y descuenta si track_inventory.
    """
    # Agrupar por producto por si hay líneas repetidas
    needed: dict[int, int] = {}
    products: dict[int, Product] = {}
    for row in line_rows:
        product = row[0]
        quantity = int(row[1])
        products[product.id] = product
        needed[product.id] = needed.get(product.id, 0) + quantity

    if not needed:
        return

    locked = {
        p.id: p
        for p in Product.objects.select_for_update().filter(pk__in=needed.keys())
    }
    for product_id, qty in needed.items():
        product = locked.get(product_id) or products[product_id]
        if not product.track_inventory:
            continue
        if product.stock_quantity < qty:
            raise PosError(
                f'«{product.name}» no tiene suficiente stock '
                f'(disponible: {product.stock_quantity}).'
            )
        Product.objects.filter(pk=product.id).update(
            stock_quantity=F('stock_quantity') - qty,
        )


@transaction.atomic
def restore_stock_for_order(order) -> None:
    """Devuelve stock de ítems de una venta POS cancelada."""
    items = list(order.items.select_related('product'))
    product_ids = [i.product_id for i in items if i.product_id]
    if not product_ids:
        return
    locked = {
        p.id: p
        for p in Product.objects.select_for_update().filter(pk__in=product_ids)
    }
    for item in items:
        product = locked.get(item.product_id)
        if not product or not product.track_inventory:
            continue
        Product.objects.filter(pk=product.id).update(
            stock_quantity=F('stock_quantity') + item.quantity,
        )

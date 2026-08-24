"""Reconstruir carrito desde un pedido usando precios y opciones actuales."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from restaurants.options import resolve_selected_options
from restaurants.serializers import ProductSerializer


def _option_error_text(exc: serializers.ValidationError) -> str:
    detail = getattr(exc, 'detail', None)
    if isinstance(detail, dict):
        parts = []
        for value in detail.values():
            if isinstance(value, (list, tuple)):
                parts.extend(str(item) for item in value)
            else:
                parts.append(str(value))
        if parts:
            return ' '.join(parts)
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return 'Una modificación de este platillo ya no está disponible.'


def build_reorder_preview(order, request) -> dict:
    restaurant = order.restaurant
    unavailable: list[dict] = []
    items: list[dict] = []

    if not restaurant or not restaurant.is_active:
        return {
            'ok': False,
            'reason': 'restaurant_inactive',
            'detail': 'Este restaurante ya no está disponible en ZinApp.',
            'restaurant_id': restaurant.id if restaurant else None,
            'restaurant_name': restaurant.name if restaurant else 'Restaurante',
            'restaurant_is_open': False,
            'items': [],
            'unavailable': [{
                'name': restaurant.name if restaurant else 'Restaurante',
                'reason': 'El restaurante ya no está activo.',
            }],
            'current_subtotal': '0.00',
        }

    lines = list(order.items.select_related('product', 'product__restaurant').all())
    product_ids = [line.product_id for line in lines if line.product_id]
    from restaurants.models import Product, ProductOption, ProductOptionGroup
    from django.db.models import Prefetch

    products_by_id = {
        product.id: product
        for product in Product.objects.filter(id__in=product_ids).prefetch_related(
            Prefetch(
                'option_groups',
                queryset=ProductOptionGroup.objects.prefetch_related(
                    Prefetch(
                        'options',
                        queryset=ProductOption.objects.order_by('sort_order', 'id'),
                    )
                ).order_by('sort_order', 'id'),
            )
        )
    }

    subtotal = Decimal('0.00')
    for line in lines:
        product = products_by_id.get(line.product_id) or line.product
        display_name = product.name if product else 'Platillo'
        if not product or not product.is_available or not product.restaurant_id:
            unavailable.append({
                'name': display_name,
                'reason': f'«{display_name}» ya no está disponible.',
            })
            continue
        if product.restaurant_id != restaurant.id:
            unavailable.append({
                'name': display_name,
                'reason': f'«{display_name}» ya no pertenece a este restaurante.',
            })
            continue

        wanted_ids: list[int] = []
        missing_names: list[str] = []
        for opt in line.selected_options or []:
            if not isinstance(opt, dict):
                continue
            opt_id = opt.get('id')
            if opt_id is None:
                continue
            try:
                wanted_ids.append(int(opt_id))
            except (TypeError, ValueError):
                continue
            missing_names.append(str(opt.get('name') or opt_id))

        available_ids = {
            opt.id
            for group in product.option_groups.all()
            for opt in group.options.all()
            if opt.is_available
        }
        kept_ids = [oid for oid in wanted_ids if oid in available_ids]
        dropped = [
            name
            for oid, name in zip(wanted_ids, missing_names)
            if oid not in available_ids
        ]

        try:
            snapshot, extra = resolve_selected_options(product, kept_ids)
        except serializers.ValidationError as exc:
            reason = _option_error_text(exc)
            if dropped:
                reason = f'{reason} Ya no existe: {", ".join(dropped)}.'
            unavailable.append({'name': display_name, 'reason': reason})
            continue

        quantity = max(int(line.quantity or 1), 1)
        unit = (product.price + extra).quantize(Decimal('0.01'))
        line_total = (unit * quantity).quantize(Decimal('0.01'))
        subtotal += line_total
        warnings = [f'Ya no está disponible: {name}' for name in dropped] if dropped else []
        items.append({
            'product': ProductSerializer(product, context={'request': request}).data,
            'quantity': quantity,
            'notes': (line.notes or '').strip()[:255],
            'selected_options': snapshot,
            'current_unit_price': f'{unit:.2f}',
            'warnings': warnings,
        })

    if not items:
        return {
            'ok': False,
            'reason': 'no_items',
            'detail': 'Ningún platillo de este pedido se puede volver a pedir.',
            'restaurant_id': restaurant.id,
            'restaurant_name': restaurant.name,
            'restaurant_is_open': restaurant.is_open_now(),
            'items': [],
            'unavailable': unavailable,
            'current_subtotal': '0.00',
        }

    return {
        'ok': True,
        'reason': None,
        'detail': None,
        'restaurant_id': restaurant.id,
        'restaurant_name': restaurant.name,
        'restaurant_is_open': restaurant.is_open_now(),
        'items': items,
        'unavailable': unavailable,
        'current_subtotal': f'{subtotal:.2f}',
    }

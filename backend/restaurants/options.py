"""Validación y snapshot de opciones de producto (sabores / toppings)."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from rest_framework import serializers

from .models import Product, ProductOption


def resolve_selected_options(
    product: Product,
    option_ids: list[int] | None,
) -> tuple[list[dict], Decimal]:
    """
    Valida option_ids contra los grupos del producto.
    Devuelve (snapshot JSON-serializable, suma de price_delta).
    """
    ids = [int(x) for x in (option_ids or []) if x is not None]
    if len(ids) != len(set(ids)):
        raise serializers.ValidationError({
            'option_ids': 'Hay opciones duplicadas.',
        })

    groups = list(
        product.option_groups.prefetch_related('options').order_by('sort_order', 'id')
    )
    if not groups:
        if ids:
            raise serializers.ValidationError({
                'option_ids': 'Este platillo no tiene opciones configuradas.',
            })
        return [], Decimal('0.00')

    available = {
        opt.id: opt
        for group in groups
        for opt in group.options.all()
        if opt.is_available
    }

    unknown = [oid for oid in ids if oid not in available]
    if unknown:
        raise serializers.ValidationError({
            'option_ids': f'Opciones no válidas: {unknown}.',
        })

    by_group: dict[int, list[ProductOption]] = defaultdict(list)
    for oid in ids:
        opt = available[oid]
        by_group[opt.group_id].append(opt)

    for group in groups:
        selected = by_group.get(group.id, [])
        count = len(selected)
        if count < group.min_select:
            raise serializers.ValidationError({
                'option_ids': (
                    f'Elige al menos {group.min_select} en «{group.name}».'
                ),
            })
        if count > group.max_select:
            raise serializers.ValidationError({
                'option_ids': (
                    f'Máximo {group.max_select} en «{group.name}».'
                ),
            })

    snapshot: list[dict] = []
    extra = Decimal('0.00')
    for group in groups:
        for opt in sorted(by_group.get(group.id, []), key=lambda o: (o.sort_order, o.id)):
            delta = Decimal(opt.price_delta)
            extra += delta
            snapshot.append({
                'id': opt.id,
                'group_id': group.id,
                'group': group.name,
                'name': opt.name,
                'price_delta': f'{delta:.2f}',
            })

    return snapshot, extra.quantize(Decimal('0.01'))


def replace_product_option_groups(product: Product, groups_data: list[dict]) -> None:
    """Reemplaza todos los grupos/opciones del producto (transacción externa)."""
    product.option_groups.all().delete()
    for g_idx, group_data in enumerate(groups_data):
        name = (group_data.get('name') or '').strip()
        if not name:
            raise serializers.ValidationError({
                'groups': 'Cada grupo necesita un nombre.',
            })
        min_select = int(group_data.get('min_select', 1))
        max_select = int(group_data.get('max_select', 1))
        if min_select < 0 or max_select < 1 or min_select > max_select:
            raise serializers.ValidationError({
                'groups': f'Rangos inválidos en «{name}» (min/max).',
            })
        options_data = group_data.get('options') or []
        if not options_data:
            raise serializers.ValidationError({
                'groups': f'El grupo «{name}» necesita al menos una opción.',
            })
        if max_select > len(options_data):
            max_select = len(options_data)

        group = product.option_groups.create(
            name=name[:80],
            min_select=min_select,
            max_select=max_select,
            sort_order=int(group_data.get('sort_order', g_idx)),
        )
        for o_idx, opt_data in enumerate(options_data):
            opt_name = (opt_data.get('name') or '').strip()
            if not opt_name:
                raise serializers.ValidationError({
                    'groups': f'Opción sin nombre en «{name}».',
                })
            try:
                delta = Decimal(str(opt_data.get('price_delta', '0') or '0'))
            except Exception as exc:
                raise serializers.ValidationError({
                    'groups': f'Precio inválido en «{opt_name}».',
                }) from exc
            if delta < 0:
                raise serializers.ValidationError({
                    'groups': f'El extra de «{opt_name}» no puede ser negativo.',
                })
            group.options.create(
                name=opt_name[:80],
                price_delta=delta.quantize(Decimal('0.01')),
                is_available=bool(opt_data.get('is_available', True)),
                sort_order=int(opt_data.get('sort_order', o_idx)),
            )

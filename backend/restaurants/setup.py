"""Estado de configuración de un restaurante antes de operar en producción."""


def restaurant_setup_status(restaurant) -> dict:
    available_products = restaurant.products.filter(is_available=True).count()
    has_logo = bool(restaurant.image)
    has_hours = bool(restaurant.opening_time and restaurant.closing_time)
    has_location = (
        restaurant.latitude is not None
        and restaurant.longitude is not None
        and restaurant.location_pinned
    )

    steps = [
        {
            'key': 'menu',
            'label': 'Al menos un platillo en el menú',
            'done': available_products >= 1,
        },
        {
            'key': 'profile',
            'label': 'Logo o foto del local',
            'done': has_logo,
        },
        {
            'key': 'hours',
            'label': 'Horario de apertura',
            'done': has_hours,
        },
        {
            'key': 'location',
            'label': 'Ubicación exacta en mapa',
            'done': has_location,
        },
    ]
    done_count = sum(1 for s in steps if s['done'])
    complete = done_count == len(steps)

    return {
        'steps': steps,
        'done_count': done_count,
        'total_count': len(steps),
        'complete': complete,
        'ready_for_orders': complete and restaurant.is_active and restaurant.accepting_orders,
    }

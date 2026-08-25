"""Helpers for consistent panel page metadata (title, nav, breadcrumbs)."""

NAV_GROUPS = {
    'home': '',
    'orders': 'operacion',
    'disputes': 'operacion',
    'shipments': 'operacion',
    'restaurants': 'negocios',
    'products': 'negocios',
    'local-services': 'negocios',
    'customers': 'personas',
    'drivers': 'personas',
    'promotions': 'marketing',
    'coupons': 'marketing',
    'reviews': 'marketing',
    'reports': '',
    'users': 'sistema',
    'gestion': 'sistema',
}


def page_context(title, nav, *, subtitle='', breadcrumbs=None, nav_group=None):
    return {
        'page_title': title,
        'nav': nav,
        'nav_group': NAV_GROUPS.get(nav, '') if nav_group is None else nav_group,
        'page_subtitle': subtitle,
        'breadcrumbs': breadcrumbs or [],
    }

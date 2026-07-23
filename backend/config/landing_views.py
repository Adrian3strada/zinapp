from django.conf import settings
from django.db import OperationalError
from django.views.generic import TemplateView


def _whatsapp_link(raw: str) -> str:
    digits = ''.join(c for c in (raw or '') if c.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        digits = f'52{digits}'
    return f'https://wa.me/{digits}'


def _format_schedule(opening, closing) -> str:
    if not opening or not closing:
        return 'Consulta horario en la app'
    return f'{opening.strftime("%H:%M")} – {closing.strftime("%H:%M")}'


def _category_label(choices, value: str) -> str:
    return dict(choices).get(value, value or 'Local')


def _restaurant_cards(limit: int = 6) -> list[dict]:
    """Negocios reales desde restaurantes activos."""
    try:
        from restaurants.models import Restaurant, RestaurantCategory
    except Exception:
        return []

    try:
        restaurants = list(
            Restaurant.objects.filter(is_active=True).order_by('name')[:limit]
        )
    except (OperationalError, Exception):
        # Landing no debe fallar si la BD no responde.
        return []

    cards = []
    for r in restaurants:
        image_url = ''
        if r.image:
            try:
                image_url = r.image.url
            except ValueError:
                image_url = ''
        cards.append(
            {
                'id': f'restaurant-{r.pk}',
                'name': r.name,
                'category': _category_label(RestaurantCategory.choices, r.category),
                'schedule': _format_schedule(r.opening_time, r.closing_time),
                'location': (r.address or 'Zinapécuaro').strip(),
                'image_url': image_url,
                'cta_label': 'Pedir ahora',
                'cta_url': settings.LANDING_APP_URL,
                'source': 'restaurant',
                'is_demo': False,
            }
        )
    return cards


def _service_cards(limit: int = 6) -> list[dict]:
    """Negocios reales desde servicios locales activos."""
    try:
        from local_services.models import LocalService, LocalServiceCategory
    except Exception:
        return []

    try:
        services = list(
            LocalService.objects.filter(is_active=True)
            .order_by('sort_order', 'name')[:limit]
        )
    except (OperationalError, Exception):
        return []

    cards = []
    for s in services:
        image_url = ''
        if s.logo:
            try:
                image_url = s.logo.url
            except ValueError:
                image_url = ''
        cards.append(
            {
                'id': f'service-{s.pk}',
                'name': s.name,
                'category': _category_label(LocalServiceCategory.choices, s.category),
                'schedule': (s.schedule or 'Consulta horario en la app').strip(),
                'location': (s.address or 'Zinapécuaro').strip(),
                'image_url': image_url,
                'cta_label': 'Ver negocio',
                'cta_url': settings.LANDING_APP_URL,
                'source': 'service',
                'is_demo': False,
            }
        )
    return cards


def _demo_featured_businesses() -> list[dict]:
    """Ejemplos claramente marcados cuando aún no hay datos en el backend."""
    return [
        {
            'id': 'demo-1',
            'name': 'Ejemplo: Taquería El Centro',
            'category': 'Comida',
            'schedule': '11:00 – 22:00',
            'location': 'Centro, Zinapécuaro',
            'image_url': '',
            'cta_label': 'Pedir ahora',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
        },
        {
            'id': 'demo-2',
            'name': 'Ejemplo: Salon María Belleza',
            'category': 'Servicios',
            'schedule': 'Lun–Sáb 10:00–19:00',
            'location': 'Col. Independencia',
            'image_url': '',
            'cta_label': 'Ver negocio',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
        },
        {
            'id': 'demo-3',
            'name': 'Ejemplo: Abarrotes Don Luis',
            'category': 'Comercio',
            'schedule': '8:00 – 21:00',
            'location': 'Av. Principal',
            'image_url': '',
            'cta_label': 'Ver negocio',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
        },
    ]


def _featured_businesses(limit: int = 6) -> tuple[list[dict], bool]:
    """Combina restaurantes y servicios; si no hay, usa demos."""
    restaurants = _restaurant_cards(limit=limit)
    services = _service_cards(limit=limit)
    combined = []
    r_i = s_i = 0
    while len(combined) < limit and (r_i < len(restaurants) or s_i < len(services)):
        if r_i < len(restaurants):
            combined.append(restaurants[r_i])
            r_i += 1
        if len(combined) >= limit:
            break
        if s_i < len(services):
            combined.append(services[s_i])
            s_i += 1
    if combined:
        return combined, False
    return _demo_featured_businesses()[:limit], True


def _social_url(platform: str, raw: str) -> str:
    value = (raw or '').strip()
    if not value:
        return ''
    if value.startswith('http://') or value.startswith('https://'):
        return value
    handle = value.lstrip('@')
    if platform == 'instagram':
        return f'https://instagram.com/{handle}'
    if platform == 'facebook':
        return f'https://facebook.com/{handle}'
    return value


class LandingView(TemplateView):
    template_name = 'landing/home.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        whatsapp = (settings.SUPPORT_WHATSAPP or '').strip()
        featured, using_demo = _featured_businesses(limit=6)
        register_msg = (
            'Hola, quiero registrar mi negocio en ZinApp Zinapécuaro.\n\n'
            'Nombre del negocio:\n'
            'Giro / categoría:\n'
            'Teléfono / WhatsApp:\n'
            'Horario:\n'
            'Dirección:'
        )
        ctx.update(
            {
                'app_url': settings.LANDING_APP_URL or '/app/',
                'app_store_url': settings.APP_STORE_URL,
                'play_store_url': settings.PLAY_STORE_URL,
                'whatsapp_url': _whatsapp_link(whatsapp),
                'support_email': settings.SUPPORT_EMAIL,
                'support_phone': settings.SUPPORT_PHONE,
                'social_instagram_url': _social_url('instagram', settings.SOCIAL_INSTAGRAM),
                'social_facebook_url': _social_url('facebook', settings.SOCIAL_FACEBOOK),
                'terms_url': settings.TERMS_URL,
                'register_whatsapp_text': register_msg,
                'featured_businesses': featured,
                'featured_is_demo': using_demo,
            }
        )
        return ctx

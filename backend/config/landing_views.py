from datetime import date, time
import json
import re

from django.conf import settings
from django.db import OperationalError
from django.http import HttpResponse
from django.views.generic import TemplateView

from .seo import get_site_url


# Preguntas visibles en landing/includes/faq.html — misma fuente para Schema FAQPage.
LANDING_FAQS = [
    {
        'question': '¿Necesito descargar ZinApp?',
        'answer': (
            'Puedes usarla desde el navegador en zinapp.com.mx/app. '
            'En iPhone también puedes instalarla desde App Store. '
            'En Android, mientras la ficha de Google Play no esté pública, '
            'usa ZinApp en el navegador.'
        ),
    },
    {
        'question': '¿Cómo registro mi negocio?',
        'answer': (
            'Usa el botón Registrar mi negocio. Te guiaremos por WhatsApp según '
            'la modalidad (Servicios o Restaurantes y pedidos).'
        ),
    },
    {
        'question': '¿Qué incluye la modalidad Servicios?',
        'answer': (
            'Publicación del negocio, contacto, horario, dirección y ubicación en Google Maps. '
            'Para registrarte o conocer las condiciones actuales, contáctanos por WhatsApp.'
        ),
    },
    {
        'question': '¿Cómo funciona la comisión para restaurantes?',
        'answer': (
            'No hay mensualidad. Los precios publicados en ZinApp incluyen un 10% adicional. '
            'El restaurante recibe el precio original de sus productos y ZinApp conserva el 10% como comisión.'
        ),
    },
    {
        'question': '¿Cómo hago un pedido?',
        'answer': (
            'Abre ZinApp, elige un restaurante, arma tu pedido y confirma. '
            'Puedes recibir a domicilio (con repartidor) o seguir las indicaciones del local.'
        ),
    },
    {
        'question': '¿Cómo contacto a ZinApp?',
        'answer': (
            'Escríbenos por WhatsApp desde la sección Contacto. '
            'Ahí también verás correo, teléfono o redes si están configurados.'
        ),
    },
]


def _whatsapp_link(raw: str) -> str:
    digits = ''.join(c for c in (raw or '') if c.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        digits = f'52{digits}'
    return f'https://wa.me/{digits}'


_DAY_SHORT = {
    0: 'Lun',
    1: 'Mar',
    2: 'Mié',
    3: 'Jue',
    4: 'Vie',
    5: 'Sáb',
    6: 'Dom',
}


def _format_clock(value: time) -> str:
    hour = value.hour % 12 or 12
    minute = value.strftime('%M')
    suffix = 'a. m.' if value.hour < 12 else 'p. m.'
    return f'{hour}:{minute} {suffix}'


def _format_schedule(opening, closing) -> str:
    if not opening or not closing:
        return 'Horario no disponible'
    return f'{_format_clock(opening)}–{_format_clock(closing)}'


def _format_business_hours(hours) -> str:
    """Resume días consecutivos con el mismo horario."""
    open_days = [
        h for h in hours
        if not getattr(h, 'is_closed', False) and h.opening_time and h.closing_time
    ]
    if not open_days:
        return 'Horario no disponible'

    open_days.sort(key=lambda h: h.day_of_week)
    groups: list[tuple[int, int, time, time]] = []
    start = prev = open_days[0]
    for current in open_days[1:]:
        same_hours = (
            current.opening_time == start.opening_time
            and current.closing_time == start.closing_time
        )
        consecutive = current.day_of_week == prev.day_of_week + 1
        if same_hours and consecutive:
            prev = current
            continue
        groups.append((start.day_of_week, prev.day_of_week, start.opening_time, start.closing_time))
        start = prev = current
    groups.append((start.day_of_week, prev.day_of_week, start.opening_time, start.closing_time))

    parts = []
    for day_from, day_to, opening, closing in groups[:3]:
        if day_from == day_to:
            label = _DAY_SHORT.get(day_from, str(day_from))
        else:
            label = f'{_DAY_SHORT.get(day_from, day_from)}–{_DAY_SHORT.get(day_to, day_to)}'
        parts.append(f'{label} · {_format_schedule(opening, closing)}')
    return ' · '.join(parts)


def _shorten_schedule_text(raw: str) -> str:
    text = re.sub(r'\s+', ' ', (raw or '').strip())
    if not text:
        return 'Horario no disponible'
    if len(text) > 72:
        return text[:69].rstrip(' ,;.') + '…'
    return text


def _category_label(choices, value: str, *, fallback: str = 'Local') -> str:
    label = dict(choices).get(value, value or fallback)
    if (label or '').strip().lower() == 'general':
        return fallback
    return label or fallback


def _restaurant_cards(limit: int = 6) -> list[dict]:
    """Negocios reales desde restaurantes activos."""
    try:
        from restaurants.models import Restaurant, RestaurantCategory
    except Exception:
        return []

    try:
        restaurants = list(
            Restaurant.objects.filter(is_active=True)
            .prefetch_related('business_hours')
            .order_by('name')[:limit]
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
        hours = list(r.business_hours.all())
        if hours:
            schedule = _format_business_hours(hours)
        else:
            schedule = _format_schedule(r.opening_time, r.closing_time)
        cards.append(
            {
                'id': f'restaurant-{r.pk}',
                'name': r.name,
                'category': _category_label(
                    RestaurantCategory.choices,
                    r.category,
                    fallback='Restaurante',
                ),
                'schedule': schedule,
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
                'category': _category_label(
                    LocalServiceCategory.choices,
                    s.category,
                    fallback='Servicio',
                ),
                'schedule': _shorten_schedule_text(s.schedule),
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
            'category': 'Restaurante',
            'schedule': 'Lun–Dom · 11:00 a. m.–10:00 p. m.',
            'location': 'Centro, Zinapécuaro',
            'image_url': '',
            'cta_label': 'Pedir ahora',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
        },
        {
            'id': 'demo-2',
            'name': 'Ejemplo: Salón María Belleza',
            'category': 'Servicio',
            'schedule': 'Lun–Sáb · 10:00 a. m.–7:00 p. m.',
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
            'schedule': 'Lun–Dom · 8:00 a. m.–9:00 p. m.',
            'location': 'Av. Principal',
            'image_url': '',
            'cta_label': 'Ver negocio',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
        },
    ]


def _live_trust_metrics() -> dict:
    """Métricas reales opcionales; ocultas sin flag o sin datos."""
    empty = {
        'business_count': None,
        'order_count': None,
        'show_metrics': False,
        'testimonials': [],
        'active_promotions': [],
    }
    if not getattr(settings, 'LANDING_SHOW_LIVE_STATS', False):
        return empty
    business_count = 0
    order_count = 0
    try:
        from restaurants.models import Restaurant
        business_count += Restaurant.objects.filter(is_active=True).count()
    except Exception:
        pass
    try:
        from local_services.models import LocalService
        business_count += LocalService.objects.filter(is_active=True).count()
    except Exception:
        pass
    try:
        from orders.models import Order
        order_count = Order.objects.count()
    except Exception:
        pass
    # testimonials / active_promotions: reservados para datos reales futuros (sin inventar).
    return {
        'business_count': business_count if business_count > 0 else None,
        'order_count': order_count if order_count > 0 else None,
        'show_metrics': business_count > 0 or order_count > 0,
        'testimonials': [],
        'active_promotions': [],
    }


def _play_store_context() -> dict:
    enabled = bool(getattr(settings, 'GOOGLE_PLAY_ENABLED', False))
    url = (getattr(settings, 'PLAY_STORE_URL', '') or '').strip()
    if enabled and url:
        return {'google_play_enabled': True, 'play_store_url': url}
    return {'google_play_enabled': False, 'play_store_url': ''}


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
        site_url = get_site_url()
        logo_url = f'{site_url}/static/dashboard/img/logo-on-blue.png'
        same_as = [
            u for u in (
                _social_url('instagram', settings.SOCIAL_INSTAGRAM),
                _social_url('facebook', settings.SOCIAL_FACEBOOK),
            )
            if u
        ]
        organization = {
            '@type': 'Organization',
            '@id': f'{site_url}/#organization',
            'name': 'ZinApp',
            'url': f'{site_url}/',
            'logo': logo_url,
            'description': (
                'ZinApp es una app local de pedidos, entregas, restaurantes, '
                'comercios y servicios locales en Zinapécuaro, Michoacán.'
            ),
            'areaServed': {
                '@type': 'City',
                'name': 'Zinapécuaro',
                'address': {
                    '@type': 'PostalAddress',
                    'addressLocality': 'Zinapécuaro',
                    'addressRegion': 'Michoacán',
                    'addressCountry': 'MX',
                },
            },
            'contactPoint': {
                '@type': 'ContactPoint',
                'contactType': 'customer support',
                'areaServed': 'MX',
                'availableLanguage': 'Spanish',
                **(
                    {'telephone': settings.SUPPORT_PHONE}
                    if settings.SUPPORT_PHONE
                    else {}
                ),
                **(
                    {'email': settings.SUPPORT_EMAIL}
                    if settings.SUPPORT_EMAIL
                    else {}
                ),
            },
        }
        if same_as:
            organization['sameAs'] = same_as

        seo_graph = [
            organization,
            {
                '@type': 'WebSite',
                '@id': f'{site_url}/#website',
                'url': f'{site_url}/',
                'name': 'ZinApp',
                'publisher': {'@id': f'{site_url}/#organization'},
                'inLanguage': 'es-MX',
            },
            {
                '@type': 'SoftwareApplication',
                '@id': f'{site_url}/#app',
                'name': 'ZinApp',
                'applicationCategory': 'LifestyleApplication',
                'operatingSystem': 'Android, iOS, Web',
                'url': f'{site_url}/app/',
                'description': (
                    'Aplicación local para pedir comida, encontrar servicios, descubrir negocios '
                    'locales y coordinar entregas en Zinapécuaro, Michoacán.'
                ),
                'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'MXN'},
                'publisher': {'@id': f'{site_url}/#organization'},
            },
            {
                '@type': 'LocalBusiness',
                '@id': f'{site_url}/#local-business',
                'name': 'ZinApp',
                'url': f'{site_url}/',
                'image': logo_url,
                'description': 'Plataforma local de pedidos, entregas y servicios para Zinapécuaro, Michoacán.',
                'address': {
                    '@type': 'PostalAddress',
                    'addressLocality': 'Zinapécuaro',
                    'addressRegion': 'Michoacán',
                    'addressCountry': 'MX',
                },
                'areaServed': 'Zinapécuaro, Michoacán',
                'priceRange': '$',
            },
            {
                '@type': 'FAQPage',
                '@id': f'{site_url}/#faq',
                'mainEntity': [
                    {
                        '@type': 'Question',
                        'name': item['question'],
                        'acceptedAnswer': {
                            '@type': 'Answer',
                            'text': item['answer'],
                        },
                    }
                    for item in LANDING_FAQS
                ],
            },
        ]
        play = _play_store_context()
        ctx.update(
            {
                'site_url': site_url,
                'seo_logo_url': logo_url,
                'landing_faqs': LANDING_FAQS,
                'seo_json_ld': json.dumps(
                    {'@context': 'https://schema.org', '@graph': seo_graph},
                    ensure_ascii=False,
                    separators=(',', ':'),
                ),
                'app_url': settings.LANDING_APP_URL or '/app/',
                'app_store_url': settings.APP_STORE_URL,
                'google_play_enabled': play['google_play_enabled'],
                'play_store_url': play['play_store_url'],
                'whatsapp_url': _whatsapp_link(whatsapp),
                'support_email': settings.SUPPORT_EMAIL,
                'support_phone': settings.SUPPORT_PHONE,
                'social_instagram_url': _social_url('instagram', settings.SOCIAL_INSTAGRAM),
                'social_facebook_url': _social_url('facebook', settings.SOCIAL_FACEBOOK),
                'terms_url': settings.TERMS_URL,
                'register_whatsapp_text': register_msg,
                'featured_businesses': featured,
                'featured_is_demo': using_demo,
                'trust_metrics': _live_trust_metrics(),
            }
        )
        return ctx


def robots_txt(request):
    site = get_site_url()
    body = '\n'.join([
        'User-agent: *',
        'Allow: /',
        'Allow: /privacidad/',
        'Disallow: /admin/',
        'Disallow: /panel/',
        'Disallow: /api/',
        'Disallow: /app/',
        'Disallow: /media/',
        f'Sitemap: {site}/sitemap.xml',
        '',
    ])
    response = HttpResponse(body, content_type='text/plain; charset=utf-8')
    response['Cache-Control'] = 'public, max-age=3600'
    return response


def sitemap_xml(request):
    site = get_site_url()
    today = date.today().isoformat()
    urls = [
        (f'{site}/', 'weekly', '1.0'),
        (f'{site}/privacidad/', 'yearly', '0.4'),
    ]
    items = []
    for loc, freq, prio in urls:
        items.append(
            f'''  <url>
    <loc>{loc}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>'''
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(items)
        + '\n</urlset>\n'
    )
    response = HttpResponse(body, content_type='application/xml; charset=utf-8')
    response['Cache-Control'] = 'public, max-age=3600'
    return response

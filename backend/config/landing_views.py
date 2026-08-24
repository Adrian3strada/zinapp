from datetime import date, time
import json
import re

from django.conf import settings
from django.db import OperationalError
from django.http import HttpResponse
from django.views.generic import TemplateView

from .seo import get_contact_email, get_site_url

SEO_TITLE = 'Comida a domicilio en Zinapécuaro | ZinApp'
SEO_DESCRIPTION = (
    'Pide comida a domicilio en Zinapécuaro. Restaurantes, negocios locales, '
    'servicios y promociones en una sola app hecha para el pueblo.'
)


def get_landing_faqs(*, google_play_enabled: bool) -> list[dict]:
    """Preguntas visibles en faq.html — misma fuente para Schema FAQPage."""
    if google_play_enabled:
        download_answer = (
            'Puedes usarla en el navegador o instalarla desde App Store y Google Play.'
        )
    else:
        download_answer = (
            'Puedes usarla en el navegador en zinapp.com.mx/app. '
            'En iPhone también está en App Store. '
            'En Android úsala desde el navegador hasta que esté en Google Play.'
        )
    return [
        {
            'question': '¿Necesito descargar ZinApp?',
            'answer': download_answer,
        },
        {
            'question': '¿Cómo hago un pedido?',
            'answer': (
                'Abre ZinApp, elige un restaurante, arma tu pedido y confirma. '
                'Puedes recibirlo a domicilio o recogerlo en el local.'
            ),
        },
        {
            'question': '¿Cómo registro mi negocio?',
            'answer': (
                'Toca Registrar mi negocio y te guiamos por WhatsApp. '
                'Hay modalidad Servicios y modalidad Restaurantes y pedidos.'
            ),
        },
        {
            'question': '¿Qué incluye la modalidad Servicios?',
            'answer': (
                'Publicamos tu negocio con contacto, horario, dirección '
                'y ubicación en Google Maps.'
            ),
        },
        {
            'question': '¿Cómo funciona la comisión para restaurantes?',
            'answer': (
                'No hay mensualidad. El precio en ZinApp incluye un 10% adicional. '
                'El restaurante recibe su precio original; ZinApp conserva ese 10%.'
            ),
        },
        {
            'question': '¿Cómo contacto a ZinApp?',
            'answer': (
                'Escríbenos por WhatsApp desde Contacto. '
                'Ahí también verás correo o teléfono si están disponibles.'
            ),
        },
    ]


# Compatibilidad con imports/tests que esperan el nombre anterior.
LANDING_FAQS = get_landing_faqs(google_play_enabled=False)


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


def _shorten_text(raw: str, limit: int = 110) -> str:
    text = re.sub(r'\s+', ' ', (raw or '').strip())
    if not text:
        return ''
    if len(text) > limit:
        return text[: limit - 1].rstrip(' ,;.') + '…'
    return text


def _media_url(field) -> str:
    if not field:
        return ''
    try:
        return field.url
    except ValueError:
        return ''


def _sort_images_first(cards: list[dict]) -> list[dict]:
    return sorted(cards, key=lambda c: (0 if c.get('image_url') else 1, (c.get('name') or '').lower()))


def _category_label(choices, value: str, *, fallback: str = 'Local') -> str:
    label = dict(choices).get(value, value or fallback)
    if (label or '').strip().lower() == 'general':
        return fallback
    return label or fallback


def _restaurant_cards(limit: int = 6, *, order_by: str = 'name') -> list[dict]:
    """Negocios reales desde restaurantes activos."""
    try:
        from restaurants.models import Restaurant, RestaurantCategory
    except Exception:
        return []

    try:
        restaurants = list(
            Restaurant.objects.filter(is_active=True)
            .prefetch_related('business_hours')
            .order_by(order_by)[:limit]
        )
    except (OperationalError, Exception):
        # Landing no debe fallar si la BD no responde.
        return []

    cards = []
    for r in restaurants:
        image_url = _media_url(r.image)
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
                'description': _shorten_text(r.description),
                'schedule': schedule,
                'location': (r.address or 'Zinapécuaro').strip(),
                'image_url': image_url,
                'image_fit': 'cover' if image_url else '',
                'image_alt': f'{r.name}, restaurante en Zinapécuaro',
                'cta_label': 'Pedir ahora',
                'cta_url': settings.LANDING_APP_URL,
                'source': 'restaurant',
                'is_demo': False,
                'created_at': r.created_at.isoformat() if r.created_at else '',
            }
        )
    return cards


def _service_cards(limit: int = 6, *, order_by: str | None = None) -> list[dict]:
    """Negocios reales desde servicios locales activos."""
    try:
        from local_services.models import LocalService, LocalServiceCategory
    except Exception:
        return []

    try:
        qs = LocalService.objects.filter(is_active=True)
        if order_by:
            qs = qs.order_by(order_by)
        else:
            qs = qs.order_by('sort_order', 'name')
        services = list(qs[:limit])
    except (OperationalError, Exception):
        return []

    cards = []
    for s in services:
        image_url = _media_url(s.logo)
        cards.append(
            {
                'id': f'service-{s.pk}',
                'name': s.name,
                'category': _category_label(
                    LocalServiceCategory.choices,
                    s.category,
                    fallback='Servicio',
                ),
                'description': _shorten_text(s.description),
                'schedule': _shorten_schedule_text(s.schedule),
                'location': (s.address or 'Zinapécuaro').strip(),
                'image_url': image_url,
                'image_fit': 'contain' if image_url else '',
                'image_alt': f'{s.name}, negocio local en Zinapécuaro',
                'cta_label': 'Ver negocio',
                'cta_url': settings.LANDING_APP_URL,
                'source': 'service',
                'is_demo': False,
                'created_at': s.created_at.isoformat() if s.created_at else '',
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
            'description': '',
            'image_fit': '',
            'image_alt': 'Ejemplo de restaurante en ZinApp',
            'cta_label': 'Pedir ahora',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
            'created_at': '',
        },
        {
            'id': 'demo-2',
            'name': 'Ejemplo: Salón María Belleza',
            'category': 'Servicio',
            'schedule': 'Lun–Sáb · 10:00 a. m.–7:00 p. m.',
            'location': 'Col. Independencia',
            'image_url': '',
            'description': '',
            'image_fit': '',
            'image_alt': 'Ejemplo de servicio en ZinApp',
            'cta_label': 'Ver negocio',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
            'created_at': '',
        },
        {
            'id': 'demo-3',
            'name': 'Ejemplo: Abarrotes Don Luis',
            'category': 'Comercio',
            'schedule': 'Lun–Dom · 8:00 a. m.–9:00 p. m.',
            'location': 'Av. Principal',
            'image_url': '',
            'description': '',
            'image_fit': '',
            'image_alt': 'Ejemplo de comercio en ZinApp',
            'cta_label': 'Ver negocio',
            'cta_url': settings.LANDING_APP_URL,
            'source': 'demo',
            'is_demo': True,
            'created_at': '',
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
    restaurants = _sort_images_first(_restaurant_cards(limit=max(limit, 12)))
    services = _sort_images_first(_service_cards(limit=max(limit, 12)))
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


def _newest_businesses(featured_ids: set[str], limit: int = 3) -> list[dict]:
    """Negocios reales recientes que no están ya en destacados."""
    pool = (
        _restaurant_cards(limit=12, order_by='-created_at')
        + _service_cards(limit=12, order_by='-created_at')
    )
    pool.sort(key=lambda c: c.get('created_at') or '', reverse=True)
    newest = [c for c in pool if c.get('id') not in featured_ids]
    return newest[:limit]


def _discover_dishes(limit: int = 8) -> list[dict]:
    """Platillos reales con foto de restaurantes activos."""
    try:
        from django.db.models import Q

        from restaurants.models import Product
    except Exception:
        return []

    try:
        products = list(
            Product.objects.filter(
                is_available=True,
                restaurant__is_active=True,
            )
            .exclude(Q(image='') | Q(image__isnull=True))
            .select_related('restaurant')
            .order_by('-updated_at')[:limit]
        )
    except (OperationalError, Exception):
        return []

    dishes = []
    for product in products:
        image_url = _media_url(product.image)
        if not image_url:
            continue
        dishes.append(
            {
                'id': f'dish-{product.pk}',
                'name': product.name,
                'restaurant': product.restaurant.name,
                'description': _shorten_text(product.description, limit=90),
                'image_url': image_url,
                'image_alt': f'{product.name} de {product.restaurant.name} en Zinapécuaro',
                'cta_url': settings.LANDING_APP_URL,
            }
        )
    return dishes


def _active_promotions(limit: int = 6) -> list[dict]:
    """Promociones vigentes; la sección se oculta si no hay ninguna."""
    try:
        from django.utils import timezone

        from restaurants.models import ProductPromotion
        from restaurants.promotions import promo_label
    except Exception:
        return []

    try:
        now = timezone.now()
        promos = list(
            ProductPromotion.objects.filter(
                is_active=True,
                valid_until__gte=now,
                product__is_available=True,
                restaurant__is_active=True,
            )
            .select_related('product', 'restaurant')
            .order_by('-valid_until', '-id')[:limit]
        )
    except (OperationalError, Exception):
        return []

    cards = []
    for promo in promos:
        image_url = _media_url(promo.product.image) or _media_url(promo.restaurant.image)
        cards.append(
            {
                'id': f'promo-{promo.pk}',
                'title': promo_label(promo),
                'product': promo.product.name,
                'restaurant': promo.restaurant.name,
                'image_url': image_url,
                'image_alt': f'Promoción {promo.product.name} en {promo.restaurant.name}, Zinapécuaro',
                'cta_url': settings.LANDING_APP_URL,
            }
        )
    return cards


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
        play = _play_store_context()
        landing_faqs = get_landing_faqs(google_play_enabled=play['google_play_enabled'])
        featured, using_demo = _featured_businesses(limit=6)
        newest = [] if using_demo else _newest_businesses(
            {biz['id'] for biz in featured},
            limit=3,
        )
        discover_dishes = [] if using_demo else _discover_dishes(limit=8)
        landing_promos = [] if using_demo else _active_promotions(limit=6)
        contact_email = get_contact_email()
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
                'ZinApp es la app local para pedir comida a domicilio, descubrir '
                'restaurantes, negocios y servicios en Zinapécuaro, Michoacán.'
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
                    {'email': contact_email}
                    if contact_email
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
                'description': SEO_DESCRIPTION,
            },
            {
                '@type': 'SoftwareApplication',
                '@id': f'{site_url}/#app',
                'name': 'ZinApp',
                'applicationCategory': 'LifestyleApplication',
                'operatingSystem': 'Android, iOS, Web',
                'url': f'{site_url}/app/',
                'description': (
                    'Pide comida a domicilio en Zinapécuaro, encuentra restaurantes, '
                    'negocios locales, servicios y promociones.'
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
                'description': (
                    'Plataforma local de comida a domicilio, restaurantes, negocios '
                    'y servicios en Zinapécuaro, Michoacán.'
                ),
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
                    for item in landing_faqs
                ],
            },
        ]
        if not using_demo and featured:
            seo_graph.append(
                {
                    '@type': 'ItemList',
                    '@id': f'{site_url}/#negocios-destacados',
                    'name': 'Negocios destacados en ZinApp Zinapécuaro',
                    'itemListElement': [
                        {
                            '@type': 'ListItem',
                            'position': index,
                            'name': biz['name'],
                            'url': f'{site_url}/app/',
                        }
                        for index, biz in enumerate(featured, start=1)
                    ],
                }
            )
        ctx.update(
            {
                'site_url': site_url,
                'seo_title': SEO_TITLE,
                'seo_description': SEO_DESCRIPTION,
                'seo_logo_url': logo_url,
                'landing_faqs': landing_faqs,
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
                'contact_email': contact_email,
                'support_phone': settings.SUPPORT_PHONE,
                'social_instagram_url': _social_url('instagram', settings.SOCIAL_INSTAGRAM),
                'social_facebook_url': _social_url('facebook', settings.SOCIAL_FACEBOOK),
                'terms_url': settings.TERMS_URL,
                'register_whatsapp_text': register_msg,
                'featured_businesses': featured,
                'featured_is_demo': using_demo,
                'newest_businesses': newest,
                'discover_dishes': discover_dishes,
                'landing_promos': landing_promos,
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

import json

from django.conf import settings
from django.views.generic import TemplateView

from .seo import get_site_url


class PrivacyPolicyView(TemplateView):
    template_name = 'legal/privacidad.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        site_url = get_site_url()
        logo_url = f'{site_url}/static/dashboard/img/logo-on-blue.png'
        page_url = f'{site_url}/privacidad/'
        seo_graph = [
            {
                '@type': 'WebPage',
                '@id': f'{page_url}#webpage',
                'url': page_url,
                'name': 'Aviso de privacidad — ZinApp',
                'description': (
                    'Aviso de privacidad integral de ZinApp — delivery y servicios locales '
                    'en Zinapécuaro, Michoacán, México.'
                ),
                'isPartOf': {'@id': f'{site_url}/#website'},
                'inLanguage': 'es-MX',
            },
            {
                '@type': 'BreadcrumbList',
                '@id': f'{page_url}#breadcrumb',
                'itemListElement': [
                    {
                        '@type': 'ListItem',
                        'position': 1,
                        'name': 'Inicio',
                        'item': f'{site_url}/',
                    },
                    {
                        '@type': 'ListItem',
                        'position': 2,
                        'name': 'Aviso de privacidad',
                        'item': page_url,
                    },
                ],
            },
        ]
        ctx.update(
            {
                'site_url': site_url,
                'support_email': settings.SUPPORT_EMAIL or 'soporte@zinapp.com.mx',
                'seo_logo_url': logo_url,
                'seo_json_ld': json.dumps(
                    {'@context': 'https://schema.org', '@graph': seo_graph},
                    ensure_ascii=False,
                    separators=(',', ':'),
                ),
            }
        )
        return ctx

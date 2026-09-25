import json

from django.conf import settings
from django.views.generic import TemplateView

from .landing_views import build_privacy_seo_graph
from .seo import get_privacy_email, get_site_url


class PrivacyPolicyView(TemplateView):
    template_name = 'legal/privacidad.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        site_url = get_site_url()
        logo_url = f'{site_url}/static/dashboard/img/logo-on-blue.png'
        seo_graph = build_privacy_seo_graph(site_url=site_url)
        ctx.update(
            {
                'site_url': site_url,
                'support_email': get_privacy_email(),
                'privacy_email': get_privacy_email(),
                'seo_logo_url': logo_url,
                'seo_json_ld': json.dumps(
                    {'@context': 'https://schema.org', '@graph': seo_graph},
                    ensure_ascii=False,
                    separators=(',', ':'),
                ),
                'stripe_payments_enabled': bool(
                    (getattr(settings, 'STRIPE_SECRET_KEY', '') or '').strip()
                ),
            }
        )
        return ctx

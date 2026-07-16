from django.conf import settings
from django.views.generic import TemplateView


def _whatsapp_link(raw: str) -> str:
    digits = ''.join(c for c in (raw or '') if c.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        digits = f'52{digits}'
    return f'https://wa.me/{digits}'


class LandingView(TemplateView):
    template_name = 'landing/home.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        whatsapp = (settings.SUPPORT_WHATSAPP or '').strip()
        ctx.update(
            {
                'app_store_url': settings.APP_STORE_URL,
                'play_store_url': settings.PLAY_STORE_URL,
                'whatsapp_url': _whatsapp_link(whatsapp),
            }
        )
        return ctx

from django.views.generic import TemplateView

from ..permissions import PosAccessMixin


class PosReportsPlaceholderView(PosAccessMixin, TemplateView):
    template_name = 'pos/placeholder.html'
    pos_permission = 'reports'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['section_title'] = 'Reportes'
        ctx['section_message'] = (
            'Reportes de ventas, ticket promedio y desgloses — FASE 3.'
        )
        return ctx

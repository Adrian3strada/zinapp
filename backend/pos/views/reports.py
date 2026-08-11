from django.views import View
from django.shortcuts import render

from ..permissions import PosAccessMixin
from ..services.reports import build_daily_reports


class PosReportsView(PosAccessMixin, View):
    template_name = 'pos/reports.html'
    pos_permission = 'reports'

    def get(self, request):
        report = build_daily_reports(self.pos_restaurant)
        return render(request, self.template_name, {
            'pos_restaurant': self.pos_restaurant,
            'pos_role': self.pos_access.role,
            'report': report,
        })

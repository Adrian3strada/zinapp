from django.views.generic import TemplateView

from ..permissions import PosAccessMixin
from ..selectors.cash import open_sessions_for_restaurant
from ..selectors.orders import (
    pos_sales_today_total,
    preparing_orders_count,
    zinapp_new_orders_count,
)


class PosDashboardView(PosAccessMixin, TemplateView):
    template_name = 'pos/dashboard.html'
    pos_permission = 'dashboard'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        restaurant = self.pos_restaurant
        open_sessions = list(open_sessions_for_restaurant(restaurant))
        sales_total, sales_count = pos_sales_today_total(restaurant)
        ctx.update({
            'cash_open': bool(open_sessions),
            'open_sessions': open_sessions,
            'pos_sales_today_total': sales_total,
            'pos_sales_today_count': sales_count,
            'zinapp_new_orders': zinapp_new_orders_count(restaurant),
            'preparing_orders': preparing_orders_count(restaurant),
            'realtime_restaurant_id': restaurant.id,
        })
        return ctx

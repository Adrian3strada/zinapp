from decimal import Decimal

from django.contrib import messages
from django.shortcuts import redirect, render
from django.views import View

from ..exceptions import PosError
from ..forms import CashMovementForm, CloseCashSessionForm, OpenCashSessionForm
from ..permissions import PosAccessMixin
from ..selectors.cash import open_sessions_for_restaurant, registers_for_restaurant
from ..services import cash as cash_services
from ..services.reports import build_cash_cut_summary


class PosCashView(PosAccessMixin, View):
    template_name = 'pos/cash/index.html'
    pos_permission = 'cash'

    def get(self, request):
        restaurant = self.pos_restaurant
        open_sessions = list(open_sessions_for_restaurant(restaurant))
        registers = list(registers_for_restaurant(restaurant))
        open_form = OpenCashSessionForm(restaurant=restaurant)
        close_form = CloseCashSessionForm()
        movement_form = CashMovementForm()
        expected = None
        if open_sessions:
            expected = cash_services.compute_expected_cash(open_sessions[0])
        return render(request, self.template_name, {
            'pos_restaurant': restaurant,
            'pos_role': self.pos_access.role,
            'open_sessions': open_sessions,
            'registers': registers,
            'open_form': open_form,
            'close_form': close_form,
            'movement_form': movement_form,
            'expected_amount': expected,
        })


class PosCashOpenView(PosAccessMixin, View):
    pos_permission = 'cash'

    def post(self, request):
        restaurant = self.pos_restaurant
        form = OpenCashSessionForm(request.POST, restaurant=restaurant)
        if not form.is_valid():
            messages.error(request, 'Datos inválidos para abrir caja.')
            return redirect('pos:cash')
        register = form.cleaned_data.get('cash_register')
        try:
            cash_services.open_cash_session(
                restaurant=restaurant,
                user=request.user,
                cash_register_id=register.id if register else None,
                opening_amount=form.cleaned_data['opening_amount'],
            )
            messages.success(request, 'Caja abierta correctamente.')
        except PosError as exc:
            messages.error(request, exc.message)
        return redirect('pos:cash')


class PosCashCloseView(PosAccessMixin, View):
    pos_permission = 'cash'

    def post(self, request):
        restaurant = self.pos_restaurant
        form = CloseCashSessionForm(request.POST)
        sessions = list(open_sessions_for_restaurant(restaurant))
        if not sessions:
            messages.error(request, 'No hay caja abierta.')
            return redirect('pos:cash_cut')
        if not form.is_valid():
            messages.error(request, 'Indica el efectivo contado.')
            return redirect('pos:cash_cut')
        try:
            cash_services.close_cash_session(
                session=sessions[0],
                user=request.user,
                counted_amount=form.cleaned_data['counted_amount'],
            )
            messages.success(request, 'Caja cerrada.')
        except PosError as exc:
            messages.error(request, exc.message)
            return redirect('pos:cash_cut')
        return redirect('pos:cash')


class PosCashMovementView(PosAccessMixin, View):
    pos_permission = 'cash'

    def post(self, request):
        restaurant = self.pos_restaurant
        form = CashMovementForm(request.POST)
        sessions = list(open_sessions_for_restaurant(restaurant))
        if not sessions:
            messages.error(request, 'No hay caja abierta.')
            return redirect('pos:cash')
        if not form.is_valid():
            messages.error(request, 'Movimiento inválido.')
            return redirect('pos:cash')
        try:
            cash_services.add_manual_movement(
                session=sessions[0],
                restaurant=restaurant,
                user=request.user,
                movement_type=form.cleaned_data['type'],
                amount=form.cleaned_data['amount'],
                description=form.cleaned_data.get('description') or '',
            )
            messages.success(request, 'Movimiento registrado.')
        except PosError as exc:
            messages.error(request, exc.message)
        return redirect('pos:cash')


class PosCashCutView(PosAccessMixin, View):
    template_name = 'pos/cash/cut.html'
    pos_permission = 'cash'

    def get(self, request):
        restaurant = self.pos_restaurant
        sessions = list(open_sessions_for_restaurant(restaurant))
        if not sessions:
            return render(request, self.template_name, {
                'pos_restaurant': restaurant,
                'pos_role': self.pos_access.role,
                'summary': None,
                'close_form': CloseCashSessionForm(),
            })
        summary = build_cash_cut_summary(sessions[0])
        return render(request, self.template_name, {
            'pos_restaurant': restaurant,
            'pos_role': self.pos_access.role,
            'summary': summary,
            'close_form': CloseCashSessionForm(),
        })

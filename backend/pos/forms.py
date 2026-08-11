from decimal import Decimal

from django import forms
from django.contrib.auth.forms import AuthenticationForm

from orders.models import PaymentMethod

from .models import CashMovementType, CashRegister


class PosLoginForm(AuthenticationForm):
    username = forms.CharField(
        label='Usuario',
        widget=forms.TextInput(attrs={
            'class': 'pos-input',
            'autocomplete': 'username',
            'autofocus': True,
            'placeholder': 'Usuario',
        }),
    )
    password = forms.CharField(
        label='Contraseña',
        widget=forms.PasswordInput(attrs={
            'class': 'pos-input',
            'autocomplete': 'current-password',
            'placeholder': 'Contraseña',
        }),
    )


class OpenCashSessionForm(forms.Form):
    cash_register = forms.ModelChoiceField(
        queryset=CashRegister.objects.none(),
        required=False,
        label='Caja',
        empty_label='Caja principal (automática)',
    )
    opening_amount = forms.DecimalField(
        min_value=Decimal('0.00'),
        max_digits=12,
        decimal_places=2,
        initial=Decimal('0.00'),
        label='Monto inicial',
    )

    def __init__(self, *args, restaurant=None, **kwargs):
        super().__init__(*args, **kwargs)
        if restaurant is not None:
            self.fields['cash_register'].queryset = CashRegister.objects.filter(
                restaurant=restaurant,
                is_active=True,
            )


class CloseCashSessionForm(forms.Form):
    counted_amount = forms.DecimalField(
        min_value=Decimal('0.00'),
        max_digits=12,
        decimal_places=2,
        label='Efectivo contado',
    )


class CashMovementForm(forms.Form):
    type = forms.ChoiceField(
        choices=[
            (CashMovementType.CASH_IN, 'Entrada'),
            (CashMovementType.CASH_OUT, 'Retiro'),
            (CashMovementType.ADJUSTMENT, 'Ajuste'),
        ],
        label='Tipo',
    )
    amount = forms.DecimalField(
        min_value=Decimal('0.01'),
        max_digits=12,
        decimal_places=2,
        label='Monto',
    )
    description = forms.CharField(
        required=False,
        max_length=255,
        label='Descripción',
    )


class PosCheckoutForm(forms.Form):
    payment_method = forms.ChoiceField(
        choices=[
            (PaymentMethod.CASH, 'Efectivo'),
            (PaymentMethod.CARD, 'Tarjeta'),
            (PaymentMethod.TRANSFER, 'Transferencia'),
            (PaymentMethod.OTHER, 'Otro'),
        ],
        initial=PaymentMethod.CASH,
    )
    amount_received = forms.DecimalField(
        required=False,
        min_value=Decimal('0.00'),
        max_digits=12,
        decimal_places=2,
    )
    discount_amount = forms.DecimalField(
        required=False,
        min_value=Decimal('0.00'),
        max_digits=12,
        decimal_places=2,
        initial=Decimal('0.00'),
    )
    cart_json = forms.CharField()
    idempotency_key = forms.CharField(max_length=64)

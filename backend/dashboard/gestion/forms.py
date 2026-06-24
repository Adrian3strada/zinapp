from decimal import Decimal

from django import forms
from django.contrib.auth.forms import UserCreationForm

from accounts.models import DeliveryProfile, User, UserRole
from orders.models import Coupon, Order, OrderStatus, Shipment, ShipmentStatus
from restaurants.models import Product, Restaurant


class PanelFormMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, (forms.CheckboxInput, forms.RadioSelect)):
                continue
            css = widget.attrs.get('class', '')
            widget.attrs['class'] = f'form-control {css}'.strip()


class CouponForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Coupon
        fields = (
            'code', 'description', 'discount_percent', 'discount_fixed',
            'min_order_amount', 'is_active', 'expires_at', 'max_uses',
        )
        widgets = {
            'expires_at': forms.DateTimeInput(attrs={'type': 'datetime-local'}),
            'description': forms.TextInput(),
        }

    def clean_code(self):
        return self.cleaned_data['code'].strip().upper()


class ProductForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Product
        fields = ('restaurant', 'name', 'description', 'price', 'image', 'is_available')
        widgets = {'description': forms.Textarea(attrs={'rows': 3})}


class OrderAdminForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Order
        fields = ('status', 'driver')
        widgets = {
            'driver': forms.Select(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['driver'].queryset = User.objects.filter(role=UserRole.DRIVER).order_by('username')
        self.fields['driver'].required = False


class RestaurantForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Restaurant
        fields = (
            'owner', 'name', 'category', 'description', 'address', 'phone',
            'whatsapp', 'bank_name', 'account_holder', 'clabe',
            'opening_time', 'closing_time', 'is_active', 'accepting_orders',
        )
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'address': forms.Textarea(attrs={'rows': 2}),
            'opening_time': forms.TimeInput(attrs={'type': 'time'}),
            'closing_time': forms.TimeInput(attrs={'type': 'time'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['owner'].queryset = User.objects.filter(role=UserRole.RESTAURANT).order_by('username')

    def save(self, commit=True):
        instance = super().save(commit=False)
        if not instance.pk:
            instance.is_active = False
            instance.accepting_orders = False
        if commit:
            instance.save()
        return instance


class ShipmentStatusForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Shipment
        fields = ('status', 'driver')
        widgets = {
            'driver': forms.Select(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['driver'].queryset = User.objects.filter(role=UserRole.DRIVER).order_by('username')
        self.fields['driver'].required = False


class UserCreateForm(PanelFormMixin, UserCreationForm):
    role = forms.ChoiceField(choices=UserRole.choices, initial=UserRole.CUSTOMER)
    phone = forms.CharField(required=False, max_length=20)
    email = forms.EmailField(required=False)
    vehicle_type = forms.ChoiceField(
        choices=DeliveryProfile.VehicleType.choices,
        required=False,
        initial=DeliveryProfile.VehicleType.MOTORCYCLE,
    )
    license_plate = forms.CharField(required=False, max_length=20)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name', 'role', 'phone',
            'password1', 'password2',
        )

    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = self.cleaned_data['role']
        user.phone = self.cleaned_data.get('phone', '')
        if commit:
            user.save()
            if user.role == UserRole.DRIVER:
                DeliveryProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'vehicle_type': self.cleaned_data.get('vehicle_type')
                        or DeliveryProfile.VehicleType.MOTORCYCLE,
                        'license_plate': self.cleaned_data.get('license_plate', ''),
                        'is_available': False,
                    },
                )
        return user


class UserEditForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'is_active', 'is_staff',
        )

    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            if user.role == UserRole.DRIVER:
                DeliveryProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'vehicle_type': DeliveryProfile.VehicleType.MOTORCYCLE,
                        'is_available': False,
                    },
                )
        return user


class DriverProfileForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = DeliveryProfile
        fields = ('vehicle_type', 'license_plate', 'is_available')

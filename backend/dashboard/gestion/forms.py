from decimal import Decimal

from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError

from accounts.models import DeliveryProfile, User, UserRole
from accounts.username import normalize_username
from orders.models import Coupon, Order, OrderStatus, Shipment, ShipmentStatus
from restaurants.geo import geocode_address
from local_services.models import LocalService
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
            'latitude', 'longitude',
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
    restaurant_name = forms.CharField(
        required=False,
        max_length=120,
        label='Nombre del restaurante',
        help_text='Obligatorio si el rol es Restaurante.',
    )
    restaurant_address = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 2}),
        label='Dirección del restaurante',
        help_text='Obligatorio si el rol es Restaurante.',
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name', 'role', 'phone',
            'password1', 'password2',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].help_text = (
            'Se guarda en minúsculas. En la app se inicia sesión con este usuario.'
        )
        self.fields['password1'].help_text = (
            'Mínimo 8 caracteres; evita que sea igual al usuario o solo números.'
        )

    def clean_username(self):
        username = normalize_username(self.cleaned_data['username'])
        if not username:
            raise ValidationError('El usuario no puede estar vacío.')
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError('Ya existe un usuario con ese nombre.')
        return username

    def clean_email(self):
        email = (self.cleaned_data.get('email') or '').strip().lower()
        return email

    def clean(self):
        cleaned = super().clean()
        role = cleaned.get('role')
        if role == UserRole.RESTAURANT:
            name = (cleaned.get('restaurant_name') or '').strip()
            address = (cleaned.get('restaurant_address') or '').strip()
            if not name:
                self.add_error('restaurant_name', 'Indica el nombre del restaurante.')
            if not address:
                self.add_error('restaurant_address', 'Indica la dirección del restaurante.')
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('password1')
        if password:
            user.set_password(password)
        user.role = self.cleaned_data['role']
        user.phone = self.cleaned_data.get('phone', '')
        email = self.cleaned_data.get('email') or ''
        if email:
            user.email = email
        user.is_active = True
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
            if user.role == UserRole.RESTAURANT:
                name = self.cleaned_data.get('restaurant_name', '').strip()
                address = self.cleaned_data.get('restaurant_address', '').strip()
                if name and address and not Restaurant.objects.filter(owner=user).exists():
                    geo = geocode_address(address)
                    Restaurant.objects.create(
                        owner=user,
                        name=name,
                        address=address,
                        phone=user.phone,
                        latitude=geo['latitude'] if geo else None,
                        longitude=geo['longitude'] if geo else None,
                        is_active=False,
                        accepting_orders=False,
                    )
        return user


class UserEditForm(PanelFormMixin, forms.ModelForm):
    new_password1 = forms.CharField(
        required=False,
        label='Nueva contraseña',
        widget=forms.PasswordInput,
        help_text='Déjalo vacío para no cambiar la contraseña.',
    )
    new_password2 = forms.CharField(
        required=False,
        label='Confirmar contraseña',
        widget=forms.PasswordInput,
    )

    class Meta:
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'is_active', 'is_staff',
        )

    def clean_username(self):
        username = normalize_username(self.cleaned_data['username'])
        if not username:
            raise ValidationError('El usuario no puede estar vacío.')
        qs = User.objects.filter(username__iexact=username)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError('Ya existe un usuario con ese nombre.')
        return username

    def clean_email(self):
        return (self.cleaned_data.get('email') or '').strip().lower()

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('new_password1') or ''
        p2 = cleaned.get('new_password2') or ''
        if p1 or p2:
            if p1 != p2:
                self.add_error('new_password2', 'Las contraseñas no coinciden.')
            elif len(p1) < 8:
                self.add_error('new_password1', 'Mínimo 8 caracteres.')
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('new_password1')
        if password:
            user.set_password(password)
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


class LocalServiceForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = LocalService
        fields = (
            'name', 'category', 'description', 'logo', 'address', 'schedule',
            'phone', 'whatsapp', 'instagram', 'facebook',
            'is_active', 'sort_order',
        )
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'address': forms.Textarea(attrs={'rows': 2}),
        }


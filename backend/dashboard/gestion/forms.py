from decimal import Decimal

from django import forms
from django.contrib.auth import password_validation
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.utils import timezone

from accounts.models import DeliveryProfile, User, UserRole
from accounts.username import normalize_username
from orders.models import Coupon, Order, OrderStatus, Shipment, ShipmentStatus
from orders.models import DisputeStatus, OrderDispute
from local_services.models import LocalService
from restaurants.models import Product, ProductPromotion, PromoType, Restaurant


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
        fields = ('restaurant', 'name', 'description', 'category', 'price', 'image', 'is_available')
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'category': forms.Select(),
        }


class ProductPromotionForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = ProductPromotion
        fields = (
            'product', 'promo_type', 'percent_off', 'special_price',
            'label', 'valid_until', 'is_active',
        )
        widgets = {
            'valid_until': forms.DateTimeInput(attrs={'type': 'datetime-local'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['product'].queryset = Product.objects.select_related(
            'restaurant',
        ).order_by('restaurant__name', 'name')
        self.fields['percent_off'].required = False
        self.fields['special_price'].required = False
        self.fields['label'].required = False

    def clean(self):
        cleaned = super().clean()
        promo_type = cleaned.get('promo_type')
        percent_off = cleaned.get('percent_off')
        special_price = cleaned.get('special_price')
        valid_until = cleaned.get('valid_until')

        if promo_type == PromoType.PERCENT_OFF:
            if percent_off is None or percent_off < 1 or percent_off > 99:
                self.add_error('percent_off', 'Indica un porcentaje entre 1 y 99.')
            cleaned['special_price'] = None
        elif promo_type == PromoType.SPECIAL_PRICE:
            if special_price is None or special_price <= 0:
                self.add_error('special_price', 'Indica un precio promocional mayor a 0.')
            cleaned['percent_off'] = None
        elif promo_type == PromoType.TWO_FOR_ONE:
            cleaned['percent_off'] = None
            cleaned['special_price'] = None

        if valid_until and valid_until <= timezone.now():
            self.add_error('valid_until', 'La promoción debe terminar en una fecha futura.')
        return cleaned

    def save(self, commit=True):
        promotion = super().save(commit=False)
        promotion.restaurant = promotion.product.restaurant
        if commit:
            if promotion.is_active:
                ProductPromotion.objects.filter(
                    product=promotion.product,
                    is_active=True,
                ).exclude(pk=promotion.pk).update(is_active=False)
            promotion.save()
        return promotion


class OrderAdminForm(PanelFormMixin, forms.ModelForm):
    VALID_TRANSITIONS = {
        OrderStatus.PENDING: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
        OrderStatus.ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
        OrderStatus.PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
        # Panel admins may assign a driver (equivalent to accept_delivery).
        OrderStatus.READY: [OrderStatus.ON_THE_WAY, OrderStatus.CANCELLED],
        OrderStatus.ON_THE_WAY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        OrderStatus.DELIVERED: [],
        OrderStatus.CANCELLED: [],
    }

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

    def clean_status(self):
        new_status = self.cleaned_data['status']
        current = self.instance.status
        if new_status == current:
            return new_status
        allowed = self.VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError(
                f'No se puede cambiar de {self.instance.get_status_display()} '
                f'a {dict(OrderStatus.choices).get(new_status, new_status)}.'
            )
        return new_status

    def clean(self):
        cleaned = super().clean()
        status = cleaned.get('status')
        driver = cleaned.get('driver')
        if status in (OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED) and not driver:
            self.add_error('driver', 'Asigna un repartidor para este estado.')
        return cleaned

    def save(self, commit=True):
        order = super().save(commit=False)
        now = timezone.now()
        if order.status == OrderStatus.ACCEPTED and not order.accepted_at:
            order.accepted_at = now
        elif order.status == OrderStatus.READY and not order.ready_at:
            order.ready_at = now
        elif order.status == OrderStatus.DELIVERED and not order.delivered_at:
            order.delivered_at = now
        if commit:
            order.save()
        return order


class RestaurantForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = Restaurant
        fields = (
            'owner', 'name', 'category', 'description', 'address', 'phone',
            'whatsapp',
            'image', 'latitude', 'longitude', 'location_pinned',
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
        if (
            instance.latitude is not None
            and instance.longitude is not None
            and ('latitude' in self.changed_data or 'longitude' in self.changed_data)
        ):
            instance.location_pinned = True
        if commit:
            instance.save()
        return instance


class ShipmentStatusForm(PanelFormMixin, forms.ModelForm):
    VALID_TRANSITIONS = {
        ShipmentStatus.PENDING: [ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED],
        ShipmentStatus.PICKED_UP: [ShipmentStatus.ON_THE_WAY, ShipmentStatus.CANCELLED],
        ShipmentStatus.ON_THE_WAY: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
        ShipmentStatus.DELIVERED: [],
        ShipmentStatus.CANCELLED: [],
    }

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

    def clean_status(self):
        new_status = self.cleaned_data['status']
        current = self.instance.status
        if new_status == current:
            return new_status
        allowed = self.VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValidationError(
                f'No se puede cambiar de {self.instance.get_status_display()} '
                f'a {dict(ShipmentStatus.choices).get(new_status, new_status)}.'
            )
        return new_status

    def clean(self):
        cleaned = super().clean()
        status = cleaned.get('status')
        driver = cleaned.get('driver')
        if status in (ShipmentStatus.PICKED_UP, ShipmentStatus.ON_THE_WAY, ShipmentStatus.DELIVERED) and not driver:
            self.add_error('driver', 'Asigna un repartidor para avanzar este envío.')
        return cleaned

    def save(self, commit=True):
        shipment = super().save(commit=False)
        if shipment.status == ShipmentStatus.DELIVERED and not shipment.delivered_at:
            shipment.delivered_at = timezone.now()
        if commit:
            shipment.save()
        return shipment


class DisputeResolveForm(PanelFormMixin, forms.ModelForm):
    class Meta:
        model = OrderDispute
        fields = ('status', 'admin_notes')
        widgets = {
            'admin_notes': forms.Textarea(attrs={'rows': 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['status'].choices = [
            (DisputeStatus.PENDING, DisputeStatus.PENDING.label),
            (DisputeStatus.APPROVED, DisputeStatus.APPROVED.label),
            (DisputeStatus.REJECTED, DisputeStatus.REJECTED.label),
            (DisputeStatus.REFUNDED, DisputeStatus.REFUNDED.label),
        ]


class UserCreateForm(PanelFormMixin, UserCreationForm):
    role = forms.ChoiceField(choices=UserRole.choices, initial=UserRole.CUSTOMER)
    phone = forms.CharField(required=False, max_length=20)
    email = forms.EmailField(required=False)
    vehicle_type = forms.ChoiceField(
        choices=DeliveryProfile.VehicleType.choices,
        required=False,
        initial=DeliveryProfile.VehicleType.MOTORCYCLE,
        label='Tipo de vehículo',
    )
    license_plate = forms.CharField(
        required=False,
        max_length=20,
        label='Placas',
        help_text='Obligatorio salvo bicicleta.',
    )
    avatar = forms.ImageField(
        required=False,
        label='Foto de perfil',
        help_text='Para repartidores: visible en la app.',
    )
    identity_document = forms.ImageField(
        required=False,
        label='INE / identificación',
        help_text='Para repartidores: solo visible en el panel.',
    )
    approve_driver = forms.BooleanField(
        required=False,
        initial=True,
        label='Aprobar repartidor ahora',
        help_text='Si hay teléfono, vehículo, placas (si aplica), foto e INE, queda listo para entregas.',
    )
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
        if user.role == UserRole.ADMIN:
            user.is_staff = True
        email = self.cleaned_data.get('email') or ''
        if email:
            user.email = email
        user.is_active = True
        avatar = self.cleaned_data.get('avatar')
        if avatar:
            user.avatar = avatar
        if commit:
            user.save()
            if user.role == UserRole.DRIVER:
                profile, _created = DeliveryProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'vehicle_type': self.cleaned_data.get('vehicle_type')
                        or DeliveryProfile.VehicleType.MOTORCYCLE,
                        'license_plate': self.cleaned_data.get('license_plate', ''),
                        'is_available': False,
                    },
                )
                update_fields = []
                vehicle_type = self.cleaned_data.get('vehicle_type')
                if vehicle_type and profile.vehicle_type != vehicle_type:
                    profile.vehicle_type = vehicle_type
                    update_fields.append('vehicle_type')
                license_plate = self.cleaned_data.get('license_plate', '')
                if license_plate and profile.license_plate != license_plate:
                    profile.license_plate = license_plate
                    update_fields.append('license_plate')
                identity = self.cleaned_data.get('identity_document')
                if identity:
                    profile.identity_document = identity
                    update_fields.append('identity_document')
                if update_fields:
                    profile.save(update_fields=[*update_fields, 'updated_at'])
            if user.role == UserRole.RESTAURANT:
                name = self.cleaned_data.get('restaurant_name', '').strip()
                address = self.cleaned_data.get('restaurant_address', '').strip()
                if name and address and not Restaurant.objects.filter(owner=user).exists():
                    Restaurant.objects.create(
                        owner=user,
                        name=name,
                        address=address,
                        phone=user.phone,
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
    avatar = forms.ImageField(
        required=False,
        label='Foto de perfil',
        help_text='Visible en la app.',
    )
    identity_document = forms.ImageField(
        required=False,
        label='INE / identificación',
        help_text='Solo para repartidores. Visible en el panel.',
    )
    vehicle_type = forms.ChoiceField(
        choices=DeliveryProfile.VehicleType.choices,
        required=False,
        label='Tipo de vehículo',
    )
    license_plate = forms.CharField(
        required=False,
        max_length=20,
        label='Placas',
    )

    class Meta:
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'avatar', 'is_active', 'is_staff',
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

    def clean_is_active(self):
        if self.instance.pk and 'is_active' not in self.data:
            return self.instance.is_active
        return self.cleaned_data.get('is_active', True)

    def clean_is_staff(self):
        if self.instance.pk and 'is_staff' not in self.data:
            return self.instance.is_staff
        return self.cleaned_data.get('is_staff', False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        is_driver = (
            (self.instance and self.instance.role == UserRole.DRIVER)
            or (self.data and self.data.get('role') == UserRole.DRIVER)
        )
        if not is_driver:
            self.fields.pop('identity_document', None)
            self.fields.pop('vehicle_type', None)
            self.fields.pop('license_plate', None)
            self.order_fields([
                'username', 'email', 'first_name', 'last_name', 'role', 'phone',
                'address', 'avatar', 'is_active', 'is_staff',
                'new_password1', 'new_password2',
            ])
        else:
            if self.instance and self.instance.pk:
                profile = DeliveryProfile.objects.filter(user=self.instance).first()
                if profile:
                    self.fields['identity_document'].initial = profile.identity_document
                    self.fields['vehicle_type'].initial = profile.vehicle_type
                    self.fields['license_plate'].initial = profile.license_plate
            self.order_fields([
                'username', 'email', 'first_name', 'last_name', 'role', 'phone',
                'address', 'vehicle_type', 'license_plate', 'avatar',
                'identity_document', 'is_active', 'is_staff',
                'new_password1', 'new_password2',
            ])

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get('new_password1') or ''
        p2 = cleaned.get('new_password2') or ''
        if p1 or p2:
            if p1 != p2:
                self.add_error('new_password2', 'Las contraseñas no coinciden.')
            elif len(p1) < 8:
                self.add_error('new_password1', 'Mínimo 8 caracteres.')
            elif self.instance.pk:
                try:
                    password_validation.validate_password(p1, self.instance)
                except ValidationError as exc:
                    self.add_error('new_password1', exc)
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('new_password1')
        if password:
            user.set_password(password)
        if commit:
            user.save()
            if user.role == UserRole.DRIVER:
                profile, _created = DeliveryProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'vehicle_type': self.cleaned_data.get('vehicle_type')
                        or DeliveryProfile.VehicleType.MOTORCYCLE,
                        'license_plate': self.cleaned_data.get('license_plate', ''),
                        'is_available': False,
                    },
                )
                update_fields = []
                vehicle_type = self.cleaned_data.get('vehicle_type')
                if vehicle_type and profile.vehicle_type != vehicle_type:
                    profile.vehicle_type = vehicle_type
                    update_fields.append('vehicle_type')
                if 'license_plate' in self.cleaned_data:
                    plate = self.cleaned_data.get('license_plate') or ''
                    if profile.license_plate != plate:
                        profile.license_plate = plate
                        update_fields.append('license_plate')
                identity = self.cleaned_data.get('identity_document')
                if identity:
                    profile.identity_document = identity
                    update_fields.append('identity_document')
                if update_fields:
                    profile.save(update_fields=[*update_fields, 'updated_at'])
        return user


class DriverProfileForm(PanelFormMixin, forms.ModelForm):
    avatar = forms.ImageField(
        required=False,
        label='Foto de perfil',
        help_text='Visible en la app.',
    )

    class Meta:
        model = DeliveryProfile
        fields = (
            'vehicle_type', 'license_plate', 'is_available', 'identity_document',
        )
        labels = {
            'identity_document': 'INE / identificación',
            'is_available': 'Disponible para pedidos',
        }
        help_texts = {
            'identity_document': 'Solo visible en el panel para verificación.',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and getattr(self.instance, 'user_id', None):
            self.fields['avatar'].initial = self.instance.user.avatar

    def save(self, commit=True):
        profile = super().save(commit=commit)
        avatar = self.cleaned_data.get('avatar')
        if avatar:
            profile.user.avatar = avatar
            if commit:
                profile.user.save(update_fields=['avatar'])
        return profile


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


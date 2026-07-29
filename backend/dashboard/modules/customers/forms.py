"""Formularios exclusivos de clientes (sin campos de otros roles)."""

from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError

from accounts.models import User, UserRole
from accounts.phone import validate_required_mx_phone
from accounts.username import normalize_username
from dashboard.gestion.forms import PanelFormMixin


class CustomerCreateForm(PanelFormMixin, UserCreationForm):
    """Alta de cliente. role=customer se asigna solo en save() del servidor."""

    email = forms.EmailField(
        required=True,
        label='Correo',
        widget=forms.EmailInput(attrs={
            'autocomplete': 'email',
            'required': True,
        }),
    )
    first_name = forms.CharField(
        required=True,
        max_length=150,
        label='Nombre',
        widget=forms.TextInput(attrs={'required': True, 'autocomplete': 'given-name'}),
    )
    last_name = forms.CharField(
        required=True,
        max_length=150,
        label='Apellidos',
        widget=forms.TextInput(attrs={'required': True, 'autocomplete': 'family-name'}),
    )
    phone = forms.CharField(
        required=True,
        max_length=20,
        label='Teléfono',
        help_text='10 dígitos (México).',
        widget=forms.TextInput(attrs={
            'required': True,
            'inputmode': 'numeric',
            'autocomplete': 'tel',
            'placeholder': '4431234567',
        }),
    )
    address = forms.CharField(
        required=False,
        label='Dirección',
        widget=forms.Textarea(attrs={'rows': 2, 'autocomplete': 'street-address'}),
    )

    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'email', 'phone', 'address',
            'password1', 'password2',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].help_text = (
            'Se guarda en minúsculas. El cliente inicia sesión con este usuario.'
        )
        self.fields['password1'].help_text = (
            'Mínimo 8 caracteres; evita que sea igual al usuario o solo números.'
        )
        self.fields['password1'].widget.attrs['required'] = True
        self.fields['password2'].widget.attrs['required'] = True
        self.fields['username'].widget.attrs['required'] = True
        self.fields['username'].widget.attrs['autocomplete'] = 'username'

    def clean_username(self):
        username = normalize_username(self.cleaned_data['username'])
        if not username:
            raise ValidationError('El usuario es obligatorio.')
        if User.objects.filter(username__iexact=username).exists():
            raise ValidationError('Ya existe un usuario con ese nombre.')
        return username

    def clean_email(self):
        email = (self.cleaned_data.get('email') or '').strip().lower()
        if not email:
            raise ValidationError('El correo es obligatorio.')
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError('Este correo ya está registrado.')
        return email

    def clean_first_name(self):
        name = (self.cleaned_data.get('first_name') or '').strip()
        if not name:
            raise ValidationError('El nombre es obligatorio.')
        return name

    def clean_last_name(self):
        name = (self.cleaned_data.get('last_name') or '').strip()
        if not name:
            raise ValidationError('Los apellidos son obligatorios.')
        return name

    def clean_phone(self):
        try:
            return validate_required_mx_phone(self.cleaned_data.get('phone'))
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = UserRole.CUSTOMER
        user.is_staff = False
        user.is_superuser = False
        user.email = self.cleaned_data['email']
        user.first_name = self.cleaned_data['first_name']
        user.last_name = self.cleaned_data['last_name']
        user.phone = self.cleaned_data['phone']
        user.address = (self.cleaned_data.get('address') or '').strip()
        if commit:
            user.save()
        return user


class CustomerEditForm(PanelFormMixin, forms.ModelForm):
    """Edición de cliente. No permite cambiar role ni tocar otros perfiles."""

    email = forms.EmailField(
        required=True,
        label='Correo',
        widget=forms.EmailInput(attrs={'required': True, 'autocomplete': 'email'}),
    )
    phone = forms.CharField(
        required=True,
        max_length=20,
        label='Teléfono',
        help_text='10 dígitos (México).',
        widget=forms.TextInput(attrs={
            'required': True,
            'inputmode': 'numeric',
            'autocomplete': 'tel',
        }),
    )
    is_active = forms.BooleanField(
        required=False,
        label='Cuenta activa',
        help_text='Si está desactivada, el cliente no puede iniciar sesión.',
    )

    class Meta:
        model = User
        fields = (
            'username', 'first_name', 'last_name', 'email', 'phone', 'address',
            'is_active',
        )
        widgets = {
            'address': forms.Textarea(attrs={'rows': 2}),
            'first_name': forms.TextInput(attrs={'required': True}),
            'last_name': forms.TextInput(attrs={'required': True}),
            'username': forms.TextInput(attrs={'required': True, 'autocomplete': 'username'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['first_name'].required = True
        self.fields['last_name'].required = True
        self.fields['username'].help_text = 'Se guarda en minúsculas.'
        self.fields['is_active'].widget.attrs['class'] = 'form-check-input'

    def clean_username(self):
        username = normalize_username(self.cleaned_data['username'])
        if not username:
            raise ValidationError('El usuario es obligatorio.')
        qs = User.objects.filter(username__iexact=username)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError('Ya existe un usuario con ese nombre.')
        return username

    def clean_email(self):
        email = (self.cleaned_data.get('email') or '').strip().lower()
        if not email:
            raise ValidationError('El correo es obligatorio.')
        qs = User.objects.filter(email__iexact=email)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise ValidationError('Este correo ya está registrado.')
        return email

    def clean_first_name(self):
        name = (self.cleaned_data.get('first_name') or '').strip()
        if not name:
            raise ValidationError('El nombre es obligatorio.')
        return name

    def clean_last_name(self):
        name = (self.cleaned_data.get('last_name') or '').strip()
        if not name:
            raise ValidationError('Los apellidos son obligatorios.')
        return name

    def clean_phone(self):
        try:
            return validate_required_mx_phone(self.cleaned_data.get('phone'))
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def save(self, commit=True):
        user = super().save(commit=False)
        # Defensa: nunca permitir que un POST manipulado cambie el rol.
        user.role = UserRole.CUSTOMER
        if commit:
            user.save()
        return user

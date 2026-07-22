from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

from .username import normalize_username

User = get_user_model()


class CaseInsensitiveUsernameBackend(ModelBackend):
    """Login con usuario o correo (sin importar mayúsculas)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        login_field = User.USERNAME_FIELD
        if username is None:
            username = kwargs.get(login_field)
        if username is None or password is None:
            return None

        raw = (username or '').strip()
        if not raw:
            return None

        normalized = normalize_username(raw)
        user = None
        if normalized:
            try:
                user = User.objects.get(**{f'{login_field}__iexact': normalized})
            except User.DoesNotExist:
                user = None

        if user is None and '@' in raw:
            user = User.objects.filter(email__iexact=raw.lower()).first()

        if user is None:
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

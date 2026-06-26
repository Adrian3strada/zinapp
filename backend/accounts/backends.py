from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

from .username import normalize_username

User = get_user_model()


class CaseInsensitiveUsernameBackend(ModelBackend):
    """Login con usuario sin importar mayúsculas (panel vs app)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        login_field = User.USERNAME_FIELD
        if username is None:
            username = kwargs.get(login_field)
        if username is None or password is None:
            return None

        normalized = normalize_username(username)
        if not normalized:
            return None

        try:
            user = User.objects.get(**{f'{login_field}__iexact': normalized})
        except User.DoesNotExist:
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

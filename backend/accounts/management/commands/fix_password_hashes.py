from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import is_password_usable
from django.core.management.base import BaseCommand

User = get_user_model()

HASH_PREFIXES = (
    'pbkdf2_sha256$',
    'argon2',
    'bcrypt',
    'sha1$',
    'md5$',
)


def looks_hashed(password: str) -> bool:
    return any(password.startswith(prefix) for prefix in HASH_PREFIXES)


class Command(BaseCommand):
    help = (
        'Re-hashea contraseñas guardadas en texto plano (usuarios creados desde el panel '
        'antes de corregir el guardado).'
    )

    def handle(self, *args, **options):
        fixed = 0
        skipped = 0

        for user in User.objects.all().only('id', 'username', 'password'):
            encoded = user.password or ''
            if not encoded or not is_password_usable(encoded):
                skipped += 1
                continue
            if looks_hashed(encoded):
                continue

            raw = encoded
            user.set_password(raw)
            user.save(update_fields=['password'])
            fixed += 1
            self.stdout.write(f'  {user.username}: contraseña re-hasheada')

        self.stdout.write(
            self.style.SUCCESS(
                f'Listo. {fixed} usuario(s) corregido(s), {skipped} sin cambios.',
            ),
        )

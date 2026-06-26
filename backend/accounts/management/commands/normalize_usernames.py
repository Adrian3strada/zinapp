from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.username import normalize_username

User = get_user_model()


class Command(BaseCommand):
    help = 'Normaliza usernames a minúsculas (panel + app).'

    def handle(self, *args, **options):
        updated = 0
        for user in User.objects.all().only('id', 'username'):
            normalized = normalize_username(user.username)
            if not normalized or normalized == user.username:
                continue
            if User.objects.filter(username=normalized).exclude(pk=user.pk).exists():
                self.stderr.write(
                    self.style.WARNING(
                        f'Salta {user.username!r}: ya existe {normalized!r}',
                    ),
                )
                continue
            user.username = normalized
            user.save(update_fields=['username'])
            updated += 1
            self.stdout.write(f'  {user.pk}: -> {normalized}')
        self.stdout.write(self.style.SUCCESS(f'Listo. {updated} usuario(s) actualizado(s).'))

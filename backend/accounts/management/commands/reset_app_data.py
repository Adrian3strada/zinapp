import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from accounts.models import UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Vacía todos los datos de la app (usuarios, pedidos, restaurantes) para empezar en limpio'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirma que quieres borrar todos los datos',
        )
        parser.add_argument(
            '--create-admin',
            metavar='USERNAME',
            help='Crea un superusuario tras vaciar (ej. admin)',
        )
        parser.add_argument(
            '--admin-password',
            default='',
            help='Contraseña del admin (o variable RESET_ADMIN_PASSWORD)',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            raise CommandError(
                'Operación destructiva. Usa: python manage.py reset_app_data --confirm'
            )

        self.stdout.write(self.style.WARNING('Vaciando base de datos…'))
        call_command('flush', interactive=False)
        self.stdout.write(self.style.SUCCESS('Base de datos vacía.'))

        username = (options.get('create_admin') or '').strip()
        if not username:
            username = os.environ.get('RESET_ADMIN_USERNAME', '').strip()

        password = (options.get('admin_password') or '').strip()
        if not password:
            password = os.environ.get('RESET_ADMIN_PASSWORD', '').strip()

        if username:
            if not password:
                raise CommandError(
                    'Indica --admin-password o la variable RESET_ADMIN_PASSWORD'
                )
            if len(password) < 8:
                raise CommandError('La contraseña del admin debe tener al menos 8 caracteres')

            user = User.objects.create_superuser(
                username=username,
                email=os.environ.get('RESET_ADMIN_EMAIL', 'admin@zinapp.mx'),
                password=password,
                role=UserRole.ADMIN,
            )
            self.stdout.write(
                self.style.SUCCESS(f'Administrador creado: {user.username}')
            )
        else:
            self.stdout.write(
                'Sin admin creado. Usa createsuperuser o --create-admin para el panel.'
            )

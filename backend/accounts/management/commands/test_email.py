from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from config.email_utils import (
    email_delivery_configured,
    email_reset_enabled,
    resend_api_key,
    send_app_email,
)


class Command(BaseCommand):
    help = 'Prueba el envío de correo (Resend HTTP, SMTP o consola en DEBUG).'

    def add_arguments(self, parser):
        parser.add_argument('to_email', help='Correo destino de la prueba')

    def handle(self, *args, **options):
        to_email = (options['to_email'] or '').strip()
        if not to_email or '@' not in to_email:
            raise CommandError('Indica un correo válido, ej. python manage.py test_email tu@correo.com')

        self.stdout.write(f'EMAIL_BACKEND = {settings.EMAIL_BACKEND}')
        self.stdout.write(f'RESEND_API_KEY = {"(definido)" if settings.RESEND_API_KEY else "(vacío)"}')
        self.stdout.write(f'EMAIL_HOST = {settings.EMAIL_HOST or "(vacío)"}')
        self.stdout.write(f'EMAIL_HOST_USER = {settings.EMAIL_HOST_USER or "(vacío)"}')
        self.stdout.write(
            f'EMAIL_HOST_PASSWORD = {"(definido)" if settings.EMAIL_HOST_PASSWORD else "(vacío)"}'
        )
        self.stdout.write(f'DEFAULT_FROM_EMAIL = {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'resend_api_key = {"(sí)" if resend_api_key() else "(no)"}')
        self.stdout.write(f'email_delivery_configured = {email_delivery_configured()}')
        self.stdout.write(f'email_reset_enabled = {email_reset_enabled()}')

        if not email_reset_enabled():
            raise CommandError(
                'Correo deshabilitado. En Railway/.env define:\n'
                '  RESEND_API_KEY=<API_KEY de Resend>\n'
                '  DEFAULT_FROM_EMAIL=ZinApp <onboarding@resend.dev>\n'
                'O compat SMTP (también usa HTTP automáticamente):\n'
                '  EMAIL_HOST=smtp.resend.com\n'
                '  EMAIL_HOST_USER=resend\n'
                '  EMAIL_HOST_PASSWORD=<API_KEY>\n'
                'Con dominio verificado: DEFAULT_FROM_EMAIL=ZinApp <noreply@zinapp.com.mx>'
            )

        try:
            send_app_email(
                subject='Prueba ZinApp - correo OK',
                message=(
                    'Si lees esto, el correo de ZinApp está funcionando.\n'
                    'La recuperación de contraseña puede enviar códigos.'
                ),
                recipient_list=[to_email],
            )
        except Exception as exc:
            raise CommandError(f'Falló el envío: {exc}') from exc

        if email_delivery_configured():
            channel = 'Resend HTTP' if resend_api_key() else 'SMTP'
            self.stdout.write(self.style.SUCCESS(f'Correo enviado a {to_email} vía {channel}'))
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'Enviado por consola (sin entrega real). Revisa el log del runserver. Destino: {to_email}'
                )
            )

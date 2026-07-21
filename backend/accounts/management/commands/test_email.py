from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError

from config.email_utils import email_reset_enabled, email_smtp_configured


class Command(BaseCommand):
    help = 'Prueba el envío de correo (SMTP Resend o consola en DEBUG).'

    def add_arguments(self, parser):
        parser.add_argument('to_email', help='Correo destino de la prueba')

    def handle(self, *args, **options):
        to_email = (options['to_email'] or '').strip()
        if not to_email or '@' not in to_email:
            raise CommandError('Indica un correo válido, ej. python manage.py test_email tu@correo.com')

        self.stdout.write(f'EMAIL_BACKEND = {settings.EMAIL_BACKEND}')
        self.stdout.write(f'EMAIL_HOST = {settings.EMAIL_HOST or "(vacío)"}')
        self.stdout.write(f'EMAIL_HOST_USER = {settings.EMAIL_HOST_USER or "(vacío)"}')
        self.stdout.write(
            f'EMAIL_HOST_PASSWORD = {"(definido)" if settings.EMAIL_HOST_PASSWORD else "(vacío)"}'
        )
        self.stdout.write(f'DEFAULT_FROM_EMAIL = {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'smtp_configured = {email_smtp_configured()}')
        self.stdout.write(f'email_reset_enabled = {email_reset_enabled()}')

        if not email_reset_enabled():
            raise CommandError(
                'Correo deshabilitado. En Railway/.env define:\n'
                '  EMAIL_HOST=smtp.resend.com\n'
                '  EMAIL_PORT=587\n'
                '  EMAIL_HOST_USER=resend\n'
                '  EMAIL_HOST_PASSWORD=<API_KEY de Resend>\n'
                '  EMAIL_USE_TLS=True\n'
                '  DEFAULT_FROM_EMAIL=ZinApp <onboarding@resend.dev>\n'
                'Con dominio verificado: DEFAULT_FROM_EMAIL=ZinApp <noreply@zinapp.com.mx>'
            )

        try:
            send_mail(
                subject='Prueba ZinApp - correo OK',
                message=(
                    'Si lees esto, el SMTP de ZinApp está funcionando.\n'
                    'La recuperación de contraseña puede enviar códigos.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[to_email],
                fail_silently=False,
            )
        except Exception as exc:
            raise CommandError(f'Falló el envío: {exc}') from exc

        if email_smtp_configured():
            self.stdout.write(self.style.SUCCESS(f'Correo enviado a {to_email}'))
        else:
            self.stdout.write(
                self.style.WARNING(
                    f'Enviado por consola (sin SMTP). Revisa el log del runserver. Destino: {to_email}'
                )
            )

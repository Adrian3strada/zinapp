from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from config.landing_views import get_landing_faqs
from config.seo import LEGACY_PRIVACY_EMAIL, get_contact_email, get_privacy_email
from local_services.models import LocalService
from restaurants.models import Restaurant

User = get_user_model()


class LandingPageTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_landing_renders_core_message_and_ctas(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Todo Zinapécuaro en una sola app')
        self.assertContains(response, 'Ver restaurantes y comida')
        self.assertContains(response, 'Descargar ZinApp')
        self.assertContains(response, '/privacidad/')
        self.assertNotContains(response, 'ficha de Google Play')
        self.assertNotContains(response, 'SUPPORT_WHATSAPP')
        self.assertNotContains(response, 'SUPPORT_EMAIL')

    def test_faq_android_copy_depends_on_play_flag(self):
        off = get_landing_faqs(google_play_enabled=False)
        on = get_landing_faqs(google_play_enabled=True)
        self.assertIn('navegador', off[0]['answer'])
        self.assertIn('hasta que esté en Google Play', off[0]['answer'])
        self.assertIn('Google Play', on[0]['answer'])
        self.assertNotIn('hasta que esté', on[0]['answer'])

    @override_settings(GOOGLE_PLAY_ENABLED=False, PLAY_STORE_URL='https://play.google.com/store/apps/details?id=com.zinapp.delivery')
    def test_play_button_hidden_until_enabled(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'https://play.google.com/store/apps/details?id=com.zinapp.delivery')
        self.assertContains(response, 'Usar ZinApp en Android')

    def test_real_restaurant_appears_instead_of_demo(self):
        owner = User.objects.create_user(username='rest_landing', password='pass1234', role='restaurant')
        Restaurant.objects.create(
            owner=owner,
            name='Taquería Centro Test',
            address='Centro, Zinapécuaro',
            description='Tacos de guisado y suadero.',
            is_active=True,
        )
        response = self.client.get('/')
        self.assertContains(response, 'Taquería Centro Test')
        self.assertContains(response, 'Tacos de guisado y suadero.')
        self.assertNotContains(response, 'Ejemplo: Taquería El Centro')

    def test_newest_section_only_shows_businesses_outside_featured(self):
        owner = User.objects.create_user(username='rest_many', password='pass1234', role='restaurant')
        for i in range(8):
            Restaurant.objects.create(
                owner=owner,
                name=f'Restaurante {i:02d}',
                address='Zinapécuaro',
                is_active=True,
            )
        LocalService.objects.create(name='Taller Nuevo', is_active=True)
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Nuevos en ZinApp')

    @override_settings(SUPPORT_EMAIL='', PRIVACY_EMAIL='', CONTACT_EMAIL='')
    def test_privacy_page_uses_configured_email_and_canonical(self):
        response = self.client.get('/privacidad/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'rel="canonical"')
        self.assertContains(response, '/privacidad/')
        self.assertContains(response, LEGACY_PRIVACY_EMAIL)

    @override_settings(PRIVACY_EMAIL='privacidad@zinapp.com.mx', SUPPORT_EMAIL='soporte@zinapp.com.mx')
    def test_privacy_email_prefers_corporate_mailbox(self):
        self.assertEqual(get_privacy_email(), 'privacidad@zinapp.com.mx')
        self.assertEqual(get_contact_email(), 'soporte@zinapp.com.mx')
        response = self.client.get('/privacidad/')
        self.assertContains(response, 'privacidad@zinapp.com.mx')
        self.assertNotContains(response, LEGACY_PRIVACY_EMAIL)

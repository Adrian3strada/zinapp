from datetime import datetime, time
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from config.landing_views import get_landing_faqs, parse_schedule_open_now
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


class LandingApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_landing_api_returns_core_payload(self):
        response = self.client.get('/api/landing/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('public, max-age=60', response['Cache-Control'])
        data = response.json()
        self.assertEqual(data['seo_title'], 'Comida a domicilio en Zinapécuaro | ZinApp')
        self.assertTrue(data['featured_businesses'])
        self.assertTrue(data['featured_is_demo'])
        self.assertEqual(data['featured_businesses'][0]['name'], 'Ejemplo: Taquería El Centro')
        self.assertTrue(data['landing_faqs'])
        self.assertIn('navegador', data['landing_faqs'][0]['answer'])
        self.assertIn('/privacidad/', data['privacy_seo_graph'][0]['url'])
        self.assertFalse(data['google_play_enabled'])

    @override_settings(
        GOOGLE_PLAY_ENABLED=False,
        PLAY_STORE_URL='https://play.google.com/store/apps/details?id=com.zinapp.delivery',
    )
    def test_landing_api_hides_play_store_until_enabled(self):
        data = self.client.get('/api/landing/').json()
        self.assertFalse(data['google_play_enabled'])
        self.assertEqual(data['play_store_url'], '')

    def test_landing_api_uses_real_restaurant_instead_of_demo(self):
        owner = User.objects.create_user(username='rest_landing_api', password='pass1234', role='restaurant')
        Restaurant.objects.create(
            owner=owner,
            name='Taquería Centro Test',
            address='Centro, Zinapécuaro',
            description='Tacos de guisado y suadero.',
            is_active=True,
        )
        data = self.client.get('/api/landing/').json()
        names = [biz['name'] for biz in data['featured_businesses']]
        self.assertIn('Taquería Centro Test', names)
        self.assertFalse(data['featured_is_demo'])
        self.assertNotIn('Ejemplo: Taquería El Centro', names)

    def test_landing_api_newest_excludes_featured(self):
        owner = User.objects.create_user(username='rest_many_api', password='pass1234', role='restaurant')
        for i in range(8):
            Restaurant.objects.create(
                owner=owner,
                name=f'Restaurante {i:02d}',
                address='Zinapécuaro',
                is_active=True,
            )
        LocalService.objects.create(name='Taller Nuevo', is_active=True)
        data = self.client.get('/api/landing/').json()
        featured_ids = {biz['id'] for biz in data['featured_businesses']}
        newest_ids = {biz['id'] for biz in data['newest_businesses']}
        self.assertTrue(data['newest_businesses'])
        self.assertFalse(featured_ids & newest_ids)

    @override_settings(PRIVACY_EMAIL='privacidad@zinapp.com.mx', SUPPORT_EMAIL='soporte@zinapp.com.mx')
    def test_landing_api_privacy_email_prefers_corporate_mailbox(self):
        data = self.client.get('/api/landing/').json()
        self.assertEqual(data['privacy_email'], 'privacidad@zinapp.com.mx')
        self.assertEqual(data['contact_email'], 'soporte@zinapp.com.mx')
        self.assertNotEqual(data['privacy_email'], LEGACY_PRIVACY_EMAIL)

    def test_landing_api_includes_coverage_bounds(self):
        data = self.client.get('/api/landing/').json()
        coverage = data['coverage']
        self.assertEqual(coverage['label'], 'Zinapécuaro, Michoacán')
        self.assertLess(coverage['bounds']['min_lat'], coverage['bounds']['max_lat'])
        self.assertLess(coverage['bounds']['min_lon'], coverage['bounds']['max_lon'])

    def test_landing_api_marks_restaurant_open_from_hours(self):
        owner = User.objects.create_user(username='rest_hours', password='pass1234', role='restaurant')
        Restaurant.objects.create(
            owner=owner,
            name='Fonda Abierta',
            address='Centro, Zinapécuaro',
            is_active=True,
            opening_time=time(8, 0),
            closing_time=time(22, 0),
            latitude='19.860000',
            longitude='-100.827000',
        )
        noon = timezone.make_aware(datetime(2026, 9, 15, 12, 0))
        with patch('config.landing_views.timezone.localtime', return_value=noon):
            data = self.client.get('/api/landing/').json()
        fonda = next(biz for biz in data['featured_businesses'] if biz['name'] == 'Fonda Abierta')
        self.assertTrue(fonda['is_open_now'])
        self.assertAlmostEqual(fonda['latitude'], 19.86, places=4)
        self.assertAlmostEqual(fonda['longitude'], -100.827, places=3)


class ScheduleOpenNowTests(TestCase):
    def test_parses_spanish_range_during_open_hours(self):
        noon = timezone.make_aware(datetime(2026, 9, 15, 12, 0))
        self.assertTrue(
            parse_schedule_open_now('Lun–Dom · 11:00 a. m.–10:00 p. m.', now=noon)
        )

    def test_closed_outside_hours_or_day(self):
        night = timezone.make_aware(datetime(2026, 9, 15, 23, 0))
        self.assertFalse(
            parse_schedule_open_now('Lun–Dom · 11:00 a. m.–10:00 p. m.', now=night)
        )
        sunday = timezone.make_aware(datetime(2026, 9, 13, 12, 0))
        self.assertFalse(parse_schedule_open_now('Lun–Sáb · 10:00 a. m.–7:00 p. m.', now=sunday))

    def test_unknown_schedule_returns_none(self):
        self.assertIsNone(parse_schedule_open_now('Horario no disponible'))
        self.assertIsNone(parse_schedule_open_now(''))


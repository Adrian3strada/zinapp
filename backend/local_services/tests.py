from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import LocalService, LocalServiceCategory

User = get_user_model()


class LocalServiceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='cliente1',
            password='test1234',
            role='customer',
        )
        self.active = LocalService.objects.create(
            name='Peluquería Demo',
            category=LocalServiceCategory.BEAUTY,
            description='Cortes y peinados',
            address='Centro, Zinapécuaro',
            schedule='Lun–Sáb 10:00–19:00',
            phone='4171234567',
            whatsapp='4171234567',
            instagram='@salonmaria',
            is_active=True,
            sort_order=0,
        )
        LocalService.objects.create(
            name='Taller Mecánico',
            category=LocalServiceCategory.AUTO,
            description='Frenos y afino',
            is_active=True,
            sort_order=1,
        )
        LocalService.objects.create(
            name='Oculto',
            description='No visible',
            is_active=False,
        )

    def test_list_requires_auth(self):
        res = self.client.get('/api/local-services/')
        self.assertEqual(res.status_code, 401)

    def test_list_active_only(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/local-services/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)
        self.assertEqual(res.data[0]['name'], 'Peluquería Demo')
        self.assertEqual(res.data[0]['category'], 'beauty')
        self.assertEqual(res.data[0]['category_display'], 'Belleza')
        self.assertIn('schedule', res.data[0])
        self.assertIn('logo_url', res.data[0])

    def test_filter_by_category(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/local-services/', {'category': 'auto'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Taller Mecánico')

    def test_no_create_via_api(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/local-services/', {'name': 'Hack'})
        self.assertIn(res.status_code, (403, 405))

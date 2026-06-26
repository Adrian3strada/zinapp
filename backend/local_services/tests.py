from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import LocalService

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
            description='Cortes y peinados',
            phone='4171234567',
            whatsapp='4171234567',
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
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Peluquería Demo')
        self.assertIn('logo_url', res.data[0])

    def test_no_create_via_api(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/local-services/', {'name': 'Hack'})
        self.assertIn(res.status_code, (403, 405))

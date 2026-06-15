from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import DeliveryProfile

User = get_user_model()


class DeliveryProfileApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.driver = User.objects.create_user(
            username='kike',
            password='test1234',
            role='driver',
        )
        DeliveryProfile.objects.create(user=self.driver, is_available=False)

    def test_driver_can_toggle_availability_via_me(self):
        self.client.force_authenticate(self.driver)
        response = self.client.patch(
            '/api/auth/delivery-profiles/me/',
            {'is_available': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_available'])

    def test_driver_can_read_own_profile_via_me(self):
        self.client.force_authenticate(self.driver)
        response = self.client.get('/api/auth/delivery-profiles/me/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], self.driver.id)

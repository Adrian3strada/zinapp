from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from accounts.models import UserRole

User = get_user_model()


@override_settings(GOOGLE_OAUTH_CLIENT_IDS=['test-google-client.apps.googleusercontent.com'])
class GoogleLoginApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.claims = {
            'sub': 'google-sub-123',
            'email': 'cliente.google@example.com',
            'email_verified': True,
            'given_name': 'Ana',
            'family_name': 'López',
            'name': 'Ana López',
            'picture': '',
        }

    @patch('accounts.views.verify_google_id_token')
    def test_google_login_creates_customer(self, mock_verify):
        mock_verify.return_value = self.claims
        response = self.client.post(
            '/api/auth/google/',
            {'id_token': 'fake.google.token'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'cliente.google@example.com')
        self.assertEqual(response.data['user']['role'], UserRole.CUSTOMER)
        user = User.objects.get(email='cliente.google@example.com')
        self.assertEqual(user.google_sub, 'google-sub-123')
        self.assertFalse(user.has_usable_password())

    @patch('accounts.views.verify_google_id_token')
    def test_google_login_links_existing_email(self, mock_verify):
        existing = User.objects.create_user(
            username='ana_existente',
            password='test1234',
            email='cliente.google@example.com',
            role=UserRole.CUSTOMER,
        )
        mock_verify.return_value = self.claims
        response = self.client.post(
            '/api/auth/google/',
            {'id_token': 'fake.google.token'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        existing.refresh_from_db()
        self.assertEqual(existing.google_sub, 'google-sub-123')
        self.assertEqual(response.data['user']['id'], existing.id)
        self.assertEqual(User.objects.filter(email__iexact='cliente.google@example.com').count(), 1)

    @override_settings(GOOGLE_OAUTH_CLIENT_IDS=[])
    def test_google_login_disabled_without_client_ids(self):
        response = self.client.post(
            '/api/auth/google/',
            {'id_token': 'fake.google.token'},
            format='json',
        )
        self.assertEqual(response.status_code, 503)

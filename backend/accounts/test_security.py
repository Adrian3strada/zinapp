from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.settings import api_settings
from rest_framework.test import APIClient

THROTTLE_SETTINGS = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/min',
        'user': '400/min',
        'login': '3/min',
        'register': '5/hour',
        'forgot_password': '8/hour',
        'reset_password': '15/hour',
        'token_refresh': '30/min',
    },
}


class AuthRateLimitTests(TestCase):
    def test_login_rate_limit_returns_429(self):
        cache.clear()
        api_settings.reload()
        client = APIClient()
        payload = {'username': 'nobody', 'password': 'wrong-password'}
        statuses = []
        for _ in range(11):
            response = client.post('/api/auth/login/', payload, format='json')
            statuses.append(response.status_code)
        self.assertIn(429, statuses)
        self.assertTrue(all(code in (400, 401, 429) for code in statuses))

    def test_register_rate_limit_returns_429(self):
        cache.clear()
        with override_settings(REST_FRAMEWORK=THROTTLE_SETTINGS):
            api_settings.reload()
            client = APIClient()
            for index in range(5):
                response = client.post(
                    '/api/auth/register/',
                    {
                        'username': f'user_{index}',
                        'email': f'user_{index}@example.com',
                        'password': 'test1234',
                        'password_confirm': 'test1234',
                        'first_name': 'Test',
                        'last_name': 'User',
                        'role': 'customer',
                    },
                    format='json',
                )
                self.assertIn(response.status_code, (201, 400))

            blocked = client.post(
                '/api/auth/register/',
                {
                    'username': 'user_blocked',
                    'email': 'blocked@example.com',
                    'password': 'test1234',
                    'password_confirm': 'test1234',
                    'first_name': 'Test',
                    'last_name': 'User',
                    'role': 'customer',
                },
                format='json',
            )
            self.assertEqual(blocked.status_code, 429)

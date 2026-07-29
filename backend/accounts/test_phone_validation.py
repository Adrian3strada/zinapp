from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import UserRole
from accounts.phone import normalize_mx_phone, validate_required_mx_phone
from django.contrib.auth import get_user_model

User = get_user_model()


class PhoneValidationTests(TestCase):
    def test_normalize_strips_country_code(self):
        self.assertEqual(normalize_mx_phone('+52 443 123 4567'), '4431234567')
        self.assertEqual(normalize_mx_phone('524431234567'), '4431234567')

    def test_required_rejects_blank(self):
        for value in (None, '', '   ', '\t'):
            with self.assertRaises(ValueError):
                validate_required_mx_phone(value)

    def test_required_rejects_short(self):
        with self.assertRaises(ValueError):
            validate_required_mx_phone('443123')


class RegisterPhoneRequiredTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_customer_register_requires_phone(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'cli_sin_tel',
                'email': 'cli_sin_tel@example.com',
                'password': 'clave12345',
                'password_confirm': 'clave12345',
                'first_name': 'Ana',
                'last_name': 'Pérez',
                'role': 'customer',
                'phone': '',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)

    def test_customer_register_accepts_valid_phone(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'cli_con_tel',
                'email': 'cli_con_tel@example.com',
                'password': 'clave12345',
                'password_confirm': 'clave12345',
                'first_name': 'Ana',
                'last_name': 'Pérez',
                'role': 'customer',
                'phone': '443-123-4567',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username='cli_con_tel')
        self.assertEqual(user.phone, '4431234567')
        self.assertEqual(user.role, UserRole.CUSTOMER)

    def test_register_rejects_whitespace_names(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'cli_nombre',
                'email': 'cli_nombre@example.com',
                'password': 'clave12345',
                'password_confirm': 'clave12345',
                'first_name': '   ',
                'last_name': 'Pérez',
                'role': 'customer',
                'phone': '4431234567',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('first_name', response.data)

import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import DeliveryProfile, PasswordResetToken, UserRole
from orders.models import Coupon, Order, OrderStatus
from restaurants.models import Restaurant

User = get_user_model()


class _FakeResendResponse:
    def __init__(self, payload: dict, status: int = 200):
        self.status = status
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ForgotPasswordEmailTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='reset_user',
            password='test1234',
            role=UserRole.CUSTOMER,
            email='reset.user@example.com',
        )

    @override_settings(
        RESEND_API_KEY='re_test_key',
        DEFAULT_FROM_EMAIL='ZinApp <onboarding@resend.dev>',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD='',
    )
    @patch('config.email_utils.urllib.request.urlopen')
    def test_forgot_password_uses_resend_http(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResendResponse({'id': 'msg_123'})

        response = self.client.post(
            '/api/auth/forgot-password/',
            {'identifier': self.user.email},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user, used=False).exists())
        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args.args[0]
        self.assertEqual(req.full_url, 'https://api.resend.com/emails')
        self.assertEqual(req.get_header('Authorization'), 'Bearer re_test_key')
        body = json.loads(req.data.decode('utf-8'))
        self.assertEqual(body['to'], ['reset.user@example.com'])
        self.assertIn('Restablece tu contraseña', body['subject'])
        token = PasswordResetToken.objects.filter(user=self.user, used=False).latest('created_at')
        self.assertIn(token.token, body['text'])

    def test_reset_password_idempotent_on_retry(self):
        token = PasswordResetToken.objects.create(
            user=self.user,
            token='ABCD2345',
            expires_at=timezone.now() + timedelta(hours=2),
        )
        first = self.client.post(
            '/api/auth/reset-password/',
            {'token': 'ABCD2345', 'new_password': 'NuevaClave99'},
        )
        self.assertEqual(first.status_code, 200, first.data)
        token.refresh_from_db()
        self.assertTrue(token.used)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NuevaClave99'))

        # Doble toque / reintento con la misma contraseña no debe fallar.
        second = self.client.post(
            '/api/auth/reset-password/',
            {'token': 'abcd2345', 'new_password': 'NuevaClave99'},
        )
        self.assertEqual(second.status_code, 200, second.data)

        # Código ya usado con otra contraseña sí falla.
        third = self.client.post(
            '/api/auth/reset-password/',
            {'token': 'ABCD2345', 'new_password': 'OtraClave88'},
        )
        self.assertEqual(third.status_code, 400)

    @override_settings(
        RESEND_API_KEY='re_test_key',
        DEFAULT_FROM_EMAIL='ZinApp <onboarding@resend.dev>',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD='',
    )
    @patch('config.email_utils.urllib.request.urlopen')
    def test_second_forgot_keeps_latest_code_usable(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResendResponse({'id': 'msg_1'})
        first = self.client.post(
            '/api/auth/forgot-password/',
            {'identifier': self.user.email},
        )
        self.assertEqual(first.status_code, 200)
        first_token = PasswordResetToken.objects.filter(user=self.user, used=False).latest('created_at')

        mock_urlopen.return_value = _FakeResendResponse({'id': 'msg_2'})
        second = self.client.post(
            '/api/auth/forgot-password/',
            {'identifier': self.user.email},
        )
        self.assertEqual(second.status_code, 200)
        latest = PasswordResetToken.objects.filter(user=self.user).latest('created_at')
        first_token.refresh_from_db()
        self.assertTrue(first_token.used)
        self.assertFalse(latest.used)

        reset = self.client.post(
            '/api/auth/reset-password/',
            {'token': latest.token, 'new_password': 'ClaveNueva55'},
        )
        self.assertEqual(reset.status_code, 200, reset.data)

    @override_settings(
        RESEND_API_KEY='re_test_key',
        DEFAULT_FROM_EMAIL='ZinApp <onboarding@resend.dev>',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD='',
    )
    @patch('config.email_utils.urllib.request.urlopen')
    def test_concurrent_forgot_does_not_burn_newer_code(self, mock_urlopen):
        mock_urlopen.return_value = _FakeResendResponse({'id': 'msg_race'})
        older = PasswordResetToken.objects.create(
            user=self.user,
            token='OLDER234',
            expires_at=timezone.now() + timedelta(hours=2),
        )
        newer = PasswordResetToken.objects.create(
            user=self.user,
            token='NEWER567',
            expires_at=timezone.now() + timedelta(hours=2),
        )
        from django.db.models import Q

        # El activate del request viejo no debe quemar el código más nuevo
        # aunque ambos tengan el mismo created_at (SQLite).
        PasswordResetToken.objects.filter(user=self.user, used=False).filter(
            Q(created_at__lt=older.created_at)
            | Q(created_at=older.created_at, pk__lt=older.pk),
        ).update(used=True)
        older.refresh_from_db()
        newer.refresh_from_db()
        self.assertFalse(older.used)
        self.assertFalse(newer.used)

        PasswordResetToken.objects.filter(user=self.user, used=False).filter(
            Q(created_at__lt=newer.created_at)
            | Q(created_at=newer.created_at, pk__lt=newer.pk),
        ).update(used=True)
        older.refresh_from_db()
        newer.refresh_from_db()
        self.assertTrue(older.used)
        self.assertFalse(newer.used)


class HardeningApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='hard_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            phone='4431111111',
            address='Calle Secreta 1',
            email='customer@example.com',
        )
        self.driver = User.objects.create_user(
            username='hard_driver',
            password='test1234',
            role=UserRole.DRIVER,
        )
        DeliveryProfile.objects.create(
            user=self.driver,
            verification_status=DeliveryProfile.VerificationStatus.APPROVED,
            is_available=True,
        )
        self.owner = User.objects.create_user(
            username='hard_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Local Hard',
            address='Centro',
            is_active=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.READY,
            delivery_address='Calle Secreta 99',
            delivery_notes='Portón azul',
            subtotal=Decimal('100.00'),
            delivery_fee=Decimal('20.00'),
            total=Decimal('120.00'),
        )
        Coupon.objects.create(
            code='PUBLICO10',
            description='Promo',
            discount_percent=10,
            is_active=True,
        )

    @override_settings(
        RESEND_API_KEY='',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD='',
        EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend',
    )
    def test_forgot_password_does_not_enumerate_users(self):
        missing = self.client.post('/api/auth/forgot-password/', {'identifier': 'no_existe_xyz'})
        existing = self.client.post('/api/auth/forgot-password/', {'username': 'hard_customer'})
        by_email = self.client.post(
            '/api/auth/forgot-password/',
            {'identifier': self.customer.email},
        )
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(existing.status_code, 200)
        self.assertEqual(by_email.status_code, 200)
        self.assertEqual(missing.data['detail'], existing.data['detail'])
        self.assertEqual(missing.data['detail'], by_email.data['detail'])
        self.assertNotIn('reset_token', missing.data)

    def test_active_coupons_require_customer(self):
        anon = self.client.get('/api/coupons/active/')
        self.assertEqual(anon.status_code, 401)

        self.client.force_authenticate(self.driver)
        as_driver = self.client.get('/api/coupons/active/')
        self.assertEqual(as_driver.status_code, 403)

        self.client.force_authenticate(self.customer)
        as_customer = self.client.get('/api/coupons/active/')
        self.assertEqual(as_customer.status_code, 200)
        self.assertEqual(as_customer.data[0]['code'], 'PUBLICO10')

    def test_available_orders_hide_customer_contact_for_drivers(self):
        self.client.force_authenticate(self.driver)
        response = self.client.get('/api/orders/available/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        row = response.data[0]
        self.assertEqual(row['customer_detail']['phone'], '')
        self.assertEqual(row['customer_detail']['address'], '')
        self.assertEqual(row['delivery_address'], 'Disponible al aceptar la entrega')
        self.assertEqual(row['delivery_notes'], '')

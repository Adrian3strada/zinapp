from decimal import Decimal
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase

from accounts.models import UserRole
from orders.models import Order, PaymentMethod, PaymentStatus
from restaurants.models import Restaurant

User = get_user_model()


def _tiny_png():
    # 1x1 PNG
    return (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
        b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
        b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    )


class TransferProofTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='tr_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            username='tr_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Fonda Transfer',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            payment_method=PaymentMethod.TRANSFER,
            payment_status=PaymentStatus.PENDING,
            delivery_address='Calle 1',
            delivery_fee=Decimal('35.00'),
            subtotal=Decimal('50.00'),
            total=Decimal('85.00'),
        )

    def test_accept_blocked_until_transfer_confirmed(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(f'/api/orders/{self.order.id}/accept/', {'prep_minutes': 15})
        self.assertEqual(resp.status_code, 400)

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_customer_uploads_and_restaurant_confirms(self, _mock):
        self.client.force_authenticate(self.customer)
        upload = SimpleUploadedFile('comprobante.png', _tiny_png(), content_type='image/png')
        resp = self.client.post(
            f'/api/orders/{self.order.id}/payment-proof/',
            {'payment_proof': upload},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data.get('payment_proof_url'))

        self.client.force_authenticate(self.owner)
        confirm = self.client.post(f'/api/orders/{self.order.id}/confirm-transfer/')
        self.assertEqual(confirm.status_code, 200, confirm.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, PaymentStatus.PAID)

        accept = self.client.post(f'/api/orders/{self.order.id}/accept/', {'prep_minutes': 15})
        self.assertEqual(accept.status_code, 200, accept.data)

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_reject_after_paid_transfer_asks_whatsapp_refund(self, mock_push):
        self.client.force_authenticate(self.owner)
        confirm = self.client.post(f'/api/orders/{self.order.id}/confirm-transfer/')
        self.assertEqual(confirm.status_code, 200, confirm.data)
        mock_push.reset_mock()
        reject = self.client.post(f'/api/orders/{self.order.id}/reject/')
        self.assertEqual(reject.status_code, 200, reject.data)
        customer_bodies = [
            call.args[2] for call in mock_push.call_args_list if call.args[0] == self.customer
        ]
        self.assertTrue(any('WhatsApp' in body and 'dinero' in body for body in customer_bodies))
        self.order.refresh_from_db()
        self.assertTrue(self.order.disputes.filter(status='pending').exists())

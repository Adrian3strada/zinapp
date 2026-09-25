from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from accounts.models import UserRole
from orders.models import Order
from restaurants.models import Restaurant

User = get_user_model()


class OrderChatApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            username='msg_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            first_name='Ana',
        )
        self.owner = User.objects.create_user(
            username='msg_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
            first_name='Luis',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Chat API Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            delivery_address='Calle 1',
            delivery_fee=Decimal('35.00'),
            subtotal=Decimal('50.00'),
            total=Decimal('85.00'),
        )

    @patch('accounts.notifications.send_push_to_user', return_value=True)
    def test_post_message_notifies_other_party(self, mock_push):
        self.client.force_authenticate(self.customer)
        resp = self.client.post(
            f'/api/orders/{self.order.id}/messages/',
            {'body': 'Hola, ¿va en camino?'},
            format='json',
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        recipients = [call.args[0] for call in mock_push.call_args_list]
        self.assertIn(self.owner, recipients)
        self.assertNotIn(self.customer, recipients)

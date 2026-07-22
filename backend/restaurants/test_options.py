from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from accounts.models import UserRole
from restaurants.models import Product, Restaurant

User = get_user_model()


class ProductOptionsApiTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='opt_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.customer = User.objects.create_user(
            username='opt_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
            email='opt_customer@example.com',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Tacos Options',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.product = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('25.00'),
            is_available=True,
        )

    def test_replace_option_groups_and_order_with_extras(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.put(
            f'/api/products/{self.product.id}/option-groups/',
            {
                'groups': [
                    {
                        'name': 'Sabor',
                        'min_select': 1,
                        'max_select': 1,
                        'options': [
                            {'name': 'Pastor', 'price_delta': '0'},
                            {'name': 'Suadero', 'price_delta': '5.00'},
                        ],
                    },
                    {
                        'name': 'Extra',
                        'min_select': 0,
                        'max_select': 2,
                        'options': [
                            {'name': 'Queso', 'price_delta': '10.00'},
                            {'name': 'Piña', 'price_delta': '8.00'},
                        ],
                    },
                ],
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data['option_groups']), 2)
        sabor = resp.data['option_groups'][0]
        suadero_id = next(o['id'] for o in sabor['options'] if o['name'] == 'Suadero')
        extra = resp.data['option_groups'][1]
        queso_id = next(o['id'] for o in extra['options'] if o['name'] == 'Queso')

        self.client.force_authenticate(self.customer)
        order_resp = self.client.post(
            '/api/orders/',
            {
                'restaurant_id': self.restaurant.id,
                'delivery_address': 'Calle 1',
                'delivery_latitude': '19.860000',
                'delivery_longitude': '-100.820000',
                'payment_method': 'cash',
                'items': [
                    {
                        'product_id': self.product.id,
                        'quantity': 2,
                        'option_ids': [suadero_id, queso_id],
                        'notes': 'bien dorado',
                    },
                ],
            },
            format='json',
        )
        self.assertEqual(order_resp.status_code, 201, order_resp.data)
        item = order_resp.data['items'][0]
        # 25 + 5 + 10 = 40 c/u × 2
        self.assertEqual(item['unit_price'], '40.00')
        self.assertEqual(item['subtotal'], '80.00')
        self.assertEqual(item['notes'], 'bien dorado')
        names = {row['name'] for row in item['selected_options']}
        self.assertEqual(names, {'Suadero', 'Queso'})

    def test_required_option_rejected_when_missing(self):
        self.client.force_authenticate(self.owner)
        self.client.put(
            f'/api/products/{self.product.id}/option-groups/',
            {
                'groups': [
                    {
                        'name': 'Sabor',
                        'min_select': 1,
                        'max_select': 1,
                        'options': [{'name': 'Pastor', 'price_delta': '0'}],
                    },
                ],
            },
            format='json',
        )
        self.client.force_authenticate(self.customer)
        order_resp = self.client.post(
            '/api/orders/',
            {
                'restaurant_id': self.restaurant.id,
                'delivery_address': 'Calle 1',
                'delivery_latitude': '19.860000',
                'delivery_longitude': '-100.820000',
                'payment_method': 'cash',
                'items': [{'product_id': self.product.id, 'quantity': 1, 'option_ids': []}],
            },
            format='json',
        )
        self.assertEqual(order_resp.status_code, 400)

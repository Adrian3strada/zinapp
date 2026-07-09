from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from restaurants.models import Product, Restaurant

User = get_user_model()


class RestaurantProductFlowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='menu_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Menu Test',
            address='Centro, Zinapécuaro',
            is_active=True,
            accepting_orders=True,
        )
        self.available = Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price=Decimal('30.00'),
            is_available=True,
        )
        self.hidden = Product.objects.create(
            restaurant=self.restaurant,
            name='Agua',
            price=Decimal('15.00'),
            is_available=False,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_mine_includes_all_products_for_owner(self):
        response = self.client.get('/api/restaurants/mine/')
        self.assertEqual(response.status_code, 200)
        names = {item['name'] for item in response.data['products']}
        self.assertEqual(names, {'Agua', 'Taco'})

    def test_owner_can_create_product_multipart(self):
        response = self.client.post(
            '/api/products/',
            {
                'restaurant': self.restaurant.id,
                'name': 'Quesadilla',
                'description': 'Con queso',
                'price': '45.00',
                'is_available': 'true',
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Quesadilla')
        self.assertTrue(response.data['is_available'])

    def test_owner_can_toggle_availability(self):
        response = self.client.patch(
            f'/api/products/{self.available.id}/',
            {'is_available': False},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['is_available'])

    def test_invalid_price_rejected(self):
        response = self.client.post(
            '/api/products/',
            {
                'restaurant': self.restaurant.id,
                'name': 'Mal precio',
                'price': '0',
                'is_available': 'true',
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 400)

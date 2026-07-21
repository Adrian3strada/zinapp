from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from restaurants.geo import geocode_address, is_in_coverage, looks_like_street_address
from restaurants.models import Restaurant
from restaurants.serializers import RestaurantSerializer

User = get_user_model()


class GeocodeTests(TestCase):
    def test_sirani_felix_ireta_finds_street(self):
        result = geocode_address('Sirani 11 Felix Ireta')
        self.assertIsNotNone(result)
        self.assertTrue(result['in_coverage'])

    def test_felix_ireta_street(self):
        result = geocode_address('Calle Felix Ireta 11')
        self.assertIsNotNone(result)
        self.assertTrue(result['in_coverage'])

    def test_is_in_coverage_zinapecuaro_center(self):
        self.assertTrue(is_in_coverage(19.858, -100.827))

    def test_las_galeras_colonia(self):
        result = geocode_address('Las Galeras')
        self.assertIsNotNone(result)
        self.assertTrue(result['in_coverage'])

    def test_felix_ireta_by_colonia_name(self):
        result = geocode_address('Félix Ireta')
        self.assertIsNotNone(result)
        self.assertTrue(result['in_coverage'])

    def test_street_address_skips_colonia_centroid(self):
        self.assertTrue(looks_like_street_address('Av. Hidalgo 25, Centro'))
        result = geocode_address('Av. Hidalgo 25, Centro')
        self.assertIsNotNone(result)
        self.assertNotEqual(result['latitude'], 19.859939)


class RestaurantPaymentInfoTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner1',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Pizza Test',
            address='Calle 1',
            phone='4431112233',
        )

    def test_setup_status_omits_bank_step(self):
        factory = APIRequestFactory()
        request = factory.get('/')
        data = RestaurantSerializer(self.restaurant, context={'request': request}).data
        status = data['setup_status']
        self.assertFalse(status['complete'])
        self.assertEqual(status['done_count'], 0)
        self.assertFalse(any(s['key'] == 'bank' for s in status['steps']))
        self.assertTrue(any(s['key'] == 'menu' and not s['done'] for s in status['steps']))
        for private_field in ('bank_name', 'account_holder', 'clabe', 'has_transfer_info'):
            self.assertNotIn(private_field, data)


class RestaurantLocationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_loc',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Deli',
            address='Salazar, Centro',
            phone='4431112233',
            latitude='19.859500',
            longitude='-100.826500',
        )
        self.factory = APIRequestFactory()
        self.request = self.factory.patch('/')

    def test_address_change_keeps_manual_coordinates(self):
        serializer = RestaurantSerializer(
            self.restaurant,
            data={'address': 'Salazar 120, Centro, Zinapécuaro'},
            partial=True,
            context={'request': self.request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(str(updated.latitude), '19.859500')
        self.assertEqual(str(updated.longitude), '-100.826500')

    def test_explicit_coordinates_update(self):
        serializer = RestaurantSerializer(
            self.restaurant,
            data={'latitude': '19.860100', 'longitude': '-100.825100'},
            partial=True,
            context={'request': self.request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(str(updated.latitude), '19.860100')
        self.assertEqual(str(updated.longitude), '-100.825100')
        self.assertTrue(updated.location_pinned)


class PublicCatalogTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='pub_owner',
            password='test1234',
            role='restaurant',
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='Public Tacos',
            address='Centro',
            phone='4511111111',
            is_active=True,
            accepting_orders=True,
        )
        from restaurants.models import Product
        Product.objects.create(
            restaurant=self.restaurant,
            name='Taco',
            price='15.00',
            is_available=True,
        )

    def test_anonymous_can_list_restaurants(self):
        from rest_framework.test import APIClient

        client = APIClient()
        response = client.get('/api/restaurants/')
        self.assertEqual(response.status_code, 200)
        names = [r['name'] for r in response.data['results']]
        self.assertIn('Public Tacos', names)
        restaurant = next(item for item in response.data['results'] if item['name'] == 'Public Tacos')
        for private_field in (
            'owner', 'owner_detail', 'bank_name', 'account_holder', 'clabe', 'has_transfer_info',
        ):
            self.assertNotIn(private_field, restaurant)

    def test_anonymous_restaurant_detail_hides_owner_and_payment_data(self):
        from rest_framework.test import APIClient

        response = APIClient().get(f'/api/restaurants/{self.restaurant.id}/')

        self.assertEqual(response.status_code, 200)
        for private_field in (
            'owner', 'owner_detail', 'bank_name', 'account_holder', 'clabe', 'has_transfer_info',
        ):
            self.assertNotIn(private_field, response.data)

    def test_transfer_info_endpoint_removed(self):
        from rest_framework.test import APIClient

        customer = User.objects.create_user(
            username='transfer_customer',
            password='test1234',
            role='customer',
        )
        client = APIClient()
        client.force_authenticate(customer)

        response = client.get(f'/api/restaurants/{self.restaurant.id}/transfer-info/')
        self.assertEqual(response.status_code, 404)

    def test_anonymous_can_list_products(self):
        from rest_framework.test import APIClient

        client = APIClient()
        response = client.get(f'/api/products/?restaurant={self.restaurant.id}')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data['results']), 1)

    def test_featured_products_diversify_restaurants(self):
        from restaurants.models import Product
        from rest_framework.test import APIClient

        other_owner = User.objects.create_user(
            username='featured_owner',
            password='test1234',
            role='restaurant',
        )
        other = Restaurant.objects.create(
            owner=other_owner,
            name='Other Spot',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        Product.objects.create(restaurant=other, name='Pizza', price='80.00', is_available=True)
        Product.objects.create(
            restaurant=self.restaurant,
            name='Second Taco',
            price='18.00',
            is_available=True,
        )

        response = APIClient().get('/api/products/featured/?limit=8')
        self.assertEqual(response.status_code, 200)
        names = {item['name'] for item in response.data}
        restaurants = {item['restaurant'] for item in response.data}
        # Un platillo por restaurante (el más reciente gana sobre "Taco").
        self.assertIn('Second Taco', names)
        self.assertIn('Pizza', names)
        self.assertNotIn('Taco', names)
        self.assertEqual(len(restaurants), len(response.data))
        self.assertTrue(all(item.get('restaurant_name') for item in response.data))

    def test_list_puts_open_restaurants_first(self):
        from restaurants.models import Product
        from rest_framework.test import APIClient

        closed_owner = User.objects.create_user(
            username='closed_owner',
            password='test1234',
            role='restaurant',
        )
        closed = Restaurant.objects.create(
            owner=closed_owner,
            name='AAA Closed First Alphabetically',
            address='Centro',
            is_active=True,
            accepting_orders=False,
        )
        Product.objects.create(
            restaurant=closed,
            name='Torta',
            price='20.00',
            is_available=True,
        )

        response = APIClient().get('/api/restaurants/')
        self.assertEqual(response.status_code, 200)
        names = [r['name'] for r in response.data['results']]
        self.assertLess(names.index('Public Tacos'), names.index(closed.name))
        open_item = next(r for r in response.data['results'] if r['name'] == 'Public Tacos')
        closed_item = next(r for r in response.data['results'] if r['name'] == closed.name)
        self.assertTrue(open_item['is_open'])
        self.assertFalse(closed_item['is_open'])

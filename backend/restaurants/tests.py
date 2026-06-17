from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from restaurants.geo import geocode_address, is_in_coverage
from restaurants.models import Restaurant
from restaurants.serializers import RestaurantSerializer

User = get_user_model()


class GeocodeTests(TestCase):
    def test_sirani_felix_ireta_finds_street(self):
        result = geocode_address('Sirani 11 Felix Ireta')
        self.assertIsNotNone(result)
        self.assertTrue(result['in_coverage'])
        self.assertTrue(result.get('approximate'))

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
            bank_name='BBVA',
            account_holder='Pizza Test SA',
            clabe='012180001234567890',
        )

    def test_has_transfer_info_when_clabe_set(self):
        factory = APIRequestFactory()
        request = factory.get('/')
        data = RestaurantSerializer(self.restaurant, context={'request': request}).data
        self.assertTrue(data['has_transfer_info'])
        self.assertEqual(data['clabe'], '012180001234567890')

    def test_clabe_must_be_18_digits(self):
        serializer = RestaurantSerializer(
            self.restaurant,
            data={'clabe': '123'},
            partial=True,
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('clabe', serializer.errors)

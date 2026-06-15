from django.test import TestCase

from restaurants.geo import geocode_address, is_in_coverage


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

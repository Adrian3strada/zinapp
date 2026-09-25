from django.test import TestCase


class PublicAppConfigTests(TestCase):
    def test_delivery_fee_is_thirty_five(self):
        response = self.client.get('/api/config/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['delivery_fee'], '35.00')

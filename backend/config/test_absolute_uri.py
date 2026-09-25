from django.test import SimpleTestCase, override_settings

from config.absolute_uri import upgrade_public_media_url


class UpgradePublicMediaUrlTests(SimpleTestCase):
    @override_settings(SITE_URL='https://zinapp.com.mx')
    def test_upgrades_http_on_canonical_host(self):
        raw = 'http://zinapp.com.mx/media/restaurants/taco.jpg'
        self.assertEqual(
            upgrade_public_media_url(raw),
            'https://zinapp.com.mx/media/restaurants/taco.jpg',
        )

    @override_settings(SITE_URL='https://zinapp.com.mx')
    def test_upgrades_www_when_site_is_apex(self):
        raw = 'http://www.zinapp.com.mx/media/restaurants/taco.jpg'
        self.assertEqual(
            upgrade_public_media_url(raw),
            'https://www.zinapp.com.mx/media/restaurants/taco.jpg',
        )

    @override_settings(SITE_URL='https://zinapp.com.mx')
    def test_leaves_internal_http_alone(self):
        raw = 'http://zinapp-api.railway.internal:8000/media/restaurants/taco.jpg'
        self.assertEqual(upgrade_public_media_url(raw), raw)

    @override_settings(SITE_URL='http://127.0.0.1:8000')
    def test_leaves_http_when_site_is_http(self):
        raw = 'http://127.0.0.1:8000/media/restaurants/taco.jpg'
        self.assertEqual(upgrade_public_media_url(raw), raw)

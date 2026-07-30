import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.models import UserRole
from accounts.notifications import (
    _extract_push_ticket,
    _sanitize_provider_message,
    send_push_to_user,
)

User = get_user_model()

VALID_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'


class _FakeExpoResponse:
    def __init__(self, payload, status: int = 200):
        self.status = status
        self._payload = payload

    def read(self):
        if isinstance(self._payload, (bytes, bytearray)):
            return bytes(self._payload)
        if isinstance(self._payload, str):
            return self._payload.encode('utf-8')
        return json.dumps(self._payload).encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ExtractPushTicketTests(TestCase):
    def test_list_ticket(self):
        ticket = _extract_push_ticket({'data': [{'status': 'ok', 'id': 'abc'}]})
        self.assertEqual(ticket, {'status': 'ok', 'id': 'abc'})

    def test_dict_ticket(self):
        ticket = _extract_push_ticket({'data': {'status': 'ok', 'id': 'abc'}})
        self.assertEqual(ticket, {'status': 'ok', 'id': 'abc'})

    def test_empty_list(self):
        self.assertIsNone(_extract_push_ticket({'data': []}))

    def test_missing_data(self):
        self.assertIsNone(_extract_push_ticket({}))
        self.assertIsNone(_extract_push_ticket({'data': None}))

    def test_unexpected_data_type(self):
        self.assertIsNone(_extract_push_ticket({'data': 'oops'}))
        self.assertIsNone(_extract_push_ticket({'data': 1}))


class SanitizeProviderMessageTests(TestCase):
    def test_redacts_expo_token(self):
        msg = f'"{VALID_TOKEN}" is not a registered push notification recipient'
        sanitized = _sanitize_provider_message(msg)
        self.assertNotIn(VALID_TOKEN, sanitized)
        self.assertIn('ExponentPushToken[REDACTED]', sanitized)


class SendPushToUserTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='push_user',
            password='test1234',
            role=UserRole.CUSTOMER,
            expo_push_token=VALID_TOKEN,
        )

    def _send(self, mock_urlopen, payload, status=200):
        mock_urlopen.return_value = _FakeExpoResponse(payload, status=status)
        return send_push_to_user(self.user, 'Título', 'Cuerpo', {'orderId': 1})

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_success_with_list_data(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': [{'status': 'ok', 'id': 'ticket-1'}],
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_success_with_dict_data(self, mock_urlopen):
        """Expo puede devolver un solo ticket como objeto, no lista."""
        ok = self._send(mock_urlopen, {
            'data': {'status': 'ok', 'id': 'ticket-1'},
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_expo_error_without_raising_keyerror(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': {
                'status': 'error',
                'message': 'MessageTooBig',
                'details': {'error': 'MessageTooBig'},
            },
        })
        self.assertFalse(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_device_not_registered_clears_token(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': {
                'status': 'error',
                'message': f'"{VALID_TOKEN}" is not a registered push notification recipient',
                'details': {'error': 'DeviceNotRegistered'},
            },
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, '')

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_device_not_registered_in_list(self, mock_urlopen):
        ok = self._send(mock_urlopen, {
            'data': [{
                'status': 'error',
                'message': 'Device unregistered',
                'details': {'error': 'DeviceNotRegistered'},
            }],
        })
        self.assertTrue(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, '')

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_empty_data_list_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'data': []})
        self.assertFalse(ok)
        self.user.refresh_from_db()
        self.assertEqual(self.user.expo_push_token, VALID_TOKEN)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_missing_data_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'errors': [{'code': 'UNAUTHORIZED', 'message': 'nope'}]})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_response_without_data_key(self, mock_urlopen):
        ok = self._send(mock_urlopen, {})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_unexpected_data_type_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, {'data': 'not-a-ticket'})
        self.assertFalse(ok)

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_no_token_skips_request(self, mock_urlopen):
        self.user.expo_push_token = ''
        self.user.save(update_fields=['expo_push_token'])
        ok = send_push_to_user(self.user, 'Título', 'Cuerpo')
        self.assertTrue(ok)
        mock_urlopen.assert_not_called()

    @patch('accounts.notifications.urllib.request.urlopen')
    def test_invalid_json_does_not_raise(self, mock_urlopen):
        ok = self._send(mock_urlopen, b'{not-json')
        self.assertFalse(ok)

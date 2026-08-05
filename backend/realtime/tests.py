import logging
import time
from unittest.mock import patch

from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import UserRole
from orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from realtime.broadcast import broadcast_order_updated, order_group
from realtime.log_filters import RedactSecretsFilter, redact_secrets
from realtime.tickets import TICKET_KEY_PREFIX, TicketStoreUnavailable, create_ws_ticket
from restaurants.models import Restaurant

User = get_user_model()

CHANNEL_LAYERS_TEST = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}

CACHES_TEST = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'ws-tickets-tests',
    },
}

WS_TEST_SETTINGS = {
    'CHANNEL_LAYERS': CHANNEL_LAYERS_TEST,
    'CACHES': CACHES_TEST,
    'REDIS_URL': '',
    'WS_TICKETS_REQUIRE_REDIS': False,
    'WS_LEGACY_JWT_QUERY_AUTH': False,
    'WS_TICKET_TTL_SECONDS': 60,
}


@override_settings(**WS_TEST_SETTINGS)
class WebsocketTicketSecurityTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(
            username='ws_ticket_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        self.other = User.objects.create_user(
            username='ws_ticket_other',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        self.client = APIClient()

    def _application(self):
        from config.asgi import application

        return application

    def _auth_header(self, user):
        return {'HTTP_AUTHORIZATION': f'Bearer {AccessToken.for_user(user)}'}

    def _issue_ticket(self, user, *, auth_expires_at: float | None = None):
        if auth_expires_at is None:
            auth_expires_at = time.time() + 3600
        return create_ws_ticket(user_id=user.id, auth_expires_at=auth_expires_at)

    async def _connect_ticket(self, ticket: str):
        communicator = WebsocketCommunicator(
            self._application(),
            f'/ws/v1/?ticket={ticket}',
        )
        connected, code = await communicator.connect()
        return communicator, connected, code

    async def _assert_rejected(self, communicator, connected, code, expected_close: int):
        """accept()+close(code) puede reportar connected=True y luego websocket.close."""
        if connected:
            close_msg = await communicator.receive_output(timeout=2)
            self.assertEqual(close_msg['type'], 'websocket.close')
            self.assertEqual(close_msg['code'], expected_close)
        else:
            self.assertEqual(code, expected_close)
        await communicator.disconnect()

    def test_rest_issues_ticket(self):
        self.client.credentials(**self._auth_header(self.customer))
        response = self.client.post('/api/realtime/ws-ticket/')
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertIn('ticket', body)
        self.assertLessEqual(body['expires_in'], 60)
        self.assertEqual(body['ws_path'], '/ws/v1/')

    async def test_valid_ticket_connects(self):
        issued = self._issue_ticket(self.customer)
        communicator, connected, _code = await self._connect_ticket(issued['ticket'])
        self.assertTrue(connected)
        hello = await communicator.receive_json_from(timeout=2)
        self.assertEqual(hello['type'], 'connected')
        self.assertEqual(hello['data']['userId'], self.customer.id)
        self.assertIsNotNone(hello['data'].get('authExpiresAt'))
        await communicator.disconnect()

    async def test_expired_ticket_rejected(self):
        # Tras el TTL de Redis/cache el GETDEL no encuentra la clave (mismo efecto que vencido).
        issued = self._issue_ticket(self.customer)
        cache.delete(f'{TICKET_KEY_PREFIX}{issued["ticket"]}')
        communicator, connected, code = await self._connect_ticket(issued['ticket'])
        await self._assert_rejected(communicator, connected, code, 4001)

    async def test_reused_ticket_rejected(self):
        issued = self._issue_ticket(self.customer)
        first, connected, _ = await self._connect_ticket(issued['ticket'])
        self.assertTrue(connected)
        await first.receive_json_from(timeout=2)
        await first.disconnect()

        second, connected2, code = await self._connect_ticket(issued['ticket'])
        await self._assert_rejected(second, connected2, code, 4001)

    async def test_ticket_binds_to_issuing_user_not_other(self):
        """El ticket autentica como el user_id asociado, no como otro usuario."""
        issued_other = self._issue_ticket(self.other)
        communicator, connected, _ = await self._connect_ticket(issued_other['ticket'])
        self.assertTrue(connected)
        hello = await communicator.receive_json_from(timeout=2)
        self.assertEqual(hello['data']['userId'], self.other.id)
        self.assertNotEqual(hello['data']['userId'], self.customer.id)
        await communicator.disconnect()

    async def test_inactive_user_rejected(self):
        issued = self._issue_ticket(self.customer)

        def _deactivate():
            self.customer.is_active = False
            self.customer.save(update_fields=['is_active'])

        await sync_to_async(_deactivate)()
        communicator, connected, code = await self._connect_ticket(issued['ticket'])
        await self._assert_rejected(communicator, connected, code, 4004)

    def test_inactive_user_cannot_issue_ticket(self):
        self.customer.is_active = False
        self.customer.save(update_fields=['is_active'])
        # force_authenticate evita que JWT bloquee antes del view.
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/realtime/ws-ticket/')
        self.assertIn(response.status_code, (401, 403))

    async def test_closes_when_auth_session_expires(self):
        issued = self._issue_ticket(self.customer, auth_expires_at=time.time() + 1)
        communicator, connected, _ = await self._connect_ticket(issued['ticket'])
        self.assertTrue(connected)
        await communicator.receive_json_from(timeout=2)
        close_msg = await communicator.receive_output(timeout=3)
        self.assertEqual(close_msg['type'], 'websocket.close')
        self.assertEqual(close_msg['code'], 4003)
        await communicator.disconnect()

    async def test_connection_without_ticket_rejected(self):
        communicator = WebsocketCommunicator(self._application(), '/ws/v1/')
        connected, code = await communicator.connect()
        await self._assert_rejected(communicator, connected, code, 4001)

    def test_redis_unavailable_on_ticket_endpoint(self):
        self.client.credentials(**self._auth_header(self.customer))
        with patch(
            'realtime.views.create_ws_ticket',
            side_effect=TicketStoreUnavailable('redis down'),
        ):
            response = self.client.post('/api/realtime/ws-ticket/')
        self.assertEqual(response.status_code, 503)

    async def test_redis_unavailable_on_websocket_connect(self):
        with patch(
            'realtime.auth.consume_ws_ticket',
            side_effect=TicketStoreUnavailable('redis down'),
        ):
            communicator, connected, code = await self._connect_ticket('any-ticket')
        await self._assert_rejected(communicator, connected, code, 4002)

    async def test_legacy_jwt_query_disabled_by_default(self):
        token = str(AccessToken.for_user(self.customer))
        communicator = WebsocketCommunicator(
            self._application(),
            f'/ws/v1/?token={token}',
        )
        connected, code = await communicator.connect()
        await self._assert_rejected(communicator, connected, code, 4001)

    @override_settings(WS_LEGACY_JWT_QUERY_AUTH=True)
    async def test_legacy_jwt_query_works_when_enabled(self):
        token = str(AccessToken.for_user(self.customer))
        communicator = WebsocketCommunicator(
            self._application(),
            f'/ws/v1/?token={token}',
        )
        connected, code = await communicator.connect()
        self.assertTrue(connected)
        hello = await communicator.receive_json_from(timeout=2)
        self.assertEqual(hello['type'], 'connected')
        self.assertEqual(hello['data']['userId'], self.customer.id)
        await communicator.disconnect()

    def test_logs_redact_ticket_and_token(self):
        raw = 'GET /ws/v1/?ticket=supersecretticket&token=eyJhbGciOi.jwt HTTP/1.1'
        self.assertIn('[REDACTED]', redact_secrets(raw))
        self.assertNotIn('supersecretticket', redact_secrets(raw))
        self.assertNotIn('eyJhbGciOi.jwt', redact_secrets(raw))

        record = logging.LogRecord(
            name='uvicorn.access',
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg=raw,
            args=(),
            exc_info=None,
        )
        RedactSecretsFilter().filter(record)
        self.assertNotIn('supersecretticket', record.getMessage())


@override_settings(**WS_TEST_SETTINGS)
class RealtimeWebsocketFlowTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(
            username='rt_customer',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        self.other = User.objects.create_user(
            username='rt_other',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            username='rt_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.owner,
            name='RT Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        self.order = Order.objects.create(
            customer=self.customer,
            restaurant=self.restaurant,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PENDING,
            delivery_address='Calle 1',
        )

    def _application(self):
        from config.asgi import application

        return application

    async def _connect(self, user):
        issued = create_ws_ticket(user_id=user.id, auth_expires_at=time.time() + 3600)
        communicator = WebsocketCommunicator(
            self._application(),
            f'/ws/v1/?ticket={issued["ticket"]}',
        )
        connected, _ = await communicator.connect()
        return communicator, connected

    async def test_connect_and_subscribe_order(self):
        communicator, connected = await self._connect(self.customer)
        self.assertTrue(connected)
        hello = await communicator.receive_json_from(timeout=2)
        self.assertEqual(hello['type'], 'connected')

        await communicator.send_json_to({'action': 'subscribe', 'orderId': self.order.id})
        sub = await communicator.receive_json_from(timeout=2)
        self.assertEqual(sub['type'], 'subscribed')
        self.assertEqual(sub['data']['orderId'], self.order.id)

        layer = get_channel_layer()
        await layer.group_send(
            order_group(self.order.id),
            {
                'type': 'realtime.event',
                'event': 'order.updated',
                'data': {'orderId': self.order.id, 'status': self.order.status},
            },
        )
        event = await communicator.receive_json_from(timeout=2)
        self.assertEqual(event['type'], 'order.updated')
        self.assertEqual(event['data']['orderId'], self.order.id)
        await communicator.disconnect()

    async def test_subscribe_forbidden_order(self):
        communicator, connected = await self._connect(self.other)
        self.assertTrue(connected)
        await communicator.receive_json_from(timeout=2)
        await communicator.send_json_to({'action': 'subscribe', 'orderId': self.order.id})
        err = await communicator.receive_json_from(timeout=2)
        self.assertEqual(err['type'], 'error')
        self.assertEqual(err['data']['code'], 'forbidden')
        await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
class BroadcastHelperTests(TransactionTestCase):
    def test_broadcast_order_updated_does_not_raise(self):
        user = User.objects.create_user(
            username='rt_bcast',
            password='test1234',
            role=UserRole.CUSTOMER,
        )
        owner = User.objects.create_user(
            username='rt_bcast_owner',
            password='test1234',
            role=UserRole.RESTAURANT,
        )
        restaurant = Restaurant.objects.create(
            owner=owner,
            name='Bcast Rest',
            address='Centro',
            is_active=True,
            accepting_orders=True,
        )
        order = Order.objects.create(
            customer=user,
            restaurant=restaurant,
            status=OrderStatus.PENDING,
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.PENDING,
            delivery_address='Calle 1',
        )
        broadcast_order_updated(order)
        self.assertEqual(order_group(order.id), f'order_{order.id}')

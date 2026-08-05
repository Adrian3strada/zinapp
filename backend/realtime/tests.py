from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import UserRole
from orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from realtime.broadcast import broadcast_order_updated, order_group
from restaurants.models import Restaurant

User = get_user_model()


CHANNEL_LAYERS_TEST = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}


@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
class RealtimeWebsocketTests(TransactionTestCase):
    def setUp(self):
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

    async def _connect(self, user, *, token: str | None = None):
        if token is None:
            token = str(AccessToken.for_user(user))
        communicator = WebsocketCommunicator(
            self._application(),
            f'/ws/v1/?token={token}',
        )
        connected, _ = await communicator.connect()
        return communicator, connected

    async def test_rejects_missing_token(self):
        communicator = WebsocketCommunicator(self._application(), '/ws/v1/')
        connected, code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4001)
        await communicator.disconnect()

    async def test_connect_and_subscribe_order(self):
        communicator, connected = await self._connect(self.customer)
        self.assertTrue(connected)
        hello = await communicator.receive_json_from(timeout=2)
        self.assertEqual(hello['type'], 'connected')

        await communicator.send_json_to({'action': 'subscribe', 'orderId': self.order.id})
        sub = await communicator.receive_json_from(timeout=2)
        self.assertEqual(sub['type'], 'subscribed')
        self.assertEqual(sub['data']['orderId'], self.order.id)

        # Await group_send directly — async_to_sync inside an async test can hang.
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

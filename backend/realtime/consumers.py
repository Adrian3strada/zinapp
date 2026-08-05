import asyncio
import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from realtime.broadcast import (
    DRIVERS_AVAILABLE_GROUP,
    order_group,
    restaurant_group,
    shipment_group,
    user_group,
)

logger = logging.getLogger(__name__)

# Close codes (app-specific 4xxx)
CLOSE_AUTH = 4001
CLOSE_STORE = 4002
CLOSE_SESSION_EXPIRED = 4003
CLOSE_INACTIVE = 4004


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    """Authenticated multiplexed realtime channel (ticket auth)."""

    async def connect(self):
        user = self.scope.get('user')
        auth_error = self.scope.get('ws_auth_error')
        auth_expires_at = self.scope.get('ws_auth_expires_at')

        if auth_error == 'store_unavailable':
            await self.close(code=CLOSE_STORE)
            return
        if auth_error == 'inactive_or_missing':
            await self.close(code=CLOSE_INACTIVE)
            return
        if (
            user is None
            or isinstance(user, AnonymousUser)
            or not getattr(user, 'is_authenticated', False)
        ):
            await self.close(code=CLOSE_AUTH)
            return

        # Defensa extra: is_active
        if not await self._user_is_active(user.id):
            await self.close(code=CLOSE_INACTIVE)
            return

        now = time.time()
        if auth_expires_at is not None and float(auth_expires_at) <= now:
            await self.close(code=CLOSE_SESSION_EXPIRED)
            return

        self.user = user
        self.auth_expires_at = float(auth_expires_at) if auth_expires_at else None
        self.joined_groups: set[str] = set()
        self._expire_task: asyncio.Task | None = None

        await self.accept()
        await self._join(user_group(user.id))

        if await self._is_available_driver():
            await self._join(DRIVERS_AVAILABLE_GROUP)

        await self.send_json({
            'type': 'connected',
            'data': {
                'userId': user.id,
                'authExpiresAt': self.auth_expires_at,
            },
        })

        if self.auth_expires_at is not None:
            self._expire_task = asyncio.create_task(self._watch_auth_expiry())

    async def disconnect(self, code):
        task = getattr(self, '_expire_task', None)
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        for group in list(getattr(self, 'joined_groups', set())):
            await self.channel_layer.group_discard(group, self.channel_name)
        self.joined_groups = set()

    async def receive_json(self, content, **kwargs):
        if await self._session_expired():
            await self.close(code=CLOSE_SESSION_EXPIRED)
            return
        if not isinstance(content, dict):
            return
        action = content.get('action')
        if action == 'ping':
            await self.send_json({'type': 'pong', 'data': {}})
            return
        if action == 'subscribe':
            await self._handle_subscribe(content)
            return
        if action == 'unsubscribe':
            await self._handle_unsubscribe(content)
            return
        if action == 'set_driver_available':
            await self._handle_driver_available(bool(content.get('available')))

    async def realtime_event(self, event):
        if await self._session_expired():
            await self.close(code=CLOSE_SESSION_EXPIRED)
            return
        await self.send_json({
            'type': event.get('event'),
            'data': event.get('data') or {},
        })

    async def _watch_auth_expiry(self):
        try:
            delay = (self.auth_expires_at or 0) - time.time()
            if delay > 0:
                await asyncio.sleep(delay)
            await self.close(code=CLOSE_SESSION_EXPIRED)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('ws auth expiry watch failed')

    async def _session_expired(self) -> bool:
        if self.auth_expires_at is None:
            return False
        return time.time() >= self.auth_expires_at

    async def _handle_subscribe(self, content):
        order_id = content.get('orderId')
        shipment_id = content.get('shipmentId')
        restaurant_id = content.get('restaurantId')

        if order_id is not None:
            ok = await self._can_access_order(int(order_id))
            if not ok:
                await self.send_json({
                    'type': 'error',
                    'data': {'code': 'forbidden', 'orderId': int(order_id)},
                })
                return
            await self._join(order_group(int(order_id)))
            await self.send_json({
                'type': 'subscribed',
                'data': {'orderId': int(order_id)},
            })

        if shipment_id is not None:
            ok = await self._can_access_shipment(int(shipment_id))
            if not ok:
                await self.send_json({
                    'type': 'error',
                    'data': {'code': 'forbidden', 'shipmentId': int(shipment_id)},
                })
                return
            await self._join(shipment_group(int(shipment_id)))
            await self.send_json({
                'type': 'subscribed',
                'data': {'shipmentId': int(shipment_id)},
            })

        if restaurant_id is not None:
            ok = await self._can_access_restaurant(int(restaurant_id))
            if not ok:
                await self.send_json({
                    'type': 'error',
                    'data': {'code': 'forbidden', 'restaurantId': int(restaurant_id)},
                })
                return
            await self._join(restaurant_group(int(restaurant_id)))
            await self.send_json({
                'type': 'subscribed',
                'data': {'restaurantId': int(restaurant_id)},
            })

    async def _handle_unsubscribe(self, content):
        if content.get('orderId') is not None:
            await self._leave(order_group(int(content['orderId'])))
        if content.get('shipmentId') is not None:
            await self._leave(shipment_group(int(content['shipmentId'])))
        if content.get('restaurantId') is not None:
            await self._leave(restaurant_group(int(content['restaurantId'])))

    async def _handle_driver_available(self, available: bool):
        if not await self._is_driver():
            return
        if available:
            await self._join(DRIVERS_AVAILABLE_GROUP)
        else:
            await self._leave(DRIVERS_AVAILABLE_GROUP)

    async def _join(self, group: str):
        if group in self.joined_groups:
            return
        await self.channel_layer.group_add(group, self.channel_name)
        self.joined_groups.add(group)

    async def _leave(self, group: str):
        if group not in self.joined_groups:
            return
        await self.channel_layer.group_discard(group, self.channel_name)
        self.joined_groups.discard(group)

    @database_sync_to_async
    def _user_is_active(self, user_id: int) -> bool:
        from django.contrib.auth import get_user_model

        return get_user_model().objects.filter(pk=user_id, is_active=True).exists()

    @database_sync_to_async
    def _is_driver(self) -> bool:
        return bool(getattr(self.user, 'is_driver', False))

    @database_sync_to_async
    def _is_available_driver(self) -> bool:
        if not getattr(self.user, 'is_driver', False):
            return False
        profile = getattr(self.user, 'delivery_profile', None)
        if profile is None:
            from accounts.models import DeliveryProfile
            try:
                profile = DeliveryProfile.objects.get(user=self.user)
            except DeliveryProfile.DoesNotExist:
                return False
        return (
            profile.is_available
            and profile.verification_status == profile.VerificationStatus.APPROVED
        )

    @database_sync_to_async
    def _can_access_order(self, order_id: int) -> bool:
        from orders.models import Order
        from orders.order_access import user_can_access_order

        try:
            order = Order.objects.select_related('restaurant').get(pk=order_id)
        except Order.DoesNotExist:
            return False
        return user_can_access_order(order, self.user)

    @database_sync_to_async
    def _can_access_shipment(self, shipment_id: int) -> bool:
        from orders.models import Shipment

        try:
            shipment = Shipment.objects.get(pk=shipment_id)
        except Shipment.DoesNotExist:
            return False
        if getattr(self.user, 'is_admin_user', False):
            return True
        if shipment.customer_id == self.user.id:
            return True
        if shipment.driver_id == self.user.id:
            return True
        return False

    @database_sync_to_async
    def _can_access_restaurant(self, restaurant_id: int) -> bool:
        from restaurants.models import Restaurant

        try:
            restaurant = Restaurant.objects.get(pk=restaurant_id)
        except Restaurant.DoesNotExist:
            return False
        if getattr(self.user, 'is_admin_user', False):
            return True
        return restaurant.owner_id == self.user.id

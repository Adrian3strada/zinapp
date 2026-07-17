from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import DeliveryProfile
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from accounts.permissions import (
    IsAdmin,
    IsCustomer,
    IsDriver,
    IsRestaurantOwner,
    IsRestaurantOwnerOrAdmin,
)

from .idempotency import idempotent_create
from .models import (
    CancellationSource,
    Coupon,
    DisputeStatus,
    Order,
    OrderDispute,
    OrderMessage,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Review,
    Shipment,
    ShipmentStatus,
)
from .order_access import user_can_access_order
from .serializers import (
    CouponPublicSerializer,
    CouponSerializer,
    CouponValidateSerializer,
    OrderActiveSerializer,
    OrderCreateSerializer,
    OrderDisputeCreateSerializer,
    OrderDisputeResolveSerializer,
    OrderDisputeSerializer,
    OrderMessageCreateSerializer,
    OrderMessageSerializer,
    OrderSerializer,
    OrderStatusUpdateSerializer,
    ReviewCreateSerializer,
    ReviewSerializer,
    ShipmentActiveSerializer,
    ShipmentCreateSerializer,
    ShipmentSerializer,
)


def driver_has_active_delivery(user) -> bool:
    if Order.objects.filter(driver=user, status=OrderStatus.ON_THE_WAY).exists():
        return True
    return (
        Shipment.objects.filter(
            driver=user,
            status__in=[ShipmentStatus.PICKED_UP, ShipmentStatus.ON_THE_WAY],
        ).exists()
    )


def driver_can_receive_deliveries(user) -> bool:
    profile = getattr(user, 'delivery_profile', None)
    return bool(
        profile
        and profile.verification_status == DeliveryProfile.VerificationStatus.APPROVED
    )


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related(
        'customer', 'restaurant', 'restaurant__owner', 'driver',
        'driver__delivery_profile',
    ).prefetch_related('items', 'items__product')
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        if self.action == 'update_status':
            return OrderStatusUpdateSerializer
        return OrderSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset

        if user.is_admin_user:
            return queryset

        if user.is_customer:
            return queryset.filter(customer=user)

        if user.is_restaurant_owner:
            return queryset.filter(restaurant__owner=user)

        if user.is_driver:
            if self.action == 'accept_delivery':
                return queryset.filter(
                    status=OrderStatus.READY,
                    driver__isnull=True,
                )
            if self.action == 'retrieve':
                return queryset.filter(
                    Q(driver=user)
                    | Q(status=OrderStatus.READY, driver__isnull=True),
                )
            return queryset.filter(driver=user)

        return Order.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsCustomer()]
        if self.action in ('accept', 'reject', 'update_status'):
            return [IsRestaurantOwnerOrAdmin()]
        if self.action == 'restaurant_pending':
            return [IsRestaurantOwner()]
        if self.action in (
            'available', 'accept_delivery', 'mark_delivered',
            'my_deliveries', 'driver_earnings', 'driver_settlement',
        ):
            return [IsDriver()]
        if self.action == 'restaurant_settlement':
            return [IsRestaurantOwner()]
        if self.action in ('messages',):
            return [IsAuthenticated()]
        if self.action == 'active':
            return [IsCustomer()]
        if self.action == 'cancel':
            return [IsCustomer()]
        if self.action == 'list' and self.request.user.is_admin_user:
            return [IsAdmin()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        def do_create():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            order = serializer.save()
            output = OrderSerializer(order, context={'request': request})
            return Response(output.data, status=status.HTTP_201_CREATED)

        return idempotent_create(request, 'order_create', do_create)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            return self._update_status_locked(request, order)

    def _update_status_locked(self, request, order):
        if order.restaurant.owner != request.user and not request.user.is_admin_user:
            return Response(
                {'detail': 'No tienes permiso para actualizar este pedido.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(
            data=request.data,
            context={'order': order, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            if order.status != OrderStatus.PENDING:
                return Response(
                    {'detail': 'Solo se pueden aceptar pedidos pendientes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                order.payment_method == PaymentMethod.ONLINE
                and order.payment_status != PaymentStatus.PAID
            ):
                return Response(
                    {'detail': 'El pago en línea aún no está confirmado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = OrderStatusUpdateSerializer(
                data={'status': OrderStatus.ACCEPTED},
                context={'order': order},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            if order.status != OrderStatus.PENDING:
                return Response(
                    {'detail': 'Solo se pueden rechazar pedidos pendientes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = OrderStatusUpdateSerializer(
                data={'status': OrderStatus.CANCELLED},
                context={
                    'order': order,
                    'cancellation_source': CancellationSource.RESTAURANT_REJECT,
                },
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelación por el cliente antes de que el pedido esté listo."""
        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.get_object().pk)
            if order.customer != request.user:
                return Response(
                    {'detail': 'No puedes cancelar este pedido.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            cancellable = (
                OrderStatus.PENDING,
                OrderStatus.ACCEPTED,
                OrderStatus.PREPARING,
            )
            if order.status not in cancellable:
                return Response(
                    {
                        'detail': (
                            'Ya no se puede cancelar. '
                            'Contacta al restaurante si necesitas ayuda.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer = OrderStatusUpdateSerializer(
                data={'status': OrderStatus.CANCELLED},
                context={
                    'order': order,
                    'cancellation_source': CancellationSource.CUSTOMER,
                },
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        order.refresh_from_db()
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'])
    def available(self, request):
        """Pedidos listos para recoger sin repartidor asignado."""
        if not driver_can_receive_deliveries(request.user):
            return Response(
                {'detail': 'Tu perfil está pendiente de aprobación por ZinApp.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        orders = Order.objects.filter(
            status=OrderStatus.READY,
            driver__isnull=True,
        ).select_related('restaurant', 'customer').prefetch_related('items')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='accept-delivery')
    def accept_delivery(self, request, pk=None):
        profile, _ = DeliveryProfile.objects.get_or_create(
            user=request.user,
            defaults={'is_available': False},
        )
        if not driver_can_receive_deliveries(request.user):
            return Response(
                {'detail': 'Tu perfil está pendiente de aprobación por ZinApp.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not profile.is_available:
            return Response(
                {'detail': 'Debes estar disponible para aceptar entregas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if driver_has_active_delivery(request.user):
            return Response(
                {'detail': 'Termina tu entrega actual antes de aceptar otra.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            order = Order.objects.select_for_update().filter(pk=pk).first()
            if not order:
                return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if order.status != OrderStatus.READY:
                return Response(
                    {'detail': 'Solo se pueden tomar pedidos listos para recoger.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if order.driver_id:
                return Response(
                    {'detail': 'Este pedido ya tiene repartidor asignado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order.driver = request.user
            order.status = OrderStatus.ON_THE_WAY
            order.save(update_fields=['driver', 'status', 'updated_at'])

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='mark-delivered')
    def mark_delivered(self, request, pk=None):
        order = self.get_object()
        if order.driver != request.user:
            return Response(
                {'detail': 'No eres el repartidor de este pedido.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = OrderStatusUpdateSerializer(
            data={'status': OrderStatus.DELIVERED},
            context={'order': order},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'], url_path='my-deliveries')
    def my_deliveries(self, request):
        orders = self.queryset.filter(driver=request.user)
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        active_statuses = [
            OrderStatus.PENDING,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.ON_THE_WAY,
        ]
        orders = (
            Order.objects.filter(customer=request.user, status__in=active_statuses)
            .select_related('restaurant', 'driver', 'driver__delivery_profile')
        )
        serializer = OrderActiveSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='driver-earnings')
    def driver_earnings(self, request):
        from datetime import timedelta
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncDate

        week_start = timezone.now() - timedelta(days=7)
        user = request.user
        delivered_orders = Order.objects.filter(
            driver=user,
            status=OrderStatus.DELIVERED,
            delivered_at__gte=week_start,
        )
        delivered_shipments = Shipment.objects.filter(
            driver=user,
            status=ShipmentStatus.DELIVERED,
            delivered_at__gte=week_start,
        )
        order_fees = delivered_orders.aggregate(total=Sum('delivery_fee'))['total'] or Decimal('0')
        tip_total = delivered_orders.aggregate(total=Sum('tip_amount'))['total'] or Decimal('0')
        shipment_fees = delivered_shipments.aggregate(total=Sum('delivery_fee'))['total'] or Decimal('0')
        total = order_fees + shipment_fees + tip_total

        order_days = (
            delivered_orders.annotate(day=TruncDate('delivered_at'))
            .values('day')
            .annotate(count=Count('id'), earnings=Sum('delivery_fee'))
            .order_by('-day')
        )
        shipment_days = (
            delivered_shipments.annotate(day=TruncDate('delivered_at'))
            .values('day')
            .annotate(count=Count('id'), earnings=Sum('delivery_fee'))
            .order_by('-day')
        )
        daily_map: dict = {}
        for row in order_days:
            key = row['day'].isoformat() if row['day'] else ''
            daily_map[key] = {
                'date': key,
                'orders': row['count'],
                'shipments': 0,
                'earnings': row['earnings'] or Decimal('0'),
            }
        for row in shipment_days:
            key = row['day'].isoformat() if row['day'] else ''
            entry = daily_map.setdefault(key, {
                'date': key,
                'orders': 0,
                'shipments': 0,
                'earnings': Decimal('0'),
            })
            entry['shipments'] = row['count']
            entry['earnings'] = (entry['earnings'] or Decimal('0')) + (row['earnings'] or Decimal('0'))

        daily_breakdown = sorted(
            [
                {
                    'date': v['date'],
                    'deliveries': v['orders'] + v['shipments'],
                    'orders': v['orders'],
                    'shipments': v['shipments'],
                    'earnings': str(v['earnings']),
                }
                for v in daily_map.values()
            ],
            key=lambda x: x['date'],
            reverse=True,
        )

        cash_orders = delivered_orders.filter(payment_method=PaymentMethod.CASH).count()
        cash_shipments = delivered_shipments.filter(payment_method=PaymentMethod.CASH).count()
        transfer_orders = delivered_orders.filter(payment_method=PaymentMethod.TRANSFER).count()
        transfer_shipments = delivered_shipments.filter(payment_method=PaymentMethod.TRANSFER).count()

        return Response({
            'week_deliveries': delivered_orders.count() + delivered_shipments.count(),
            'week_orders': delivered_orders.count(),
            'week_shipments': delivered_shipments.count(),
            'week_earnings': str(total),
            'week_delivery_fees': str(order_fees + shipment_fees),
            'week_tips': str(tip_total),
            'daily_breakdown': daily_breakdown,
            'cash_deliveries': cash_orders + cash_shipments,
            'transfer_deliveries': transfer_orders + transfer_shipments,
        })

    @action(detail=False, methods=['get'], url_path='settlements/driver')
    def driver_settlement(self, request):
        from datetime import timedelta
        from django.db.models import Count, Sum

        week_start = timezone.now() - timedelta(days=7)
        delivered = Order.objects.filter(
            driver=request.user,
            status=OrderStatus.DELIVERED,
            delivered_at__gte=week_start,
        )
        fees = delivered.aggregate(total=Sum('delivery_fee'))['total'] or Decimal('0')
        tips = delivered.aggregate(total=Sum('tip_amount'))['total'] or Decimal('0')
        pending_payout = fees + tips
        return Response({
            'period_days': 7,
            'deliveries_count': delivered.count(),
            'delivery_fees': str(fees),
            'tips': str(tips),
            'total_payout': str(pending_payout),
            'status': 'pending_transfer',
            'note': 'Liquidación semanal estimada. Contacta a soporte para confirmar depósito.',
        })

    @action(detail=False, methods=['get'], url_path='settlements/restaurant')
    def restaurant_settlement(self, request):
        from datetime import timedelta
        from django.db.models import Sum

        week_start = timezone.now() - timedelta(days=7)
        from restaurants.models import Restaurant

        restaurant = Restaurant.objects.filter(owner=request.user).first()
        if not restaurant:
            return Response({'detail': 'No tienes restaurante.'}, status=status.HTTP_404_NOT_FOUND)

        delivered = Order.objects.filter(
            restaurant=restaurant,
            status=OrderStatus.DELIVERED,
            delivered_at__gte=week_start,
        )
        food_sales = delivered.aggregate(total=Sum('subtotal'))['total'] or Decimal('0')
        discounts = delivered.aggregate(total=Sum('discount_amount'))['total'] or Decimal('0')
        net_sales = food_sales - discounts
        return Response({
            'period_days': 7,
            'orders_count': delivered.count(),
            'food_sales': str(food_sales),
            'discounts': str(discounts),
            'net_sales': str(net_sales),
            'status': 'pending_transfer',
            'note': 'Ventas de platillos sin envío. Contacta a soporte para liquidación.',
        })

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        order = self.get_object()
        if not user_can_access_order(order, request.user):
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if order.status in (OrderStatus.DELIVERED, OrderStatus.CANCELLED):
            if request.method == 'POST':
                return Response(
                    {'detail': 'El pedido ya finalizó; no se pueden enviar más mensajes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if request.method == 'GET':
            msgs = order.messages.select_related('sender').order_by('created_at')
            return Response(OrderMessageSerializer(msgs, many=True).data)

        serializer = OrderMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = OrderMessage.objects.create(
            order=order,
            sender=request.user,
            body=serializer.validated_data['body'],
        )
        return Response(
            OrderMessageSerializer(msg).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='restaurant-pending')
    def restaurant_pending(self, request):
        """Pedidos activos del restaurante del usuario."""
        orders = self.queryset.filter(
            restaurant__owner=request.user,
        ).exclude(status__in=[OrderStatus.DELIVERED, OrderStatus.CANCELLED])
        serializer = OrderSerializer(orders, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='initiate-payment')
    def initiate_payment(self, request, pk=None):
        order = self.get_object()
        if order.customer != request.user:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_method != PaymentMethod.ONLINE:
            return Response(
                {'detail': 'Este pedido no usa pago en línea.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.payment_status == PaymentStatus.PAID:
            return Response({'detail': 'Ya está pagado.', 'payment_status': 'paid'})

        from .mercadopago import create_checkout_preference, mercadopago_enabled

        mp = create_checkout_preference(order) if mercadopago_enabled() else None
        if mp and mp.get('init_point'):
            return Response({
                'payment_status': 'pending',
                'payment_url': mp['init_point'],
                'preference_id': mp.get('preference_id'),
                'order_id': order.id,
                'amount': str(order.total),
            })

        return Response({
            'payment_status': 'pending',
            'payment_url': None,
            'message': (
                'Pago en línea no configurado. '
                'Configura MERCADOPAGO_ACCESS_TOKEN o usa efectivo/transferencia.'
            ),
            'order_id': order.id,
            'amount': str(order.total),
        })

    @action(detail=True, methods=['post'], url_path='confirm-payment')
    def confirm_payment(self, request, pk=None):
        """Confirmación manual de pago en línea (solo administrador)."""
        order = self.get_object()
        if not request.user.is_admin_user:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_method != PaymentMethod.ONLINE:
            return Response(
                {'detail': 'Este pedido no usa pago en línea.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.payment_status = PaymentStatus.PAID
        order.save(update_fields=['payment_status', 'updated_at'])
        return Response(OrderSerializer(order, context={'request': request}).data)


class ShipmentViewSet(viewsets.ModelViewSet):
    queryset = Shipment.objects.select_related(
        'customer', 'driver', 'driver__delivery_profile',
    )
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return ShipmentCreateSerializer
        return ShipmentSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset

        if user.is_admin_user:
            return queryset

        if user.is_customer:
            return queryset.filter(customer=user)

        if user.is_driver:
            if self.action == 'accept_delivery':
                return queryset.filter(
                    status=ShipmentStatus.PENDING,
                    driver__isnull=True,
                )
            if self.action == 'retrieve':
                return queryset.filter(
                    Q(driver=user)
                    | Q(status=ShipmentStatus.PENDING, driver__isnull=True),
                )
            return queryset.filter(driver=user)

        return Shipment.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsCustomer()]
        if self.action in (
            'available', 'accept_delivery', 'mark_picked_up', 'mark_delivered', 'my_deliveries',
        ):
            return [IsDriver()]
        if self.action == 'cancel':
            return [IsCustomer()]
        if self.action == 'active':
            return [IsCustomer()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        def do_create():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            shipment = serializer.save()
            output = ShipmentSerializer(shipment, context={'request': request})
            return Response(output.data, status=status.HTTP_201_CREATED)

        return idempotent_create(request, 'shipment_create', do_create)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            shipment = Shipment.objects.select_for_update().get(pk=self.get_object().pk)
            if shipment.customer != request.user:
                return Response(
                    {'detail': 'No puedes cancelar este envío.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if shipment.status != ShipmentStatus.PENDING:
                return Response(
                    {'detail': 'Solo se pueden cancelar envíos pendientes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            shipment.status = ShipmentStatus.CANCELLED
            shipment.save(update_fields=['status', 'updated_at'])
        return Response(ShipmentSerializer(shipment).data)

    @action(detail=False, methods=['get'])
    def available(self, request):
        if not driver_can_receive_deliveries(request.user):
            return Response(
                {'detail': 'Tu perfil está pendiente de aprobación por ZinApp.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        shipments = Shipment.objects.filter(
            status=ShipmentStatus.PENDING,
            driver__isnull=True,
        ).select_related('customer')
        serializer = ShipmentSerializer(shipments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='accept-delivery')
    def accept_delivery(self, request, pk=None):
        profile, _ = DeliveryProfile.objects.get_or_create(
            user=request.user,
            defaults={'is_available': False},
        )
        if not driver_can_receive_deliveries(request.user):
            return Response(
                {'detail': 'Tu perfil está pendiente de aprobación por ZinApp.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not profile.is_available:
            return Response(
                {'detail': 'Debes estar disponible para aceptar entregas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if driver_has_active_delivery(request.user):
            return Response(
                {'detail': 'Termina tu entrega actual antes de aceptar otra.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            shipment = Shipment.objects.select_for_update().filter(pk=pk).first()
            if not shipment:
                return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if shipment.status != ShipmentStatus.PENDING:
                return Response(
                    {'detail': 'Solo se pueden tomar envíos pendientes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if shipment.driver_id:
                return Response(
                    {'detail': 'Este envío ya tiene repartidor asignado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            shipment.driver = request.user
            shipment.status = ShipmentStatus.PICKED_UP
            shipment.save(update_fields=['driver', 'status', 'updated_at'])

        return Response(ShipmentSerializer(shipment).data)

    @action(detail=True, methods=['post'], url_path='mark-picked-up')
    def mark_picked_up(self, request, pk=None):
        shipment = self.get_object()
        if shipment.driver != request.user:
            return Response(
                {'detail': 'No eres el repartidor de este envío.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if shipment.status != ShipmentStatus.PICKED_UP:
            return Response(
                {'detail': 'El envío no está en recogida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shipment.status = ShipmentStatus.ON_THE_WAY
        shipment.driver_nearby_notified = False
        shipment.save(update_fields=['status', 'driver_nearby_notified', 'updated_at'])
        return Response(ShipmentSerializer(shipment).data)

    @action(detail=True, methods=['post'], url_path='mark-delivered')
    def mark_delivered(self, request, pk=None):
        shipment = self.get_object()
        if shipment.driver != request.user:
            return Response(
                {'detail': 'No eres el repartidor de este envío.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if shipment.status != ShipmentStatus.ON_THE_WAY:
            return Response(
                {'detail': 'Este envío no está en camino.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shipment.status = ShipmentStatus.DELIVERED
        shipment.delivered_at = timezone.now()
        shipment.save(update_fields=['status', 'delivered_at', 'updated_at'])
        return Response(ShipmentSerializer(shipment).data)

    @action(detail=False, methods=['get'], url_path='my-deliveries')
    def my_deliveries(self, request):
        shipments = self.queryset.filter(driver=request.user)
        serializer = ShipmentSerializer(shipments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        active_statuses = [
            ShipmentStatus.PENDING,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.ON_THE_WAY,
        ]
        shipments = (
            Shipment.objects.filter(customer=request.user, status__in=active_statuses)
            .select_related('driver', 'driver__delivery_profile')
        )
        serializer = ShipmentActiveSerializer(shipments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='sizes')
    def sizes(self, request):
        from .models import SHIPMENT_SIZE_FEES, ShipmentSize

        hints = {
            ShipmentSize.SMALL: 'Sobre, documentos o bolsa pequeña',
            ShipmentSize.MEDIUM: 'Caja mediana o varios artículos',
            ShipmentSize.LARGE: 'Caja grande o paquete pesado',
        }
        data = [
            {
                'key': choice.value,
                'label': choice.label,
                'fee': str(SHIPMENT_SIZE_FEES[choice.value]),
                'hint': hints.get(choice.value, ''),
            }
            for choice in ShipmentSize
        ]
        return Response(data)


class MercadoPagoWebhookView(APIView):
    """Webhook de notificaciones IPN de Mercado Pago."""
    permission_classes = []
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        topic = request.data.get('type') or request.query_params.get('type')
        payment_id = (
            request.data.get('data', {}).get('id')
            or request.query_params.get('data.id')
        )
        if topic != 'payment' or not payment_id:
            return Response({'detail': 'Ignorado.'})

        from .mercadopago import fetch_payment, verify_webhook_signature

        if not verify_webhook_signature(request, str(payment_id)):
            return Response(
                {'detail': 'Firma de webhook inválida.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        payment = fetch_payment(str(payment_id))
        if not payment:
            return Response({'detail': 'Pago no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if payment.get('status') != 'approved':
            return Response({'detail': 'Pago no aprobado.'})

        metadata = payment.get('metadata') or {}
        if metadata.get('type') and metadata.get('type') != 'order':
            return Response({'detail': 'Notificación ignorada.'})

        order_id = payment.get('external_reference') or metadata.get('order_id')
        if not order_id:
            return Response({'detail': 'Sin referencia.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment_amount = Decimal(str(payment.get('transaction_amount'))).quantize(Decimal('0.01'))
        except Exception:
            payment_amount = None

        if payment.get('currency_id') != 'MXN':
            return Response(
                {'detail': 'El pago no corresponde al pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order_pk = int(order_id)
        except (ValueError, TypeError):
            return Response({'detail': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(pk=order_pk)
            except Order.DoesNotExist:
                return Response({'detail': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

            if str(payment.get('external_reference')) != str(order.id) or payment_amount != order.total:
                return Response(
                    {'detail': 'El pago no corresponde al pedido.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if order.status == OrderStatus.CANCELLED or order.payment_status == PaymentStatus.PAID:
                return Response({'detail': 'OK', 'order_id': order.id})

            if order.payment_method == PaymentMethod.ONLINE:
                order.payment_status = PaymentStatus.PAID
                order.save(update_fields=['payment_status', 'updated_at'])

        return Response({'detail': 'OK', 'order_id': order.id})


class OrderDisputeViewSet(viewsets.ModelViewSet):
    queryset = OrderDispute.objects.select_related('order', 'customer')
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return OrderDisputeCreateSerializer
        if self.action == 'resolve':
            return OrderDisputeResolveSerializer
        return OrderDisputeSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_user:
            return self.queryset
        if user.is_customer:
            return self.queryset.filter(customer=user)
        return OrderDispute.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsCustomer()]
        if self.action == 'resolve':
            return [IsAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        dispute = self.get_object()
        if dispute.status != DisputeStatus.PENDING:
            return Response(
                {'detail': 'Esta disputa ya fue resuelta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = OrderDisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dispute.status = serializer.validated_data['status']
        dispute.admin_notes = serializer.validated_data.get('admin_notes', '')
        dispute.resolved_at = timezone.now()
        dispute.save(update_fields=['status', 'admin_notes', 'resolved_at', 'updated_at'])
        if dispute.status == DisputeStatus.REFUNDED:
            dispute.order.payment_status = PaymentStatus.PAID
            dispute.order.save(update_fields=['payment_status', 'updated_at'])
        return Response(OrderDisputeSerializer(dispute).data)


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [IsAdmin]
    lookup_field = 'code'
    lookup_value_regex = '[^/]+'

    @action(detail=False, methods=['post'], url_path='validate', permission_classes=[IsAuthenticated])
    def validate_coupon(self, request):
        serializer = CouponValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coupon = serializer.validated_data['coupon']
        return Response({
            'code': coupon.code,
            'discount_amount': serializer.validated_data['discount_amount'],
            'description': coupon.description,
        })

    @action(detail=False, methods=['get'], url_path='active', permission_classes=[AllowAny])
    def active_coupons(self, request):
        now = timezone.now()
        coupons = Coupon.objects.filter(is_active=True).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now),
        ).filter(
            Q(max_uses__isnull=True) | Q(times_used__lt=F('max_uses')),
        )
        serializer = CouponPublicSerializer(coupons, many=True)
        return Response(serializer.data)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related('customer', 'restaurant', 'driver', 'order')
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        if self.action == 'list' and self.request.query_params.get('restaurant'):
            return [AllowAny()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_queryset(self):
        qs = self.queryset
        restaurant_id = self.request.query_params.get('restaurant')
        if restaurant_id:
            return qs.filter(restaurant_id=restaurant_id)
        if not self.request.user.is_authenticated:
            return qs.none()
        if self.request.user.is_customer:
            return qs.filter(customer=self.request.user)
        if self.request.user.is_admin_user:
            return qs
        if self.request.user.is_restaurant_owner:
            return qs.filter(restaurant__owner=self.request.user)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save()


class AdminStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from accounts.models import User
        from restaurants.models import Restaurant

        return Response({
            'users': User.objects.count(),
            'restaurants': Restaurant.objects.count(),
            'restaurants_active': Restaurant.objects.filter(is_active=True).count(),
            'restaurants_pending': Restaurant.objects.filter(is_active=False).count(),
            'orders': Order.objects.count(),
            'orders_pending': Order.objects.filter(status=OrderStatus.PENDING).count(),
            'orders_active': Order.objects.exclude(
                status__in=[OrderStatus.DELIVERED, OrderStatus.CANCELLED]
            ).count(),
            'coupons': Coupon.objects.filter(is_active=True).count(),
            'disputes_pending': OrderDispute.objects.filter(status=DisputeStatus.PENDING).count(),
        })

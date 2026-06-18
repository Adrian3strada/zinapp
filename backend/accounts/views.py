import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DeliveryProfile, PasswordResetToken, User
from .permissions import IsAdmin, IsDriver
from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    DeliveryProfileSerializer,
    ForgotPasswordSerializer,
    PushTokenSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Contraseña actualizada.'})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.get(username=serializer.validated_data['username'])
        token_value = secrets.token_urlsafe(32)
        PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
        reset_token = PasswordResetToken.objects.create(
            user=user,
            token=token_value,
            expires_at=timezone.now() + timedelta(hours=2),
        )
        response = {'detail': 'Si el usuario existe, recibirás instrucciones para restablecer.'}
        if user.email and getattr(settings, 'EMAIL_HOST', '') and getattr(settings, 'EMAIL_HOST_USER', ''):
            try:
                send_mail(
                    subject='Restablece tu contraseña — ZinApp',
                    message=(
                        f'Hola {user.first_name or user.username},\n\n'
                        f'Tu código para restablecer contraseña en ZinApp:\n\n{token_value}\n\n'
                        'Válido 2 horas. En la app: Recuperar contraseña → pegar el código.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                if settings.DEBUG:
                    response['reset_token'] = reset_token.token
                    response['hint'] = 'Email falló — usa este token en desarrollo.'
        elif settings.DEBUG:
            response['reset_token'] = reset_token.token
            response['hint'] = 'En desarrollo: usa este token en /api/auth/reset-password/'
        return Response(response)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['reset_token']
        token.user.set_password(serializer.validated_data['new_password'])
        token.user.save(update_fields=['password'])
        token.used = True
        token.save(update_fields=['used'])
        return Response({'detail': 'Contraseña restablecida. Ya puedes iniciar sesión.'})


class PushTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.expo_push_token = serializer.validated_data['expo_push_token']
        request.user.save(update_fields=['expo_push_token'])
        return Response({'detail': 'Token registrado.'})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class DeliveryProfileViewSet(viewsets.ModelViewSet):
    queryset = DeliveryProfile.objects.select_related('user').all()
    serializer_class = DeliveryProfileSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdmin()]
        if self.action in ('update', 'partial_update', 'me'):
            return [IsDriver()]
        return [IsAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_user:
            return self.queryset
        if user.is_driver:
            return self.queryset.filter(user=user)
        return DeliveryProfile.objects.none()

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsDriver])
    def me(self, request):
        profile, _ = DeliveryProfile.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            serializer = self.get_serializer(profile, context={'request': request})
            return Response(serializer.data)
        serializer = self.get_serializer(
            profile,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        profile.refresh_from_db()
        lat = profile.current_latitude
        lon = profile.current_longitude
        if lat is not None and lon is not None:
            from accounts.proximity import check_driver_nearby_deliveries
            check_driver_nearby_deliveries(request.user, float(lat), float(lon))
        return Response(serializer.data)

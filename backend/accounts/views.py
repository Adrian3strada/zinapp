import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

logger = logging.getLogger(__name__)

# Sin 0/O/1/I para facilitar lectura del código en el correo.
_RESET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _generate_reset_code(length=8):
    return ''.join(secrets.choice(_RESET_CODE_ALPHABET) for _ in range(length))

from config.email_utils import email_reset_enabled, email_smtp_configured
from config.throttling import (
    ForgotPasswordRateThrottle,
    LoginRateThrottle,
    RegisterRateThrottle,
    ResetPasswordRateThrottle,
    TokenRefreshRateThrottle,
)
from .account_deletion import delete_user_account
from .models import DeliveryProfile, PasswordResetToken, User
from .permissions import IsAdmin, IsDriver
from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    DeleteAccountSerializer,
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
    throttle_classes = [RegisterRateThrottle]


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [TokenRefreshRateThrottle]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


@extend_schema(exclude=True)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Contraseña actualizada.'})


@extend_schema(exclude=True)
class DeleteAccountView(APIView):
    """App Store 5.1.1(v): in-app account deletion."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            delete_user_account(request.user)
        except PermissionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {'detail': 'Tu cuenta y datos personales fueron eliminados.'},
            status=status.HTTP_200_OK,
        )


@extend_schema(exclude=True)
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordRateThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data['identifier']
        # Respuesta idéntica siempre (anti-enumeración).
        response = {
            'detail': (
                'Si la cuenta existe y tiene correo, te enviamos un código '
                'para restablecer la contraseña.'
            ),
        }
        whatsapp = getattr(settings, 'SUPPORT_WHATSAPP', '').strip()
        email_ready = email_reset_enabled()
        smtp_ready = email_smtp_configured()
        if whatsapp and not smtp_ready:
            response['password_reset_via_whatsapp'] = True
            response['hint'] = (
                'Si no llega correo, contacta soporte por WhatsApp para restablecer.'
            )

        user = (
            User.objects.filter(username__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
        )
        if not user:
            return Response(response)

        PasswordResetToken.objects.filter(user=user, used=False).update(used=True)
        reset_token = None
        for _ in range(5):
            token_value = _generate_reset_code()
            try:
                reset_token = PasswordResetToken.objects.create(
                    user=user,
                    token=token_value,
                    expires_at=timezone.now() + timedelta(hours=2),
                )
                break
            except IntegrityError:
                continue
        if reset_token is None:
            logger.error('Forgot-password: no se pudo generar código único user_id=%s', user.pk)
            return Response(response)

        if not user.email:
            logger.info('Forgot-password: usuario sin correo user_id=%s', user.pk)
            if settings.DEBUG:
                response['reset_token'] = reset_token.token
                response['hint'] = 'En desarrollo: usa este código (cuenta sin correo).'
            elif whatsapp:
                response['password_reset_via_whatsapp'] = True
                response['hint'] = (
                    'Tu cuenta no tiene correo. Contacta soporte por WhatsApp para restablecer.'
                )
            return Response(response)

        if not email_ready:
            logger.warning(
                'Forgot-password: SMTP no configurado (EMAIL_HOST/USER/PASSWORD). '
                'No se envió correo user_id=%s',
                user.pk,
            )
            if settings.DEBUG:
                response['reset_token'] = reset_token.token
                response['hint'] = (
                    'SMTP no configurado. Usa este código o define EMAIL_* en .env '
                    '(Resend: smtp.resend.com / resend / API_KEY).'
                )
            elif whatsapp:
                response['password_reset_via_whatsapp'] = True
                response['hint'] = (
                    'No pudimos enviar el correo. Contacta soporte por WhatsApp.'
                )
            return Response(response)

        try:
            send_mail(
                subject='Restablece tu contraseña - ZinApp',
                message=(
                    f'Hola {user.first_name or user.username},\n\n'
                    f'Tu código para restablecer la contraseña en ZinApp:\n\n'
                    f'{reset_token.token}\n\n'
                    'Válido 2 horas.\n'
                    'En la app: Recuperar contraseña > Ya tengo el código > pega este código.\n'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            logger.info(
                'Forgot-password: correo enviado user_id=%s to=%s smtp=%s from=%s',
                user.pk,
                user.email,
                smtp_ready,
                settings.DEFAULT_FROM_EMAIL,
            )
            if settings.DEBUG:
                # Facilita prueba local (consola o SMTP): también devolver el código.
                response['reset_token'] = reset_token.token
                response['hint'] = (
                    'Correo enviado (en consola si no hay SMTP). '
                    'También puedes usar este código.'
                )
        except Exception:
            logger.exception(
                'Forgot-password email failed user_id=%s from=%s host=%s',
                user.pk,
                settings.DEFAULT_FROM_EMAIL,
                settings.EMAIL_HOST,
            )
            if settings.DEBUG:
                response['reset_token'] = reset_token.token
                response['hint'] = 'Email falló — usa este código en desarrollo.'
            elif whatsapp:
                response['password_reset_via_whatsapp'] = True
                response['hint'] = (
                    'No pudimos enviar el correo. Contacta soporte por WhatsApp.'
                )

        return Response(response)


@extend_schema(exclude=True)
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ResetPasswordRateThrottle]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data['reset_token']
        token.user.set_password(serializer.validated_data['new_password'])
        token.user.save(update_fields=['password'])
        token.used = True
        token.save(update_fields=['used'])
        return Response({'detail': 'Contraseña restablecida. Ya puedes iniciar sesión.'})


@extend_schema(exclude=True)
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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdmin()]
        if self.action in ('update', 'partial_update', 'me'):
            return [IsDriver()]
        return [IsAdmin()]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'is_admin_user', False):
            return self.queryset
        if user.is_driver:
            return self.queryset.filter(user=user)
        return DeliveryProfile.objects.none()

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsDriver])
    def me(self, request):
        profile, _ = DeliveryProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'is_available': False,
                'verification_status': DeliveryProfile.VerificationStatus.PENDING,
            },
        )
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

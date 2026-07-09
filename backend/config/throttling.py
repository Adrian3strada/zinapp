from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'


class ForgotPasswordRateThrottle(AnonRateThrottle):
    scope = 'forgot_password'


class ResetPasswordRateThrottle(AnonRateThrottle):
    scope = 'reset_password'


class TokenRefreshRateThrottle(AnonRateThrottle):
    scope = 'token_refresh'

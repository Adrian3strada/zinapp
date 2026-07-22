from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-me')
DEBUG = config('DEBUG', default=False, cast=bool)

if not DEBUG and (
    SECRET_KEY.startswith('django-insecure')
    or len(SECRET_KEY) < 32
):
    raise ImproperlyConfigured(
        'SECRET_KEY inseguro en producción. Genera uno con '
        'python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
    )

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# En desarrollo, permitir conexiones desde Expo Go en la red local
if DEBUG:
    ALLOWED_HOSTS = ['*']
elif not ALLOWED_HOSTS or ALLOWED_HOSTS == ['localhost', '127.0.0.1']:
    ALLOWED_HOSTS = ['.railway.app', '.onrender.com']

CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if not DEBUG else None

if not DEBUG:
    # Railway/Caddy terminan TLS en el borde; el healthcheck interno usa HTTP.
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=False, cast=bool)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    X_FRAME_OPTIONS = 'DENY'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'accounts',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'corsheaders',
    'restaurants.apps.RestaurantsConfig',
    'local_services.apps.LocalServicesConfig',
    'orders',
    'dashboard',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'config' / 'templates',
            BASE_DIR / 'dashboard' / 'templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'dashboard.context_processors.panel_nav',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

USE_SQLITE = config('USE_SQLITE', default=False, cast=bool)
DATABASE_URL = config('DATABASE_URL', default='').strip()

if DATABASE_URL:
    # Railway / Render inyectan DATABASE_URL al vincular Postgres
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=not DEBUG,
        ),
    }
elif USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='zinapp_db'),
            'USER': config('DB_USER', default='postgres'),
            'PASSWORD': config('DB_PASSWORD', default='postgres'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'connect_timeout': 10,
                **({'sslmode': 'disable'} if DEBUG else {}),
            },
        }
    }

AUTH_USER_MODEL = 'accounts.User'

AUTHENTICATION_BACKENDS = [
    'accounts.backends.CaseInsensitiveUsernameBackend',
    'django.contrib.auth.backends.ModelBackend',
]

if DEBUG:
    # Desarrollo: contraseña mínima de 6 caracteres (sin bloquear "test1234", etc.)
    AUTH_PASSWORD_VALIDATORS = [
        {
            'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
            'OPTIONS': {'min_length': 6},
        },
    ]
else:
    AUTH_PASSWORD_VALIDATORS = [
        {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
        {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
        {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
        {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    ]

LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

LOGIN_URL = '/panel/login/'
LOGIN_REDIRECT_URL = '/panel/'
LOGOUT_REDIRECT_URL = '/panel/login/'

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = Path(config('MEDIA_ROOT', default=str(BASE_DIR / 'media')))
# Keep Django's development media server opt-in in production. Public media
# should normally be served by object storage or the edge proxy.
SERVE_MEDIA = config('SERVE_MEDIA', default=False, cast=bool)
API_DOCS_ENABLED = config('API_DOCS_ENABLED', default=DEBUG, cast=bool)

SUPPORT_WHATSAPP = config('SUPPORT_WHATSAPP', default='').strip()
APP_STORE_URL = config('APP_STORE_URL', default='').strip()
PLAY_STORE_URL = config('PLAY_STORE_URL', default='').strip()
DEMO_ACCOUNTS_ENABLED = config('DEMO_ACCOUNTS_ENABLED', default=DEBUG, cast=bool)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:8081,http://127.0.0.1:8081',
    cast=Csv(),
)

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

REDIS_URL = config('REDIS_URL', default='').strip()
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
        },
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        },
    }

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/min',
        'user': '400/min',
        'login': '10/min',
        'register': '5/hour',
        'forgot_password': '8/hour',
        'reset_password': '15/hour',
        'token_refresh': '30/min',
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'ZinApp API',
    'DESCRIPTION': 'API privada y pública de ZinApp.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

SIMPLE_JWT = {
    # Access corto; el cliente renueva con refresh sin forzar re-login.
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    # Sesión persistente al cerrar la app; se renueva al usarla (rotate).
    'REFRESH_TOKEN_LIFETIME': timedelta(days=365),
    'ROTATE_REFRESH_TOKENS': True,
    # Invalida el refresh anterior al rotar (requiere token_blacklist).
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

MERCADOPAGO_ACCESS_TOKEN = config('MERCADOPAGO_ACCESS_TOKEN', default='')
MERCADOPAGO_BACK_URL = config('MERCADOPAGO_BACK_URL', default='')
MERCADOPAGO_WEBHOOK_URL = config('MERCADOPAGO_WEBHOOK_URL', default='')
MERCADOPAGO_WEBHOOK_SECRET = config('MERCADOPAGO_WEBHOOK_SECRET', default='')

CRON_SECRET = config('CRON_SECRET', default='')

# Resend: preferir API HTTP (RESEND_API_KEY). SMTP a smtp.resend.com se cuelga en Railway.
RESEND_API_KEY = config('RESEND_API_KEY', default='').strip()
EMAIL_HOST = config('EMAIL_HOST', default='').strip()
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='').strip()
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
# Evita workers colgados si alguien usa SMTP como respaldo.
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=15, cast=int)
_default_from = config('DEFAULT_FROM_EMAIL', default='').strip()
_resend_ready = bool(
    RESEND_API_KEY
    or (EMAIL_HOST_PASSWORD and 'resend.com' in EMAIL_HOST.lower())
)
if _default_from:
    DEFAULT_FROM_EMAIL = _default_from
elif _resend_ready or (EMAIL_HOST and 'resend.com' in EMAIL_HOST.lower()):
    # Resend rechaza from="resend"; sin dominio verificado usa onboarding@resend.dev
    DEFAULT_FROM_EMAIL = 'ZinApp <onboarding@resend.dev>'
else:
    DEFAULT_FROM_EMAIL = EMAIL_HOST_USER or 'noreply@zinapp.mx'

_email_smtp_ready = bool(EMAIL_HOST and EMAIL_HOST_USER and EMAIL_HOST_PASSWORD)
# Con Resend HTTP no hace falta SMTP; consola solo en DEBUG local.
if _resend_ready:
    EMAIL_BACKEND = 'django.core.mail.backends.dummy.EmailBackend'
elif _email_smtp_ready:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
elif DEBUG:
    # Local sin Resend: el correo se imprime en la consola del runserver.
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.dummy.EmailBackend'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '[{levelname}] {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'dashboard': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'accounts.notifications': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'accounts.views': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

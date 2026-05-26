import importlib.util
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent


def load_env_file(file_path: Path):
    if not file_path.exists():
        return

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


load_env_file(ROOT_DIR / ".env")
load_env_file(BASE_DIR / ".env")


def env(name: str, default=None, cast=str):
    value = os.getenv(name, default)
    if value is None:
        return None
    if cast is bool:
        return str(value).strip().lower() in {"1", "true", "yes", "on"}
    return cast(value)


def csv_env(name: str, default: str = ""):
    raw = env(name, default=default, cast=str)
    return [item.strip() for item in raw.split(",") if item.strip()]


def module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-dev-only-change-me",
    cast=str,
)
DEBUG = env("DJANGO_DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = csv_env("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1")

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = []
if module_available("rest_framework"):
    THIRD_PARTY_APPS.append("rest_framework")
if module_available("rest_framework_simplejwt"):
    THIRD_PARTY_APPS.append("rest_framework_simplejwt")
if module_available("corsheaders"):
    THIRD_PARTY_APPS.append("corsheaders")

LOCAL_APPS = [
    "apps.accounts",
    "apps.companies",
    "apps.standards",
    "apps.implementation",
    "apps.documents",
    "apps.reviews",
    "apps.action_plans",
    "apps.ai_engine",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
if "corsheaders" in THIRD_PARTY_APPS:
    MIDDLEWARE.insert(1, "corsheaders.middleware.CorsMiddleware")

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


DB_ENGINE = env("DB_ENGINE", default="sqlite", cast=str).lower()

if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB", default="audibot"),
            "USER": env("POSTGRES_USER", default="audibot"),
            "PASSWORD": env("POSTGRES_PASSWORD", default="audibot"),
            "HOST": env("POSTGRES_HOST", default="localhost"),
            "PORT": env("POSTGRES_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


LANGUAGE_CODE = "es-ec"
TIME_ZONE = env("TIME_ZONE", default="America/Guayaquil", cast=str)

USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

CSRF_TRUSTED_ORIGINS = csv_env("CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = csv_env("CORS_ALLOWED_ORIGINS")

AI_PROVIDER = env("AI_PROVIDER", default="ollama", cast=str)
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434", cast=str).rstrip("/")
OLLAMA_CHAT_MODEL = env("OLLAMA_CHAT_MODEL", default="llama3.1:8b", cast=str)
OLLAMA_EMBEDDING_MODEL = env(
    "OLLAMA_EMBEDDING_MODEL",
    default="nomic-embed-text",
    cast=str,
)
AI_REQUEST_TIMEOUT_SECONDS = env("AI_REQUEST_TIMEOUT_SECONDS", default=60, cast=int)
CHUNK_SIZE_WORDS = env("CHUNK_SIZE_WORDS", default=1000, cast=int)
CHUNK_OVERLAP_WORDS = env("CHUNK_OVERLAP_WORDS", default=150, cast=int)
SEMANTIC_SEARCH_TOP_K = env("SEMANTIC_SEARCH_TOP_K", default=5, cast=int)
REVIEW_CONTEXT_TOP_K = env("REVIEW_CONTEXT_TOP_K", default=3, cast=int)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

CORS_ALLOW_CREDENTIALS = True


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

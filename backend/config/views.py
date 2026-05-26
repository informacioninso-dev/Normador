from pathlib import Path

from django.conf import settings
from django.db import connection
from django.db.utils import Error as DatabaseError
from django.http import JsonResponse

from apps.common.choices import AIProvider

def healthcheck(request):
    checks = {
        "database": _database_check(),
        "media_root": _media_root_check(),
        "ai_provider": _ai_provider_check(),
    }
    overall_status = (
        "ok"
        if all(check["status"] in {"ok", "configured"} for check in checks.values())
        else "degraded"
    )

    return JsonResponse(
        {
            "status": overall_status,
            "service": "audibot-backend",
            "debug": settings.DEBUG,
            "database_engine": settings.DATABASES["default"]["ENGINE"],
            "checks": checks,
        }
    )


def _database_check() -> dict:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return {"status": "ok"}
    except DatabaseError as exc:
        return {
            "status": "error",
            "detail": str(exc),
        }


def _media_root_check() -> dict:
    try:
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)
        probe_file = media_root / ".healthcheck.tmp"
        probe_file.write_text("ok", encoding="utf-8")
        probe_file.unlink(missing_ok=True)
        return {
            "status": "ok",
            "path": str(media_root),
        }
    except OSError as exc:
        return {
            "status": "error",
            "path": str(settings.MEDIA_ROOT),
            "detail": str(exc),
        }


def _ai_provider_check() -> dict:
    payload = {
        "status": "configured",
        "provider": settings.AI_PROVIDER,
    }
    if settings.AI_PROVIDER == AIProvider.OLLAMA:
        payload.update(
            {
                "base_url": settings.OLLAMA_BASE_URL,
                "chat_model": settings.OLLAMA_CHAT_MODEL,
                "embedding_model": settings.OLLAMA_EMBEDDING_MODEL,
            }
        )
    return payload

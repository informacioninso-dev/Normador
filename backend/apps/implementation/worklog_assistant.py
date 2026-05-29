import re
import time
import unicodedata
from datetime import date
from decimal import Decimal

from django.conf import settings

from apps.ai_engine.models import AIProviderLog
from apps.ai_engine.ollama_client import OllamaAPIError, OllamaClient
from apps.common.choices import AILogStatus, AIOperationType, AIProvider


ACTIVITY_KEYWORDS = {
    "CAPACITACION": ["capacitacion", "capacitar", "entrenamiento", "formacion"],
    "REUNION": ["reunion", "llamada", "comite", "mesa"],
    "REVISION": ["revision", "reviison", "revisar", "validacion", "validar", "documental", "documentar"],
    "SEGUIMIENTO": ["seguimiento", "seguimiento", "avance", "control"],
    "INFORME": ["informe", "reporte"],
    "ADMINISTRATIVO": ["administrativo", "admin", "facturacion"],
    "IMPLEMENTACION": ["implementacion", "implementar", "levantamiento"],
}


WORKLOG_SCHEMA = {
    "type": "object",
    "properties": {
        "activity_type": {
            "type": "string",
            "enum": [
                "IMPLEMENTACION",
                "REVISION",
                "REUNION",
                "SEGUIMIENTO",
                "CAPACITACION",
                "INFORME",
                "ADMINISTRATIVO",
                "OTRO",
            ],
        },
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "deliverables": {"type": "string"},
        "work_date": {"type": "string"},
        "start_time": {"type": "string"},
        "end_time": {"type": "string"},
        "logged_hours": {"type": ["number", "null"]},
        "billable_hours": {"type": ["number", "null"]},
        "confidence": {"type": "number"},
        "needs_review": {"type": "boolean"},
    },
    "required": [
        "activity_type",
        "title",
        "summary",
        "deliverables",
        "work_date",
        "start_time",
        "end_time",
        "logged_hours",
        "billable_hours",
        "confidence",
        "needs_review",
    ],
}


def parse_worklog_instruction(
    *,
    instruction: str,
    work_date: date | None = None,
    created_by=None,
    use_llm: bool = False,
) -> dict:
    text = " ".join((instruction or "").split())
    if not text:
        raise ValueError("Instruction is required.")

    parsed = _parse_with_rules(text, work_date=work_date)
    if not use_llm or not parsed["needs_review"]:
        return parsed

    if settings.AI_PROVIDER != AIProvider.MOCK:
        try:
            return _parse_with_ollama(text, work_date=work_date, created_by=created_by)
        except Exception:
            pass

    return parsed


def _parse_with_ollama(instruction: str, *, work_date: date | None, created_by=None) -> dict:
    today = (work_date or date.today()).isoformat()
    system_prompt = (
        "Eres un asistente de registro diario para consultores de implementacion normativa. "
        "Extraes datos operativos desde una frase en espanol. Devuelve JSON valido solamente. "
        "No inventes horas ni entregables. Si falta un campo, deja string vacio o null."
    )
    user_prompt = (
        f"Fecha por defecto: {today}\n"
        "Convierte esta instruccion en una jornada de trabajo:\n"
        f"{instruction}\n\n"
        "Reglas: activity_type debe usar uno de los enums. "
        "start_time y end_time deben estar en HH:MM de 24 horas. "
        "Si dicen 8 am hasta 9, usa 08:00 y 09:00. "
        "Si no hay fecha, usa la fecha por defecto. "
        "El titulo debe ser corto y accionable."
    )
    started = time.perf_counter()
    client = OllamaClient()

    try:
        response = client.chat_structured(
            model=settings.OLLAMA_CHAT_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=WORKLOG_SCHEMA,
            temperature=0,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        parsed = _normalize_payload(response["parsed"], instruction, default_date=today)
        AIProviderLog.objects.create(
            provider=AIProvider.OLLAMA,
            model_name=settings.OLLAMA_CHAT_MODEL,
            operation_type=AIOperationType.CHAT,
            status=AILogStatus.SUCCESS,
            prompt_version="worklog-assistant-v1",
            request_payload={"instruction": instruction, "default_date": today},
            response_payload=response.get("raw", response["parsed"]),
            latency_ms=latency_ms,
            created_by=created_by,
        )
        return parsed
    except OllamaAPIError as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        AIProviderLog.objects.create(
            provider=AIProvider.OLLAMA,
            model_name=settings.OLLAMA_CHAT_MODEL,
            operation_type=AIOperationType.CHAT,
            status=AILogStatus.ERROR,
            prompt_version="worklog-assistant-v1",
            request_payload={"instruction": instruction, "default_date": today},
            response_payload={},
            error_message=str(exc),
            latency_ms=latency_ms,
            created_by=created_by,
        )
        raise


def _parse_with_rules(instruction: str, *, work_date: date | None) -> dict:
    normalized = _normalize_text(instruction)
    default_date = (work_date or date.today()).isoformat()
    start_time, end_time = _extract_time_range(normalized)
    activity_type = _infer_activity_type(normalized)
    title = _extract_title(instruction, normalized, activity_type)
    logged_hours = _calculate_hours(start_time, end_time)

    return _normalize_payload(
        {
            "activity_type": activity_type,
            "title": title,
            "summary": instruction,
            "deliverables": "",
            "work_date": default_date,
            "start_time": start_time or "",
            "end_time": end_time or "",
            "logged_hours": logged_hours,
            "billable_hours": logged_hours,
            "confidence": 0.68 if start_time and end_time else 0.45,
            "needs_review": not bool(start_time and end_time and title),
        },
        instruction,
        default_date=default_date,
    )


def _normalize_payload(payload: dict, instruction: str, *, default_date: str) -> dict:
    activity_type = payload.get("activity_type") or "IMPLEMENTACION"
    if activity_type not in {
        "IMPLEMENTACION",
        "REVISION",
        "REUNION",
        "SEGUIMIENTO",
        "CAPACITACION",
        "INFORME",
        "ADMINISTRATIVO",
        "OTRO",
    }:
        activity_type = "IMPLEMENTACION"

    title = str(payload.get("title") or "").strip() or _extract_title(
        instruction,
        _normalize_text(instruction),
        activity_type,
    )

    start_time = _normalize_time_string(payload.get("start_time"))
    end_time = _normalize_time_string(payload.get("end_time"))
    logged_hours = payload.get("logged_hours")
    if logged_hours in {"", None}:
        logged_hours = _calculate_hours(start_time, end_time)
    billable_hours = payload.get("billable_hours")
    if billable_hours in {"", None}:
        billable_hours = logged_hours

    return {
        "activity_type": activity_type,
        "title": title[:255],
        "summary": str(payload.get("summary") or instruction).strip(),
        "deliverables": str(payload.get("deliverables") or "").strip(),
        "work_date": str(payload.get("work_date") or default_date)[:10],
        "start_time": start_time,
        "end_time": end_time,
        "logged_hours": _decimal_string(logged_hours),
        "billable_hours": _decimal_string(billable_hours),
        "confidence": float(payload.get("confidence") or 0),
        "needs_review": bool(payload.get("needs_review")),
    }


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\b([ap])\s*\.?\s*m\.?(?=\W|$)", r"\1m", normalized)


def _infer_activity_type(normalized: str) -> str:
    for activity_type, keywords in ACTIVITY_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return activity_type
    return "IMPLEMENTACION"


def _extract_time_range(normalized: str) -> tuple[str, str]:
    explicit_pattern = (
        r"(?:desde|dese|a)\s+(?:las\s+)?(?P<start>\d{1,2})(?::(?P<start_min>\d{2}))?\s*(?P<start_ampm>am|pm)?"
        r"\s*(?:hasta|a|-)\s*(?:las\s+)?(?P<end>\d{1,2})(?::(?P<end_min>\d{2}))?\s*(?P<end_ampm>am|pm)?"
    )
    fallback_pattern = (
        r"(?:^|\D)(?P<start>\d{1,2})(?::(?P<start_min>\d{2}))?\s*(?P<start_ampm>am|pm)?"
        r"\s*(?:hasta|-)\s*(?:las\s+)?(?P<end>\d{1,2})(?::(?P<end_min>\d{2}))?\s*(?P<end_ampm>am|pm)?"
    )
    match = re.search(explicit_pattern, normalized) or re.search(fallback_pattern, normalized)
    if not match:
        return "", ""

    if not _valid_raw_time(match.group("start"), match.group("start_min")):
        return "", ""
    if not _valid_raw_time(match.group("end"), match.group("end_min")):
        return "", ""

    start_ampm = match.group("start_ampm") or match.group("end_ampm")
    end_ampm = match.group("end_ampm") or match.group("start_ampm")
    start = _time_parts_to_hhmm(
        match.group("start"),
        match.group("start_min"),
        start_ampm,
    )
    end = _time_parts_to_hhmm(
        match.group("end"),
        match.group("end_min"),
        end_ampm,
    )
    if _time_to_minutes(end) <= _time_to_minutes(start):
        end = _infer_same_day_end_time(
            raw_end_hour=match.group("end"),
            raw_end_minutes=match.group("end_min"),
            start_ampm=start_ampm,
            explicit_end_ampm=match.group("end_ampm"),
        ) or end
    return start, end


def _valid_raw_time(raw_hour: str, raw_minutes: str | None) -> bool:
    hour = int(raw_hour)
    minutes = int(raw_minutes or "0")
    return 0 <= hour <= 23 and 0 <= minutes <= 59


def _time_parts_to_hhmm(raw_hour: str, raw_minutes: str | None, ampm: str | None) -> str:
    hour = int(raw_hour)
    minutes = int(raw_minutes or "0")
    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minutes:02d}"


def _infer_same_day_end_time(
    *,
    raw_end_hour: str,
    raw_end_minutes: str | None,
    start_ampm: str | None,
    explicit_end_ampm: str | None,
) -> str:
    end_hour = int(raw_end_hour)
    end_minutes = int(raw_end_minutes or "0")
    if start_ampm == "am" and end_hour == 12 and explicit_end_ampm in {None, "am"}:
        return f"12:{end_minutes:02d}"
    return ""


def _time_to_minutes(value: str) -> int:
    if not value:
        return 0
    hour, minute = [int(part) for part in value.split(":")]
    return hour * 60 + minute


def _normalize_time_string(value) -> str:
    text = str(value or "").strip()
    match = re.match(r"^(\d{1,2}):(\d{2})", text)
    if not match:
        return ""
    hour = min(max(int(match.group(1)), 0), 23)
    minute = min(max(int(match.group(2)), 0), 59)
    minute = minute - (minute % 5)
    return f"{hour:02d}:{minute:02d}"


def _calculate_hours(start_time: str, end_time: str) -> str | None:
    if not start_time or not end_time:
        return None
    start_hour, start_minute = [int(part) for part in start_time.split(":")]
    end_hour, end_minute = [int(part) for part in end_time.split(":")]
    start_total = start_hour * 60 + start_minute
    end_total = end_hour * 60 + end_minute
    if end_total <= start_total:
        return None
    return _decimal_string(Decimal(end_total - start_total) / Decimal("60"))


def _decimal_string(value) -> str | None:
    if value in {"", None}:
        return None
    decimal = Decimal(str(value)).quantize(Decimal("0.01"))
    return str(decimal)


def _extract_title(instruction: str, normalized: str, activity_type: str) -> str:
    explicit_title = _extract_explicit_title(instruction)
    if explicit_title:
        return explicit_title[:255]

    title = instruction.strip()
    title = re.sub(r"\b(desde|dese)\b.+$", "", title, flags=re.IGNORECASE).strip(" .,-")
    title = re.sub(r"^(capacitacion|revision|reviison|reunion|seguimiento|implementacion)\s+(con\s+)?", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^(documental|documentar)\s+(del?|de la|de los|de las)\s+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^el\s+titulo\s+", "", title, flags=re.IGNORECASE)
    if title:
        return title[:255]
    return activity_type.title().replace("_", " ")


def _extract_explicit_title(instruction: str) -> str:
    match = re.search(r"\bt[ií]tulo\s+(.+)$", instruction, flags=re.IGNORECASE)
    if not match:
        return ""

    title = match.group(1).strip(" .,-")
    title = re.sub(r"\b(desde|dese)\b.+$", "", title, flags=re.IGNORECASE).strip(" .,-")
    return title

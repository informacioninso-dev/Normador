from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers


def logo_upload_to(instance, filename):
    return f"company-logos/{instance.pk or 'new'}/{uuid4().hex}.png"


def clean_logo(upload):
    if upload.size > 2 * 1024 * 1024:
        raise serializers.ValidationError("El logo debe pesar como máximo 2 MB.")
    try:
        image = Image.open(upload)
        if image.format not in {"PNG", "JPEG"}:
            raise serializers.ValidationError("Usa una imagen PNG o JPEG.")
        if image.width > 5000 or image.height > 5000 or image.width * image.height > 12_000_000:
            raise serializers.ValidationError("El logo es demasiado grande. Usa una imagen de hasta 5000 px por lado.")
        image.load()
        image = image.convert("RGBA")
        image.thumbnail((1200, 600))
        output = BytesIO()
        image.save(output, format="PNG")
        return ContentFile(output.getvalue(), name="logo.png")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise serializers.ValidationError("No se pudo leer el logo. Usa una imagen PNG o JPEG válida.") from exc


def validate_header(value):
    allowed = {"title": 120, "subtitle": 140, "footer": 180}
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise serializers.ValidationError("El encabezado admite título, subtítulo y pie de página.")
    result = {}
    for key, limit in allowed.items():
        text = value.get(key, "")
        if not isinstance(text, str) or len(text) > limit:
            raise serializers.ValidationError(f"{key}: usa texto de hasta {limit} caracteres.")
        if any(ord(char) < 32 and char not in "\t\n\r" for char in text):
            raise serializers.ValidationError(f"{key}: el texto contiene caracteres no admitidos.")
        result[key] = text.strip()
    return result


def snapshot_branding(company):
    return {"company_name": company.name, "company_ruc": company.ruc,
            "header": dict(company.document_header or {}), "logo_name": company.logo.name if company.logo else ""}

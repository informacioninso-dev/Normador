"""Validate the exact JSON-schema subset used by the versioned review contract."""

from apps.ai_engine.prompt_builder import REVIEW_OUTPUT_SCHEMA


def _validate(value, schema, path):
    checks = {
        "object": lambda v: isinstance(v, dict),
        "array": lambda v: isinstance(v, list),
        "string": lambda v: isinstance(v, str),
        "integer": lambda v: type(v) is int,
        "boolean": lambda v: type(v) is bool,
        "null": lambda v: v is None,
    }
    types = schema.get("type", [])
    types = [types] if isinstance(types, str) else types
    if types and not any(checks[kind](value) for kind in types):
        raise ValueError(f"{path}: tipo invalido, se esperaba {types}.")
    if "enum" in schema and value not in schema["enum"]:
        raise ValueError(f"{path}: valor fuera del contrato.")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                raise ValueError(f"{path}.{key}: campo requerido.")
        for key, child in schema.get("properties", {}).items():
            if key in value:
                _validate(value[key], child, f"{path}.{key}")
    elif isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            _validate(item, schema["items"], f"{path}[{index}]")


def validate_review_output(payload, requirements):
    _validate(payload, REVIEW_OUTPUT_SCHEMA, "review")
    required_ids = {requirement.pk for requirement in requirements}
    seen = set()
    for evaluation in payload["requirement_evaluations"]:
        try:
            requirement_id = int(evaluation["requirement_id"])
        except (ValueError, TypeError):
            raise ValueError("Identificador de requisito invalido.") from None
        if requirement_id not in required_ids or requirement_id in seen:
            raise ValueError("La revision contiene requisitos ajenos o duplicados.")
        if (
            evaluation["status"] == "CUMPLE"
            and not evaluation["evidence_found"].strip()
        ):
            raise ValueError("CUMPLE requiere una cita documental.")
        seen.add(requirement_id)
    if seen != required_ids:
        raise ValueError("La revision debe evaluar todos los requisitos seleccionados.")
    for finding in payload["findings"]:
        value = finding.get("requirement_id")
        if value is not None and (
            not str(value).isdigit() or int(value) not in required_ids
        ):
            raise ValueError("El hallazgo referencia un requisito ajeno.")

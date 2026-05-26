from django.db import models


class ProjectStatus(models.TextChoices):
    PLANNING = "PLANNING", "Planning"
    ACTIVE = "ACTIVE", "Active"
    ON_HOLD = "ON_HOLD", "On hold"
    COMPLETED = "COMPLETED", "Completed"
    ARCHIVED = "ARCHIVED", "Archived"


class RequirementCriticality(models.TextChoices):
    LOW = "BAJA", "Baja"
    MEDIUM = "MEDIA", "Media"
    HIGH = "ALTA", "Alta"


class ChecklistStatus(models.TextChoices):
    NOT_STARTED = "NO_INICIADO", "No iniciado"
    DOCUMENT_PENDING = "PENDIENTE_DOCUMENTAL", "Pendiente documental"
    IN_REVIEW = "EN_REVISION", "En revision"
    PARTIAL = "CUMPLE_PARCIAL", "Cumple parcial"
    OBSERVED = "OBSERVADO", "Observado"
    DOCUMENT_VALIDATED = "VALIDADO_DOCUMENTALMENTE", "Validado documentalmente"
    IMPLEMENTED = "IMPLEMENTADO", "Implementado"
    CLOSED = "CERRADO", "Cerrado"


class ReviewType(models.TextChoices):
    DOCUMENT_REVIEW = "REVISION_DOCUMENTAL", "Revision documental"
    REGULATORY_COMPLIANCE = "CUMPLIMIENTO_NORMATIVO", "Cumplimiento normativo"
    NONCONFORMITY_CLOSURE = "CIERRE_NO_CONFORMIDAD", "Cierre no conformidad"
    AUDIT_PREPARATION = "PREPARACION_AUDITORIA", "Preparacion auditoria"
    IMPLEMENTATION = "IMPLEMENTACION", "Implementacion"


class DocumentType(models.TextChoices):
    POLICY = "POLITICA", "Politica"
    PROCEDURE = "PROCEDIMIENTO", "Procedimiento"
    TEMPLATE = "FORMATO", "Formato"
    RECORD = "REGISTRO", "Registro"
    MATRIX = "MATRIZ", "Matriz"
    REPORT = "INFORME", "Informe"
    MINUTES = "ACTA", "Acta"
    EVIDENCE = "EVIDENCIA", "Evidencia"
    OTHER = "OTRO", "Otro"


class DocumentProcessingStatus(models.TextChoices):
    UPLOADED = "CARGADO", "Cargado"
    PROCESSING = "PROCESANDO", "Procesando"
    READY = "LISTO", "Listo"
    FAILED = "FALLIDO", "Fallido"
    ARCHIVED = "ARCHIVADO", "Archivado"


class EvidenceType(models.TextChoices):
    RECORD = "REGISTRO_DILIGENCIADO", "Registro diligenciado"
    MINUTES = "ACTA", "Acta"
    REPORT = "INFORME", "Informe"
    TRAINING = "CAPACITACION", "Capacitacion"
    EXECUTED_CONTROL = "CONTROL_EJECUTADO", "Control ejecutado"
    AUDIT_TRAIL = "TRAZABILIDAD", "Trazabilidad"
    OTHER = "OTRO", "Otro"


class RequirementEvaluationStatus(models.TextChoices):
    COMPLIES = "CUMPLE", "Cumple"
    PARTIAL = "CUMPLE_PARCIAL", "Cumple parcial"
    DOES_NOT_COMPLY = "NO_CUMPLE", "No cumple"
    NOT_APPLICABLE = "NO_APLICA", "No aplica"
    NOT_EVALUATED = "NO_EVALUADO", "No evaluado"


class RiskLevel(models.TextChoices):
    LOW = "BAJO", "Bajo"
    MEDIUM = "MEDIO", "Medio"
    HIGH = "ALTO", "Alto"


class FindingType(models.TextChoices):
    DOCUMENTARY_GAP = "BRECHA_DOCUMENTAL", "Brecha documental"
    IMPLEMENTATION_GAP = "BRECHA_IMPLEMENTACION", "Brecha implementacion"
    AUDIT_RISK = "RIESGO_AUDITORIA", "Riesgo auditoria"
    POTENTIAL_NONCONFORMITY = "NO_CONFORMIDAD_POTENCIAL", "No conformidad potencial"
    OBSERVATION = "OBSERVACION", "Observacion"
    IMPROVEMENT_OPPORTUNITY = "OPORTUNIDAD_MEJORA", "Oportunidad de mejora"


class FindingStatus(models.TextChoices):
    OPEN = "ABIERTO", "Abierto"
    IN_PROGRESS = "EN_PROGRESO", "En progreso"
    CLOSED = "CERRADO", "Cerrado"


class ActionPlanStatus(models.TextChoices):
    PENDING = "PENDIENTE", "Pendiente"
    IN_PROGRESS = "EN_PROGRESO", "En progreso"
    RESOLVED = "RESUELTO", "Resuelto"
    CLOSED = "CERRADO", "Cerrado"
    SUPERSEDED = "SUPERSEDIDO", "Supercedido"


class EvidenceValidationStatus(models.TextChoices):
    UPLOADED = "CARGADA", "Cargada"
    VALIDATED = "VALIDADA", "Validada"
    REJECTED = "RECHAZADA", "Rechazada"
    ARCHIVED = "ARCHIVADA", "Archivada"


class AIProvider(models.TextChoices):
    OLLAMA = "ollama", "Ollama"
    MOCK = "mock", "Mock"
    OPENAI = "openai", "OpenAI"
    OTHER = "other", "Other"


class AIOperationType(models.TextChoices):
    REVIEW = "review", "Review"
    EMBEDDING = "embedding", "Embedding"
    CHAT = "chat", "Chat"


class AILogStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    ERROR = "error", "Error"
    TIMEOUT = "timeout", "Timeout"


class EmbeddingStatus(models.TextChoices):
    PENDING = "PENDIENTE", "Pendiente"
    PROCESSING = "PROCESANDO", "Procesando"
    READY = "LISTO", "Listo"
    FAILED = "FALLIDO", "Fallido"

# NORMAN — Especificación del MVP

Fuente funcional vigente. Las instrucciones de AGENTS.md y estas especificaciones guían el desarrollo; los planes antiguos se conservan como historial.

## Visión y alcance

Plataforma local de implementación normativa: Norma → Requisito → Checklist → Documento → Revisión → Hallazgo → Plan → Evidencia → Cierre. Primeras normas: ISO 9001, ISO 13485 y BPADT ARCSA. Procesos: control documental, recepción, almacenamiento, producto no conforme, auditoría interna y revisión por la dirección. Los criterios se redactan como resúmenes originales, sin copiar normas protegidas.

## Requisitos e historias de usuario

| ID | Historia y criterio de aceptación |
| --- | --- |
| RF-01 | Como usuario inicio sesión; credenciales inválidas o cuenta inactiva no obtienen tokens. Solo administradores gestionan usuarios. |
| RF-02 | Como responsable accedo a mis empresas y proyectos; un identificador ajeno no permite leer ni modificar información. La misma restricción se aplica a relaciones enviadas al crear o actualizar. |
| RF-03 | Como responsable selecciono una norma y obtengo un checklist único por proyecto/requisito. |
| RF-04 | Como implementador cargo y clasifico TXT, DOCX, XLSX y PDF con texto; se conservan archivo, metadatos, texto y errores de extracción. No incluye OCR avanzado. |
| RF-05 | Como revisor recupero contexto filtrado por cliente, proyecto, documento, norma, cláusula y tipo; cambiar de modelo permite reindexar. |
| RF-06 | Como auditor recibo evaluación por requisito con citas, faltantes y riesgo; JSON inválido no genera evaluaciones ni hallazgos parciales. Se registran usuario, fecha, modelo, proveedor, prompt y salida. |
| RF-07 | Como responsable gestiono hallazgos, pendientes, responsables, fechas y planes; nuevas revisiones conservan el historial. |
| RF-08 | Como validador separo cumplimiento documental de implementación; la evidencia real requiere validación humana antes del cierre sensible. |
| RF-09 | Como director consulto avance documental, avance real, pendientes, documentos observados y requisitos cerrados. |

## Reglas de negocio

- RB-01: Nunca inventar evidencia ni inferir cumplimiento sin soporte. Un simulador solo sirve para pruebas y demostraciones identificadas.
- RB-02: Sin documento: NO_INICIADO/PENDIENTE_DOCUMENTAL; documento sin revisión: EN_REVISION; NO_CUMPLE: OBSERVADO; CUMPLE_PARCIAL: CUMPLE_PARCIAL.
- RB-03: CUMPLE sin evidencia real requerida permite CERRADO si satisface todos los criterios; con evidencia pendiente solo VALIDADO_DOCUMENTALMENTE. Soporte documental más evidencia validada permite IMPLEMENTADO. CERRADO exige satisfacer todos los criterios y pendientes aplicables.
- RB-04: Estados derivados del cumplimiento se calculan en backend; el cliente no puede eludir las condiciones mediante PATCH.
- RB-05: Documentos empresariales se archivan. No se borran datos, migraciones aplicadas, credenciales ni archivos locales sin autorización explícita.
- RB-06: Aislamiento obligatorio tanto en consultas como en mutaciones, descargas y recuperación semántica. Los catálogos globales no convierten documentos privados en públicos.
- RB-07: NO_APLICA exige revisión humana, justificación y aprobación asociada a la revisión vigente; la IA por sí sola no cierra una exclusión. Una revisión posterior exige nueva aprobación.
- RB-08: Un documento revisado y una evidencia validada se conservan como soporte histórico. Las correcciones se cargan como nuevas versiones o registros.

## Roles por empresa (RF-02)

| Rol | Operaciones |
| --- | --- |
| RESPONSABLE | Consultar, preparar documentos/acciones, gestionar membresías y validar cierres/evidencias/exclusiones. |
| IMPLEMENTADOR | Consultar y preparar documentos, revisiones y acciones; no aprobar evidencia ni cierre final. |
| AUDITOR | Consultar, descargar y validar evidencia, aprobación documental, cierres y exclusiones; no preparar registros. |
| LECTOR | Consultar y descargar los registros autorizados. |

Staff conserva administración global. Los propietarios existentes mantienen responsabilidad de su empresa. La creación de cuentas corresponde al administrador; conceder membresía no envía invitaciones.

## Restricciones y requisitos no funcionales

- RNF-01: Monolito Django modular, DRF, Python 3.12 y Poetry con lock y entorno backend/.venv. Sin LangChain ni dependencias globales.
- RNF-02: Conservar Next.js/React/TypeScript/Tailwind existente por sus Server Actions; npm y package-lock.json como único gestor frontend.
- RNF-03: PostgreSQL/pgvector como destino; SQLite permite desarrollo inicial. Ollama detrás de abstracción; proveedor simulado permite pruebas sin IA comercial.
- RNF-04: Pruebas críticas de permisos, aislamiento, extracción, revisión inválida y cierre. No declarar finalización por apariencia de UI.
- RNF-05: Celery/Redis para extracción, indexación, revisión opcional tras carga y revisión manual en cola; estado, solicitante, opciones, errores y reintentos explícitos. Un trabajo completado no significa cumplimiento normativo. Ejecución eager disponible para desarrollo y pruebas.
- RNF-06: Checklist con búsqueda, filtros y detalle bajo demanda; etiquetas asociadas a controles y errores; revisión de soporte y citas completas desde la UI, con acceso a rechazados e historial. La navegación de proyecto permanece disponible en todas sus superficies como barra desplegable y colapsable, con la sección actual visible aun contraída.

Identidad del asistente: NORMAN usa una carita sencilla y minimalista, elegida por el usuario. Acompaña la marca y los estados reales de procesamiento; el texto comunica el estado y la expresión es decorativa. Completar procesamiento no implica cumplimiento normativo ni cierre.

## Fuera del MVP

Facturación, ERP/correo, OCR complejo, aprobaciones multinivel y chat genérico como producto principal. El MVP incluye roles y aislamiento multicliente básico; aislamiento por esquemas PostgreSQL queda fuera.

## Flujo SDD

Consultar SPEC.md → ARCHITECTURE.md → tarea en TASKS.md → inspeccionar implementación → fijar aceptación → implementar → probar → actualizar tarea. Cambios de alcance requieren decisión documentada aquí o en arquitectura.

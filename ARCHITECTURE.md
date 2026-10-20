# NORMAN — Arquitectura y auditoría técnica

## Decisiones

- DA-01: Reutilizar el monolito Django 5.2/DRF y sus migraciones. No crear un proyecto paralelo ni apps vacías.
- DA-02: Conservar Next.js 15, React 19, TypeScript y Tailwind. Las rutas App Router, middleware de autenticación, cookies de servidor y Server Actions justifican la excepción a Vite.
- DA-03: Poetry es la única fuente de dependencias Python. pyproject.toml conserva las restricciones existentes, poetry.lock fija resolución y poetry.toml ubica el entorno en backend/.venv. Grupo dev separado.
- DA-04: Conservar docker-compose.yml en raíz e infra/docker; moverlos no aporta valor. Cuatro documentos SDD vigentes; las guías y el plan anteriores se conservan en docs/legacy/.

## Estructura y responsabilidades

```text
backend/config/             configuración, rutas y salud
backend/apps/accounts/      JWT y gestión de usuarios
backend/apps/companies/     empresas; límite inicial del cliente
backend/apps/standards/     normas, requisitos y seeds resumidos
backend/apps/implementation/ proyectos, checklist y bitácora
backend/apps/documents/     archivos, extracción y versiones controladas
backend/apps/ai_engine/     proveedor, chunking, embeddings y retrieval
backend/apps/reviews/       revisión estructurada, evaluaciones y hallazgos
backend/apps/action_plans/  acciones, seguimiento y evidencias
frontend/src/               interfaz Next.js y puente autenticado al API
infra/docker/               imágenes de desarrollo
```

Next.js → API DRF → servicios internos → persistencia local/PostgreSQL → Ollama. El backend controla reglas y transiciones; no se duplican en UI. Se conserva la agrupación actual de requisitos en standards y hallazgos en reviews para evitar fragmentación.

## Modelo y multicliente

Company → Project → ImplementationChecklistItem → StandardRequirement → Standard. Document enlaza proyecto/requisito/checklist; DocumentChunk conserva texto y embedding. DocumentReview → RequirementEvaluation/Finding → ActionPlan → Evidence. PromptTemplate y AIProviderLog conservan trazabilidad. ControlledDocument/DocumentRevision agregan versiones y eventos; WorkLogEntry/WorkLogEvidence conservan actividad.

CompanyMembership vincula usuarios con empresas y roles RESPONSABLE, IMPLEMENTADOR, AUDITOR y LECTOR. Company.created_by conserva acceso de propietario; staff es administrador global. La migración crea membresías para propietarios existentes sin asignar empresas huérfanas. No se añade una app tenants ni otro modelo que duplique Company.

DA-06 / T-25: el recorrido multicliente comienza en Empresas. `/companies/{id}` reúne proyectos y equipo de un cliente, y los proyectos enlazan de vuelta a esa empresa. La cuenta es global; el rol pertenece a CompanyMembership y abarca todos los proyectos de la empresa. No hay permisos individuales por proyecto. El frontend filtra sus opciones según el rol, y el backend conserva la decisión de autorización. ProjectViewSet admite filtro company sin omitir el aislamiento. UserCreateSerializer permite dar el primer acceso dentro de la misma transacción que crea la cuenta; un fallo de membresía revierte el alta. Los campos company/role son opcionales en la API para mantener compatibilidad y no se guardan en User. La UI exige empresa para cuentas ordinarias y separa explícitamente al administrador global. Gestionar una membresía no modifica la cuenta ni el acceso de otra empresa; retirar is_staff sí cambia el alcance global. No se migran ni alteran asignaciones existentes.

companies/access.py declara las relaciones de propiedad y roles por acción. companies/api_access.py aplica el límite a listas/detalles, relaciones de escritura y acciones de las apps existentes. Incluye validación de consistencia entre proyecto/empresa y usuarios asignados. Las referencias globales son de lectura para miembros y escritura para staff; las referencias privadas se filtran en API y retrieval. El catálogo global solo deriva criterios de referencias globales.

## Seguridad

JWT: access de 15 minutos y refresh de 30 días. Logout revoca refresh mediante blacklist; access ya emitido vence por TTL. No se rota refresh en cada renovación para evitar carreras entre solicitudes paralelas. Middleware Next renueva antes de renderizar y propaga cookies a la solicitud actual. Desactivar un usuario impide acceder/renovar; eliminar por API desactiva y conserva historial.

Se retiró la ruta pública /media. Descargas de documentos, evidencia y soportes exigen autenticación y alcance de empresa; Next las transmite con los encabezados de sesión y Cache-Control privado. Documentos revisados y evidencia validada son inmutables por API. Empresas/proyectos se archivan; los demás registros de negocio no admiten DELETE. Mantener secretos fuera del repositorio.

El checklist no permite editar estados ni condiciones calculadas. NO_APLICA queda OBSERVADO hasta la confirmación de responsable/auditor con justificación, usuario, fecha y revisión exacta. Una nueva revisión invalida la aprobación anterior. Los planes abiertos siguen impidiendo cierre; una exclusión aprobada permite resolverlos sin fabricar evidencia de un requisito que no aplica.

## RAG e integraciones

Extracción local → ventanas de 1000 palabras/150 de solapamiento → proveedor de embeddings → chunks → contexto por requisito → prompt versionado → proveedor de revisión → validación → persistencia transaccional → recálculo de checklist. Ollama es predeterminado; mock solo prueba infraestructura. Futuro OpenAI se añade en el adaptador.

Contrato de revisión v2: validación recursiva del subconjunto de JSON Schema usado por prompt_builder, cobertura completa de IDs sin duplicados, booleanos reales y citas literales presentes en contexto. Salidas inválidas se registran como error sin guardar revisiones parciales. Revisión, hallazgos, planes, checklist y log de éxito comparten transacción. La UI identifica revisiones simuladas.

DocumentReview conserva proveedor explícito además de modelo, usuario, timestamp, prompts y salida. El log de éxito incluye review_id para correlación exacta. El nuevo campo queda vacío en revisiones históricas cuyo proveedor no constaba, sin inferirlo del nombre de modelo.

DA-05 / T-21: DocumentChunk conserva el JSON histórico y añade embedding_vector (pgvector de dimensión variable). PostgreSQL aplica filtros de empresa, proyecto, documento, norma, cláusula, tipo, proveedor, modelo y dimensión antes de ordenar por distancia coseno y limitar en SQL. Se usa ranking exacto e índice B-tree de metadatos; no se declara un índice HNSW/IVFFlat. SQLite mantiene NumPy como alternativa de desarrollo. Cambiar modelo reembebe los mismos chunks sin duplicarlos; vectores vacíos, nulos, no finitos o inconsistentes fallan de forma explícita.

DocumentProcessingJob conserva documento, solicitante, operación, tarea Celery, estado, intentos, errores, resultado y fechas. La carga encola extracción e indexación; opcionalmente continúa con revisión estructurada. Existe un único trabajo activo por documento, publicación tras commit, reintentos limitados por fallos transitorios del proveedor y protección ante una segunda entrega de trabajos completados. Fallo del broker queda visible en el registro. API y UI consultan el estado; la acción de reintento conserva el historial.

El worker corre en Linux dentro de Docker; Redis usa AOF y volumen persistente. NORMAN utiliza puertos locales separados y el Ollama nativo. La alternativa eager ejecuta los mismos servicios sin broker para desarrollo/pruebas. Falta probar recuperación tras caída forzada del worker: un trabajo RUNNING interrumpido puede requerir intervención; no se afirma entrega exactamente una vez ni recuperación automática de toda caída.

## Auditoría inicial (2026-10-19)

- Repositorio inicialmente sin cambios pendientes; código funcional amplio, no un scaffold vacío. Existen pruebas de dominio, extracción, revisión, bitácora, control documental y piloto; accounts/companies tenían pruebas vacías.
- SQLite local existente (1.118.208 bytes) y seis archivos en media, además de test-media y logs. Preservar todo; inspección de contenido mediante conteos, sin exponer información personal.
- README y plan anterior describían fases desactualizadas y comandos de instalación global. Se sustituyen instrucciones vigentes por Poetry, conservando historia documental.
- Brechas: aislamiento incompleto en checklist/chunks/revisiones/acciones y relaciones de escritura; referencias privadas visibles por is_reference; estados editables en checklist; borrados en cascada; logout sin revocación. Requieren pruebas y correcciones por slices.
- Archivos candidatos a limpieza: tsconfig.tsbuildinfo, cachés, logs, test-media y guías históricas duplicadas. Se ignoran artefactos futuros; no se eliminan archivos locales ni datos.
- Docker backend dependía de requirements.txt y frontend usaba npm install; deben consumir locks. Compose necesita hosts internos de PostgreSQL/Ollama y entorno separado del .venv de Windows.

## Validación

El admin de Django para proyectos, checklist, documentos/chunks, revisiones/evaluaciones/hallazgos, acciones/evidencias/actividades y logs IA es de consulta: no permite altas, cambios ni borrados que eludan los servicios de dominio. Usuarios se desactivan desde la UI; CompanyAdmin tampoco permite borrar empresas.

Ver TASKS.md para resultados ejecutados y problemas abiertos. Una prueba con SQLite/mock no acredita PostgreSQL, pgvector ni Ollama reales.

## Segunda revisión de reutilización y limpieza

- Se conservan las ocho apps y los servicios de extracción, proveedores, revisión, checklist, control documental, bitácora y reportes. No se crean módulos vacíos ni se migra de framework.
- Guías y plan históricos movidos a docs/legacy; contenido conservado. La raíz mantiene README, SPEC, ARCHITECTURE y TASKS, además de AGENTS como instrucciones.
- Retirados accounts/models.py y ai_engine/views.py: solo contenían placeholders y no tenían consumidores. accounts/admin.py se reutiliza para impedir borrado de usuarios desde admin.
- Retirado del conjunto fuente tsconfig.tsbuildinfo, artefacto regenerable cubierto por .gitignore. No se limpiaron node_modules, .next, entornos, logs, datos locales ni archivos ajenos.
- Se centralizó getCurrentUser, antes duplicado en el layout y lib/api. Se completó la ruta de detalle de control documental existente en enlaces/acciones pero ausente en el frontend.
- pgvector/Celery/Redis se reutilizaron e integraron en T-21; no se incorporaron frameworks de RAG ni nuevas apps vacías.

## Transferencia local a PostgreSQL

La cuenta postgres proporcionada conecta con el servidor nativo, que no ofrece vector. Se creó una instancia aislada pgvector/pgvector:pg16 en 15432 con base/usuario de aplicación separados, sin modificar el servidor nativo. Antes de transferir se respaldó SQLite y backend/.env. Se migró el esquema nuevo y se importaron 270 objetos conservando IDs, cuentas y relaciones. Se comparó la serialización completa origen/destino antes de cambiar configuración; SQLite y archivos permanecen disponibles. El signal de creación de checklist omite raw=True para que restaurar fixtures no genere registros que colisionen con el historial.

NORMAN incorpora un avatar geométrico minimalista reutilizable en marca y procesamiento. Las expresiones son decorativas; el estado siempre se comunica mediante texto y procede del backend.

## Usabilidad y cargas por superficie (T-24)

Se conserva el frontend y sus servicios. Checklist renderiza diez resúmenes y un detalle seleccionado mediante URL; no crea cientos de formularios simultáneamente. FormField y ActionForm reutilizan etiquetas, errores accesibles, estado de envío y recuperación sin navegar en fallos. No trasladan reglas de cumplimiento a la UI.

T-26: el detalle de requisito se convierte en una ficha con cuatro pasos persistidos en URL (understand/documents/review/evidence). Solo se renderiza el paso solicitado; se conserva el filtro de proceso al navegar y al enviar formularios. RequirementWorkspace reutiliza las Server Actions y APIs existentes para documentos, revisión, evidencia y aprobación humana. workflow.ts solo selecciona contexto y aconseja navegación sobre estados del API; no recalcula cumplimiento ni realiza transiciones. El inicio de proyecto ofrece revisión de documentos existentes e implementación desde requisitos con la misma prioridad, y señala trabajo pendiente según el rol. Los diez destinos del proyecto siguen en una barra desplegable, separados en trabajo y herramientas/historial. La carga directa de documento exige un requisito para revisar por defecto; guardar sin revisión queda como alternativa explícita. El historial conserva revisión individual, revisión de todos los requisitos y todos los tipos de revisión. No se modifican modelos, migraciones ni permisos por este cambio de recorrido.

La cabecera obtiene porcentajes del reporte backend; cada superficie pide las colecciones utilizadas. Los serializadores admiten summary=true como opción de lectura y omiten contenido voluminoso sin quitar evaluaciones/citas; el contrato completo sigue disponible sin esa opción. Las revisiones manuales reutilizan DocumentProcessingJob con operación REVIEW y opciones JSON; el worker llama al mismo revisor validado y transaccional. No se duplica el motor IA ni se cambia la semántica de cierre.


## Presentación y exportaciones (T-27/T-28)

Company almacena document_header y un logo normalizado a PNG en almacenamiento privado. Solo responsables/administradores pueden cambiarlo. DocumentRevision conserva presentation_snapshot con encabezado y referencia al logo de esa versión; sustituir o quitar el logo de empresa no elimina los archivos anteriores. El generador existente reutiliza presentation.py para Word, PDF y Excel. Los originales y archivos aprobados siguen conservados con hash. Las conversiones se producen a partir del contenido estructurado de versiones PLANTILLA; ARCHIVO conserva el original.

GET /api/projects/{id}/export_report/ usa el mismo ámbito de empresa que el informe JSON. excel_report.py emite datos completos y trazables, con celdas de texto literales. GET /api/controlled-documents/{id}/download/?version=N&file_format=pdf|docx|xlsx permite formatos adicionales; file_format evita colisionar con el parámetro format reservado de DRF. Los proxies Next usan las credenciales de sesión y no almacenan en caché descargas privadas.

ProgressMatrix presenta los estados backend y agrupa soportes por proyecto/requisito, con filtros y veinte filas por página. NORMAN es un panel persistente de guía contextual: consulta los datos autorizados bajo demanda, explica un siguiente paso y enlaza a la ficha. No simula respuestas de un modelo ni ejecuta transiciones. Las revisiones IA siguen usando el motor y la cola existentes. Las expresiones comunican consulta, orientación o atención junto a texto accesible.

El informe backend calcula implementación como proporción de requisitos IMPLEMENTADO/CERRADO, sin asignar puntos a documentación parcial o validada. El resumen frontend refleja la misma fórmula; las reglas y validaciones de transición siguen exclusivamente en backend.

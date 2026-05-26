# Plan de Implementacion - AudiBot ISO

## 1. Objetivo

Construir un MVP local de `AudiBot ISO` que permita crear proyectos de implementacion, cargar requisitos normativos resumidos, subir documentos, revisarlos con IA, detectar brechas, generar pendientes, cargar evidencias y cerrar requisitos con trazabilidad auditable.

El objetivo del MVP no es "hablar con documentos". El objetivo es operar un flujo normativo verificable:

`Norma -> Requisito -> Checklist -> Documento -> Revision IA -> Hallazgo -> Plan de accion -> Evidencia -> Cierre`

## 2. Resultado esperado del MVP

Al finalizar el MVP, un usuario debe poder:

1. Crear una empresa y un proyecto.
2. Seleccionar una norma inicial: `ISO 9001`, `ISO 13485` o `BPADT ARCSA`.
3. Ver un checklist generado desde requisitos implementables.
4. Subir un procedimiento, politica, formato, registro o evidencia.
5. Extraer texto del archivo y procesarlo para busqueda semantica.
6. Ejecutar una revision IA contra requisitos seleccionados.
7. Obtener evaluaciones, brechas, riesgos y recomendaciones.
8. Generar pendientes o planes de accion.
9. Cargar evidencia real de implementacion.
10. Ver el avance documental y el avance de implementacion real por separado.

## 3. Supuestos de trabajo

- Se prioriza despliegue local primero.
- El proveedor inicial de IA es `Ollama`.
- El backend concentra reglas de negocio y trazabilidad.
- El frontend expone flujos claros y auditables.
- No se incluye en el MVP autenticacion empresarial compleja, facturacion, multi-idioma, aprobaciones avanzadas ni OCR pesado.
- El seed normativo usara criterios resumidos y redactados de forma propia, no texto protegido de normas.

## 4. Alcance del MVP

### Dentro del MVP

- Gestion de empresas y proyectos
- Catalogo de normas y requisitos resumidos
- Generacion de checklist por proyecto
- Carga y clasificacion documental
- Extraccion de texto `docx`, `xlsx`, `pdf`, `txt`
- Chunking y embeddings con `pgvector`
- Revision IA estructurada con salida JSON valida
- Generacion de hallazgos y pendientes
- Carga de evidencia
- Estados de checklist con reglas explicitas
- Dashboard y reporte basico de avance

### Fuera del MVP

- OCR avanzado para documentos escaneados complejos
- Integraciones con correo o ERP
- Workflow formal de aprobaciones multinivel
- Soporte multi-tenant sofisticado
- Motor de reglas por pais altamente parametrizable
- Exportadores complejos de reportes con plantillas corporativas
- Chat conversacional libre como modulo principal

## 5. Enfoque de implementacion

Se recomienda construir por slices verticales y no por capas aisladas. Cada fase debe dejar una capacidad demostrable y usable. El orden tecnico base es:

1. Fundacion del sistema
2. Dominio y checklist
3. Ingestion documental
4. Capa IA y retrieval
5. Revision normativa
6. Hallazgos, evidencias y cierre
7. Frontend MVP
8. QA, hardening y piloto

## 6. Plan por fases

### Fase 0 - Fundacion tecnica

Duracion estimada: `3 a 5 dias`

Objetivo:
Dejar el proyecto ejecutable en local con estructura base, entorno reproducible y decisiones tecnicas fijas.

Trabajo:

- Crear estructura `backend/`, `frontend/`, `docs/`, `infra/`
- Preparar `docker-compose` para `PostgreSQL`, `Redis`, `Ollama` y servicios de app si aplica
- Inicializar proyecto Django y proyecto Next.js
- Configurar `pgvector` en PostgreSQL
- Definir variables de entorno
- Configurar calidad base: lint, formatter, test runner
- Definir politica de archivos y almacenamiento local

Entregables:

- Repositorio inicial ejecutable
- Backend y frontend levantando en local
- Base de datos con `pgvector`
- Documento de entorno local y variables requeridas

Criterio de salida:

- Un desarrollador nuevo puede levantar el proyecto sin decisiones faltantes.

### Fase 1 - Dominio base y checklist

Duracion estimada: `1 a 2 semanas`

Objetivo:
Construir el nucleo normativo y de trazabilidad del sistema.

Trabajo:

- Crear apps Django: `companies`, `standards`, `implementation`, `documents`, `reviews`, `action_plans`, `ai_engine`
- Modelar entidades base:
  - `Company`
  - `Project`
  - `Standard`
  - `StandardRequirement`
  - `ImplementationChecklistItem`
  - `PromptTemplate`
  - `AIProviderLog`
- Definir enums de estados, tipos documentales, tipos de revision y hallazgos
- Crear seeds iniciales para `ISO 9001`, `ISO 13485` y `BPADT ARCSA`
- Implementar logica para generar checklist al crear proyecto
- Exponer APIs CRUD minimas para empresas, proyectos, normas y checklist

Entregables:

- Modelos y migraciones base
- Seed data inicial
- API para crear empresa, proyecto y checklist
- Primer demo: proyecto creado con checklist generado

Criterio de salida:

- Crear un proyecto debe poblar un checklist consistente y trazable.

### Fase 2 - Ingestion documental

Duracion estimada: `1 a 2 semanas`

Objetivo:
Permitir subir documentos, clasificarlos y extraer texto util para analisis.

Trabajo:

- Modelar `Document`
- Implementar almacenamiento local en `/media/documents/`
- Crear `extractor.py` para `docx`, `xlsx`, `pdf` y `txt`
- Guardar texto extraido y metadatos
- Permitir asociar documento a proyecto, requisito o checklist item
- Definir pipeline asincrono con `Celery` para extraccion
- Crear API de carga y estado de procesamiento

Entregables:

- Upload funcional de documentos
- Extraccion de texto y metadatos
- Estado de procesamiento por documento
- Primer demo: subir un procedimiento y ver texto extraido

Criterio de salida:

- Los documentos del alcance MVP pueden subirse y quedar listos para analisis sin procesamiento manual.

### Fase 3 - Chunking, embeddings y retrieval

Duracion estimada: `1 semana`

Objetivo:
Preparar la capa RAG minima sin introducir complejidad innecesaria.

Trabajo:

- Modelar `DocumentChunk`
- Implementar `chunker.py`
- Implementar `ollama_client.py` con abstraccion de proveedor
- Implementar `embeddings.py`
- Persistir embeddings en `pgvector`
- Implementar `retriever.py` con filtros por proyecto, documento, norma y tipo
- Permitir re-embedding si cambia el modelo

Entregables:

- Pipeline completo de chunking y embeddings
- Busqueda semantica funcional sobre documentos del proyecto
- Logs de proveedor IA y fallos tecnicos

Criterio de salida:

- Un requisito puede recuperar fragmentos relevantes de un documento con precision suficiente para revision dirigida.

### Fase 4 - Motor de revision normativa con IA

Duracion estimada: `1 a 2 semanas`

Objetivo:
Convertir el pipeline documental en una evaluacion normativa estructurada y auditable.

Trabajo:

- Modelar `DocumentReview`, `RequirementEvaluation`, `Finding`
- Implementar `prompt_builder.py`
- Implementar `iso_reviewer.py`
- Definir schema JSON valido para respuestas del modelo
- Validar y parsear salida antes de persistir
- Guardar trazabilidad de prompt, modelo, proveedor, usuario y fecha
- Diferenciar explicitamente `cumplimiento documental` vs `implementacion real`
- Actualizar checklist segun reglas de estado

Entregables:

- Endpoint de revision documental
- Evaluaciones por requisito
- Hallazgos y recomendaciones persistidos
- Actualizacion automatica de estado del checklist
- Demo principal: revisar un documento contra `ISO 13485` o `ISO 9001`

Criterio de salida:

- La revision devuelve JSON valido, deja evidencia persistida y nunca cierra un requisito sin soporte suficiente.

### Fase 5 - Pendientes, planes de accion y evidencias

Duracion estimada: `1 semana`

Objetivo:
Cerrar el ciclo operativo posterior a la revision.

Trabajo:

- Modelar `ActionPlan` y `Evidence`
- Generar pendientes automaticamente desde hallazgos relevantes
- Permitir registrar responsable, prioridad y fecha objetivo
- Permitir carga de evidencia real
- Implementar reglas para pasar de `VALIDADO_DOCUMENTALMENTE` a `IMPLEMENTADO`
- Mantener historial de revisiones y nueva revision luego de correcciones

Entregables:

- Modulo de pendientes
- Modulo de evidencias
- Reglas de transicion de estado completas
- Demo: revisar, corregir, recargar evidencia y mover estado

Criterio de salida:

- El sistema refleja claramente que un documento valido no equivale por si solo a una implementacion cerrada.

### Fase 6 - Frontend MVP

Duracion estimada: `1 a 2 semanas`

Objetivo:
Exponer el flujo completo en una interfaz clara para implementacion y auditoria.

Trabajo:

- Dashboard general
- Lista de empresas
- Lista de proyectos
- Detalle de proyecto
- Checklist normativo con filtros
- Biblioteca documental
- Flujo de subida de documentos
- Vista de revision documental
- Vista de pendientes y planes de accion
- Vista de evidencias
- Vista de avance general

Entregables:

- UI navegable del flujo principal
- Formularios y tablas basicas conectadas al backend
- Indicadores de avance documental e implementacion real

Criterio de salida:

- Un usuario no tecnico puede ejecutar el flujo central sin recurrir a consola o herramientas externas.

### Fase 7 - QA, hardening y piloto

Duracion estimada: `1 semana`

Objetivo:
Convertir el MVP funcional en un MVP demostrable y defendible.

Trabajo:

- Tests unitarios sobre reglas criticas
- Tests de integracion para ingestion, revision y cambios de estado
- Manejo de errores de proveedor IA
- Reintentos seguros en tareas asincronas
- Auditoria de performance basica
- Reglas de permisos minimas
- Seed/demo dataset para presentacion
- Ajustes UX segun pruebas internas

Entregables:

- Suite minima de pruebas
- Dataset de demo
- Checklist de validacion final
- Guion de demo operativa

Criterio de salida:

- El MVP puede demostrarse de punta a punta de forma estable y con trazabilidad visible.

## 7. Cronograma sugerido

### Opcion A - 1 desarrollador full stack principal

- Semana 1: Fase 0
- Semanas 2 y 3: Fase 1
- Semanas 4 y 5: Fase 2
- Semana 6: Fase 3
- Semanas 7 y 8: Fase 4
- Semana 9: Fase 5
- Semanas 10 y 11: Fase 6
- Semana 12: Fase 7

### Opcion B - Equipo pequeno de 2 a 3 personas

- Semanas 1 y 2: Fase 0 + Fase 1
- Semanas 3 y 4: Fase 2 + Fase 3 en paralelo parcial
- Semanas 5 y 6: Fase 4
- Semana 7: Fase 5
- Semanas 8 y 9: Fase 6
- Semana 10: Fase 7

## 8. Hitos demostrables

Hito 1:
Se crea empresa, proyecto y checklist.

Hito 2:
Se sube documento y se extrae texto correctamente.

Hito 3:
Se recuperan chunks relevantes para un requisito.

Hito 4:
Se ejecuta revision IA con salida estructurada.

Hito 5:
Se generan hallazgos, pendientes y recomendaciones.

Hito 6:
Se carga evidencia y cambia el estado del checklist de forma valida.

Hito 7:
Existe dashboard con avance documental y avance real.

## 9. Riesgos principales y mitigacion

Riesgo:
Salidas inconsistentes del modelo IA.

Mitigacion:
Usar prompts estrictos, schema JSON, validacion fuerte y reintentos controlados.

Riesgo:
Mala calidad de texto extraido desde PDF.

Mitigacion:
Limitar el MVP a PDFs con texto seleccionable y registrar OCR avanzado como fase posterior.

Riesgo:
Scope creep por querer cubrir demasiadas normas y procesos.

Mitigacion:
Cerrar el MVP inicial en `ISO 9001`, `ISO 13485` y `BPADT ARCSA` con pocos procesos de alto valor.

Riesgo:
Confusion entre cumplimiento documental e implementacion real.

Mitigacion:
Forzar estados separados y reglas de negocio en backend.

Riesgo:
Latencia o fallos de `Ollama` en local.

Mitigacion:
Procesos asincronos, timeouts, logs, reintentos y abstraccion de proveedor.

## 10. Pruebas minimas obligatorias

- Crear proyecto genera checklist correcto
- Documento subido se extrae y clasifica
- Chunking respeta tamano y overlap configurado
- Embeddings se guardan en `pgvector`
- Retrieval devuelve chunks del proyecto correcto
- Revision IA invalida no se persiste
- Revision `CUMPLE` con evidencia faltante no cierra requisito
- Evidencia validada puede mover estado a `IMPLEMENTADO`
- Historial de revisiones queda preservado

## 11. Criterio de exito del MVP

El MVP se considera exitoso si puede completar este escenario de punta a punta:

1. Crear un proyecto para una empresa.
2. Seleccionar `ISO 13485` o `ISO 9001`.
3. Ver checklist generado.
4. Subir un procedimiento de recepcion.
5. Extraer texto y generar embeddings.
6. Revisar el documento contra requisitos aplicables.
7. Detectar brechas documentales.
8. Generar pendientes.
9. Subir evidencia real.
10. Reflejar el avance documental y de implementacion real con estados correctos y trazables.

## 12. Recomendacion operativa

La implementacion debe comenzar por backend y reglas de negocio, no por interfaz. Si el dominio y los estados quedan bien definidos desde el inicio, el frontend se vuelve una capa de operacion. Si se empieza por UI sin cerrar semantica de requisitos, estados y evidencia, el sistema se vuelve ambiguo y dificil de auditar.


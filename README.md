# AudiBot ISO

Base tecnica inicial para el MVP local de `AudiBot ISO`.

## Estado actual

Esta primera fase deja listo el esqueleto del proyecto:

- `backend/` con Django 5 y apps base del dominio
- `frontend/` con scaffold de Next.js + TypeScript + Tailwind
- `infra/` con Dockerfiles y `docker-compose.yml`
- `docs/` con guia de arranque local

## Estructura

```text
backend/
frontend/
infra/
docs/
AGENTS.md
IMPLEMENTATION_PLAN.md
```

## Arranque rapido

### Backend

```powershell
py -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
py backend/manage.py migrate
py backend/manage.py seed_standards
py backend/manage.py runserver
```

### Frontend

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Set-Location frontend
npm install
npm run dev
```

## Nota

La configuracion de contenedores queda preparada en `docker-compose.yml`. Para usarla, asegurese de tener `Docker Desktop` con el engine levantado.

## APIs base de Fase 1

- `GET /api/health/`
- `GET, POST /api/companies/`
- `GET, POST /api/projects/`
- `POST /api/projects/{id}/regenerate_checklist/`
- `GET /api/standards/`
- `GET /api/requirements/?standard_code=ISO_13485`
- `GET /api/checklist-items/?project={project_id}`

Al crear un `Project`, el sistema genera automaticamente items del checklist usando los requisitos de la norma seleccionada.

## APIs base de Fase 2

- `GET, POST /api/documents/`
- `POST /api/documents/{id}/reprocess/`

Tipos soportados para extraccion inicial:

- `.txt`
- `.docx`
- `.xlsx`
- `.pdf`

Si el documento se asocia a un item del checklist, el sistema lo mueve a `EN_REVISION` cuando la extraccion termina correctamente.

## APIs base de Fase 3

- `POST /api/documents/{id}/index_chunks/`
- `GET /api/document-chunks/?document={document_id}`
- `POST /api/document-chunks/semantic_search/`

Variables nuevas del pipeline:

- `AI_PROVIDER`
- `OLLAMA_EMBEDDING_MODEL`
- `AI_REQUEST_TIMEOUT_SECONDS`
- `CHUNK_SIZE_WORDS`
- `CHUNK_OVERLAP_WORDS`
- `SEMANTIC_SEARCH_TOP_K`

Para desarrollo sin `Ollama`, puedes usar temporalmente:

```env
AI_PROVIDER=mock
```

Eso habilita embeddings deterministas de prueba para indexar y validar retrieval sin depender del servicio local de IA.

## APIs base de Fase 4

- `GET, POST /api/document-reviews/`
- `GET /api/requirement-evaluations/?review={review_id}`
- `GET /api/findings/?review={review_id}`

El `POST /api/document-reviews/` ejecuta el flujo completo:

1. valida que el documento este en `LISTO`
2. indexa chunks si aun no existen embeddings listos
3. recupera contexto relevante por requisito
4. construye el prompt de revision
5. ejecuta IA con proveedor `mock` u `ollama`
6. valida y persiste la salida estructurada
7. actualiza el estado del checklist

Si no existe un `PromptTemplate` activo con slug `document-review-v1`, el sistema usa un prompt interno versionado por codigo.

## APIs base de Fase 5

- `GET, POST /api/action-plans/`
- `PATCH /api/action-plans/{id}/`
- `POST /api/action-plans/{id}/start_progress/`
- `POST /api/action-plans/{id}/resolve/`
- `POST /api/action-plans/{id}/close_plan/`
- `GET, POST /api/evidences/`
- `PATCH /api/evidences/{id}/`
- `POST /api/evidences/{id}/validate_evidence/`
- `POST /api/evidences/{id}/reject_evidence/`

Comportamiento nuevo del flujo:

1. cada `Finding` generado por revision crea un `ActionPlan` automatico
2. la evidencia real se registra por separado en `Evidence`
3. al validar evidencia real, el checklist puede pasar a `IMPLEMENTADO`
4. un `ActionPlan` solo puede cerrarse si la ultima revision ya cumple
5. si el requisito exige evidencia real, el cierre del plan requiere `Evidence` validada
6. al cerrar todos los pendientes aplicables, el checklist pasa a `CERRADO`

Tambien se superceden automaticamente los planes auto-generados viejos cuando una revision mas reciente reemplaza la brecha del mismo requisito.

## Frontend MVP de Fase 6

Rutas principales ya implementadas en `Next.js`:

- `/`
- `/companies`
- `/projects`
- `/projects/{id}`
- `/projects/{id}/checklist`
- `/projects/{id}/documents`
- `/projects/{id}/reviews`
- `/projects/{id}/action-plans`
- `/projects/{id}/evidence`
- `/projects/{id}/report`

Capacidades cubiertas:

1. dashboard portfolio con progreso documental vs implementacion real
2. alta de empresas y proyectos
3. detalle de proyecto con subnavegacion operativa
4. checklist por proceso y requisito
5. carga documental conectada al backend
6. ejecucion de revisiones IA desde la UI
7. gestion de pendientes y planes de accion
8. registro y validacion de evidencia
9. reporte ejecutivo por proyecto

El frontend usa `NEXT_PUBLIC_API_BASE_URL` y server actions para mutaciones, evitando depender del navegador para llamadas cross-origin directas al backend.

## Fase 7 - QA, Hardening y Piloto

Capacidades nuevas:

- `GET /api/projects/{id}/progress_report/` para reporte backend reutilizable
- `GET /api/health/` con chequeos de base de datos, `MEDIA_ROOT` y proveedor IA configurado
- comando `py backend/manage.py seed_demo_workspace --force-reset` para crear un dataset piloto reproducible

Archivos operativos:

- [backend/apps/reviews/report_generator.py](<C:/Users/fbravo/Desktop/Normador/backend/apps/reviews/report_generator.py>)
- [backend/apps/implementation/management/commands/seed_demo_workspace.py](<C:/Users/fbravo/Desktop/Normador/backend/apps/implementation/management/commands/seed_demo_workspace.py>)
- [docs/runbooks/pilot-demo.md](<C:/Users/fbravo/Desktop/Normador/docs/runbooks/pilot-demo.md>)
- [docs/checklists/pilot-validation.md](<C:/Users/fbravo/Desktop/Normador/docs/checklists/pilot-validation.md>)

El dataset demo deja el proyecto piloto con tres escenarios visibles:

1. un requisito `CERRADO`
2. un requisito `VALIDADO_DOCUMENTALMENTE`
3. un requisito `OBSERVADO`

Eso permite demostrar la diferencia entre soporte documental, evidencia real y brecha abierta sin depender de datos manuales improvisados.

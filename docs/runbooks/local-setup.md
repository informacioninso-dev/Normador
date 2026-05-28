# Local Setup

## Requisitos

- Python 3.12 con `py`
- Node.js 20+
- npm 10+
- PostgreSQL 16+ con `pgvector` para el stack objetivo
- Redis 7+
- Ollama

## Backend

```powershell
py -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
py backend/manage.py migrate
py backend/manage.py seed_standards
py backend/manage.py runserver
```

El backend arranca con `sqlite` por defecto para bootstrap local rapido. Para usar PostgreSQL, cambia:

```env
DB_ENGINE=postgres
POSTGRES_DB=audibot
POSTGRES_USER=audibot
POSTGRES_PASSWORD=audibot
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

## Frontend

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Set-Location frontend
npm install
npm run dev
```

Variable minima:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Docker

Si luego instalas Docker Desktop:

```powershell
docker compose up --build
```

## Healthcheck

- Backend: `http://localhost:8000/api/health/`
- Frontend: `http://localhost:3000`

## Frontend MVP

Rutas utiles:

- `/`
- `/companies`
- `/projects`
- `/projects/{id}`
- `/projects/{id}/checklist`
- `/projects/{id}/documents`
- `/projects/{id}/reviews`
- `/projects/{id}/action-plans`
- `/projects/{id}/tracking`
- `/projects/{id}/evidence`
- `/projects/{id}/report`

La UI ya ejecuta estas mutaciones contra backend:

- crear empresa
- crear proyecto
- cargar documento
- correr revision
- crear plan de accion
- mover plan de accion
- registrar seguimiento del implementador
- registrar evidencia
- validar o rechazar evidencia

## Upload documental

Endpoint base:

- `POST http://localhost:8000/api/documents/`

Campos esperados en multipart:

- `project`
- `document_type`
- `file`
- `title` opcional
- `requirement` opcional
- `checklist_item` opcional

Extensiones soportadas por la extraccion local actual:

- `.txt`
- `.docx`
- `.xlsx`
- `.pdf`

## Chunking y retrieval

Endpoints base:

- `POST /api/documents/{id}/index_chunks/`
- `GET /api/document-chunks/?document={id}`
- `POST /api/document-chunks/semantic_search/`

Variables utiles:

```env
AI_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
AI_REQUEST_TIMEOUT_SECONDS=60
CHUNK_SIZE_WORDS=1000
CHUNK_OVERLAP_WORDS=150
SEMANTIC_SEARCH_TOP_K=5
REVIEW_CONTEXT_TOP_K=3
```

Si todavia no tienes `Ollama`, usa temporalmente:

```env
AI_PROVIDER=mock
```

## Revision normativa

Endpoints base:

- `POST /api/document-reviews/`
- `GET /api/document-reviews/`
- `GET /api/requirement-evaluations/?review={id}`
- `GET /api/findings/?review={id}`

Payload minimo para ejecutar una revision:

```json
{
  "document": 1,
  "review_type": "CUMPLIMIENTO_NORMATIVO"
}
```

Reporte backend por proyecto:

- `GET /api/projects/{id}/progress_report/`

## Planes de accion y evidencia

Endpoints base:

- `GET /api/action-plans/?project={id}`
- `POST /api/action-plans/`
- `POST /api/action-plans/{id}/start_progress/`
- `POST /api/action-plans/{id}/resolve/`
- `POST /api/action-plans/{id}/close_plan/`
- `GET /api/implementation-activities/?project={id}`
- `POST /api/implementation-activities/`
- `GET /api/evidences/?project={id}`
- `POST /api/evidences/`
- `POST /api/evidences/{id}/validate_evidence/`
- `POST /api/evidences/{id}/reject_evidence/`

Payload minimo para cargar evidencia asociada a un plan:

```text
action_plan=<id>
evidence_type=REGISTRO_DILIGENCIADO
file=<archivo>
description=Registro ejecutado del proceso
```

Reglas relevantes:

- la revision crea `ActionPlan` automaticos desde hallazgos
- cada `ActionPlan` puede acumular una bitacora de seguimiento operativo
- iniciar, resolver y cerrar un plan deja hitos automaticos en esa bitacora
- la evidencia validada mueve el checklist a `IMPLEMENTADO` cuando aplica
- `close_plan` exige una ultima revision conforme
- si el requisito exige evidencia real, `close_plan` tambien exige `Evidence` en estado `VALIDADA`
- una revision nueva supercede automaticamente planes auto-generados viejos del mismo requisito

## Dataset piloto

Comando:

```powershell
py backend/manage.py seed_demo_workspace --force-reset
```

Que crea:

- empresa demo
- proyecto `Piloto ISO 13485 Demo`
- documentos de muestra
- revisiones con `mock`
- planes de accion abiertos y cerrados
- evidencia validada

Escenario esperado:

- `7.4.3` en `CERRADO`
- `4.2` en `VALIDADO_DOCUMENTALMENTE`
- `8.3` en `OBSERVADO`

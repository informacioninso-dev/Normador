# AGENTS.md

## Mission

Build `AudiBot ISO`, a local-first AI platform for ISO and regulatory implementation, document review, gap control, and evidence-based closure.

This product is **not** a generic chatbot. It must behave as a compliance implementation platform where every conclusion is traceable to:

`Standard -> Requirement -> Checklist Item -> Document -> AI Review -> Finding -> Action Plan -> Evidence -> Closure`

## Product Goal

Deliver an MVP that allows a user to:

1. Create companies and implementation projects.
2. Select an applicable standard or regulation.
3. Generate an implementation checklist from structured requirements.
4. Upload documents and classify them by type.
5. Extract text from `docx`, `xlsx`, `pdf`, and `txt`.
6. Chunk, embed, and retrieve document content.
7. Review documents against selected requirements.
8. Detect documentary and implementation gaps.
9. Generate findings, pending items, action plans, and recommendations.
10. Track documentary compliance separately from real implementation evidence.
11. Produce progress and review reports.

## Non-Negotiable Rules

- Never invent evidence.
- Never assume compliance if the text does not support it.
- Documentary compliance and real implementation are different states.
- A requirement must not be marked `CERRADO` if the standard requires real evidence and only documents exist.
- Every review must store traceability: user, timestamp, model, provider, prompt version, and review output.
- Keep a human review path before final closure of sensitive items.
- Do not delete business documents; prefer archival or status changes.
- Do not copy protected ISO text verbatim into seed data. Use original summaries and implementable criteria.
- Do not use LangChain in the MVP. Keep extraction, chunking, embeddings, retrieval, prompting, and review logic in internal services.

## Target Stack

- Frontend: `Next.js`, `TypeScript`, `Tailwind CSS`
- Backend: `Django`, `Django REST Framework`
- Database: `PostgreSQL`
- Vector search: `pgvector`
- Local AI provider: `Ollama`
- Background jobs: `Celery`, `Redis`
- Document parsing:
  - `python-docx`
  - `openpyxl`
  - `pandas`
  - `pypdf` or `pdfplumber`

## Provider Strategy

The MVP starts with local `Ollama`, but all AI access must be implemented behind a provider abstraction so the project can later switch to `OpenAI API` or another provider without rewriting review flows.

Required environment variables:

- `AI_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_CHAT_MODEL=llama3.1:8b`
- `OLLAMA_EMBEDDING_MODEL=nomic-embed-text`

## Architecture Direction

Preferred repo layout:

```text
backend/
  apps/
    accounts/
    companies/
    standards/
    implementation/
    documents/
    reviews/
    action_plans/
    ai_engine/
frontend/
docs/
infra/
```

System shape:

`Next.js UI -> Django REST API -> internal AI services -> PostgreSQL/pgvector -> Ollama`

The backend should own business rules, checklist state transitions, document processing, and traceability. The frontend should remain a thin product UI over explicit APIs.

## Core Backend Services

Agents should implement these services early and keep them small, explicit, and testable:

- `ollama_client.py`: chat and embedding calls, provider config, retry/error handling
- `extractor.py`: extract text and metadata from supported file types
- `chunker.py`: chunk text into `800-1200` word windows with `100-200` overlap while preserving headings when possible
- `embeddings.py`: generate and persist embeddings, support re-embedding if the model changes
- `retriever.py`: similarity search filtered by project, document, standard, clause, and document type
- `prompt_builder.py`: construct review prompts with role, rules, requirements, retrieved context, and JSON schema
- `iso_reviewer.py`: orchestrate document review, parse model output, save evaluations/findings/actions, and update checklist state
- `report_generator.py`: generate review and progress summaries

## Domain Model

The initial domain should include at least:

- `Company`
- `Project`
- `Standard`
- `StandardRequirement`
- `ImplementationChecklistItem`
- `Document`
- `DocumentChunk`
- `DocumentReview`
- `RequirementEvaluation`
- `Finding`
- `ActionPlan`
- `Evidence`
- `PromptTemplate`
- `AIProviderLog`

## Required Product Semantics

### Standards

Initial support:

- `ISO 9001`
- `ISO 13485`
- `BPADT ARCSA`

Design the schema so more standards can be added later, including `ISO 14001` and `ISO 27001`.

### Initial process areas

- `Control documental`
- `Recepcion`
- `Almacenamiento`
- `Producto no conforme`
- `Auditoria interna`
- `Revision por la direccion`

### Initial document types

- `POLITICA`
- `PROCEDIMIENTO`
- `FORMATO`
- `REGISTRO`
- `MATRIZ`
- `INFORME`
- `ACTA`
- `EVIDENCIA`
- `OTRO`

### Checklist states

- `NO_INICIADO`
- `PENDIENTE_DOCUMENTAL`
- `EN_REVISION`
- `CUMPLE_PARCIAL`
- `OBSERVADO`
- `VALIDADO_DOCUMENTALMENTE`
- `IMPLEMENTADO`
- `CERRADO`

### Review types

- `REVISION_DOCUMENTAL`
- `CUMPLIMIENTO_NORMATIVO`
- `CIERRE_NO_CONFORMIDAD`
- `PREPARACION_AUDITORIA`
- `IMPLEMENTACION`

### Requirement evaluation states

- `CUMPLE`
- `CUMPLE_PARCIAL`
- `NO_CUMPLE`
- `NO_APLICA`
- `NO_EVALUADO`

### Finding types

- `BRECHA_DOCUMENTAL`
- `BRECHA_IMPLEMENTACION`
- `RIESGO_AUDITORIA`
- `NO_CONFORMIDAD_POTENCIAL`
- `OBSERVACION`
- `OPORTUNIDAD_MEJORA`

## Mandatory Flows

### 1. Project setup

- Create company
- Create project
- Select standard or regulation
- Load requirements for that standard
- Generate checklist items for the project

### 2. Document ingestion

- Upload file
- Assign document type
- Optionally associate process, clause, requirement, or checklist item
- Extract text
- Store source metadata
- Chunk content
- Generate embeddings
- Save chunks in `pgvector`

### 3. Document review

- Select document
- Select standard
- Select review type
- Load applicable requirements
- Retrieve relevant chunks
- Build structured prompt
- Run AI review
- Parse strict JSON output
- Save review, evaluations, findings, and pending items
- Update checklist state if rules allow it

### 4. Closure and evidence

- Convert findings into action plans or pending items
- Allow corrected documents or additional evidence uploads
- Re-run review after corrections
- Move item to `VALIDADO_DOCUMENTALMENTE` only when documentary support is sufficient
- Move item to `IMPLEMENTADO` only when real evidence exists and has been validated
- Move item to `CERRADO` only when all closure conditions are satisfied

## Checklist Update Rules

- No associated document: `NO_INICIADO` or `PENDIENTE_DOCUMENTAL`
- Document exists but has not been reviewed: `EN_REVISION`
- Review result `NO_CUMPLE`: `OBSERVADO`
- Review result `CUMPLE_PARCIAL`: `CUMPLE_PARCIAL`
- Review result `CUMPLE` and no real evidence required: `CERRADO`
- Review result `CUMPLE` but real evidence still required: `VALIDADO_DOCUMENTALMENTE`
- Valid documentary support plus validated real evidence: `IMPLEMENTADO`
- All completion criteria satisfied: `CERRADO`

## AI Review Contract

Every review prompt must instruct the model to:

- evaluate requirement by requirement
- cite evidence found in the document
- identify missing information explicitly
- classify risk
- distinguish documentary support from real implementation
- state whether the requirement can be closed
- state what evidence or document is still missing
- return valid JSON only

Suggested top-level response shape:

```json
{
  "overall_status": "CUMPLE | CUMPLE_PARCIAL | NO_CUMPLE | NO_APLICA",
  "risk_level": "BAJO | MEDIO | ALTO",
  "executive_summary": "",
  "requirement_evaluations": [],
  "findings": [],
  "implementation_pending_items": []
}
```

Model outputs must be schema-validated before persistence.

## Frontend Scope

The MVP frontend should include:

- General dashboard
- Companies list
- Projects list
- Project detail page
- Checklist page
- Document library
- Document upload flow
- Document review page
- Pending items page
- Action plans page
- Evidence page
- Progress report page

Project detail should show at minimum:

- selected standard
- project scope
- documentary progress percentage
- real implementation progress percentage
- open pending count
- observed documents count
- closed requirements count

## Seed Data Rules

Seed `Standard` and `StandardRequirement` with summarized, implementation-oriented criteria. Focus first on:

- document control
- reception
- storage
- nonconforming product
- internal audit
- management review

Do not seed full protected standard text.

## Delivery Priorities

Build in this order unless the existing codebase already dictates another dependency chain:

1. Django project and core domain models
2. Seed data for standards and requirements
3. Document upload and extraction
4. Ollama client and provider abstraction
5. Chunking, embeddings, and retrieval
6. Structured AI review flow
7. Findings, action plans, and checklist updates
8. Basic frontend workflows
9. Progress and review reporting

## Definition of Done

A task is only done when:

- business rules are enforced in the backend
- traceability is persisted
- AI output is validated before save
- checklist state transitions are deterministic
- documentary vs implementation evidence is respected
- new flows have tests for critical logic
- the UI exposes the result clearly enough for an auditor or implementation lead to act on it

## Working Style For Agents

- Prefer vertical slices that leave the app runnable.
- Keep AI logic deterministic around prompts, parsing, and persistence.
- Put compliance rules in backend services or domain logic, not in the frontend.
- Avoid hidden magic and large framework abstractions.
- Make status transitions explicit and test them.
- Preserve future portability from `Ollama` to other providers.


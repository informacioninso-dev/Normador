# Pilot Demo Runbook

## Objetivo

Levantar un escenario demostrable de punta a punta con datos consistentes y sin depender de entrada manual.

## Preparacion

### 1. Backend

```powershell
.\backend\.venv\Scripts\Activate.ps1
py backend/manage.py migrate
py backend/manage.py seed_standards
py backend/manage.py seed_demo_workspace --force-reset
py backend/manage.py runserver
```

### 2. Frontend

```powershell
Copy-Item frontend/.env.example frontend/.env.local -ErrorAction SilentlyContinue
Set-Location frontend
npm run dev
Set-Location ..
```

## Verificaciones rapidas

- `http://localhost:8000/api/health/`
- `http://localhost:8000/api/projects/`
- `http://localhost:8000/api/projects/{id}/progress_report/`
- `http://localhost:3000/projects`

## Flujo de demo recomendado

### 1. Abrir portfolio

- Ir a `/`
- Mostrar progreso documental vs implementacion real
- Resaltar que no es un chatbot sino una plataforma de operacion normativa

### 2. Entrar al proyecto piloto

- Abrir `Piloto ISO 13485 Demo`
- Mostrar norma, alcance y tabs operativas

### 3. Explicar los tres estados clave

- `7.4.3 Recepcion e inspeccion de producto comprado` en `CERRADO`
- `4.2 Control formal de documentos y registros` en `VALIDADO_DOCUMENTALMENTE`
- `8.3 Control de producto no conforme` en `OBSERVADO`

Punto a remarcar:

- el primer requisito tiene documento, evidencia validada y cierre
- el segundo tiene soporte documental pero todavia no evidencia real validada
- el tercero mantiene brecha abierta y pendiente operativo

### 4. Mostrar documentos y revisiones

- Ir a `Documentos`
- Mostrar texto extraido y clasificacion
- Ir a `Revisiones`
- Mostrar evaluaciones, hallazgos y salida estructurada

### 5. Mostrar pendientes y evidencia

- Ir a `Pendientes`
- Mostrar planes abiertos y el plan ya cerrado
- Ir a `Evidencia`
- Mostrar evidencia validada asociada al cierre

### 6. Mostrar reporte

- Ir a `Reporte`
- Explicar conteos de cierre, hallazgos, planes y progreso por proceso
- Si quieres soporte backend puro, abrir `GET /api/projects/{id}/progress_report/`

## Mensajes clave para el piloto

- El backend decide estados y transiciones.
- La IA no cierra requisitos por si sola.
- Cumplimiento documental y evidencia real son estados diferentes.
- Todo queda trazado por documento, revision, hallazgo, plan y evidencia.

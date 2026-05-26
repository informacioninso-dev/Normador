# Pilot Validation Checklist

- `backend/manage.py migrate` ejecuta sin errores
- `backend/manage.py test` ejecuta sin errores
- `npm run build` del frontend compila
- `GET /api/health/` responde con `status`
- `seed_standards` carga catalogo base
- `seed_demo_workspace --force-reset` crea el proyecto piloto
- el proyecto piloto aparece en `/projects`
- el checklist del piloto muestra al menos un item `CERRADO`
- el checklist del piloto muestra al menos un item `VALIDADO_DOCUMENTALMENTE`
- el checklist del piloto muestra al menos un item `OBSERVADO`
- existe al menos un documento procesado en `LISTO`
- existe al menos una revision con evaluaciones persistidas
- existe al menos un hallazgo abierto
- existe al menos un plan de accion abierto
- existe al menos una evidencia `VALIDADA`
- `GET /api/projects/{id}/progress_report/` devuelve resumen y recomendaciones
- la UI muestra progreso documental y progreso de implementacion por separado

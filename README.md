# NORMAN AI

Plataforma local de implementación ISO y regulatoria. Conecta requisitos, documentos, revisiones, hallazgos, acciones y evidencia; distingue avance documental de implementación real. Código existente reutilizado de AudiBot ISO/Normador.

## Tecnologías y estructura

Django 5.2 + DRF/JWT en `backend/`; Next.js 15 + React 19 + TypeScript + Tailwind en `frontend/`. Python 3.12 y Poetry 2.3; Node.js 20+ y npm. PostgreSQL 16 con pgvector, Ollama local y trabajos Celery/Redis operativos. SQLite conserva una alternativa de desarrollo con búsqueda NumPy y ejecución inmediata de tareas.

Especificación vigente: [SPEC.md](SPEC.md). Arquitectura y auditoría: [ARCHITECTURE.md](ARCHITECTURE.md). Trabajo y validación: [TASKS.md](TASKS.md). `docs/legacy/` conserva guías y planes históricos. Dockerfiles en `infra/docker/` y compose en raíz.

## Instalación local (PowerShell)

Instalar Python 3.12, Poetry y Node/npm como herramientas; todas las dependencias del proyecto se instalan en su entorno. No ejecutar pip global para el backend.

```powershell
# Desde la raiz; no sobrescribir archivos existentes.
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
docker compose up -d postgres redis
Set-Location backend
poetry config virtualenvs.in-project true --local
poetry env use python3.12
# En Windows, si no existe ese alias, usar la ruta completa de Python312/python.exe.
poetry install
# Solo si NO existe .env; no sobrescribir configuraciones existentes:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
poetry run python manage.py check
poetry run python manage.py migrate
poetry run python manage.py seed_standards
poetry run python manage.py createsuperuser
poetry run python manage.py runserver 127.0.0.1:8011
```

Poetry mantiene `backend/.venv`, `pyproject.toml` y `poetry.lock`. Los cambios de dependencias se realizan con `poetry add`/`poetry add --group dev`; versionar el lock actualizado.

En otra terminal desde la raíz, iniciar el worker Linux: `docker compose up -d --build worker`. Después, iniciar frontend:

```powershell
Set-Location frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# En ejecución local, usar http://localhost:8011 en .env.local.
npm ci
npm run dev -- --port 3001
```

Abrir http://localhost:3001/login y usar el usuario creado. Salud: http://localhost:8011/api/health/. El indicador IA configurada no acredita conexión efectiva a Ollama. Los puertos separados evitan conflictos con otros proyectos.

## Variables de entorno

Consultar `.env.example` y `backend/.env.example`. Backend carga `.env` de raíz y luego backend; variables del proceso tienen prioridad y valores ya cargados no se sobrescriben. No publicar esos archivos.

- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `TIME_ZONE`.
- `DB_ENGINE=postgres`; `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT=15432` para el contenedor desde Windows. Dentro de Docker se usa `postgres:5432`.
- `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_CHAT_MODEL=llama3.1:8b`, `OLLAMA_EMBEDDING_MODEL=nomic-embed-text`.
- `AI_REQUEST_TIMEOUT_SECONDS=180`, `CHUNK_SIZE_WORDS=1000`, `CHUNK_OVERLAP_WORDS=150`, `SEMANTIC_SEARCH_TOP_K=5`, `REVIEW_CONTEXT_TOP_K=3`.
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`; frontend `NEXT_PUBLIC_API_BASE_URL=http://localhost:8011`.
- `REDIS_URL=redis://localhost:16379/0`, `CELERY_TASK_ALWAYS_EAGER=false`. En Docker se usa `redis://redis:6379/0`. Solo para desarrollo sin broker: `DB_ENGINE=sqlite`, `CELERY_TASK_ALWAYS_EAGER=true` y `AI_PROVIDER=mock`.

Para pruebas sin Ollama, usar `AI_PROVIDER=mock`: resultados simulados, sin valor como dictamen normativo. Para IA real, instalar Ollama y descargar ambos modelos configurados. Se conservan proveedores internos, sin LangChain.

Se verificó una revisión real con llama3.1:8b y nomic-embed-text sobre datos ficticios: embeddings en 5,9 s y revisión en 124,6 s con CPU. El timeout local usa 180 s. La configuración previa se respaldó antes de activar PostgreSQL y Ollama.

## Pruebas

```powershell
Set-Location backend
poetry check --lock
poetry run python manage.py check
poetry run python manage.py makemigrations --check --dry-run
$env:AI_PROVIDER='mock'
$env:CELERY_TASK_ALWAYS_EAGER='true'
poetry run python manage.py test --noinput
```

```powershell
Set-Location frontend
npm run build
npm run test:workflow
```

Las pruebas Django utilizan una base de pruebas separada. No ejecutar seeds de reinicio sobre datos de trabajo. El frontend incluye pruebas de orientación del flujo, contexto del requisito y fechas de calendario. No tiene una suite automatizada de interacción en navegador; una compilación valida tipos y rutas, no todos los gestos y flujos de usuario.

## Contenedores y conservación

Docker Desktop ejecuta PostgreSQL (`127.0.0.1:15432`), Redis (`127.0.0.1:16379`) y el worker Linux. Ollama nativo escucha en 11434; los contenedores lo alcanzan por host.docker.internal. `docker compose up -d --build` también permite ejecutar API e interfaz en 8011/3001; detener primero sus procesos locales para liberar esos puertos. Los entornos Poetry Linux usan volúmenes separados del .venv Windows.

El servicio Ollama de compose es opcional (`--profile bundled-ollama`, puerto 11435). Para usarlo en lugar del Ollama nativo, definir `OLLAMA_DOCKER_BASE_URL=http://ollama:11434` al iniciar backend/worker y descargar los modelos allí. No se necesitan dos servidores Ollama para la instalación local actual.

PostgreSQL y Redis conservan sus volúmenes; no ejecutar `down -v` sobre datos de trabajo. Ejecutar migraciones explícitamente con `docker compose exec backend poetry run python manage.py migrate` al preparar una base nueva. Cambiar variables de contraseña no modifica automáticamente una base ya inicializada.

Preservar `backend/db.sqlite3`, `backend/media`, configuraciones locales, migraciones y documentos. No ejecutar limpiezas indiscriminadas. Empresas/proyectos se archivan y usuarios se desactivan para conservar trazabilidad.

## Operación por empresa

Al iniciar sesión se abre Empresas cliente. Elige una empresa para ver sus Proyectos o su Equipo y accesos. Desde allí se crea un proyecto para esa empresa; registrar una empresa nueva es un paso separado y no ocurre implícitamente al crear proyectos.

En Usuarios y accesos, un administrador global crea la cuenta con su primera empresa y rol en una única operación. Para incorporar a una persona que ya tiene cuenta, abre la empresa → Equipo y accesos → Añadir una cuenta existente. Una persona puede ser Responsable en un cliente y Lector en otro; el rol de cada empresa se aplica a todos sus proyectos. Los administradores globales acceden a todos los clientes sin membresías adicionales. Dar acceso no envía invitaciones. El propietario conserva responsabilidad; las empresas heredadas sin propietario solo las administra staff hasta asignar membresías.

Desactivar el acceso desde el equipo afecta solo a esa empresa. Desactivar una cuenta en Usuarios y accesos bloquea el ingreso en toda la plataforma, conservando su historial. La edición de cuentas se abre en la propia página, sin un panel flotante dentro de una tabla.

Los formularios muestran permisos derivados del backend. Las descargas son privadas. NO_APLICA necesita justificación y aprobación humana en el checklist; una nueva revisión invalida esa aprobación. Las correcciones de documentos revisados se cargan como nuevos archivos o versiones. El detalle de control documental permite editar plantillas, subir correcciones, enviar a revisión y aprobar conservando versiones.

Sesión: access de 15 minutos, refresh de 30 días y renovación automática. Cerrar sesión revoca refresh; los access emitidos vencen por TTL. Para mantenimiento puede ejecutarse `poetry run python manage.py flushexpiredtokens` periódicamente.

La carga devuelve el documento con `latest_job`; Documentos muestra cola, ejecución, reintentos, resultado y errores, actualizándose mientras hay trabajo pendiente. `GET /api/documents/{id}/processing_jobs/` conserva el historial autorizado. Reintentar genera otro trabajo; no borra el anterior. La carita minimalista de NORMAN acompaña estos estados; completar procesamiento no certifica cumplimiento.

El checklist ofrece búsqueda, filtros y diez resultados por página; abrir un requisito muestra sus formularios y estado de procesamiento. Revisiones presenta todas las citas y evaluaciones desplegables. Evidencias permite descargar el soporte antes de decidir y conserva las rechazadas con sus notas. Las revisiones manuales se solicitan con `POST /api/document-reviews/enqueue/` y continúan en el worker aunque se abandone la pantalla.

## Recorrido de trabajo guiado

Dentro de un proyecto, Matriz de avance presenta el estado y soporte de cada requisito. El botón NORMAN ofrece ayuda contextual y propone un siguiente paso con los datos autorizados del proyecto. Puedes empezar cargando documentos existentes o preparando documentos nuevos.

Cada requisito se trabaja en una sola ficha: Qué se pide → Documentación → Resultado de la revisión → Evidencia de implementación. Se muestra una sección a la vez, con acceso al archivo, las citas, los faltantes y el historial. Aportar evidencia y validarla son decisiones distintas; el auditor o responsable revisa el soporte antes de decidir. Los lectores consultan y descargan; no reciben formularios de escritura como tareas pendientes. La ficha conserva el requisito, el proceso y la sección después de guardar.

La barra del proyecto sigue siendo desplegable y colapsable. Requisitos, acciones correctivas, evidencias e informe son las tareas principales; archivo de documentos, historial de revisiones, documentos controlados, bitácora y seguimiento permanecen disponibles como herramientas. Los detalles técnicos se consultan bajo demanda. Los porcentajes y estados proceden de las reglas existentes del backend; una sugerencia de navegación no acredita cumplimiento.

La base local fue transferida a PostgreSQL y comparada íntegramente: 270 objetos, incluidos 2 usuarios, 1 empresa, 1 proyecto y 1 documento. SQLite, media y respaldos se conservaron. El stack técnico está validado; falta el piloto final y la revisión visual de escritorio/móvil: ver TASKS.md.


## Archivos con identidad de empresa

En Empresa → Logo y encabezado, el responsable configura una imagen PNG/JPEG de hasta 2 MB, título, subtítulo y pie de página, con vista previa. Se aplica a nuevas versiones y reportes; las versiones anteriores conservan su encabezado y logo. No se borran imágenes históricas.

En Documentos controlados, cada versión generada permite descargar Word y PDF; las matrices y formatos también Excel. Los archivos externos conservan la descarga original. Crear una nueva versión aplica el encabezado actual sin sobrescribir versiones anteriores. La aprobación humana sigue siendo independiente de la generación y exportación.

En Matriz de avance o Informe de avance, Descargar informe Excel produce las hojas Resumen, Matriz de requisitos, Acciones, Evidencias, Documentos, Revisiones y Evaluaciones, con empresa, proyecto, norma y fecha, filtros, paneles inmovilizados y encabezados de impresión. Exporta todos los registros autorizados, aunque la pantalla esté filtrada o paginada. El texto se escribe como valor literal para impedir que se interprete como fórmula.

El porcentaje de implementación cuenta exclusivamente requisitos con estado IMPLEMENTADO o CERRADO. La validación documental sola no aporta avance de implementación. La matriz separa documentos, evaluación y evidencias validadas; el detalle narrativo queda dentro de las fichas y los archivos.

# SparkyTC

Plataforma de gestión de test cases, basada en el proyecto open source Cherry (Apache 2.0). La versión 2.0.0 está en `main`.

**Repositorio:** trabaja y abre PRs solo en https://github.com/cesared19/SparkyTC.

**Idioma:** comunícate con el usuario en español.

## Arquitectura

- **Backend:** Spring Boot 3 + Kotlin (JDK 21), en `service/`. Paquete `com.sparkytc.sparkytcservice`, configuración con prefijo `sparkytc.*`.
- **Frontend:** Remix + React + Tailwind, en `client/`. Todas las llamadas a la API pasan por el servidor Remix con la sesión del usuario (`requireAPI` / `requireUser` / `requireAdmin`).
- **Base de datos:** PostgreSQL con migraciones propias en `service/src/main/kotlin/com/sparkytc/sparkytcservice/database/DatabaseMigrator.kt` (esquema actual 0.0.17). Cada cambio de esquema agrega una versión nueva en `SchemaVersion` (`SchemaVersion.kt`) y su paso de migración.
- **Deploy:** Docker Compose (`docker-compose.yml`); la imagen del cliente usa Node 22. El backend solo se publica en `127.0.0.1:8080`; el cliente en el puerto 3000. El servidor se accede por IP, sin HTTPS todavía.

## Funcionalidades existentes (v1.0.0)

- Cuentas con roles Tester/Admin, sesiones de 7 días y página Users para gestionar usuarios y su acceso por proyecto.
- Super admin (desde 1.1.0): la cuenta de `ADMIN_USERNAME`, marcada con `users.is_super_admin`. Es la única que resetea contraseñas de otros y la única que puede modificar su propia cuenta; no aparece al asignar test runs ni test cases. `AdminBootstrap` la crea si no existe; `ADMIN_PASSWORD_RESET=true` restablece su contraseña al arrancar.
- Visibilidad por proyecto, aplicada en el backend: los testers solo ven los proyectos asignados y los proyectos ocultos responden 404.
- Dashboard por proyecto como página de inicio, con proyecto por defecto y pestañas Dashboard | Test Cases | Test Runs | Settings (Settings solo para admins).
- Test cases: importación CSV, imágenes y videos guardados en la base de datos, enlaces clicables y edición durante un run. Al eliminar uno que ya se usó en test runs se archiva (`test_cases.is_archived`, desde 1.3.1): sale de la lista, del selector y de los conteos, y los runs conservan su resultado; los que nunca se usaron se borran.
- Test runs: asignación a usuarios; los testers toman o sueltan test cases y queda registrado quién completó cada uno. Los admins reasignan mientras el run esté abierto.
- Notificaciones en la app (campana) al asignar un run y al completarlo, con preferencias por usuario. Las leídas se pueden borrar una a una o con "Clear read".
- Builds por proyecto (desde 1.1.0): los admins registran builds (texto libre); la más reciente es la actual y se muestra en el dashboard. Cada test run guarda su build (se elige entre las registradas y se puede cambiar mientras esté abierto) y se envía en los bugs de Jira.
- Jira Cloud: crear bugs desde un fail (modo Disabled, Manual o Automatic por proyecto), elegir de listas el espacio (proyecto) de Jira y el tipo de issue por proyecto (desde 1.1.0; el tipo, elegido o por defecto, debe existir en el espacio), vincular tickets existentes con su estado en vivo y sugerir tickets similares. **Nunca se suben archivos a Jira.**
- Reporter de Jira por usuario (desde 1.3.0): los bugs se crean con la cuenta compartida y el campo Reporter es el usuario de Jira vinculado (`users.jira_account_id`), elegido por cada usuario en Account o por un admin en Users. Sin vínculo se reporta como la cuenta compartida; si Jira rechaza el reporter, se crea sin él y se notifica al usuario. Settings indica si la cuenta compartida tiene *Modify Reporter* en el espacio. No se guardan credenciales de Jira por usuario.
- Resultados por build (desde 1.3.0): cuentan el último resultado ejecutado de cada test case entre los runs de la build; los rates son sobre ejecutados (pass, fail, skip). El dashboard grafica la build actual por test run con barras apiladas (pass, fail, skip y pendientes, desde 1.4.0) y la pestaña Builds compara builds (`BuildResultsService`, `RateChart`).
- Registro de tiempo (desde 1.4.0): opcional por test run (`test_runs.track_time`). Cronómetro por test case guardado en el servidor (`time_entries`, un tramo por inicio/reanudación); cada usuario tiene un solo cronómetro corriendo y registrar el resultado lo detiene. Si no se usó, el tester puede capturar los minutos al registrar el resultado. La página del run muestra el total, el desglose por día (agrupado en la zona horaria del navegador) y el tiempo por test case; un admin puede reemplazar el total de un run cerrado (`time_override_seconds`), lo que oculta el desglose. El dashboard y la pestaña Builds suman el tiempo de los runs de cada build (`TimeTrackingService`).
- Cerrar y reabrir en Jira (desde 1.5.0): al registrar un Pass, el tester puede cerrar los issues vinculados que no están en Done; al registrar un Fail, reabrir los que están en Done y cambiarles el assignee. Elige la transición entre las que ofrece Jira (Done o To Do preseleccionada) y SparkyTC comenta en el issue, con la cuenta compartida, quién lo hizo y un enlace al test case en el run. Si Jira lo rechaza, el resultado se guarda igual y se muestra el error (`JiraResultTransitions`).
- Reporte del test run (desde 1.5.0): el botón *Download report* genera en el navegador un .zip con `summary.png` (dibujada en canvas) y `test-cases.pdf` (jsPDF, imágenes embebidas, videos como enlaces) (`TestRunReport.ts`). El avance por día usa `test_case_runs.executed_at` (0.0.12; los resultados anteriores toman su `modify_date`). La exportación a Word se eliminó en 1.5.0.
- Resultados (desde 1.6.0): estados Pass, Fail, Blocked y Skip. Blocked cuenta como ejecutado sin pasar (baja el pass rate) y deja el run abierto; permite crear bug de Jira en modo Manual. Cada guardado agrega un resultado (`test_case_results`, no se editan; un admin puede borrar uno) y `test_case_runs` guarda copia del último (status, notes, executed_by, executed_at), que es lo que leen dashboard, builds y reporte (`TestCaseResultService`). La evidencia va por resultado (`test_case_attachments.test_case_result_id`; los adjuntos del test case la excluyen con `@SQLRestriction`); se sube después de guardar el resultado. Historial por test case (`/test-cases/{id}/history`) y re-run de los fallidos/bloqueados (`/test-runs/{id}/rerun`, conserva asignaciones).
- Organización (desde 1.7.0): suites y secciones anidadas (`test_case_sections`, las de primer nivel son suites; cada caso en una, `test_cases.section_id`; `TestCaseSectionService`), árbol en la lista de casos y filtro por sección en el selector del run. Labels libres (`test_case_labels`, sin repetir ignorando mayúsculas) con filtro en la lista y el selector, y columna Labels en el CSV.
- Pasos (desde 1.7.0): `test_cases.format` TEXT o STEPS; `test_case_steps` (acción y esperado, o referencia a un shared step). Biblioteca de shared steps por proyecto (`shared_steps`, `shared_step_items`); editar uno cambia los casos, no los runs, y no se borra mientras se use. Los runs copian los pasos expandidos (`test_case_run_steps`) y cada resultado guarda cada paso (`test_case_result_steps`); el resultado se sugiere a partir de los pasos (`StepService`, `StepsEditor`, `StepsView`). Skip usa cian (`#0891b2`).
- Test plans (desde 2.0.0): plantillas de casos por secciones (con las anidadas), labels (cualquiera) o casos sueltos (`test_plans`, `test_plan_sections`, `test_plan_labels`, `test_plan_test_cases`; `TestPlanService`, `planTestCases` en `utility/TestPlans.ts`). Los casos se calculan al iniciar el run (`/test-runs/{code}/new?plan=id`); el run guarda `test_runs.test_plan_id` (ON DELETE SET NULL). Solo admins borran planes.
- Exportación (desde 2.0.0): lista de casos (con los filtros) y resultados de un run en CSV (con BOM) o .xlsx (`utility/Xlsx.ts` con JSZip, `TestCaseExport.ts`). El CSV de casos se reimporta: columnas ID (se ignora), Section (ruta, crea lo que falte: `CreateTestCaseDTO.sectionPath`), Format y Steps ("1. acción", "   Expected: x", "N. [Shared] Nombre").
- Edición masiva (desde 2.0.0): botón Select en la lista de casos; mover de sección, agregar/quitar labels, fijar una propiedad, cambiar formato (`StepService.convertFormat`) y, solo admins, borrar (archiva los usados). En un run abierto los admins asignan varios casos. Todo o nada (`BulkEditService`, `/test-cases/bulk`, `/test-cases/bulk-delete`, `/test-case-runs/bulk-assignee`, ruta de recurso `/bulk-edit`, `BulkEditBar`).
- Responsivo (desde 1.3.0): en móvil la barra superior es un menú, la lista de proyectos es un panel lateral y las tablas (`Table`) se muestran como tarjetas hasta `lg`; la página Users usa `useMediaQuery` para no duplicar sus formularios. Revisa los cambios de interfaz también a 390 px y 820 px.
- Modo claro, oscuro o del sistema. Paleta de marca carmesí `#C01C37`, con la escala de grises y la escala `brand` definidas como variables CSS en `client/app/tailwind.css`.

## Cómo trabajar

- **Antes de hacer push:**
  - Backend: `cd service && ./gradlew test` (tests de integración con Testcontainers + Postgres; hoy son 81).
  - Cliente: `cd client && npx tsc && npm run lint && npm run build`. El lint está en 0 problemas (desde 2.0.1); debe seguir así. Los payloads que se envían con `useSubmit`/`fetcher.submit` son alias `type`, no interfaces que extienden `Record<string, any>`.
- **Si Testcontainers no encuentra Docker:** inicia dockerd con `DOCKER_MIN_API_VERSION=1.24`.
- **Cambios de interfaz:** pruébalos de punta a punta en el navegador contra el build de producción (`npm run build` + `npm run start`), revisando también el modo oscuro.
- **Formato del cliente:** Prettier con `--use-tabs --single-quote --no-semi`; sigue el estilo del código existente.
- **Flujo de trabajo:** un PR por versión. El usuario decide cuándo abrir y cuándo fusionar el PR (no abrirlo ni fusionarlo por iniciativa propia).
- **Versionado:** al preparar una versión, actualiza `version` en `service/build.gradle.kts` y en `client/package.json`, y el `README.md` cuando corresponda.
- **Al recibir una lista de trabajo:** proponer un orden (bugs primero) y preguntar lo que no quede claro antes de empezar.

## Pendientes conocidos

- Publicar la release v1.0.0 en GitHub (la etiqueta todavía no existe).
- Más adelante: HTTPS en el servidor y convertir la app en PWA; migrar de Remix 2 a React Router 7 y de ESLint 8 a 9.
- Rendimiento: Hibernate carga las colecciones por lotes (`default_batch_fetch_size`); al listar runs con sus resultados, usar `findAllByTestRunIn` (`BuildResultsService.testCaseRunsByRun`) en vez de una consulta por run. La página de un run carga solo ese run (`/projects/{code}/test-runs/{number}`).

## Versión en curso

- **2.0.1** (rama `claude/v2.0.1`) — hecho: lint en 0 (imports sin usar o duplicados, payloads sin `any`, ternarios sin mezcla de espacios y tabs, etiquetas asociadas a su control). Se corrigió de paso `UpdateTestRun`, que no declaraba `trackTime`.

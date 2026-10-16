# SparkyTC

Plataforma de gestión de test cases, basada en el proyecto open source Cherry (Apache 2.0). La versión 1.0.0 está en `main`.

**Idioma:** comunícate con el usuario en español.

## Arquitectura

- **Backend:** Spring Boot 3 + Kotlin (JDK 21), en `service/`. Paquete `com.sparkytc.sparkytcservice`, configuración con prefijo `sparkytc.*`.
- **Frontend:** Remix + React + Tailwind, en `client/`. Todas las llamadas a la API pasan por el servidor Remix con la sesión del usuario (`requireAPI` / `requireUser` / `requireAdmin`).
- **Base de datos:** PostgreSQL con migraciones propias en `service/src/main/kotlin/com/sparkytc/sparkytcservice/database/DatabaseMigrator.kt` (esquema actual 0.0.7). Cada cambio de esquema agrega una versión nueva en `SchemaVersion` (`SchemaVersion.kt`) y su paso de migración.
- **Deploy:** Docker Compose (`docker-compose.yml`). El backend solo se publica en `127.0.0.1:8080`; el cliente en el puerto 3000. El servidor se accede por IP, sin HTTPS todavía.

## Funcionalidades existentes (v1.0.0)

- Cuentas con roles Tester/Admin, sesiones de 7 días y página Users para gestionar usuarios y su acceso por proyecto.
- Visibilidad por proyecto, aplicada en el backend: los testers solo ven los proyectos asignados y los proyectos ocultos responden 404.
- Dashboard por proyecto como página de inicio, con proyecto por defecto y pestañas Dashboard | Test Cases | Test Runs | Settings (Settings solo para admins).
- Test cases: importación CSV, imágenes y videos guardados en la base de datos, enlaces clicables y edición durante un run.
- Test runs: asignación a usuarios; los testers toman o sueltan test cases y queda registrado quién completó cada uno. Los admins reasignan mientras el run esté abierto.
- Notificaciones en la app (campana) al asignar un run y al completarlo, con preferencias por usuario.
- Jira Cloud: crear bugs desde un fail (modo Disabled, Manual o Automatic por proyecto), elegir el proyecto de Jira, vincular tickets existentes con su estado en vivo y sugerir tickets similares. **Nunca se suben archivos a Jira.**
- Modo claro, oscuro o del sistema. Paleta de marca carmesí `#C01C37`, con la escala de grises y la escala `brand` definidas como variables CSS en `client/app/tailwind.css`.

## Cómo trabajar

- **Antes de hacer push:**
  - Backend: `cd service && ./gradlew test` (tests de integración con Testcontainers + Postgres; hoy son 58).
  - Cliente: `cd client && npx tsc && npm run lint && npm run build`.
- **Si Testcontainers no encuentra Docker:** inicia dockerd con `DOCKER_MIN_API_VERSION=1.24`.
- **Cambios de interfaz:** pruébalos de punta a punta en el navegador contra el build de producción (`npm run build` + `npm run start`), revisando también el modo oscuro.
- **Formato del cliente:** Prettier con `--use-tabs --single-quote --no-semi`; sigue el estilo del código existente.
- **Flujo de trabajo:** un PR por versión. El usuario decide cuándo abrir y cuándo fusionar el PR (no abrirlo ni fusionarlo por iniciativa propia).
- **Versionado:** al preparar una versión, actualiza `version` en `service/build.gradle.kts` y en `client/package.json`, y el `README.md` cuando corresponda.
- **Al recibir una lista de trabajo:** proponer un orden (bugs primero) y preguntar lo que no quede claro antes de empezar.

## Pendientes conocidos

- Publicar la release v1.0.0 en GitHub (la etiqueta todavía no existe).
- Más adelante: HTTPS en el servidor y convertir la app en PWA.

## Versión en curso

- **1.1.0** — bugs y user stories definidos por el usuario en la sesión.

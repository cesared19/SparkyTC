# Changelog

Notable changes to SparkyTC, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each pull request adds its line under **Unreleased**; a release pull request turns that section into the new version (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

When a version changes the database, its entry says so under **Upgrading**. Since 2.5.0, `docker compose up` backs up the database and migrates it on its own; earlier versions ran the backend once with `DATABASE_MIGRATION_MODE=MIGRATE`, then set it back to `NONE`.

## [Unreleased]

### Added
- Issue forms for bugs and feature requests, a pull request checklist, this changelog, and the contributing and security guides.
- Daily database backups on the server, keeping 14 daily and 8 weekly ones, with commands to list them, check one by restoring it into a new database, and restore one. The README explains how to restore and how to roll back an upgrade.
- Test runs record whether they were created in the app (manual) or through the integration API (automated). Automated runs show an **Automated** badge in the run list and on the run page, with the API token as their author, and the run list can show all runs, only manual or only automated ones (kept in the address with the sort order). The dashboard and the Builds tab count both.
- Test runs through the integration API: `POST /api/integration/v1/test-runs` with a Read and write token creates an automated test run for a registered build, with test cases by number and/or a test plan's. An unknown build or test case gets a 400 naming it, and a `sourceRef` returns the run already created with it instead of a duplicate. These runs track time.
- Results through the integration API: `POST /api/integration/v1/test-runs/{number}/results` with a Read and write token records Pass, Fail, Blocked or Skip for a test case of an automated test run, like the app does, with notes, the time it took and a report (for example, a replay's screenshot comparison and performance). The run completes with the same rule as in the app, and the token shows as who executed it.
- Evidence through the integration API: `POST /api/integration/v1/test-runs/{number}/results/{resultID}/attachments` attaches images, videos and `.zip` files (for example a replay's whole report) to a result of an automated test run. A `.zip` shows with a **Download** link and is never opened in SparkyTC.
- A result that came with a replay's report shows it on the test case's page in the run and in its history: the findings, each screenshot compared with the recording (with links to its recording, replay and diff images), and the performance of the recording next to the replay's, with metrics more than 20% worse highlighted. The results export adds the replay's result and p95 frame time when a run has them.

### Changed
- `docker compose up` backs up the database, migrates it if the new version needs it, and only then starts the backend. If the backup or the migration fails, the backend doesn't start. `DATABASE_MIGRATION_MODE` is no longer set by hand.

### Security
- Attachments that aren't images the browser shows safely or videos, such as SVG files (which can contain scripts), are now downloaded instead of opened in the browser, and every attachment is sent with `X-Content-Type-Options: nosniff`.

### Upgrading
- Database schema **0.0.24**: existing test runs are marked as manual, test runs can keep the reference of the app that created them, and results and evidence can be recorded by an API token, results with a report.
- Remove `DATABASE_MIGRATION_MODE` from `.env` and run `docker compose up -d --build`. Backups are written to `backups/` next to `docker-compose.yml` (`BACKUP_DIR` changes it); the README lists the other settings.

## [2.4.0] - 2026-11-06

### Added
- Test case history in the integration API: `GET /api/integration/v1/test-cases/{number}/history?limit=` returns a test case of the token's project (archived ones too) with its description, instructions and steps, and its results in every test run, newest first, with how each step went, the run's build, the number of evidence files and a link to the test case in that run. Any project API token can read it.

## [2.3.0] - 2026-11-03

### Added
- Read and write API tokens: when creating a token, admins choose **Read** or **Read and write**, and the list shows each token's permission.
- A Read and write token creates sections by path, test cases (text or steps) and test plans through the integration API. Nothing is edited or deleted through the API, and a Read token gets a 403.
- An optional `sourceRef` returns what was already created with it instead of a new one, so retries don't duplicate anything.
- `GET /project` returns the token's `permissions`.

### Changed
- What a token creates shows the token as its author, e.g. *co-bord (API token)*. Revoking a token now hides it instead of deleting it, so that stays.

### Upgrading
- Database schema **0.0.20**. Existing tokens keep reading only.

## [2.2.0] - 2026-11-03

### Added
- Project API tokens, created and revoked by admins in a project's Settings. A token is shown once and only a hash of it is stored.
- Read-only integration API at `/api/integration/v1`: the project and its builds, sections, test cases, test plans, and the latest results of chosen test cases, sections or plans in a build.

### Upgrading
- Database schema **0.0.19**. Apps in other Docker Compose projects reach the backend through SparkyTC's Docker network.

## [2.1.1] - 2026-10-29

### Added
- Drafts: what a tester marks and writes for a test case in a run is kept on the server until the result is saved.
- The result can be chosen next to **Save result**, which says what's missing; after saving, the next test case shows a notice of the result saved.
- The run's table and the exported results show how the steps went in the latest result.

### Upgrading
- Database schema **0.0.18**.

## [2.1.0] - 2026-10-29

### Added
- **Sort by** on the test run list (open runs first by default, newest, oldest, title or build), and a Build column.

### Fixed
- The test run list no longer changes order when runs are updated.
- Long pages no longer scroll as a whole past their content, leaving blank space, mostly on iPhone.

## [2.0.1] - 2026-10-23

First release since 1.0.0; versions 1.1.0 to 2.0.0 weren't published on their own and are included here.

### Added
- Suites and nested sections, free labels, test cases written as steps and a shared steps library (1.7.0).
- Test plans, CSV and Excel export, and bulk edit of test cases and of assignments in a run (2.0.0).
- Blocked result, several results per test case with their own evidence, history across runs and re-runs of failed tests (1.6.0).
- Builds per project, build results on the dashboard and a Builds tab, time tracking and a test run report (1.1.0 to 1.5.0).
- Jira: choosing the space and issue type, reporting in each user's name, and closing or reopening linked issues from a result (1.1.0 to 1.5.0).
- Super admin account, and support for phones and tablets (1.1.0 to 1.3.0).

### Changed
- Test cases used by runs are archived instead of failing to delete (1.3.1).
- Far fewer database queries on the main pages, and the client image runs on Node 22 (2.0.0).

### Removed
- The `PUT /test-cases/section` API endpoint, replaced by bulk edit.

### Upgrading
- Database schema **0.0.17**. Existing test cases are placed in a **Default** suite.

## [1.0.0] - 2026-10-15

First release as SparkyTC, based on [Cherry](https://github.com/bennettadam/cherry).

### Added
- User accounts with Tester and Admin roles, per-project visibility and a project dashboard.
- Test run assignments, in-app notifications and Jira Cloud integration.
- CSV import, images and videos in test cases, and light, dark and system themes.

### Upgrading
- Database schema 0.0.7. Signing in is now required.

[Unreleased]: https://github.com/cesared19/SparkyTC/compare/v2.4.0...HEAD
[2.4.0]: https://github.com/cesared19/SparkyTC/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/cesared19/SparkyTC/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/cesared19/SparkyTC/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/cesared19/SparkyTC/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/cesared19/SparkyTC/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/cesared19/SparkyTC/compare/v1.0.0...v2.0.1
[1.0.0]: https://github.com/cesared19/SparkyTC/releases/tag/v1.0.0

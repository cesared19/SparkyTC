# Contributing to SparkyTC

How work on SparkyTC goes from an idea to a release. It applies to everyone who changes the code, people and AI assistants alike. To run the app locally, see [Running the development server](./README.md#running-the-development-server).

## 1. Every change starts as an issue

- Bugs and ideas are reported as GitHub issues with the **Bug report** or **Feature request** form, not in chats or messages. Feedback from testers goes there too, with the steps and a video when possible.
- New issues get the `triage` label. Triage, at least once a week, decides:
  - the type (`bug`, `enhancement`, `maintenance`, `documentation`);
  - for bugs, the severity, as exactly one severity label from the table below;
  - the milestone (the version it's planned for), or that it's not planned.

  Then the `triage` label is removed. An issue keeps it while it has open questions only the owner can answer.
- An issue is **ready** to start when its expected result is clear, with acceptance criteria for features and steps to reproduce for bugs, and open questions are answered.
- Bugs go before features, by severity:

  | Label | Meaning | Aim |
  | --- | --- | --- |
  | `severity: critical` | Data is lost or nobody can work | Fix now, as a hotfix |
  | `severity: high` | A main task can't be done and there's no workaround | Next release |
  | `severity: medium` | There's a workaround | Planned in a milestone |
  | `severity: low` | Cosmetic or minor | When there's room |

## 2. One branch and one pull request per issue

- Branch from an up-to-date `main`, named after the type and the issue: `feat/123-api-token-permissions`, `fix/130-scroll-on-iphone`, `chore/...`, `docs/...`.
- Keep the branch to that issue, and short-lived: days, not weeks. Big features are split into issues that each leave `main` working.
- Commit messages say what changes and why, in the imperative ("Keep unsaved results as drafts").
- Open the pull request early and fill in the template. It **closes its issue** (`Closes #123`).
- `main` is protected: changes only arrive through pull requests approved by the owner. Pull requests are **squash merged**, so each one is a single commit in `main`, and the branch is deleted afterwards.

## 3. Definition of done

A pull request is ready to merge when:

- **The checks pass locally**, run before pushing (the repository has no automated CI):
  - backend: `cd service && ./gradlew test`;
  - client: `cd client && npx tsc && npm run lint && npm run build`, with no lint problems;
  - for changes to Docker files or `deploy/`, `docker compose build` and `shellcheck --external-sources deploy/backup/*.sh`.
- **Tests cover the change**: new behavior has tests, and a fixed bug has a test that failed before the fix.
- **UI changes pass the end-to-end tests** (`npm run e2e`, see below), which check every page at 390 px, 820 px and desktop, in light and dark mode, and that no page scrolls as a whole past its content. A new page is added to `e2e/layout.spec.ts`, and new behavior in the browser gets a test.
- **The changelog has a line** under **Unreleased** in [CHANGELOG.md](./CHANGELOG.md), in the right group (Added, Changed, Fixed, Removed, Security), written for users. Changes users don't notice don't need one.
- **Database changes** add a new schema version (`SchemaVersion` and its step in `DatabaseMigrator`), never edit an earlier one, and say so under **Upgrading** in the changelog.
- **Docs are updated**: the README when users or deployers need to know, and `CLAUDE.md` when a lasting rule or architecture detail changes.
- **Someone reviewed it**: the owner approves every pull request, including the ones written with an AI assistant.
- **The version wasn't changed**: only release pull requests change it.

### End-to-end tests

The tests in `client/e2e/` drive the app in Chromium with [Playwright](https://playwright.dev): signing in, test cases with text and steps, test runs with results, evidence and drafts, test plans, bulk edit, export, API tokens, and the layout of every page. They run against an app that is already running, and create a project and data of their own each time, so they never depend on what's in the database. Use a database for testing, not production's.

1. Start the backend with a test database and an admin account (`ADMIN_USERNAME` and `ADMIN_PASSWORD`; see [Running the development server](./README.md#running-the-development-server)).
2. Start the client's production build: `cd client && npm run build && npm run start`.
3. The first time, download Chromium: `npx playwright install chromium`.
4. Run them: `npm run e2e`. Everything takes about two minutes. `npm run e2e -- e2e/test-runs.spec.ts` runs one file.

Settings, as environment variables: `E2E_BASE_URL` (default `http://localhost:3000`), `E2E_ADMIN_USERNAME` and `E2E_ADMIN_PASSWORD` (default `admin` and `admin-password`), and `E2E_CHROMIUM_PATH` to use a Chromium already installed. When a test fails, `npx playwright show-report e2e-report` shows the step, a screenshot and a trace.

To add a test:

- Put it in the `e2e/*.spec.ts` file of its area, or a new one. The helpers in `e2e/support.ts` create test cases and runs, and `unique()` names things so a test can run again on the same database.
- Find elements by role, label or `id`, as a person would (`getByRole('button', { name: 'Save result' })`). Lists are tables on wide screens and cards on narrow ones, so text can be in the page twice: add `.filter({ visible: true })` or use the table's `row` and `cell` roles.
- A new page goes in the list of `e2e/layout.spec.ts`.

## 4. Versions and releases

SparkyTC follows [Semantic Versioning](https://semver.org/):

- **Patch** (2.4.1): bug fixes only.
- **Minor** (2.5.0): new features or compatible changes, including database migrations that keep working with existing data.
- **Major** (3.0.0): changes that break something for users, deployers or the integration API.

Releasing is its own pull request, named `Release X.Y.Z`, from a `release/X.Y.Z` branch:

1. Pick the version from what's under **Unreleased**.
2. Change the version in `service/build.gradle.kts`, `client/package.json` and `client/package-lock.json` (its two `version` fields).
3. In `CHANGELOG.md`, rename **Unreleased** to the version and date, add **Upgrading** steps (migration, environment variables, anything to do by hand), start an empty **Unreleased**, and update the compare links at the bottom.
4. Once it's merged, publish the GitHub release: tag `vX.Y.Z` on `main`, title `SparkyTC X.Y.Z`, with that version's changelog section as notes and the link `compare/vPREVIOUS...vX.Y.Z`.

## 5. Hotfixes

For a critical bug in production that can't wait for the next release:

1. Branch `hotfix/X.Y.Z` from the tag of the release in production, e.g. `v2.4.0` for 2.4.1.
2. Fix it with a test, bump the patch version and add the changelog entry.
3. Release it from that branch (tag `v2.4.1`), then merge the same fix into `main` with a pull request so it isn't lost.

## 6. The integration API is a contract

Other apps (co-bord) depend on `/api/integration/v1`. In `v1`, fields and endpoints can be added but not removed or changed in meaning. Breaking changes go to a new `/api/integration/v2`, and `v1` keeps working for at least one minor release after `v2` ships, with the deprecation announced in the changelog.

## 7. Maintenance

- **Dependencies**: reviewed by hand, at least once a month (`npm outdated` in `client`, and the versions in `service/build.gradle.kts`). Minor and patch updates go in one pull request once the checks pass locally. Major updates (Spring Boot, Remix, Node) get their own issue, since they may need code changes.
- **Security**: report vulnerabilities privately, as [SECURITY.md](./SECURITY.md) explains.
- **Branches**: merged branches are deleted; old unmerged ones are closed or deleted at triage.

## 8. Working with AI assistants

Sessions of Claude Code follow this guide like anyone else:

- **One session per issue, in its own branch.** Two sessions never change the same files at once.
- **The issue says what to do.** Plans, decisions and follow-ups go in the issue, not only in the chat.
- **`CLAUDE.md` holds lasting rules and architecture.** The current version and the released versions are not kept there: GitHub milestones and releases say that.
- **Every pull request is reviewed and approved by the owner before merging.**
- **No bulk activity on GitHub.** The owner's account doesn't allow automated tools, so assistants push branches and open pull requests when asked, but never create issues, labels, milestones or comments in bulk, and don't retry what GitHub refuses. Several issues from one plan are written up for the owner to create.

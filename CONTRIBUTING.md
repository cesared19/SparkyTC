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
- `main` is protected: changes only arrive through pull requests with green checks and an approval. Pull requests are **squash merged**, so each one is a single commit in `main`, and the branch is deleted afterwards.

## 3. Definition of done

A pull request is ready to merge when:

- **CI is green**: backend tests, client types, lint (no problems allowed) and build, and both Docker images build.
- **Tests cover the change**: new behavior has tests, and a fixed bug has a test that failed before the fix.
- **UI changes were checked** against the production build (`npm run build` + `npm run start`) at 390 px, 820 px and desktop, in light and dark mode. No page may scroll as a whole past its content.
- **The changelog has a line** under **Unreleased** in [CHANGELOG.md](./CHANGELOG.md), in the right group (Added, Changed, Fixed, Removed, Security), written for users. Changes users don't notice don't need one.
- **Database changes** add a new schema version (`SchemaVersion` and its step in `DatabaseMigrator`), never edit an earlier one, and say so under **Upgrading** in the changelog.
- **Docs are updated**: the README when users or deployers need to know, and `CLAUDE.md` when a lasting rule or architecture detail changes.
- **Someone reviewed it**: the owner approves every pull request, including the ones written with an AI assistant.
- **The version wasn't changed**: only release pull requests change it.

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

- **Dependencies**: Dependabot opens weekly pull requests. Minor and patch updates come grouped; merge them when CI is green. Major updates (Spring Boot, Remix, Node) get their own issue, since they may need code changes.
- **Security**: report vulnerabilities privately, as [SECURITY.md](./SECURITY.md) explains.
- **Branches**: merged branches are deleted; old unmerged ones are closed or deleted at triage.

## 8. Working with AI assistants

Sessions of Claude Code follow this guide like anyone else:

- **One session per issue, in its own branch.** Two sessions never change the same files at once.
- **The issue says what to do.** Plans, decisions and follow-ups go in the issue, not only in the chat.
- **`CLAUDE.md` holds lasting rules and architecture.** The current version and the released versions are not kept there: GitHub milestones and releases say that.
- **Every pull request is reviewed and approved by the owner before merging.**

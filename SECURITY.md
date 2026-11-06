# Security policy

## Reporting a vulnerability

Please don't report security problems in public issues. Report them privately with GitHub's **[Report a vulnerability](https://github.com/cesared19/SparkyTC/security/advisories/new)** form, in the repository's **Security** tab.

Include what is affected, how to reproduce it and what an attacker could do with it. You'll get an answer within a week, and we'll agree on when the fix and the advisory are published.

## Supported versions

Only the latest release gets security fixes. Upgrade to it before reporting, if you can.

## Handling secrets

- Never commit secrets: passwords, `SESSION_SECRET`, Jira API tokens or project API tokens. They belong in the server's `.env`, which is ignored by git.
- Project API tokens are shown once and only their hash is stored. Revoke a token in the project's Settings if it may have leaked, and create a new one.
- If a secret reaches the repository, rotate it right away: removing the commit doesn't make it safe again.

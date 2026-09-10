# Contributing

## Before opening a change

1. Read `AGENTS.md` and the architecture, permissions, and tests documents.
2. Keep the app read-mostly. Any new write to Dynatrace data needs an explicit product and permission review.
3. Prefer Strato components and design tokens. Do not add a new dependency for a small helper that can be implemented locally.
4. Keep external calls inside AppEngine functions and validate all external input and output.
5. Do not commit tenant credentials, tokens, Playwright auth state, screenshots containing customer data, or local deployment artifacts.

## Required checks

```text
npm ci
npm run verify
npm audit --omit=dev
```

For a release candidate, use `npm run verify:release` as the single gate. It includes CI-style coverage and the production dependency audit.

Authenticated browser checks can be run separately with `DT_APP_E2E_URL`, `DT_APP_E2E_AUTH_STATE`, and `npm run test:e2e`. The repository's E2E workflow is manual-only because tenant credentials and browser state must never be embedded in pull requests.

If a change affects DQL, permissions, app state, external calls, or a user-visible claim, update the relevant documentation and tests in the same change.

## Review expectations

- Explain the intended behavior and the deny or degraded behavior.
- Include the source of truth for any new data field or identifier.
- Separate local, tested, deployed, and target-environment-verified claims.
- Bump `app.version` whenever `app.config.json` changes.
- Deploy only from an approved branch or CI identity after review.

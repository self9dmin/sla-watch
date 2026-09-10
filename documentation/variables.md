# Variables, configuration, and secrets

## Configuration inventory

| Name | Used by | Scope | Source | Rotation or retention | Risk |
| --- | --- | --- | --- | --- | --- |
| `environmentUrl` / `DT_APP_ENVIRONMENT_URL` | `dt-app` build, dev, and deploy | Local/CI tooling | `app.config.json`, CLI flag, or environment variable | Prefer the environment variable or CLI flag for public/CI use; bump app version when manifest metadata changes | Medium: tenant-specific deployment target, not a secret |
| `app.id` and `app.version` | AppEngine identity and release | Manifest | `app.config.json` | Stable ID; monotonically new version for each manifest change | High: changing the ID breaks installed-app continuity |
| `DT_APP_OAUTH_CLIENT_ID` | CI deployment | CI only | CI secret store | Rotate with the OAuth client | Low by itself |
| `DT_APP_OAUTH_CLIENT_SECRET` | CI deployment | CI only | CI secret store | Rotate periodically and after suspected exposure | High |
| `sla.directory` | AppEngine function | Server-side outbound host | Function source and environment allowlist | Review allowlist ownership and upstream availability | Medium: external dependency |
| `providerSlug` | DQL-derived attribution and directory function | Shared app state | User input | State expires within 90 days | Low, but controls external lookup |
| `providerLabelKey` | Provider tag parsing | Shared app state | User input | State expires within 90 days | Low, affects attribution |
| `lookbackHours` | DQL query construction | Shared app state | Controlled select input | State expires within 90 days | Low |
| `sla.user.v1` | Theme and walkthrough state | User app state/local fallback | App constants | State expires within 90 days | Low |
| `sla.workspace.v1` | Provider and watch configuration | Shared app state/local fallback | App constants | State expires within 90 days | Medium: shared operator context |
| `COMMUNITY_PROFILE.availability` | Community support destination | Bundled UI configuration | `ui/app/data/externalLinks.ts` | Keep `coming-soon` until public launch approval; change to `live` only with an approved support destination | Medium: controls whether users can leave the app for support |

## Secret handling

No API token, OAuth secret, password, credential-vault ID, or private endpoint is bundled in the UI or function source. The `sla.directory` endpoint is a public API and does not require a credential in this release. If a future provider requires authentication, use Dynatrace Credential Vault from an AppEngine function. Never add the credential to `app.config.json`, app state, a dashboard, or a notebook.

## Pre-go-live checklist

- Confirm CI secrets are configured outside the repository.
- Confirm `.env`, token files, Playwright auth state, coverage output, and deployment artifacts are ignored.
- Confirm the target environment allowlists only `sla.directory`, not unrestricted outbound access.
- Confirm app-state records expire and that operators know the browser fallback is not shared.
- Confirm app-state fields do not contain PII or secrets beyond the configured provider and tag convention.
- Confirm the Community profile and support process are ready before changing `COMMUNITY_PROFILE.availability` to `live`.

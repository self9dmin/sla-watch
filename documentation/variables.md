# Variables, configuration, and secrets

## Configuration inventory

| Name | Used by | Scope | Source | Rotation or retention | Risk |
| --- | --- | --- | --- | --- | --- |
| `environmentUrl` / `DT_APP_ENVIRONMENT_URL` | `dt-app` build, dev, and deploy | Local/CI tooling | `app.config.json`, CLI flag, or environment variable | Prefer the environment variable or CLI flag for public/CI use; bump app version when manifest metadata changes | Medium: tenant-specific deployment target, not a secret |
| `app.id` and `app.version` | AppEngine identity and release | Manifest | `app.config.json` | Stable ID; monotonically new version for each manifest change | High: changing the ID breaks installed-app continuity |
| `DT_APP_OAUTH_CLIENT_ID` | CI deployment | CI only | CI secret store | Rotate with the OAuth client | Low by itself |
| `DT_APP_OAUTH_CLIENT_SECRET` | CI deployment | CI only | CI secret store | Rotate periodically and after suspected exposure | High |
| `sla.directory` | AppEngine function | Server-side outbound host | Function source and environment allowlist | Review allowlist ownership and upstream availability | Medium: external dependency |
| `status.cloud.google.com` | Google Cloud public incident function | Server-side outbound host | Function source and environment allowlist | Review allowlist ownership and upstream availability | Medium: public external dependency |
| `oauth2.googleapis.com` | Google service-account exchange | Server-side outbound host | Fixed function constant and environment allowlist | Google-managed endpoint; no configurable token URL | High: authentication boundary |
| `servicehealth.googleapis.com` | Personalized Service Health | Server-side outbound host | Fixed function constant and environment allowlist | Google-managed endpoint | High: project-scoped provider evidence |
| `providerSlugs` | Monitored provider collection | Shared app state | User input and migration from the legacy single-provider value | State expires within 90 days | Low, but controls which provider records and evidence views are available |
| `providerSlug` | Active provider for the focused Monitor, Directory, Setup, and Incidents views | Shared app state | User input constrained to `providerSlugs` | State expires within 90 days | Low, but controls the current external lookup and attribution view |
| `providerLabelKey` | Provider tag parsing | Shared app state | User input | State expires within 90 days | Low, affects attribution |
| `lookbackHours` | DQL query construction | Shared app state | Controlled select input | State expires within 90 days | Low |
| `sla.user.v1` | Theme and walkthrough state | User app state/local fallback | App constants | State expires within 90 days | Low |
| `sla.workspace.v1` | Provider and watch configuration | Shared app state/local fallback | App constants | State expires within 90 days | Medium: shared operator context |
| `contract-overrides` | Tenant custom SLA terms and exact evidence targets | Environment-shared App Settings | Authorized user input | Persists until updated or removed; Settings keeps version history | High: changes which contract terms are applied during review |
| `provider-connections` | Provider, project ID, Credential Vault ID, and enabled state | Environment-shared App Settings | Authorized administrator input | Persists until updated or removed | High: selects which provider account is queried, but contains no secret value |
| `COMMUNITY_PROFILE.availability` | Community support destination | Bundled UI configuration | `ui/app/data/externalLinks.ts` | Keep `coming-soon` until public launch approval; change to `live` only with an approved support destination | Medium: controls whether users can leave the app for support |

## Secret handling

No API token, OAuth secret, password, credential-vault ID, or private endpoint is bundled in the UI or function source. The `sla.directory` and Google Cloud Status endpoints are public. Personalized Google Cloud access uses a customer-created service-account JSON key stored only as a Token credential in Dynatrace Credential Vault. App Settings stores the Credential Vault record ID, not its value. Never add provider credential contents to `app.config.json`, App Settings, app state, a dashboard, a notebook, a test fixture, or the repository.

## Pre-go-live checklist

- Confirm CI secrets are configured outside the repository.
- Confirm `.env`, token files, Playwright auth state, coverage output, and deployment artifacts are ignored.
- Confirm the target environment allowlists only `sla.directory` plus the three documented Google hosts when the Google adapter is used, not unrestricted outbound access.
- Confirm app-state records expire and that operators know the browser fallback is not shared.
- Confirm app-state fields do not contain PII or secrets beyond the configured provider and tag convention.
- Confirm custom SLA records contain only operational terms, exact target IDs, effective dates, and a concise source reference. Do not store private contract text, credentials, or personal data because all authenticated app users can read App Settings.
- Confirm App Settings read and write policies are separated and that a read-only responder cannot mutate `contract-overrides`.
- Confirm provider credentials use AppEngine scope, restrict app access to SLA Watch, grant only intended users access, and have no contextless access.
- Confirm removal instructions delete both the provider key and Credential Vault entry when a connection is retired. Removing connection metadata alone does not revoke the provider key.
- Confirm the Community profile and support process are ready before changing `COMMUNITY_PROFILE.availability` to `live`.

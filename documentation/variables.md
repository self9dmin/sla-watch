# Variables, configuration, and secrets

## Configuration inventory

| Name | Used by | Scope | Source | Rotation or retention | Risk |
| --- | --- | --- | --- | --- | --- |
| `environmentUrl` / `DT_APP_ENVIRONMENT_URL` | `dt-app` build, dev, and deploy | Local/CI tooling | `app.config.json`, CLI flag, or environment variable | Prefer the environment variable or CLI flag for public/CI use; bump app version when manifest metadata changes | Medium: tenant-specific deployment target, not a secret |
| `app.id` and `app.version` | AppEngine identity and release | Manifest | `app.config.json` | Stable ID; monotonically new version for each manifest change | High: changing the ID breaks installed-app continuity |
| `DT_APP_OAUTH_CLIENT_ID` | CI deployment | CI only | CI secret store | Rotate with the OAuth client | Low by itself |
| `DT_APP_OAUTH_CLIENT_SECRET` | CI deployment | CI only | CI secret store | Rotate periodically and after suspected exposure | High |
| `sla.directory` | AppEngine function | Server-side outbound host | Function source and environment allowlist | Review allowlist ownership and upstream availability | Medium: external dependency |
| `sts.us-east-1.amazonaws.com` | AWS account identity verification | Server-side outbound host | Fixed function constant and environment allowlist | AWS-managed endpoint; rotate the selected AWS credential separately | High: prevents a connection from reading the wrong AWS account |
| `health.us-east-1.amazonaws.com` | AWS Health account events | Server-side outbound host | Fixed function constant and environment allowlist | AWS-managed endpoint; review API plan and IAM access | High: account-specific provider evidence and request-signing boundary |
| `login.microsoftonline.com` | Azure client-credential exchange | Server-side outbound host | Fixed tenant-scoped URL and environment allowlist | Microsoft-managed endpoint; rotate client secrets before expiration | High: authentication boundary |
| `management.azure.com` | Azure Service Health subscription events | Server-side outbound host | Fixed function constant and environment allowlist | Microsoft-managed endpoint; review subscription role assignment | High: subscription-specific provider evidence |
| `status.cloud.google.com` | Google Cloud public incident function | Server-side outbound host | Function source and environment allowlist | Review allowlist ownership and upstream availability | Medium: public external dependency |
| `oauth2.googleapis.com` | Google service-account exchange | Server-side outbound host | Fixed function constant and environment allowlist | Google-managed endpoint; no configurable token URL | High: authentication boundary |
| `servicehealth.googleapis.com` | Personalized Service Health | Server-side outbound host | Fixed function constant and environment allowlist | Google-managed endpoint | High: project-scoped provider evidence |
| `status.openai.com` | OpenAI public incidents | Server-side outbound host | Fixed function allowlist | Review endpoint availability and response compatibility | Medium: aggregate public provider evidence |
| `status.claude.com` | Anthropic public incidents | Server-side outbound host | Fixed function allowlist | Review endpoint availability and response compatibility | Medium: aggregate public provider evidence |
| `status.elevenlabs.io` | ElevenLabs public incidents | Server-side outbound host | Fixed function allowlist | Review endpoint availability and response compatibility | Medium: aggregate public provider evidence |
| `ocistatus.oraclecloud.com` | OCI public regional component status | Server-side outbound host | Fixed function allowlist | Review endpoint availability and response compatibility | Medium: current public provider evidence |
| `announcements.<region>.oraclecloud.com` | OCI tenancy Announcements | Server-side outbound host | Validated commercial region and environment allowlist | Prefer the exact regional host; rotate the API key separately in OCI and Credential Vault | High: tenancy-specific provider evidence and request-signing boundary |
| `providerSlugs` | Monitored provider collection | Shared app state | User input and migration from the legacy single-provider value | State expires within 90 days | Low, but controls which provider records and evidence views are available |
| `providerSlug` | Active provider for the focused Overview, Setup, Incidents, Provider notices, and Directory views | Shared app state | User input constrained to `providerSlugs` | State expires within 90 days | Low, but controls the current external lookup and attribution view |
| `providerLabelKey` | Provider tag parsing | Shared app state | User input | State expires within 90 days | Low, affects attribution |
| `lookbackHours` | DQL query construction | Shared app state | Controlled select input | State expires within 90 days | Low |
| `sla.user.v1` | Theme and walkthrough state | User app state/local fallback | App constants | State expires within 90 days | Low |
| `sla.workspace.v1` | Provider and watch configuration | Shared app state/local fallback | App constants | State expires within 90 days | Medium: shared operator context |
| `contract-overrides` | Tenant custom terms and exact evidence targets | Environment-shared App Settings | Authorized user input | Persists until updated or removed; Settings keeps version history | High: changes which contract terms are applied during review |
| `provider-connections` | Provider, account, subscription, project, or tenancy scope; OCI region; Credential Vault ID; and enabled state | Environment-shared App Settings | Authorized administrator input | Persists until updated or removed | High: selects which provider scope is queried, but contains no secret value |
| `provider-scope-assignments` | Confirmed provider service for an exact Dynatrace service-to-runtime relationship | Environment-shared App Settings | Authorized operator confirmation in Setup | Persists until updated or removed; Settings keeps version history | High: controls which provider-service terms Incident review applies |
| `COMMUNITY_PROFILE.availability` | Community support destination | Bundled UI configuration | `ui/app/data/externalLinks.ts` | Keep `coming-soon` until public launch approval; change to `live` only with an approved support destination | Medium: controls whether users can leave the app for support |

## Secret handling

No API token, OAuth secret, password, private key, or private endpoint is bundled in the UI or function source. The `sla.directory`, Google Cloud Status, OCI Status, OpenAI Status, Anthropic Status, and ElevenLabs Status endpoints are public. AWS account access uses a dedicated signing credential, Azure subscription access uses a dedicated client credential, personalized Google Cloud access uses a dedicated service-account JSON key, and OCI tenancy access uses a dedicated API user's signing key. Each secret stays only in Dynatrace Credential Vault. App Settings stores the Credential Vault record ID and non-secret provider scope, not a credential value. Never add provider credential contents to `app.config.json`, App Settings, app state, a dashboard, a notebook, a test fixture, or the repository.

## Pre-go-live checklist

- Confirm CI secrets are configured outside the repository.
- Confirm `.env`, token files, Playwright auth state, coverage output, and deployment artifacts are ignored.
- Confirm the target environment allowlists only `sla.directory`; the fixed AWS, Azure, and Google hosts for enabled adapters; each exact OCI Announcements regional host; and the fixed public-status hosts. Do not use unrestricted outbound access.
- Confirm each AWS identity is restricted to the documented Health read actions and its configured account is verified with STS. Confirm the account has a supported AWS Health API plan.
- Confirm each Azure service principal has only the documented Resource Health event read action on the intended subscription and that its client secret has an owner and expiry process.
- Confirm each OCI API user has only summary announcement access, each private key is unencrypted and rotated according to tenant policy, and removing a connection also revokes the OCI key and deletes its Credential Vault record.
- Confirm app-state records expire and that operators know the browser fallback is not shared.
- Confirm app-state fields do not contain PII or secrets beyond the configured provider and tag convention.
- Confirm custom records contain only operational terms, exact target IDs, effective dates, and a concise source reference. Do not store private contract text, credentials, or personal data because all authenticated app users can read App Settings.
- Confirm App Settings read and write policies are separated and that a read-only responder cannot mutate `contract-overrides`.
- Confirm a read-only responder cannot create, update, or remove `provider-scope-assignments`, and that an unavailable mapping store is never presented as a confirmed match.
- Confirm provider credentials use AppEngine scope, restrict app access to SLA Review, grant only intended users access, and have no contextless access.
- Confirm removal instructions delete both the provider key and Credential Vault entry when a connection is retired. Removing connection metadata alone does not revoke the provider key.
- Confirm the Community profile and support process are ready before changing `COMMUNITY_PROFILE.availability` to `live`.

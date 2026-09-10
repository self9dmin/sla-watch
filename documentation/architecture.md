# Architecture

## Product boundary

SLA Watch is a read-mostly Dynatrace AppEngine application with three explicit configuration write paths: confirmed provider-tag changes, tenant-owned SLA overrides, and optional provider-connection metadata. It monitors a collection of provider contracts from `sla.directory` while one active provider controls each focused review. It compares those records with custom terms, the live service inventory, Smartscape topology, recent telemetry, and separately labeled provider notices. Its output is an evidence posture for human review, not an automated credit decision.

The application has no database of its own, no scheduled work, no webhook receiver, no email sender, and no embedded agent. There is no `cron.md`, `emails.md`, `seo.md`, or `automation.md` because those capabilities do not exist in this release.

## Stack and entry points

- React 18 and TypeScript UI under `ui/`.
- Dynatrace Strato components and design tokens for the UI.
- Dynatrace DQL through `@dynatrace-sdk/react-hooks` for services, Problems, logs, spans, service-request telemetry, and Smartscape relationships.
- Dynatrace Environment API custom-tag and effective-permission clients for the explicit service-tag workflow.
- Two AppEngine functions: `api/slaDirectory.function.ts` for public contract data and `api/gcpServiceHealth.function.ts` for read-only Google Cloud provider notices.
- App state services for user preferences and shared watch configuration.
- App Settings V2 for shared, versioned tenant SLA overrides and non-secret provider connection metadata.
- `dt-app` for build, analysis, local development, and deployment.

The browser entry point is `ui/main.tsx`. Application routing is in `ui/app/App.tsx`. The primary read path is:

```text
Dashboard -> useDql / useAppFunction -> Dynatrace Grail or sla.directory -> normalized records -> evidence state -> UI
```

The application has three write paths:

```text
Settings -> SlaPreferencesContext -> user/app state service
                                     \-> browser local fallback when state access is unavailable

Setup -> explicit service selection -> confirmation -> effective permission check
      -> Environment API custom-tag endpoint -> exact selected service entity IDs

Settings -> explicit SLA terms and evidence targets -> validation -> App Settings V2
         -> shared contract override using exact service, runtime, or location identifiers

Settings -> provider project and Credential Vault ID -> validation -> App Settings V2
         -> shared provider connection metadata, never the provider secret
```

## Authentication and trust boundaries

1. The Dynatrace AppShell establishes the signed-in user session.
2. DQL, app-state, and custom-tag calls run in the current user's permission context. The effective access is the intersection of the app-declared scopes and the user's IAM permissions.
3. The browser invokes `slaDirectory` through the AppEngine function endpoint. The function validates the vendor slug, calls only `https://sla.directory`, bounds the request to eight seconds, and validates the response shape before returning data.
4. The browser invokes `gcpServiceHealth` with a validated project ID and Credential Vault record ID. The function retrieves only an AppEngine-scoped Token credential, validates the service-account shape and fixed Google OAuth endpoint, exchanges a short-lived token, and calls only Google Service Health. If no connection is configured, or normal monitoring cannot use it, the function can return the public Google Cloud Status feed with an explicit public or fallback state.
5. External API responses are treated as untrusted data. React renders them as text, no HTML is injected, response text is bounded, and stable public Google product IDs are mapped only through an explicit table.
6. App state stores provider configuration and personal display preferences. App Settings stores custom SLA values, exact evidence target IDs, and provider connection metadata. The provider secret remains in Credential Vault and is never returned to the browser.
7. The release history is bundled with the application. The Community destination is launch-gated and does not expose an external link before public launch.
8. Provider tags are written only to service entity IDs selected in Setup. Existing tags are preserved. Services with a conflicting provider tag are excluded from the bulk selection and require manual review.

## Canonical sources of truth

- Tenant services and telemetry: Dynatrace Grail, queried at runtime.
- Provider contract and directory metadata: the selected `sla.directory` API response.
- Tenant-specific operational SLA terms: the `contract-overrides` App Settings schema.
- Provider connection metadata: the `provider-connections` App Settings schema. Provider secrets: Dynatrace Credential Vault.
- Google Cloud provider notices: Personalized Service Health for a configured project, or Google Cloud Status as a non-project-specific fallback.
- Service-to-runtime and location context: Smartscape on Grail, queried at runtime.
- Personal preferences and shared watch configuration: Dynatrace app-state services when available.
- Offline state: browser local storage only as an explicitly surfaced fallback.

The monitored-provider collection determines which contracts can be reviewed. The active provider only controls the focused Monitor, Directory, Setup, and Incidents views. Changing it does not remove another monitored provider, modify service tags, or change a provider connection.

The app does not alter or copy the public provider record. A tenant override is stored separately, remains traceable to its source reference, and takes precedence only inside its effective date and explicit evidence boundary.

## Known risks and assumptions

- Provider service identifiers are joined to Dynatrace entities only through an explicit SLA assignment made by an authorized user. Provider attribution candidates require an exact service entity ID connected by Smartscape to cloud-provider metadata. Names are display context and never create the join. A candidate still requires operator confirmation and remains a review aid, not proof of fault (`README.md`, `ui/app/components/ContractOverrideEditor.tsx`, `ui/app/data/providerAttribution.ts`).
- Smartscape topology identifies a service-to-runtime or location relationship, but does not prove that a provider caused an incident or publishes a host-level SLA. Incident review applies the most specific matching record and leaves equally specific ambiguity to the operator.
- Logs and spans are counted at the tenant level rather than joined to a selected service. This is intentionally described as environment signal presence and is not sufficient for provider attribution (`ui/app/data/queries.ts`).
- `sla.directory` is an external availability dependency. The UI reports unavailable or unknown states and never converts a failed request into a healthy result (`api/slaDirectory.function.ts`, `ui/app/pages/Dashboard.tsx`).
- Shared app-state writes are workspace-wide and scope-controlled. A user with write permission can change shared provider configuration (`documentation/permissions.md`).
- SLA override writes are environment-shared App Settings and do not inherit the 90-day app-state expiry. Users with schema write access can change or remove them, and all authenticated app users can read them.
- Applying a custom tag can affect other Dynatrace configurations that select entities by tag. Setup names those consumers before confirmation, requires exact service selection, and offers a last-action undo. Undo is a compensating action, not a transactional rollback, so concurrent edits still require operator review.
- AppEngine external-request allowlisting is environment configuration, not repository configuration. The target environment must retain `sla.directory` and explicitly allow the Google hosts used by any enabled provider connection.
- Personalized Service Health is provider evidence, not tenant impact evidence. An `IMPACTED` relevance value is reported as Google's project assessment and is not converted into a Dynatrace root-cause or credit decision.
- The current Google adapter supports one configured project. AWS and Azure require separate provider-specific authentication and event adapters and are not represented as implemented.
- The manifest's `environmentUrl` is a safe placeholder for public source, and `DT_APP_ENVIRONMENT_URL` or `--environment-url` selects a real deployment target. No tenant-specific auth state is part of the source release.

## Related documents

- [`flows.md`](flows.md)
- [`permissions.md`](permissions.md)
- [`variables.md`](variables.md)
- [`tests.md`](tests.md)
- [`acceptance.md`](acceptance.md)
- [`hub-readiness.md`](hub-readiness.md)
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- [`../SECURITY.md`](../SECURITY.md)
- [`../CHANGELOG.md`](../CHANGELOG.md)
- [`../LICENSE`](../LICENSE)

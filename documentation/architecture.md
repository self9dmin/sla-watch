# Architecture

## Product boundary

SLA Watch is a read-mostly Dynatrace AppEngine application with two explicit operational write paths: confirmed provider-tag changes and tenant-owned SLA overrides. It compares a selected provider contract from `sla.directory` with custom terms, the live service inventory, Smartscape topology, and recent telemetry visible to the current Dynatrace user. Its output is an evidence posture for human review, not an automated credit decision.

The application has no database of its own, no scheduled work, no webhook receiver, no email sender, and no embedded agent. There is no `cron.md`, `emails.md`, `seo.md`, or `automation.md` because those capabilities do not exist in this release.

## Stack and entry points

- React 18 and TypeScript UI under `ui/`.
- Dynatrace Strato components and design tokens for the UI.
- Dynatrace DQL through `@dynatrace-sdk/react-hooks` for services, Problems, logs, spans, service-request telemetry, and Smartscape relationships.
- Dynatrace Environment API custom-tag and effective-permission clients for the explicit service-tag workflow.
- One AppEngine function, `api/slaDirectory.function.ts`, for the external provider API.
- App state services for user preferences and shared watch configuration.
- App Settings V2 for shared, versioned tenant SLA overrides.
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
```

## Authentication and trust boundaries

1. The Dynatrace AppShell establishes the signed-in user session.
2. DQL, app-state, and custom-tag calls run in the current user's permission context. The effective access is the intersection of the app-declared scopes and the user's IAM permissions.
3. The browser invokes `slaDirectory` through the AppEngine function endpoint. The function validates the vendor slug, calls only `https://sla.directory`, bounds the request to eight seconds, and validates the response shape before returning data.
4. The external API response is treated as untrusted data. React renders it as text, and no HTML is injected into the DOM.
5. App state stores provider configuration and personal display preferences. App Settings stores custom SLA values, effective dates, source references, and exact evidence target IDs. All authenticated app users can read App Settings, so the UI warns against confidential contract text, credentials, and personal data.
6. The release history is bundled with the application. The Community destination is launch-gated and does not expose an external link before public launch. App state and App Settings do not store credentials or Dynatrace tokens.
7. Provider tags are written only to service entity IDs selected in Setup. Existing tags are preserved. Services with a conflicting provider tag are excluded from the bulk selection and require manual review.

## Canonical sources of truth

- Tenant services and telemetry: Dynatrace Grail, queried at runtime.
- Provider contract and directory metadata: the selected `sla.directory` API response.
- Tenant-specific operational SLA terms: the `contract-overrides` App Settings schema.
- Service-to-runtime and location context: Smartscape on Grail, queried at runtime.
- Personal preferences and shared watch configuration: Dynatrace app-state services when available.
- Offline state: browser local storage only as an explicitly surfaced fallback.

The app does not alter or copy the public provider record. A tenant override is stored separately, remains traceable to its source reference, and takes precedence only inside its effective date and explicit evidence boundary.

## Known risks and assumptions

- Provider service identifiers are joined to Dynatrace entities only through an explicit SLA assignment made by an authorized user. Names are display context and never create the join. This remains a review aid, not proof of fault (`README.md`, `ui/app/components/ContractOverrideEditor.tsx`).
- Smartscape topology identifies a service-to-runtime or location relationship, but does not prove that a provider caused an incident or publishes a host-level SLA. Incident review applies the most specific matching record and leaves equally specific ambiguity to the operator.
- Logs and spans are counted at the tenant level rather than joined to a selected service. This is intentionally described as environment signal presence and is not sufficient for provider attribution (`ui/app/data/queries.ts`).
- `sla.directory` is an external availability dependency. The UI reports unavailable or unknown states and never converts a failed request into a healthy result (`api/slaDirectory.function.ts`, `ui/app/pages/Dashboard.tsx`).
- Shared app-state writes are workspace-wide and scope-controlled. A user with write permission can change shared provider configuration (`documentation/permissions.md`).
- SLA override writes are environment-shared App Settings and do not inherit the 90-day app-state expiry. Users with schema write access can change or remove them, and all authenticated app users can read them.
- Applying a custom tag can affect other Dynatrace configurations that select entities by tag. Setup names those consumers before confirmation, requires exact service selection, and offers a last-action undo. Undo is a compensating action, not a transactional rollback, so concurrent edits still require operator review.
- AppEngine external-request allowlisting is environment configuration, not repository configuration. The target environment must retain `sla.directory` in its allowlist.
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

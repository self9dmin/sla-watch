# Architecture

## Product boundary

SLA Watch is a read-mostly Dynatrace AppEngine application. It compares a selected provider contract from `sla.directory` with the live service inventory and recent telemetry visible to the current Dynatrace user. Its output is an evidence posture for human review, not an automated credit decision.

The application has no database of its own, no scheduled work, no webhook receiver, no email sender, and no embedded agent. There is no `cron.md`, `emails.md`, `seo.md`, or `automation.md` because those capabilities do not exist in this release.

## Stack and entry points

- React 18 and TypeScript UI under `ui/`.
- Dynatrace Strato components and design tokens for the UI.
- Dynatrace DQL through `@dynatrace-sdk/react-hooks` for services, Problems, logs, spans, and service-request telemetry.
- One AppEngine function, `api/slaDirectory.function.ts`, for the external provider API.
- App state services for user preferences and shared watch configuration.
- `dt-app` for build, analysis, local development, and deployment.

The browser entry point is `ui/main.tsx`. Application routing is in `ui/app/App.tsx`. The primary read path is:

```text
Dashboard -> useDql / useAppFunction -> Dynatrace Grail or sla.directory -> normalized records -> evidence state -> UI
```

The write path is limited to app state:

```text
Settings -> SlaPreferencesContext -> user/app state service
                                     \-> browser local fallback when state access is unavailable
```

## Authentication and trust boundaries

1. The Dynatrace AppShell establishes the signed-in user session.
2. DQL and app-state calls run in the current user's permission context. The effective access is the intersection of the app-declared scopes and the user's IAM permissions.
3. The browser invokes `slaDirectory` through the AppEngine function endpoint. The function validates the vendor slug, calls only `https://sla.directory`, bounds the request to eight seconds, and validates the response shape before returning data.
4. The external API response is treated as untrusted data. React renders it as text, and no HTML is injected into the DOM.
5. App state stores provider configuration and personal display preferences. The release history is bundled with the application, and the community link opens an external Dynatrace page. App state does not store credentials or Dynatrace tokens.

## Canonical sources of truth

- Tenant services and telemetry: Dynatrace Grail, queried at runtime.
- Provider contract and directory metadata: the selected `sla.directory` API response.
- Personal preferences and shared watch configuration: Dynatrace app-state services when available.
- Offline state: browser local storage only as an explicitly surfaced fallback.

The app does not copy provider contracts into a local database or silently cache a successful result as current truth.

## Known risks and assumptions

- Provider service identifiers are not yet joined automatically to Dynatrace service entity IDs. The current provider boundary is label-based and must remain a review aid, not proof of fault (`README.md`, `ui/app/pages/Dashboard.tsx`).
- Logs and spans are counted at the tenant level rather than joined to a selected service. This is intentionally described as environment signal presence and is not sufficient for provider attribution (`ui/app/data/queries.ts`).
- `sla.directory` is an external availability dependency. The UI reports unavailable or unknown states and never converts a failed request into a healthy result (`api/slaDirectory.function.ts`, `ui/app/pages/Dashboard.tsx`).
- Shared app-state writes are workspace-wide and scope-controlled. A user with write permission can change shared provider configuration (`documentation/permissions.md`).
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

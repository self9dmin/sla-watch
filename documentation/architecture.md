# Architecture

## Product boundary

SLA Review is a read-mostly Dynatrace AppEngine application with five explicit shared tenant write paths: operator-confirmed coverage mappings, tenant-owned custom terms, optional provider-connection metadata, human evidence decisions, and explicitly confirmed Dynatrace objectives. It monitors a collection of provider contracts from `sla.directory` while one active provider controls each focused review. It compares those records with custom terms, the live service inventory, Smartscape topology, recent telemetry, and separately labeled provider reports. Its output is an evidence posture for human review, not an automated credit decision.

The application has no database of its own, no scheduled work, no webhook receiver, no email sender, and no embedded agent. There is no `cron.md`, `emails.md`, `seo.md`, or `automation.md` because those capabilities do not exist in this release.

## Stack and entry points

- React 18 and TypeScript UI under `ui/`.
- Dynatrace Strato components and design tokens for the UI.
- Dynatrace DQL through `@dynatrace-sdk/react-hooks` for Smartscape service inventory and relationships, Problems, logs, spans, and service-request telemetry.
- Dynatrace Service-Level Objectives SDK for permission-aware discovery, bounded evaluation, and explicit creation of app-managed customer objectives.
- Six AppEngine functions: `api/slaDirectory.function.ts` for public contract data; `api/awsHealth.function.ts`, `api/azureServiceHealth.function.ts`, `api/gcpServiceHealth.function.ts`, and `api/ociAnnouncements.function.ts` for customer-scoped provider notices; and `api/providerPublicStatus.function.ts` for credential-free public OCI, OpenAI, Anthropic, and ElevenLabs status.
- App state services for user preferences and shared provider review configuration.
- App Settings V2 for shared, versioned tenant custom terms, confirmed provider-service scope mappings, human evidence decisions, and non-secret provider connection metadata.
- `dt-app` for build, analysis, local development, and deployment.

The browser entry point is `ui/main.tsx`. Application routing is in `ui/app/App.tsx`. The primary read path is:

```text
Dashboard -> useDql / useAppFunction -> Dynatrace Grail or sla.directory -> normalized records -> evidence state -> UI
```

The application has six write paths, including personal and shared preferences:

```text
Settings -> SlaPreferencesContext -> user/app state service
                                     \-> browser local fallback when state access is unavailable

Coverage -> Smartscape service-to-runtime scope -> fixed provider-native service match
         -> observed provider-service mapping reused by Incidents and Evidence without a per-service write

Coverage -> ambiguous or manually selected scope -> operator confirmation
         -> App Settings V2 -> exact service and runtime override reused by Incidents and Evidence

Coverage -> service without runtime context -> operator confirmation
         -> App Settings V2 -> exact service mapping reused by Incidents and Evidence

Coverage -> covered service -> scoped Grail availability preview -> explicit confirmation
         -> Service-Level Objectives API -> one customer objective per provider and service

Evidence -> Problem, exact service telemetry, objectives, terms, exclusions, and optional provider report
         -> evidence checklist plus SRE acknowledgement
         -> App Settings V2 -> package-ready, not-ready, or not-provider-related follow-up state

Settings -> explicit custom terms and evidence targets -> validation -> App Settings V2
         -> shared contract override using exact service, runtime, or location identifiers

Settings -> provider account scope and Credential Vault ID -> successful connection test -> App Settings V2
         -> shared provider connection metadata, never the provider secret
```

## Authentication and trust boundaries

1. The Dynatrace AppShell establishes the signed-in user session.
2. DQL, app-state, and App Settings calls run in the current user's permission context. The effective access is the intersection of the app-declared scopes and the user's IAM permissions.
3. The browser invokes `slaDirectory` through the AppEngine function endpoint. The function validates the vendor slug, calls only `https://sla.directory`, bounds the request to eight seconds, and validates the response shape before returning data.
4. The browser invokes `awsHealth` with a validated 12-digit account ID and Credential Vault record ID. The function verifies the credential's account with AWS STS, signs fixed AWS Health requests with Signature Version 4, filters out non-account-specific events, and retrieves bounded event details and affected entities from the fixed US East endpoint. The UI correlates an affected entity only to an exact Smartscape runtime identifier with compatible account and location context.
5. The browser invokes `azureServiceHealth` with a validated subscription ID and Credential Vault record ID. The function validates the vaulted client-credential shape, obtains a short-lived Microsoft Entra token from a fixed tenant endpoint, and reads only Resource Health events for the selected subscription through Azure Resource Manager.
6. The browser invokes `gcpServiceHealth` with a validated project ID and Credential Vault record ID. The function retrieves only an AppEngine-scoped Token credential, validates the service-account shape and fixed Google OAuth endpoint, exchanges a short-lived token, and calls only Google Service Health. If no connection is configured, or normal monitoring cannot use it, the function can return the public Google Cloud Status feed with an explicit public or fallback state.
7. The browser invokes `ociAnnouncements` with a validated commercial OCI region, tenancy OCID, and Credential Vault record ID. The function accepts only an AppEngine-scoped Token credential with a user OCID, API-key fingerprint, and unencrypted RSA private key. It signs a GET request to `announcements.<region>.oraclecloud.com` and never accepts an arbitrary endpoint. A selected OCI tenancy connection fails visibly rather than silently falling back to public status.
8. The browser invokes `providerPublicStatus` only for a fixed provider and endpoint allowlist. The function sends no credential or authorization header, bounds response text and result counts, and labels every returned record as public and non-customer-specific.
9. External API responses are treated as untrusted data. React renders them as text, no HTML is injected, response text is bounded, and provider product identifiers are mapped only through explicit tables. Ambiguous products remain unmapped.
10. App state stores provider configuration and personal display preferences. App Settings stores custom terms, confirmed scope mappings, exact evidence target IDs, bounded human evidence decisions, and non-secret provider connection metadata. Provider secrets remain in Credential Vault and are never returned to the browser.
11. The release history is bundled with the application. The Community destination is launch-gated and does not expose an external link before public launch.
12. Existing provider tags are read only as optional source evidence. The app stores confirmed coverage in App Settings and never writes or removes entity tags.
13. Objective discovery, evaluation, and creation run in the current user's permission context. Coverage performs an exact provider-and-service lookup plus a bounded Grail preview. Performance pages app-managed objectives by provider and evaluates only the visible page with bounded concurrency. Creation uses a deterministic external ID and requires an explicit second action, so repeated visits do not create duplicate objectives.

## Canonical sources of truth

- Tenant services, topology, Problems, and telemetry: Dynatrace Grail and Smartscape, queried at runtime.
- Provider contract and directory metadata: the selected `sla.directory` API response.
- Tenant-specific operational terms: the `contract-overrides` App Settings schema.
- Observed provider-service mappings: fixed provider-specific recognition of native Smartscape runtime types at query time. This state is read-only and is not persisted per service.
- Operator provider-service overrides: the `provider-scope-assignments` App Settings schema. An exact saved service or runtime mapping takes precedence over observed topology.
- Human evidence decisions: the `evidence-decisions` App Settings schema. A package-ready, not-ready, or not-provider-related record captures an SRE review outcome and the acknowledged provider-evidence checklist, not provider fault, credit eligibility, or claim submission. It remains current only while the mapping basis, affected entities, and provider-service scope still match.
- Provider connection metadata: the `provider-connections` App Settings schema. Provider secrets: Dynatrace Credential Vault.
- AWS provider notices: account-specific AWS Health events and bounded affected-resource identifiers after STS account verification. There is no credential-free AWS source in this release.
- Azure provider notices: subscription-specific Azure Service Health events. There is no credential-free Azure source in this release.
- Google Cloud provider notices: Personalized Service Health for one of the configured projects, or Google Cloud Status as a non-project-specific fallback.
- OCI provider notices: tenancy-specific Announcements when an administrator selects a saved connection, or the fixed public regional status endpoint as an explicitly non-customer-specific source.
- OpenAI, Anthropic, and ElevenLabs provider notices: fixed public status endpoints, always labeled non-customer-specific.
- Service-to-provider-resource, runtime, dependency, and location context: Smartscape on Grail, queried through bounded recent relationships at runtime.
- Customer objective definitions: native Dynatrace Service-Level Objectives. SLA Review owns only records tagged `managed-by:sla-review`; their SLI remains customer-observed service telemetry, not provider status. Performance filters these records by provider, retrieves eight per page, and evaluates only those visible records.
- Personal preferences and shared provider review configuration: Dynatrace app-state services when available.
- Offline state: browser local storage only as an explicitly surfaced fallback.

The active-provider collection is derived at runtime from bounded global Smartscape cloud inventory, provider-native service topology, cloud dimensions, source-owned provider tags, saved scope mappings, and enabled incident connections. Global inventory proves only that a provider is represented in the environment; it does not assign unrelated services to that provider. There is no separate manual provider list. The active provider controls Coverage, Performance, Incidents, Evidence, and Directory inside the shared operating shell. Coverage is the landing workspace and adapts to the strongest evidence Dynatrace returned. Detected topology opens first when provider infrastructure exists without a verified service relationship; it exposes bounded account or subscription scope, compute, monitored-host, and node-type aggregates while retaining the raw Smartscape type names. Service links opens first when confirmed or unique provider-native service relationships exist. Its bounded wildcard relationship scan preserves direct provider dependencies such as a service calling a managed database, while generic host and cluster anchors require structural relationships. Its All view groups every loaded environment service as covered, needing review, or not linked to the selected provider, and the selected provider's verified link count remains separate from the number of services evaluated. Performance is a read-only portfolio of app-managed customer objectives for that provider. Incidents reuses the canonical Evidence candidate rules, then builds a bounded list of potential provider-impact review cases. A case can contain several Problems only when they resolve to one provider service and one effective contract scope, occur within one bounded review window, and share either an affected service or an exact Dynatrace root cause. Native Davis impact level and affected-user count can prioritize otherwise equivalent cases, but their absence remains explicit. It shows only the context needed to choose Coverage, Evidence, an audited bulk triage decision, or the native Problems app. Evidence receives the same case through a shared state resolver and presents a searchable, filterable, paginated review queue. Its detail view evaluates coverage, customer impact, terms, optional provider corroboration, and required items; separates automatically collected, externally confirmed, and missing facts; and can copy a concise handoff or download a versioned JSON review artifact. Saved outcomes remain one guarded decision per underlying Problem and resolve consistently as Needs review, Needs evidence, Ready for follow-up, Excluded, Mixed review, or unavailable across Incidents and Evidence. Artifacts do not mutate state or submit anything. Changing the active provider does not remove another provider, modify entity metadata, or change a provider connection.

Directory is the normalized presentation of the complete supported `sla.directory` provider response. It keeps published terms, credit policy, claim requirements, exclusions, service-specific coverage, support plans, support-response status, and record provenance visibly separate from tenant-owned overrides. The parser rejects malformed nested support and tier records before they reach this surface.

The app does not alter or copy the public provider record. A tenant override is stored separately, remains traceable to its source reference, and takes precedence only inside its effective date and explicit evidence boundary.

## Known risks and assumptions

- Provider service identifiers are joined to Dynatrace entities through an exact operator-confirmed Coverage mapping or one unique provider-native Smartscape runtime match. Custom terms do not create provider mappings, and Incidents does not permit one-off mapping edits. Hostname-only and conflicting matches stay unresolved until reviewed. Names are display context and never create the join. Every mapping selects context only and remains evidence for human review, not proof of fault (`README.md`, `ui/app/components/CoverageWorkspace.tsx`, `ui/app/data/providerScopeAssignments.ts`).
- AWS affected entities are correlated only when a returned resource identifier exactly matches a Smartscape runtime identifier and any available account and region context is compatible. Account or region overlap without an identifier match is shown as uncorrelated provider evidence, not local impact.
- Smartscape topology identifies a service-to-runtime or location relationship, but does not prove that a provider caused an incident or publishes a host-level SLA. Incident review applies the most specific matching record and leaves equally specific ambiguity to the operator.
- Global Smartscape service and preferred-anchor queries are intentionally bounded. Relationship discovery uses the most recent seven days and accepts direct provider-owned targets while allowing only structural host or Kubernetes anchors. Separate aggregate counts detect truncation, the UI refuses to claim complete coverage when a count cannot be verified, and recent Problem service IDs trigger sanitized incident-scoped topology, service, request, and failure queries. Processes and containers remain supporting incident evidence rather than primary Coverage rows.
- Objective creation is service-scoped, not host- or process-scoped. One deterministic provider and service identity prevents an environment with thousands of runtimes from producing thousands of objectives. The objective measures the full Dynatrace service and must not be used as proof that one provider caused a failure.
- Incidents is deliberately not a second Problems app. It pages 16 compact review cases and exposes every included Problem inside the selected case. Grouping is deterministic and conservative: one provider service, one effective terms signature, no host or location override ambiguity, a maximum 45-minute gap, a maximum six-hour case span, and either a shared affected service or exact returned root cause. Same-provider records without this evidence remain separate. Manual multi-select permits eligible closed cases, including confirmed candidates without a returned root cause, while keeping that missing evidence visible through a second confirmation. Active Problems, selected-provider root links, incomplete context, and prior decisions remain ineligible. An incident-scoped topology overflow or a truncated settings read disables bulk mutation instead of treating missing data as absence. Full causal graphs, logs, traces, filters, and remediation stay in the native Problems app.
- Logs and spans are counted at the tenant level rather than joined to a selected service. This is intentionally described as environment signal presence and is not sufficient for provider attribution (`ui/app/data/queries.ts`).
- `sla.directory` is an external availability dependency. The UI reports unavailable or unknown states and never converts a failed request into a healthy result (`api/slaDirectory.function.ts`, `ui/app/pages/Dashboard.tsx`).
- Shared app-state writes are workspace-wide and scope-controlled. A user with write permission can change shared provider configuration (`documentation/permissions.md`).
- Custom-term writes are environment-shared App Settings and do not inherit the 90-day app-state expiry. Users with schema write access can change or remove them, and all authenticated app users can read them.
- Service-scoped coverage is app-owned configuration. It does not update source metadata for other Dynatrace features. Teams that need a reusable platform-wide tag must manage it at the telemetry source or through an independently governed Dynatrace configuration.
- Evidence decisions are shared App Settings records readable by authenticated app users. A case-level Evidence action and bulk triage still write one record per Problem, never one opaque aggregate decision, and report partial failures. New records snapshot the root-cause entity and are invalidated when the Problem state, root-cause identity, affected entities, mapping basis, or provider-service scope changes. Notes must remain concise and operational. They must not contain credentials, confidential contract text, personal data, or an assertion that the provider accepted liability or approved a credit.
- AppEngine external-request allowlisting is environment configuration, not repository configuration. The target environment must retain `sla.directory`, the fixed AWS and Azure hosts, the Google hosts used by any enabled provider connection, each configured OCI Announcements regional host, and the four fixed public-status hosts documented in `variables.md`.
- Personalized Service Health is provider evidence, not tenant impact evidence. An `IMPACTED` relevance value is reported as Google's project assessment and is not converted into a Dynatrace root-cause or credit decision.
- The current account-specific adapters support multiple AWS accounts, Azure subscriptions, Google Cloud projects, and commercial OCI tenancies. Non-commercial OCI realms and other provider account APIs require separate reviewed authentication and event adapters and are not represented as implemented.
- The manifest's `environmentUrl` is a safe placeholder for public source, and `DT_APP_ENVIRONMENT_URL` or `--environment-url` selects a real deployment target. No tenant-specific auth state is part of the source release.

## Related documents

- [`dynatrace-sources.md`](dynatrace-sources.md)
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

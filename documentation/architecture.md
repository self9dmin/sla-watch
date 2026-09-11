# Architecture

## Product boundary

SLA Review is a read-mostly Dynatrace AppEngine application with four explicit shared tenant write paths: operator-confirmed coverage mappings, tenant-owned custom terms, optional provider-connection metadata, and human evidence decisions. It monitors a collection of provider contracts from `sla.directory` while one active provider controls each focused review. It compares those records with custom terms, the live service inventory, Smartscape topology, recent telemetry, and separately labeled provider reports. Its output is an evidence posture for human review, not an automated credit decision.

The application has no database of its own, no scheduled work, no webhook receiver, no email sender, and no embedded agent. There is no `cron.md`, `emails.md`, `seo.md`, or `automation.md` because those capabilities do not exist in this release.

## Stack and entry points

- React 18 and TypeScript UI under `ui/`.
- Dynatrace Strato components and design tokens for the UI.
- Dynatrace DQL through `@dynatrace-sdk/react-hooks` for services, Problems, logs, spans, service-request telemetry, and Smartscape relationships.
- Six AppEngine functions: `api/slaDirectory.function.ts` for public contract data; `api/awsHealth.function.ts`, `api/azureServiceHealth.function.ts`, `api/gcpServiceHealth.function.ts`, and `api/ociAnnouncements.function.ts` for customer-scoped provider notices; and `api/providerPublicStatus.function.ts` for credential-free public OCI, OpenAI, Anthropic, and ElevenLabs status.
- App state services for user preferences and shared provider review configuration.
- App Settings V2 for shared, versioned tenant custom terms, confirmed provider-service scope mappings, human evidence decisions, and non-secret provider connection metadata.
- `dt-app` for build, analysis, local development, and deployment.

The browser entry point is `ui/main.tsx`. Application routing is in `ui/app/App.tsx`. The primary read path is:

```text
Dashboard -> useDql / useAppFunction -> Dynatrace Grail or sla.directory -> normalized records -> evidence state -> UI
```

The application has five write paths, including personal and shared preferences:

```text
Settings -> SlaPreferencesContext -> user/app state service
                                     \-> browser local fallback when state access is unavailable

Coverage -> Smartscape service-to-runtime scope -> provider-service suggestion -> operator confirmation
         -> App Settings V2 -> exact service and runtime mapping reused by Incidents and Evidence

Coverage -> service outside the Scope map -> operator confirmation
         -> App Settings V2 -> exact service mapping reused by Incidents and Evidence

Evidence -> Problem plus provider boundary -> SRE acknowledgement -> validate or dismiss
         -> App Settings V2 -> bounded operational decision for follow-up

Settings -> explicit custom terms and evidence targets -> validation -> App Settings V2
         -> shared contract override using exact service, runtime, or location identifiers

Settings -> provider account scope and Credential Vault ID -> successful connection test -> App Settings V2
         -> shared provider connection metadata, never the provider secret
```

## Authentication and trust boundaries

1. The Dynatrace AppShell establishes the signed-in user session.
2. DQL, app-state, and App Settings calls run in the current user's permission context. The effective access is the intersection of the app-declared scopes and the user's IAM permissions.
3. The browser invokes `slaDirectory` through the AppEngine function endpoint. The function validates the vendor slug, calls only `https://sla.directory`, bounds the request to eight seconds, and validates the response shape before returning data.
4. The browser invokes `awsHealth` with a validated 12-digit account ID and Credential Vault record ID. The function verifies the credential's account with AWS STS, signs fixed AWS Health requests with Signature Version 4, filters out non-account-specific events, and calls only the fixed US East endpoints required by AWS Health.
5. The browser invokes `azureServiceHealth` with a validated subscription ID and Credential Vault record ID. The function validates the vaulted client-credential shape, obtains a short-lived Microsoft Entra token from a fixed tenant endpoint, and reads only Resource Health events for the selected subscription through Azure Resource Manager.
6. The browser invokes `gcpServiceHealth` with a validated project ID and Credential Vault record ID. The function retrieves only an AppEngine-scoped Token credential, validates the service-account shape and fixed Google OAuth endpoint, exchanges a short-lived token, and calls only Google Service Health. If no connection is configured, or normal monitoring cannot use it, the function can return the public Google Cloud Status feed with an explicit public or fallback state.
7. The browser invokes `ociAnnouncements` with a validated commercial OCI region, tenancy OCID, and Credential Vault record ID. The function accepts only an AppEngine-scoped Token credential with a user OCID, API-key fingerprint, and unencrypted RSA private key. It signs a GET request to `announcements.<region>.oraclecloud.com` and never accepts an arbitrary endpoint. A selected OCI tenancy connection fails visibly rather than silently falling back to public status.
8. The browser invokes `providerPublicStatus` only for a fixed provider and endpoint allowlist. The function sends no credential or authorization header, bounds response text and result counts, and labels every returned record as public and non-customer-specific.
9. External API responses are treated as untrusted data. React renders them as text, no HTML is injected, response text is bounded, and provider product identifiers are mapped only through explicit tables. Ambiguous products remain unmapped.
10. App state stores provider configuration and personal display preferences. App Settings stores custom terms, confirmed scope mappings, exact evidence target IDs, bounded human evidence decisions, and non-secret provider connection metadata. Provider secrets remain in Credential Vault and are never returned to the browser.
11. The release history is bundled with the application. The Community destination is launch-gated and does not expose an external link before public launch.
12. Existing provider tags are read only as optional source evidence. The app stores confirmed coverage in App Settings and never writes or removes entity tags.

## Canonical sources of truth

- Tenant services and telemetry: Dynatrace Grail, queried at runtime.
- Provider contract and directory metadata: the selected `sla.directory` API response.
- Tenant-specific operational terms: the `contract-overrides` App Settings schema.
- Confirmed provider-service mappings: the `provider-scope-assignments` App Settings schema. Smartscape supplies candidate evidence, and an operator supplies the confirmation.
- Human evidence decisions: the `evidence-decisions` App Settings schema. A validated or dismissed record captures an SRE review outcome for follow-up, not provider fault or credit eligibility. It remains current only while the mapping basis, affected entities, and provider-service scope still match.
- Provider connection metadata: the `provider-connections` App Settings schema. Provider secrets: Dynatrace Credential Vault.
- AWS provider notices: account-specific AWS Health events after STS account verification. There is no credential-free AWS source in this release.
- Azure provider notices: subscription-specific Azure Service Health events. There is no credential-free Azure source in this release.
- Google Cloud provider notices: Personalized Service Health for one of the configured projects, or Google Cloud Status as a non-project-specific fallback.
- OCI provider notices: tenancy-specific Announcements when an administrator selects a saved connection, or the fixed public regional status endpoint as an explicitly non-customer-specific source.
- OpenAI, Anthropic, and ElevenLabs provider notices: fixed public status endpoints, always labeled non-customer-specific.
- Service-to-runtime and location context: Smartscape on Grail, queried at runtime.
- Personal preferences and shared provider review configuration: Dynatrace app-state services when available.
- Offline state: browser local storage only as an explicitly surfaced fallback.

The monitored-provider collection determines which contracts can be reviewed. The active provider controls Coverage, Incidents, Evidence, and Directory inside the shared operating shell. Coverage is the landing workspace, with Scope map first and Manual coverage second. Evidence contains both Dynatrace-derived review candidates and separately labeled provider reports. Changing the active provider does not remove another monitored provider, modify entity metadata, or change a provider connection.

Directory is the normalized presentation of the complete supported `sla.directory` provider response. It keeps published terms, credit policy, claim requirements, exclusions, service-specific coverage, support plans, support-response status, and record provenance visibly separate from tenant-owned overrides. The parser rejects malformed nested support and tier records before they reach this surface.

The app does not alter or copy the public provider record. A tenant override is stored separately, remains traceable to its source reference, and takes precedence only inside its effective date and explicit evidence boundary.

## Known risks and assumptions

- Provider service identifiers are joined to Dynatrace entities through either an explicit terms assignment or a provider-service scope mapping confirmed in Coverage. Candidates require an exact service entity ID connected by Smartscape to cloud-provider metadata. Names are display context and never create the join. A candidate still requires operator confirmation and remains a review aid, not proof of fault (`README.md`, `ui/app/components/ProviderScopeMap.tsx`, `ui/app/data/providerScopeAssignments.ts`).
- Smartscape topology identifies a service-to-runtime or location relationship, but does not prove that a provider caused an incident or publishes a host-level SLA. Incident review applies the most specific matching record and leaves equally specific ambiguity to the operator.
- Logs and spans are counted at the tenant level rather than joined to a selected service. This is intentionally described as environment signal presence and is not sufficient for provider attribution (`ui/app/data/queries.ts`).
- `sla.directory` is an external availability dependency. The UI reports unavailable or unknown states and never converts a failed request into a healthy result (`api/slaDirectory.function.ts`, `ui/app/pages/Dashboard.tsx`).
- Shared app-state writes are workspace-wide and scope-controlled. A user with write permission can change shared provider configuration (`documentation/permissions.md`).
- Custom-term writes are environment-shared App Settings and do not inherit the 90-day app-state expiry. Users with schema write access can change or remove them, and all authenticated app users can read them.
- Manual coverage is app-owned configuration. It does not update source metadata for other Dynatrace features. Teams that need a reusable platform-wide tag must manage it at the telemetry source or through an independently governed Dynatrace configuration.
- Evidence decisions are shared App Settings records readable by authenticated app users. Notes must remain concise and operational. They must not contain credentials, confidential contract text, personal data, or an assertion that the provider accepted liability or approved a credit.
- AppEngine external-request allowlisting is environment configuration, not repository configuration. The target environment must retain `sla.directory`, the fixed AWS and Azure hosts, the Google hosts used by any enabled provider connection, each configured OCI Announcements regional host, and the four fixed public-status hosts documented in `variables.md`.
- Personalized Service Health is provider evidence, not tenant impact evidence. An `IMPACTED` relevance value is reported as Google's project assessment and is not converted into a Dynatrace root-cause or credit decision.
- The current account-specific adapters support multiple AWS accounts, Azure subscriptions, Google Cloud projects, and commercial OCI tenancies. Non-commercial OCI realms and other provider account APIs require separate reviewed authentication and event adapters and are not represented as implemented.
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

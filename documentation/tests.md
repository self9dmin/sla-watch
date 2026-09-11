# Test coverage map

This document separates executable coverage from manual or proposed coverage. Passing local tests does not prove that tenant permissions, external allowlists, or the deployed Hub artifact are correct.

## Existing coverage

| Use case | Rule | Expected behavior, including negative case | Evidence | Status |
| --- | --- | --- | --- | --- |
| Provider setup advice | Missing provider tags must not become provider proof | A service inventory with no provider tag produces a high-priority setup recommendation and no outage claim | `tests/recommendations.test.ts` | Existing unit test |
| Provider setup advice | A wrong tag must be distinguished from a missing tag | Existing tags that do not match the selected contract produce a mapping recommendation | `tests/recommendations.test.ts` | Existing unit test |
| Provider tag parsing | Accepted tag forms must normalize without broadening the write target | Provider, vendor, cloud-provider, context, and plain-value forms normalize; entity selectors contain only unique exact IDs | `tests/providerTags.test.ts` | Existing unit test |
| Access failure | Permission failure is not absence of data | Telemetry error produces an access recommendation and suppresses provider-tag advice | `tests/recommendations.test.ts` | Existing unit test |
| Telemetry boundary | Visible services do not prove recent incident evidence exists | A visible service inventory without Problems, logs, spans, or request series produces a separate telemetry recommendation | `tests/recommendations.test.ts` | Existing unit test |
| SLO follow-up | SLO advice requires a known provider scope | A confirmed scope or matched provider tag with owner context can suggest native SLO follow-up | `tests/recommendations.test.ts` | Existing unit test |
| App-state expiry | Expiration must remain inside the platform limit | The generated timestamp includes a safety margin below 90 days | `tests/stateExpiration.test.ts` | Existing unit test |
| External contract parsing | Untrusted directory payloads must be validated | Invalid envelope or service identity throws before data reaches the UI | `tests/slaDirectory.function.test.ts` | Existing unit test |
| Multi-provider normalization | Provider monitoring is a collection with one valid active provider | Slugs are normalized, deduplicated, bounded, and invalid values are rejected | `tests/providers.test.ts` | Existing unit test |
| Smartscape provider candidates | Cloud topology may suggest an exact service boundary but never auto-assign one | Only exact service entity IDs connected to provider metadata become candidates; names do not create candidates | `tests/providerAttribution.test.ts`, `tests/topology.test.ts` | Existing unit test |
| Provider notice parsing | Provider responses remain source-labeled and bounded | Personalized relevance, public-state handling, stable product-ID mapping, lookback filtering, and malformed payloads normalize conservatively | `tests/gcpServiceHealth.function.test.ts` | Existing unit test |
| Public provider status parsing | Public status is bounded, source-labeled, and never represented as customer-specific | OpenAI-style incident history and OCI current regional status normalize conservatively; malformed payloads are rejected | `tests/providerPublicStatus.function.test.ts` | Existing unit test |
| Provider connection validation | Secret values must not enter App Settings | AWS account, Azure subscription, Google project, OCI tenancy, region, and Credential Vault identifiers normalize; incomplete and malformed records are rejected | `tests/providerConnections.test.ts` | Existing unit test |
| Provider connection catalog | Core connection types and verification boundaries must remain aligned across onboarding and settings | AWS, Azure, GCP, and OCI remain peer options with the correct scope noun; display-name or enabled-state changes do not invalidate verification, while provider scope or credential changes do | `tests/providerConnections.test.ts` | Existing unit test |
| AWS Health account adapter | Account events must stay account-scoped, signed, and source-labeled | STS verifies the configured account, Signature Version 4 headers are created, only `ACCOUNT_SPECIFIC` events are retained, requests are bounded, and explicit service codes map conservatively | `tests/awsHealth.function.test.ts` | Existing unit test with synthetic credentials |
| Azure Service Health adapter | Subscription events must stay subscription-scoped, bounded, and source-labeled | Client credentials are read only from Credential Vault, fixed Entra and Resource Manager hosts are used, provider markup is reduced to text, and explicit services map conservatively | `tests/azureServiceHealth.function.test.ts` | Existing unit test with synthetic credentials |
| OCI Announcements normalization | Tenancy notices must stay source-labeled, bounded, and conservative | OCI scope validation, fixed regional endpoints, Credential Vault reads, request signing, response normalization, and explicit service mappings are exercised without a live key | `tests/ociAnnouncements.function.test.ts` | Existing unit test |
| Provider-service candidate mapping | Smartscape runtime evidence may suggest only an exact directory service and never becomes confirmation by itself | Stable scope keys normalize, supported runtime signatures resolve only within the selected provider, and unknown services remain unassigned | `tests/providerScopeAssignments.test.ts` | Existing unit test |
| Custom SLA precedence | Tenant terms must layer predictably over the public baseline | Host, location, service, provider, and directory values are applied in documented order; unrelated, expired, and disabled records are ignored | `tests/contractOverrides.test.ts` | Existing unit test |
| Multi-entity SLA assignment | One SLA may cover several exact entities without broad name matching | Either assigned service ID matches the custom SLA; an unrelated service keeps the public baseline | `tests/contractOverrides.test.ts` | Existing unit test |
| Settings compatibility | Existing single-target SLA records remain readable after the multi-target schema addition | A legacy `scopeEntityId` is normalized into the target list | `tests/contractOverrides.test.ts` | Existing unit test |
| Smartscape normalization | Topology fields must not be fabricated or broadened | Service, runtime, relationship, and available location fields are normalized from returned Smartscape records | `tests/topology.test.ts` | Existing unit test |
| Lookback boundaries | Only supported evidence windows reach DQL | 24 hours, 72 hours, 7, 15, 30, 60, and 90 days normalize to bounded values | `tests/lookback.test.ts` | Existing unit test |
| Static quality | Type and lint errors block a change | `npm run typecheck` and `npm run lint` exit successfully | `package.json`, CI workflow | Existing CI gate |
| Bundle validity | App manifest and bundle must be accepted by `dt-app` | `npm run build` and `npm run analyze` exit successfully | `dt-app` output | Existing CI gate |
| Browser smoke | A deployed app exposes focused Overview, Setup, Incidents, and Provider notices routes with a conservative posture | The Playwright suite visits each view, confirms multi-provider controls, opens the Setup scope map, and requires normal desktop states to fit without body scrolling | `tests/e2e/sla-watch.spec.ts`, `playwright.config.ts` | Prepared guarded E2E |
| Header action guidance | Every icon-only header action must retain its icon and identify itself without relying on icon recognition | The Playwright suite requires one SVG and the matching Strato tooltip for each header action, including the disabled Community state | `tests/e2e/sla-watch.spec.ts` | Prepared guarded E2E |
| Pre-launch Community gate | Community destinations must not navigate before public launch | The Playwright suite verifies the header action is disabled and no Community link is exposed from release history or settings | `tests/e2e/sla-watch.spec.ts` | Prepared guarded E2E |
| SLA settings workflow | New records belong in Settings and require explicit evidence targets | Browser smoke confirms no create dialog is used, service scope begins empty, and selecting an exact target updates the assignment | `tests/e2e/sla-watch.spec.ts` | Prepared guarded E2E |

## Proposed tests

| Use case | Rule | Expected behavior, including negative case | Test type | Status |
| --- | --- | --- | --- | --- |
| Tenant access matrix | Each missing declared scope yields the documented degraded state | A test user without entities, events, logs, spans, metrics, or state access sees unknown/incomplete, never false absence | Guarded live integration | Proposed |
| External dependency | Upstream timeout, 4xx, 5xx, invalid JSON, and empty services remain safe | Directory status is unavailable and no contract result is reused as current | Automated function integration | Proposed |
| Personalized provider connection | Google OAuth, Credential Vault, Service Health, and fallback boundaries remain distinguishable | A valid project is project-specific, failed test never falls back, failed monitor read is labeled public fallback, and no secret reaches the UI | Guarded live integration | Proposed |
| Multiple AWS accounts | Each saved AWS account remains independently selectable and is verified before a Health read | Adding a second account does not replace the first; wrong-account credentials, unsupported plans, IAM denial, and removal remain visible | Guarded live integration | Proposed |
| Multiple Azure subscriptions | Each saved Azure subscription remains independently selectable and scoped to its role assignment | Adding a second subscription does not replace the first; expired secrets, wrong scopes, IAM denial, and removal remain visible | Guarded live integration | Proposed |
| Multiple provider projects | Each saved Google Cloud project remains selectable and independently testable | Adding a second project does not replace the first; duplicates are rejected and removal does not delete the Credential Vault secret | Guarded live integration | Proposed |
| Multiple OCI tenancies | Each saved OCI tenancy remains independently selectable and public status remains a deliberate alternative | Adding a second tenancy does not replace the first; invalid signatures and IAM denial remain visible and never become public fallback | Guarded live integration | Proposed |
| Confirmed scope reuse | Incident review must prefer a saved exact mapping over an unconfirmed topology candidate | A mapping confirmed in Setup is selected for a Problem on the same service/runtime; removing it restores the candidate or provider fallback | Guarded live integration | Proposed |
| Provider-tag authorization | The tag action requires both app scope and user permission | Granted, denied, unverifiable, and management-zone-limited users receive the documented action state | Guarded live integration | Proposed |
| Provider-tag mutation | Only confirmed entity IDs and one key/value are changed | Existing tags remain, conflicts are excluded, partial counts are shown, and undo removes only the last app-applied key/value | Guarded live integration | Proposed |
| Browser first run | Onboarding distinguishes automatic sources from optional account connections | The app states that public terms need no directory credential, optional cloud connections remain separate, setup does not change cloud resources or tags, and completion can open Provider connections directly | `tests/e2e/sla-watch.spec.ts` plus manual local smoke | Prepared, guarded live run pending |
| Browser themes | Both themes retain readable status text and controls | Light and dark views preserve the compact watch and header icons | `tests/e2e/sla-watch.spec.ts` plus visual review | Prepared, guarded live run pending |
| Shared state fallback | App-state denial is communicated accurately | The UI says local fallback, and never claims a workspace save succeeded | Manual smoke plus future denied-permission E2E | Partially verified |
| App Settings authorization | Read-only and denied users must not mutate tenant SLA terms | Read-only users can inspect records, denied users see the public fallback, and writes require schema-level permission | Guarded live integration | Proposed |
| Ambiguous incident assignment | Equally specific matches must remain an operator decision | A Problem with two matching SLA assignments does not silently select one | Component or guarded live integration | Proposed |
| Hub install | Clean install from the release artifact | App launches, function runs with allowlist, and Technical information matches the manifest | Guarded live acceptance | Proposed |

## Gaps

1. No live IAM negative tests are committed because they require tenant identities and permission fixtures.
2. The Playwright suite is committed, but no authenticated CI run is recorded because test credentials must be supplied through CI secrets, never checked into the repository.
3. DQL query validity and the semantic scope of tenant-wide log/span counts still require a representative tenant test case.
4. Provider-service-to-Dynatrace-entity joins are explicit operator assignments. Smartscape can provide an unconfirmed candidate, but no test can claim provider fault or end-to-end credit eligibility.
5. The tag write and undo require a disposable live-service fixture before automated mutation coverage can run safely.
6. No automated accessibility scan is wired into CI.
7. AWS account authentication and Health plan behavior require a disposable least-privilege live identity for acceptance. The key and Credential Vault record must be revoked and deleted after the test.
8. Azure subscription authentication requires a disposable app registration, secret, and least-privilege role assignment for acceptance. The secret, role assignment, and Credential Vault record must be removed after the test.
9. Google provider authentication requires a disposable live key for acceptance. The key and its Credential Vault record must be revoked and deleted after the test.
10. OCI request signing is covered without real credentials. A disposable OCI API user, least-privilege group, live tenancy announcement fixture, and exact outbound allowlist entry are still required for guarded acceptance, then must be revoked and removed.

## CI policy

Pull requests must pass `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:ci`, `npm run build`, `npm run analyze`, and `npm audit --omit=dev`. Deployment is intentionally not part of the pull-request job.

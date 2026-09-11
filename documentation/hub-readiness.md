# Dynatrace Hub readiness audit

## Scope and conclusion

This is a technical readiness audit of the repository and the last verified tenant deployment. It is not a claim that Dynatrace has approved the app for public Hub distribution. The public documentation describes Hub installation, app verification, code signing, manifest metadata, scopes, security, privacy, themes, dependencies, and testing. The final listing review and code-signing decision are portal-owned steps that cannot be completed by a local build.

The app is suitable for continued hardening as a custom AppEngine app. The reviewed source is published at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch), but the app is not yet ready to represent itself as a generally available Hub listing until App Settings mutations have least-privilege acceptance evidence, listing content is complete, and the Dynatrace submission route is confirmed.

## Authority reviewed

- [Dynatrace Hub](https://docs.dynatrace.com/docs/manage/hub): listing contents, required install permissions, custom-app status, subscriptions, and standard verification/code signing.
- [App Toolkit](https://developer.dynatrace.com/quickstart/app-toolkit/): manifest fields, description limits, icon behavior, and configuration surface.
- [App naming guidelines](https://developer.dynatrace.com/design/patterns/app-naming-guidelines/): title case, 40-character limit, discoverability, and avoiding ambiguous names.
- [Permission scopes](https://developer.dynatrace.com/develop/guides/security/add-permission-scopes-to-use-dynatrace-apis/): manifest declaration, least privilege, and intersection with user permissions.
- [Deploy your app](https://developer.dynatrace.com/develop/guides/deploy-your-app/): deploy IAM permissions, CI variables, and version bump rule.
- [External requests](https://developer.dynatrace.com/develop/guides/app-functions/allow-outbound-connections/): outbound host allowlist and the risk of disabling enforcement.
- [Security guidance](https://developer.dynatrace.com/develop/guides/security/): scopes, CSP, secrets, dependency management, and effective permission checks.
- [Privacy by design](https://developer.dynatrace.com/develop/guides/privacy/): PII identification, minimization, and retention.
- [Unit testing](https://developer.dynatrace.com/develop/test-and-troubleshoot/test/create-unit-tests/) and [E2E testing](https://developer.dynatrace.com/develop/test-and-troubleshoot/test/create-end-to-end-tests/): Jest, Playwright, authenticated target-environment testing, and CI cleanup.
- [`documentation/dependency-audit.md`](dependency-audit.md): the production-clean audit result and the documented upstream development-tooling finding.

## Requirement matrix

| Area | Evidence | State | Closure action |
| --- | --- | --- | --- |
| Manifest identity | `app.config.json` uses `my.sla`, `SLA Review`, version `0.0.46`, a maintained icon, and a sub-80-character description | `0.0.46` is the locally verified release candidate; `0.0.45` remains the last deployed and verified target-environment release | Confirm the permanent publisher-owned app ID and final Hub name. Do not change the ID casually after distribution. |
| Name discoverability | `SLA Review` is short and title case | Likely compliant, uniqueness unverified | Check Hub for collisions and ensure the final name describes the use case. |
| Icon and listing media | A custom SVG icon is included; final Hub screenshots and listing media are not yet packaged | Partial | Review the icon and add final Hub screenshots/demo assets. |
| Runtime scopes | Manifest declares read-only telemetry and Smartscape scopes, Credential Vault read, user/app state, and App Settings read/write. It does not declare entity-write, SLO-write, Problem-write, or ticketing scopes | Reduced scope set verified by the `0.0.45` deployed release and unchanged in the `0.0.46` candidate | Test each scope with a least-privilege user and ensure the Hub Technical information page explains each write purpose. |
| Runtime authorization | UI reports access-incomplete states and keeps App Settings actions unavailable when the current user cannot write | Default-user states are covered locally; a separate least-privilege identity is still required | Add guarded read-only and denied acceptance tests for state and App Settings. |
| External API | The directory, AWS Health, Azure Service Health, Google Service Health, OCI Announcements, and fixed public-status functions validate input, bound requests, validate responses, and preserve source boundaries | Directory and the deployed public adapters were confirmed in the recorded deployment; all four customer-scoped cloud adapters have automated contract coverage, but live least-privilege credentials remain an acceptance gap | Re-verify every documented external host and provider IAM boundary after each environment install. Never disable allowlist enforcement. |
| Tenant custom terms | The `contract-overrides` schema stores operational values, effective dates, source references, and exact evidence target IDs separately from public terms | Schema registration and empty-collection reads verified in the installed app; the `0.0.39` editor was inspected without persisting a value | Verify least-privilege write access, version history, edit, disable, and removal behavior with a non-confidential test record. |
| Smartscape scope | Bounded runtime relationships are queried from Smartscape on Grail. Unique provider-native runtime matches select provider terms automatically, while lower-confidence and conflicting matches remain exceptions | Provider-native, host, cluster, process, and container relationship behavior was profiled in Playground; `0.0.45` local review returned two observed EC2 services without a confirmation action | Verify a tenant without Smartscape access receives a conservative unavailable state and a large tenant reports truncation without claiming complete coverage. |
| Confirmed provider-service scope | Coverage stores operator-confirmed runtime-scoped or service-scoped mappings in the `provider-scope-assignments` schema; Incidents and Evidence reuse currently valid exact mappings | `0.0.42` production acceptance verified exact service-scoped create, reload persistence, Evidence reuse, removal, and cleanup without changing entity metadata. `0.0.44` verified both mapping types in one worklist and one shared terms panel. Update and read-only acceptance remain open | Verify update, denied-write, and read-only behavior with a non-confidential mapping. |
| Human evidence decisions | Evidence derives candidates only from exact affected services that overlap a saved mapping, exact provider tag, observed provider-native topology, or same-provider Smartscape suggestion. One explanation leads to Validate or Dismiss, and changed evidence boundaries invalidate stale decisions | `0.0.42` production acceptance verified acknowledgement gating, validate, reload persistence, reset, and cleanup for an exact mapped service. `0.0.45` unit coverage separates observed topology from lower-confidence candidates. Dismiss, update, and read-only acceptance remain open | Verify dismiss with a non-confidential note, update, denied-write, and read-only behavior. Confirm every surface preserves the provider-fault and credit-eligibility boundary. |
| CSP | No custom CSP exceptions are needed; external API is server-side | Implemented | Keep external calls in the function. Do not add broad browser CSP exceptions. |
| Secrets | No secrets in source or bundle; public sources need no credential; customer-scoped provider keys remain in administrator-selected Credential Vault records | Implemented locally; disposable AWS, Azure, Google Cloud, and OCI live-credential acceptance remains open | Keep CI OAuth credentials in the CI secret store, rotate provider keys, and remove all acceptance credentials after testing. |
| Privacy | App-state TTL stays inside the 90-day platform limit; bounded provider configuration, exact scope mappings, custom terms, and evidence decisions are persisted; UI warns about local fallback | Implemented locally | Review operator guidance for PII and verify deletion/expiry behavior in a tenant. |
| Themes | Custom styles use theme variables and dark/light paths were manually verified in the target tenant | The direct-to-Coverage `0.0.46` candidate was verified in light and dark during tenant-hosted local review; `0.0.45` remains the installed production release | Add automated contrast or screenshot coverage before submission. |
| Dependencies | Production audit is clean after the React Router upgrade; current `dt-app` is `1.17.0` | Implemented locally | Keep Renovate enabled and review App Toolkit advisories separately as development-only risk. |
| Tests | Focused unit tests, typecheck, lint, build, analyzer, and guarded one-screen browser assertions are present | The `0.0.46` local candidate passes 19 suites and 121 tests plus typecheck, lint, build, analyzer, and production dependency audit. Direct Coverage startup, the optional walkthrough, and both themes passed tenant-hosted local review; denied-permission evidence remains open | Add authenticated Playwright and denied/read-only acceptance jobs using CI secrets. |
| CI | Pull-request workflow is repository-local and non-deploying | Verified in [GitHub Actions run 34618336974](https://github.com/self9dmin/sla-watch/actions/runs/34618336974) on Node 24 for `6934d0b` | Make the required checks branch-protection rules and keep deployment outside the pull-request job. |
| Public repository | Reviewed source and documentation are published at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch) on `main` | Published | Review the public tree and commit history, then keep future changes gated by CI and pull request review. |
| Hub verification | Standard verification, provider identity, integrity, and code signing are controlled by Dynatrace Hub | External dependency | Use the applicable Dynatrace community, partner, or Hub-subscription submission route. A local `dt-app deploy` cannot complete this step. |

## Release gates

The release owner should not request Hub review until all of the following are true:

- The final app ID, name, description, icon, publisher, and support URL are approved.
- The public repository at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch) has a clean history, license, security policy, contribution guidance, CI, and no tenant-specific secrets or auth state.
- The public repository uses `DT_APP_ENVIRONMENT_URL` or an explicit deployment flag for contributor and CI targets rather than relying on a private tenant default.
- `npm run verify` and `npm audit --omit=dev` pass on Node 24.
- A clean tenant install passes the browser smoke path in both themes.
- The target tenant allowlist, IAM policies, app-state behavior, and external API failure behavior are verified.
- Public OCI, OpenAI, Anthropic, and ElevenLabs sources are verified as aggregate provider evidence and never represented as customer-specific health.
- AWS account events are verified with a disposable least-privilege identity, supported Health API plan, STS account check, wrong-account case, inaccessible-credential case, and IAM-denied case. Remove the key and credential after acceptance.
- Azure subscription events are verified with a disposable app registration, exact Resource Health read action, expired-secret case, inaccessible-credential case, and IAM-denied case. Remove the secret, role assignment, and credential after acceptance.
- Google Cloud project events are verified with a disposable least-privilege service account, project-scoped events, inaccessible-credential case, IAM-denied case, and explicit public fallback. Remove the key and credential after acceptance.
- OCI tenancy announcements are verified with a disposable least-privilege API user, exact regional outbound allowlist entry, inaccessible-credential case, IAM-denied case, and deliberate public-source selection. Remove the test key and credential after acceptance.
- Runtime-scoped and service-scoped coverage create, update, removal, exact-ID isolation, and denied-write behavior are verified with disposable service fixtures.
- App Settings read/write behavior, multi-entity SLA assignment, edit, disable, removal, and public-baseline fallback are verified with a non-confidential test record.
- Confirmed provider-service mapping create, update, removal, ambiguity, and Incident review reuse are verified with disposable scope records.
- Evidence decision create, update, dismissal, read-only behavior, and conservative interpretation are verified with a disposable Problem and non-confidential note.
- The Hub Technical information, getting-started, use-case, content, release-notes, and permissions text match the shipped artifact.
- The Dynatrace owner confirms the submission route and completes standard verification/code signing.

## Known non-blocking product boundary

The provider-service-to-Dynatrace-entity join is automatic only when a fixed provider-specific mapping recognizes one provider-native Smartscape runtime type for the exact service. Hostname-only, conflicting, and unknown matches remain operator decisions, and an exact saved override takes precedence. Coverage does not place unrelated services in the default exception queue and never claims complete coverage when aggregate counts show a bounded or unverified inventory. One custom terms record can target several exact service, runtime, or location IDs. A human validation is operational follow-up state only. The app does not infer an assignment from a service name, prove root cause, or automate credit eligibility. These limits are disclosed in the README and UI.

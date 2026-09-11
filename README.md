# SLA Review

SLA Review is a Dynatrace AppEngine app for evidence-first provider attribution. It puts provider terms beside the service boundary and telemetry needed to decide whether an SRE has enough evidence for a human review.

## Current capability

- Reads the tenant service inventory with DQL.
- Reads Davis Problems, logs, spans, and service-request telemetry for a selectable 24-hour to 90-day window.
- Retrieves provider and service contract data from the versioned `sla.directory` JSON API through an AppEngine function.
- Presents the active provider's published terms, credit policy, claim process, exclusions, service catalog, support plans, support-response boundary, source metadata, and tenant overrides in one read-only Directory workspace.
- Treats AWS, Microsoft Azure, Google Cloud, and Oracle Cloud Infrastructure as four peer cloud providers. A fresh workspace monitors all four and opens AWS first only as the initial focused view.
- Monitors more than one provider at a time and keeps the active provider as a focused view rather than a tenant-wide replacement.
- Lets administrators add multiple AWS accounts, Azure subscriptions, Google Cloud projects, and OCI tenancies for customer-scoped provider evidence. Credentials remain in Dynatrace Credential Vault.
- Reads credential-free public status for Google Cloud and OCI, plus optional OpenAI, Anthropic, and ElevenLabs sources. Public records remain explicitly non-customer-specific.
- Opens on a compact Coverage workspace with provider, service, incident, and filing facts above an exception-first worklist.
- Uses exact service-to-cloud-runtime relationships from Smartscape to identify provider candidates. A unique match from a provider-native runtime type is applied automatically; hostname-only or ambiguous matches remain for review. Service names never create a candidate.
- Lets an operator override or confirm the provider service for an exact Smartscape service-to-runtime scope. Saved mappings remain separate from entity tags and take precedence in Incident review.
- Lets an operator confirm app-owned coverage for an exact service without a usable Smartscape runtime relationship. The mapping can use provider-level terms or one provider service and can be updated or removed without modifying Dynatrace entity metadata.
- Provides an Incidents view with an observed Problem queue, provider-published credit terms, filing guidance, required evidence, and exclusions.
- Provides an Evidence workspace that combines Dynatrace-derived review candidates with a separate provider-reports view. Each candidate has one match explanation and one SRE decision: Validate or Dismiss. A saved decision returns to Needs review if its evidence boundary changes.
- Keeps the operating sequence inside one shell: Coverage, Incidents, then Evidence. Published and tenant-specific terms are available through Review terms. FinOps Agent is visible as planned and disabled until the platform supports the intended capability.
- Stores tenant-owned custom terms in Dynatrace App Settings while retaining the public `sla.directory` record as the comparison baseline.
- Assigns one custom terms record to one or more exact Dynatrace services, hosts, runtimes, or observed locations. Smartscape relationships supply service-to-runtime context, and entity IDs establish the boundary.
- Applies custom terms in the order host, location, service, provider-wide fallback, then public directory baseline.
- Separates missing telemetry, incomplete entity access, missing coverage, and source tags that do not match the selected provider.
- Recommends setup actions for provider boundaries, ownership metadata, service naming, and native SLO follow-up.
- Keeps personal theme and onboarding state separate from shared watch configuration.
- Provides a read-only application change log. Dynatrace Community support is visible as coming soon and remains disabled until public launch.

## Deliberate boundaries

SLA Review does not issue credits, prove provider fault, create SLOs, edit Dynatrace entity tags, or infer ownership from a service name. It can select provider terms automatically only when a fixed provider-specific mapping recognizes the native Smartscape runtime type. Hostname-only and conflicting matches require review, and an exact saved mapping overrides the observed result. A matching source tag, Smartscape relationship, contract assignment, provider report, and active Problem are only inputs to a human review. A validated candidate records an SRE decision for operational follow-up. It does not establish provider fault, credit eligibility, or claim approval.

Provider incident integrations are intentionally optional and read-only. Administrators may configure more than one AWS account, Azure subscription, Google Cloud project, or OCI tenancy. AWS Health events are account-specific, Azure Service Health events are subscription-specific, Google Personalized Service Health is project-relevant, and OCI Announcements are tenancy-specific. Google Cloud and OCI also have deliberately selected public-status views that the app labels non-customer-specific. No provider source establishes local impact. The app still requires Dynatrace telemetry and an explicit service boundary before an SRE can assess an incident. This release does not create notifications, tickets, Problems, or claims.

Custom-term assignments are explicit. An SRE selects the provider service and exact Dynatrace entity IDs that the private terms cover. When a Problem includes an assigned service, or Smartscape links it to an assigned runtime or location, the app can apply the matching terms. If more than one equally specific assignment matches, the operator chooses the boundary. The app never uses a similar service name to create that relationship.

The runtime data path does not require an MCP server or a user-supplied `sla.directory` credential. The installed app calls the public versioned JSON API automatically through its AppEngine function. `sla.directory` MCP remains useful for agent-assisted research and contract discovery.

## First-run setup

1. Install SLA Review and open it from the Dynatrace Apps page.
2. Use onboarding to choose the providers monitored by the workspace. A fresh workspace includes AWS, Azure, GCP, and OCI, with AWS only as the initial focused view.
3. Open **Coverage**. Review only ambiguous or unresolved provider evidence. Provider-native matches are already available under Covered, while All loaded supports intentional manual mapping. Existing source tags remain read-only evidence.
4. Optionally open **Settings > Provider connections**. For each account, subscription, project, or tenancy, create a least-privilege provider identity and store its secret in Dynatrace Credential Vault. SLA Review receives only the credential record ID.
5. Add the exact provider hosts to Dynatrace External requests, test the connection, and save it only after verification succeeds. A provider connection does not assign services or prove provider fault.
6. Select **Review terms** to inspect the complete published provider record, service-level coverage, support options, and any tenant overrides before assessing an incident.

Provider connections are configured independently in every installing Dynatrace environment. They are not bundled with the app, inherited from this repository, or shared with the development tenant. See the [provider incident connection guide](documentation/provider-connections.md) for the complete AWS, Azure, GCP, and OCI setup.

## Prerequisites

- Dynatrace AppEngine enabled in the target environment.
- A user or deployment identity with the app's declared scopes in `app.config.json`.
- `sla.directory` added as an allowed external host for AppEngine functions. The host entry is `sla.directory`, without a protocol or path.
- For AWS account notices, allow `sts.us-east-1.amazonaws.com` and `health.us-east-1.amazonaws.com`. The selected AWS account must have a supported AWS Health API plan. Grant a dedicated identity only `health:DescribeEvents` and `health:DescribeEventDetails`, then store JSON containing `accessKeyId`, `secretAccessKey`, and an optional `sessionToken` as an AppEngine-scoped Token credential restricted to SLA Review.
- For Azure subscription notices, allow `login.microsoftonline.com` and `management.azure.com`. Use a dedicated Microsoft Entra application with `Microsoft.ResourceHealth/events/read` on the selected subscription, then store JSON containing `tenantId`, `clientId`, and `clientSecret` as an AppEngine-scoped Token credential restricted to SLA Review.
- For Google Cloud provider notices, add `status.cloud.google.com`, `oauth2.googleapis.com`, and `servicehealth.googleapis.com` under Settings > General > External requests. Enable the Service Health API and grant the dedicated service account both `roles/servicehealth.viewer` and `roles/serviceusage.serviceUsageConsumer`. Do not disable external-request enforcement.
- For credential-free public provider status, allow `status.openai.com`, `status.claude.com`, `status.elevenlabs.io`, and `ocistatus.oraclecloud.com`.
- For each OCI tenancy connection, allow the exact regional host `announcements.<region>.oraclecloud.com`. Dynatrace supports a wildcard host pattern such as `*.oraclecloud.com`, but the exact hostname is the least-privilege default.
- For OCI tenancy notices, create a dedicated API-signing user, grant its group `Allow group AnnouncementListers to inspect announcements in tenancy`, and store JSON containing only `userOcid`, `fingerprint`, and the unencrypted RSA `privateKey` as a Token credential. Give the credential AppEngine scope, restrict application access to SLA Review, and grant only the intended users access.
- For personalized Google Cloud notices, enable the Service Health API, grant a dedicated service account both `roles/servicehealth.viewer` and `roles/serviceusage.serviceUsageConsumer` on the selected project, and store its JSON key as a Token credential with AppEngine scope. Restrict application access to SLA Review and grant only the intended users access.
- Users who create or edit custom terms need App Settings write access for the `contract-overrides` schema. Users who confirm provider-service scope mappings need write access for `provider-scope-assignments`. Users who validate or dismiss review candidates need write access for `evidence-decisions`. All authenticated app users can read these settings, so records must contain operational values and concise evidence references, not private contract text or credentials.
- Node.js 24 for the supported local and CI toolchain.

The app requests read access to Dynatrace telemetry, Smartscape, and an administrator-selected Credential Vault record, plus read/write access to user state, shared app state, and tenant configuration. It does not request entity-write, credential-vault write, ticketing, SLO-write, or Problem-write permissions. See [`documentation/permissions.md`](documentation/permissions.md) for the complete boundary.

The provider adapters follow the official [AWS Health API](https://docs.aws.amazon.com/health/latest/ug/health-api.html), [Azure Resource Health events API](https://learn.microsoft.com/en-us/rest/api/resourcehealth/events/list-by-subscription-id?view=rest-resourcehealth-2025-05-01), [Google Cloud Service Health APIs](https://docs.cloud.google.com/service-health/docs/apis), and Oracle [Announcements listing API](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/announcements_topic-To_view_a_list_of_all_announcements.htm). OCI setup also follows Oracle's [service status boundary](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/status-service.htm), [least-privilege policy](https://docs.oracle.com/en-us/iaas/Content/Identity/policiescommon/commonpolicies.htm), and [request-signing specification](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm). Dynatrace environments must separately [allow each external host](https://developer.dynatrace.com/develop/guides/app-functions/allow-outbound-connections/).

## Development

```text
npm ci
npm run start
```

The local development server uses the `environmentUrl` in `app.config.json`. For another tenant, set the supported `DT_APP_ENVIRONMENT_URL` variable or pass `--environment-url` to `dt-app`. Keep credentials and tokens outside the repository. `.env.example` documents the non-secret target setting; it is not loaded automatically by the CLI.

## Verification commands

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run analyze
npm audit --omit=dev
```

`npm run verify` runs the typecheck, lint, unit tests, build, and App Toolkit analysis in one sequence. The full dependency audit also reports advisories in the development-only App Toolkit dependency tree; the production dependency audit is the release gate.

`npm run verify:release` is the single release-candidate gate. It adds CI-style coverage and the production dependency audit.

Authenticated browser smoke tests are intentionally separate:

```powershell
$env:DT_APP_E2E_URL = "https://your-environment.apps.dynatrace.com/"
$env:DT_APP_E2E_AUTH_STATE = "./playwright/.auth/state.json"
npm run test:e2e
```

In a POSIX shell, export the same two variables before running the command.

The E2E workflow is manual-only and consumes an externally supplied Playwright auth state. Never commit that state or use it as a pull-request secret.

## Deployment

```text
npm run deploy
```

For a different target, use `npx dt-app deploy --environment-url https://your-environment.apps.dynatrace.com/` or set `DT_APP_ENVIRONMENT_URL` in the shell or CI environment.

Every change to `app.config.json` requires a new app version before deployment. Deployments should be performed from a reviewed branch or CI identity with `app-engine:apps:install` and `app-engine:apps:run`. A post-deploy smoke test must verify the app loads, the provider function returns a contract, denied telemetry is shown as unknown rather than absent, and both themes remain readable.

## State and privacy

User theme and walkthrough state use user app state. Provider selection, tag convention, and lookback use shared app state when the workspace scope is available. The browser fallback is local storage and is clearly surfaced when shared state cannot be written. App-state records expire within the platform's 90-day limit.

Custom terms use the `contract-overrides` App Settings schema so they are shared and auditable in the Dynatrace environment. The app stores exact target IDs, display names, operational targets, effective dates, and a source reference. App Settings are readable by all authenticated users of the app and persist until changed or removed.

Provider connection metadata uses the `provider-connections` App Settings schema. It stores the provider, the applicable account, subscription, project, or tenancy identifier, an OCI region when required, and the Credential Vault record ID. It never stores an AWS secret access key, Azure client secret, Google service-account key, OCI private key, or access token. The AppEngine functions read the selected secret at request time, authenticate only to fixed provider endpoints, and return normalized provider notices to the browser.

Operator overrides use the `provider-scope-assignments` App Settings schema. A runtime-scoped record contains exact Dynatrace service and runtime IDs, display context, the selected provider-service ID, and a short evidence note. A service-scoped record contains the exact service ID and either provider-level terms or one selected provider service. Coverage presents overrides, observed matches, and manual choices in one bounded worklist. Incident review checks exact tenant contract scopes first, then saved coverage, then a unique provider-native Smartscape match, followed by a lower-confidence candidate. Existing provider tags can contribute read-only evidence, but the app never writes or removes them.

Human candidate decisions use the `evidence-decisions` App Settings schema. Each record stores a bounded Problem snapshot, exact affected entity IDs, the provider and mapping basis, the decision, a concise operational note, and the review time. The app reuses a decision only while the mapping basis, affected entities, and provider-service scope still match the current candidate. These records are shared operational context. They do not establish root cause, provider liability, SLA eligibility, or credit approval. Do not store confidential contract text, credentials, or personal data in a decision note.

Do not enter secrets, credentials, or unnecessary personal data into app state. No secret is bundled in the app or stored in this repository.

## Repository documentation

- [`documentation/architecture.md`](documentation/architecture.md) maps the system and trust boundaries.
- [`documentation/flows.md`](documentation/flows.md) describes load-bearing user journeys.
- [`documentation/provider-connections.md`](documentation/provider-connections.md) is the installation and operations guide for AWS, Azure, GCP, and OCI incident sources.
- [`documentation/permissions.md`](documentation/permissions.md) maps app scopes to operations and deny behavior.
- [`documentation/variables.md`](documentation/variables.md) records configuration and secret handling.
- [`documentation/tests.md`](documentation/tests.md) separates existing coverage from proposed tests and gaps.
- [`documentation/dependency-audit.md`](documentation/dependency-audit.md) records the production-clean audit and the upstream development-tooling finding.
- [`documentation/acceptance.md`](documentation/acceptance.md) records the manually verified tenant smoke scenarios for the release candidate.
- [`documentation/hub-readiness.md`](documentation/hub-readiness.md) records the Dynatrace Hub readiness audit and remaining portal-owned steps.

## License

The project declares the ISC license. See [`LICENSE`](LICENSE).

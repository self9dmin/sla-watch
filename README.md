# SLA Review

Cloud providers tell you what they reported. Dynatrace shows what happened in your environment. SLA Review keeps those records separate, then brings them together when an SRE needs to decide whether an incident deserves provider follow-up.

The app does not decide fault, label a case as an SLA violation, file a claim, or promise a credit.

## Project status

SLA Review is a working custom Dynatrace AppEngine app under active development. Version 0.0.89 is the current source version. The release record in [acceptance](documentation/acceptance.md) identifies what has been checked in the target environment; a local build does not verify another tenant. It is not yet a generally available Dynatrace Hub app.

The core Coverage, Service health, Evidence, and Provider terms views have automated tests and earlier target-tenant smoke evidence. The four cloud-provider adapters are implemented, tested with controlled responses, and have been deployed in an earlier release. Live least-privilege credential acceptance for every provider is still open, along with denied-permission and large-environment testing.

The exact evidence and remaining gaps are in [release acceptance](documentation/acceptance.md) and [Hub readiness](documentation/hub-readiness.md).

## The SRE flow

The app has three stages. **Coverage remains the landing page.** The supporting views stay available within the first two stages.

| Stage | Main action | Supporting views |
| --- | --- | --- |
| **1. Identify** | Start in **Coverage** to inspect detected topology and confirm an exact SLA match when needed. Provider presence alone does not match every service. | The native Problems app provides full causal investigation. |
| **2. Evaluate** | Follow the one next action in **Evidence**. If only the provider is known, resolve the exact product in Coverage. Otherwise inspect a provider-product investigation and review a supported episode before recording **Evidence review complete**, **Needs evidence**, or **Excluded from provider follow-up**. Nothing is sent to the provider. | Problems remain supporting signals. Separate episodes keep separate evidence and decisions. **Provider terms** shows published `sla.directory` terms and environment-owned custom terms. |
| **3. Automate** | Open **Overview** to see existing SLOs, the actual Workflow state, and recent decisions. Use **Service health** for detailed native SLO evaluations and **Setup** to prepare one customer screening objective for an exact provider product, account, and region scope. Setup also sends prefilled route and feedback proposals to Dynatrace Workflows for an authorized operator to review and save. | A person queues an eligible reviewed case after the integration is verified, then records the later outcome. Filing is recorded only after a person supplies the provider channel and receipt or ticket reference. |

Automate can create an explicitly confirmed customer SLO for a verified provider product scope and inspect Workflows visible to the signed-in user. In **Setup**, enter the private EdgeConnect origin, Credential Vault record ID (never the token), and local Laya or Jev-compatible interface. The app sends each reviewed script and an inactive event trigger with its matcher as a prefilled proposal to Dynatrace Workflows. Workflows opens an editor draft with a private request. An authorized operator must inspect the proposal, actor, and permissions, save it in Workflows, then return to Automate and refresh its status. The app checks visible Workflow titles, expected scripts and triggers, private state, and unexpected tasks. Private Workflows created by other users are visible only to their owner or a Workflow admin, so this check cannot prove that no tenant-wide duplicate exists. A designated owner or admin must inspect the tenant inventory and acknowledge that manual check before preparing a proposal. The customer app cannot persist a Workflow directly because Dynatrace does not grant it Workflow write scope. Verify a synthetic end-to-end case before routing live evidence. Existing FinOps Agent Workflows remain visible until a verified changeover; never deploy two pairs on the same events. **Settings > Automation** contains the separate automatic queueing and work-lane assignment controls; both default to off. The model cannot decide credit eligibility or submit a claim. A person may record an external filing only with its channel and receipt or ticket reference. Follow [FinOps routing setup](documentation/finops-agent.md) and a private rollout record before using it with a live case.

Settings is not another required workflow. Administrators use it for optional provider connections, custom terms, the source-tag convention, the evidence window, Automation controls, and appearance.

## Product language

- A **provider service** is the provider product, such as Amazon RDS or Azure SQL Database.
- An **SLA match** connects a Dynatrace service or runtime to the provider service whose terms may apply.
- **Published terms** are the read-only `sla.directory` baseline.
- **Custom terms** are environment-specific terms applied to an explicit Dynatrace scope and date range.

An SLA match identifies applicable terms. It does not prove provider fault, contractual eligibility, or an approved credit.

## Provider support

Provider detection comes from bounded Smartscape inventory, exact provider identities, monitored-host cloud context, service topology, source tags, saved SLA matches, or enabled connections. Standard Smartscape cloud families work across tenants. Exact GenAI identities are mapped to the provider that owns the applicable SLA, so Bedrock remains AWS, Azure OpenAI remains Azure, and Google-hosted GenAI remains GCP. Databricks native topology is also recognized. Unknown identities, model names, framework names, and plain-text log mentions do not enable a provider. Detection establishes that a provider exists in the environment. It does not establish that a specific service depends on that provider.

Provider marks are copied from the public `sla.directory` logo set and bundled locally with the app. The logo catalog never enables a provider by itself. If Dynatrace detects a provider without a bundled mark, the UI uses a generated monogram.

| Provider | Optional customer-scoped incident source | Public fallback |
| --- | --- | --- |
| AWS | Dynatrace-ingested AWS Health events from Grail; optional direct API fallback | None used by the app |
| Azure | Subscription-specific Azure Resource Health events | None used by the app |
| GCP | Project-specific Personalized Service Health | Google Cloud public status |
| OCI | Tenancy-specific OCI Announcements | OCI regional public status |

Connections are optional and read-only. AWS is the exception to the normal setup burden: SLA Review first reads `aws.health` events already ingested into Grail by the tenant's existing Dynatrace AWS connection. That path needs no SLA Review credential, account ID, or role ARN. The AWS EventBridge integration must have event ingest enabled with source `aws.health`.

Direct provider API connections remain available when an administrator needs a source that is not already present in Dynatrace. Those secrets stay in Dynatrace Credential Vault; the app stores only the credential record ID, provider scope, and an optional non-secret AWS role ARN. The direct AWS fallback can assume a dedicated Health read role from a durable base credential, and the resulting one-hour role session exists only in memory for the request. AppEngine does not inherit credentials from Dynatrace's internal AWS monitoring service. A new or changed direct connection must pass **Test connection** before it can be saved.

Public-only adapters also exist for OpenAI, Anthropic, and ElevenLabs. Those feeds are non-customer-specific supporting signals. They do not prove local impact or provider fault.

Connection setup, provider IAM, and required external hosts are documented in the [provider connection guide](documentation/provider-connections.md).

## Guardrails

The rule we do not bend is simple: provider evidence and customer impact are different facts.

- Provider infrastructure in Smartscape does not mean every service runs on that provider.
- A Dynatrace Problem does not prove provider fault.
- A provider-wide `*` assignment or provider tag does not identify an exact product SLA. Earlier completed decisions under a broad mapping must be rechecked before routing.
- A provider notice does not prove impact in this tenant.
- A review case is not an SLA violation or an approved credit.
- A generated objective aggregates customer request telemetry across the monitored services linked to one exact, unambiguous provider product, account, and region. It is a screening signal, not provider-wide uptime or contractual credit proof.
- The app does not write entity tags, create Dynatrace Problems, open tickets, send email, change cloud resources, or submit claims.

When data is missing, denied, stale, or truncated, the app says so. It does not turn missing evidence into a healthy result.

Evidence reads remain bounded at 500 Problems, 200 inventory services, and 500 preferred Smartscape relationships, with a second bounded topology read for affected services. In larger tenants, incomplete counts or scope reads pause human completion and local routing. The current client-side review view is not yet validated for a tenant with 20,000 services; a paged or server-side scoped Grail read and scale test are required before such a rollout.

## Getting started

For an installed copy:

1. **Identify:** Open SLA Review in **Coverage** and review an ambiguous SLA match only when needed.
2. **Evaluate:** Open **Evidence** to select a case, consult **Provider terms** as needed, and record the human review outcome. A product investigation can apply one shared **Needs evidence** reason to explicitly selected unresolved episodes with the same confirmed provider product and Dynatrace service, even when their terms differ. The reviewer must confirm the reason applies to each selected Problem. This does not complete their separate reviews or establish one outage, account, region, or credit. The header and **Settings > Getting started** offer an optional three-step tour.
3. **Automate:** Start on **Overview** to inspect SLOs and Workflow state. Use **Service health** for detailed SLO results and **Setup** to confirm one product scope objective only when its mapping, terms, and telemetry pass the gates. From Setup, prepare each route and feedback Workflow in the Workflows editor. An authorized operator reviews and saves the drafts, then returns to refresh their status. After the separate local integration has been verified, an operator can manually queue a complete reviewed case. Automatic queueing and lane assignment remain off by default.

Published terms do not require a provider credential. A tenant administrator must allow `sla.directory` under Dynatrace **Settings > General > External requests**. Dynatrace-ingested AWS Health events also require no app credential. Direct provider connections are optional and are only for customer-scoped reports that are not already available in Grail.

The [getting started and configuration guide](documentation/getting-started.md) separates SRE, reviewer, administrator, and developer requirements and explains when each setting is needed.

### Install or develop

You need Dynatrace AppEngine in the target environment, a deployment identity with `app-engine:apps:install` and `app-engine:apps:run`, the scopes declared in [`app.config.json`](app.config.json), and Node.js 24. Work from the repository root. The App Toolkit uses the signed-in user's Dynatrace access for local development and deployment.

Install dependencies and run the release gate:

~~~text
npm ci
npm run verify:release
~~~

Set a real target environment URL in your shell before starting a local development session. Replace the placeholder with an environment you are authorized to use; do not commit its URL or credentials:

~~~powershell
$env:DT_APP_ENVIRONMENT_URL = "https://<your-environment>.apps.dynatrace.com/"
npm run start
~~~

After the release gate passes, deploy only to an approved target environment:

~~~text
npx dt-app deploy --environment-url https://your-environment.apps.dynatrace.com/
~~~

`app.config.json` and `.env.example` contain safe placeholders, not working target configuration. The CLI may request interactive sign-in. `DT_APP_ENVIRONMENT_URL` can also be set in CI. For a first installation, have an administrator approve the app scopes and allow `sla.directory` under **Settings > General > External requests**. Use the [getting-started guide](documentation/getting-started.md) to check the installed app without changing tenant data. Follow the provider connection guide instead of placing a secret in the repository or App Settings.

## Permissions and data

The manifest requests read access to the Dynatrace data used by the review, plus write access for shared app settings, user/app state, an explicitly confirmed objective, and operator-approved FinOps business events. It requests Workflow read access to display setup status, but no Workflow write scope. FinOps also reads its routing events from Grail. It does not request entity-write, Problem-write, ticketing, or Credential Vault write access. The full scope map and deny behavior are in [permissions](documentation/permissions.md).

Provider connection settings contain identifiers, not secrets. App Settings records are shared operational data and can be read by authenticated app users, so do not put credentials, confidential agreement text, personal data, or unrelated incident details in them.

No secret is bundled with the app or stored in this repository.

## Development

The main checks are:

~~~text
npm run typecheck
npm run lint
npm test
npm run build
npm run analyze
npm audit --omit=dev
~~~

`npm run verify:release` runs the release-candidate gate with CI-style coverage and the production dependency audit. Authenticated browser tests are separate because they require a target tenant and an external Playwright auth state. See [tests and acceptance](documentation/tests.md).

## Repository guide

- [Getting started and configuration](documentation/getting-started.md)
- [Architecture](documentation/architecture.md)
- [User flows](documentation/flows.md)
- [Provider connections](documentation/provider-connections.md)
- [Permissions](documentation/permissions.md)
- [Configuration and secrets](documentation/variables.md)
- [Tests](documentation/tests.md)
- [Release acceptance](documentation/acceptance.md)
- [Hub readiness](documentation/hub-readiness.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

ISC. See [LICENSE](LICENSE).

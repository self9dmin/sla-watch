# SLA Review

Cloud providers tell you what they reported. Dynatrace shows what happened in your environment. SLA Review keeps those records separate, then brings them together when an SRE needs to decide whether an incident deserves provider follow-up.

The app does not decide fault, label a case as an SLA violation, file a claim, or promise a credit.

## Project status

SLA Review is a working custom Dynatrace AppEngine app under active development. Release 0.0.74 is deployed and smoke-tested in the project tenant. It is not yet a generally available Dynatrace Hub app.

The core Coverage, Performance, Incidents, Evidence, and Directory views have automated tests and target-tenant smoke evidence. The four cloud-provider adapters are implemented, tested with controlled responses, and deployed. Live least-privilege credential acceptance for every provider is still open, along with denied-permission and large-environment testing.

The exact evidence and remaining gaps are in [release acceptance](documentation/acceptance.md) and [Hub readiness](documentation/hub-readiness.md).

## The SRE flow

| Step | What it does |
| --- | --- |
| **Coverage** | Shows the provider topology Dynatrace actually found. An SLA match exists only through provider-native topology, a matching source tag, or operator confirmation. Provider presence alone never matches every service in the tenant. |
| **Performance** | Shows customer-observed availability for app-managed objectives. A user with the right permission can explicitly create one native Dynatrace objective for one covered service. |
| **Incidents** | Turns relevant Dynatrace Problems into a smaller review queue. Problems merge only when provider service, effective terms, time, and shared service or exact root cause support one case. A shared vendor by itself is not enough. |
| **Evidence** | Carries the case forward with Problems, request telemetry, objectives, applicable terms, and optional provider reports. The SRE records **Ready for follow-up**, **Needs evidence**, or **Excluded from provider follow-up**, then can copy or download the review package. Nothing is submitted. |
| **Directory** | Shows published `sla.directory` terms, service-level coverage, support options, filing instructions, and environment-owned custom terms. |

Evidence is the stopping point today. FinOps Agent is visible as a planned idea and remains disabled.

Settings is not another required workflow. Administrators use it for optional provider connections, custom terms, the source-tag convention, the evidence window, and appearance.

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
| AWS | Account-specific AWS Health events | None used by the app |
| Azure | Subscription-specific Azure Resource Health events | None used by the app |
| GCP | Project-specific Personalized Service Health | Google Cloud public status |
| OCI | Tenancy-specific OCI Announcements | OCI regional public status |

Connections are optional and read-only. An administrator can add more than one account, subscription, project, or tenancy. Secrets stay in Dynatrace Credential Vault; the app stores only the credential record ID and the provider scope. A new or changed private connection must pass **Test connection** before it can be saved.

Public-only adapters also exist for OpenAI, Anthropic, and ElevenLabs. Those feeds are non-customer-specific supporting signals. They do not prove local impact or provider fault.

Connection setup, provider IAM, and required external hosts are documented in the [provider connection guide](documentation/provider-connections.md).

## Guardrails

The rule we do not bend is simple: provider evidence and customer impact are different facts.

- Provider infrastructure in Smartscape does not mean every service runs on that provider.
- A Dynatrace Problem does not prove provider fault.
- A provider notice does not prove impact in this tenant.
- A review case is not an SLA violation or an approved credit.
- A generated objective measures one customer service. It is not a provider-wide uptime score.
- The app does not write entity tags, create Dynatrace Problems, open tickets, send email, change cloud resources, or submit claims.

When data is missing, denied, stale, or truncated, the app says so. It does not turn missing evidence into a healthy result.

## Getting started

For an installed copy:

1. Open SLA Review. It lands in **Coverage** and starts with the provider topology Dynatrace can see.
2. Review **SLA matches** only when the app cannot safely resolve a service relationship.
3. Use **Incidents** to narrow Dynatrace Problems, then finish the human decision in **Evidence**.

Published terms do not require a provider credential. A tenant administrator must allow `sla.directory` under Dynatrace **Settings > General > External requests**. Provider connections are optional and are only for customer-scoped provider reports.

The [getting started and configuration guide](documentation/getting-started.md) separates SRE, reviewer, administrator, and developer requirements and explains when each setting is needed.

### Install or develop

You need Dynatrace AppEngine in the target environment, a deployment identity with `app-engine:apps:install` and `app-engine:apps:run`, the scopes declared in [`app.config.json`](app.config.json), and Node.js 24.

Install dependencies and run the release gate:

~~~text
npm ci
npm run verify:release
~~~

Start a local development session:

~~~text
npm run start
~~~

Deploy to a target environment:

~~~text
npx dt-app deploy --environment-url https://your-environment.apps.dynatrace.com/
~~~

`app.config.json` contains a safe placeholder environment URL. You can also set `DT_APP_ENVIRONMENT_URL` in the shell or CI environment. Follow the provider connection guide instead of placing a secret in the repository or App Settings.

## Permissions and data

The manifest requests read access to the Dynatrace data used by the review, plus narrow write access for shared app settings, user/app state, and an explicitly confirmed objective creation. It does not request entity-write, Problem-write, ticketing, or Credential Vault write access. The full scope map and deny behavior are in [permissions](documentation/permissions.md).

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

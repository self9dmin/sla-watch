# Getting started and configuration

SLA Review opens directly in Coverage. There is no required setup wizard and no provider credential is needed for the core review.

Coverage starts with what Dynatrace can already see. Published terms load from `sla.directory`, then the SRE reviews only the SLA matches that remain ambiguous. Settings is a separate administrative area for the few things that cannot be discovered safely.

## What works immediately

With the app installed and the required Dynatrace read access in place, SLA Review can:

- detect supported providers from bounded Smartscape topology, monitored-host context, exact provider identities, source tags, saved SLA matches, or enabled connections;
- show detected provider topology without assigning every tenant service to that provider;
- load published terms from `sla.directory` when that host is allowed under External requests;
- evaluate customer-observed service telemetry and existing app-managed objectives;
- organize relevant Dynatrace Problems into review cases; and
- assemble an Evidence review without sending a claim, email, ticket, or provider request.

Each source fails independently. If a user lacks a read permission or an upstream source is unavailable, the affected section says it is unavailable. Missing data is never presented as a healthy result.

## Requirements by responsibility

| Responsibility | What is required |
| --- | --- |
| Tenant installer | Dynatrace AppEngine, a deployment identity with `app-engine:apps:install` and `app-engine:apps:run`, approval for the scopes in `app.config.json`, and `sla.directory` allowed under **Settings > General > External requests**. |
| SRE reader | Access to run the app and the Dynatrace read grants needed for the views they use. A complete review uses Smartscape, Problems, metrics, logs, spans, objectives, App Settings, and app-state reads. |
| SRE reviewer | Reader access plus App Settings write access to save SLA matches, custom terms, and Evidence decisions. Objective write access is needed only when the user explicitly creates a customer objective. |
| Provider connection administrator | Reviewer access, permission to use the selected Credential Vault record, the provider's least-privilege IAM grants, and the exact outbound hosts for that adapter. |
| Developer or deployer | Node.js 24, npm, the repository, and a deployment identity for the target environment. |

The exact scope-to-feature behavior is documented in [Permissions](permissions.md). Provider IAM and outbound hosts are documented in [Provider connections](provider-connections.md).

## First review

1. Open SLA Review. It lands in **Coverage**.
2. If more than one provider is detected, choose the provider mark you want to review.
3. Start in **Detected topology**. This is provider presence, not service attribution.
4. Open **SLA matches** only when a service relationship needs review. Confirm a match only when the topology, source metadata, or your operational knowledge supports it.
5. Use **Performance** for continuous customer posture and **Incidents** for current or recent review cases.
6. Finish in **Evidence**. Save **Ready for follow-up**, **Needs evidence**, or **Excluded from provider follow-up**.

Evidence is the stopping point in the current product. A saved review can be copied or downloaded for an external handoff. SLA Review does not decide provider fault or credit eligibility and does not submit anything.

## Configure only when needed

| Setting | Use it when | Do not use it for |
| --- | --- | --- |
| Review defaults | The workspace needs a different focused provider, source-tag key, or evidence window. | Manually enabling providers. Provider detection is automatic. |
| SLA match in Coverage | Dynatrace cannot safely resolve a service-to-provider relationship, or an operator needs to correct a saved match. | Assigning every environment service because provider infrastructure exists. |
| Custom terms | A negotiated or private agreement differs from the published baseline. Set an explicit **Applies to** scope, effective dates, and a concise agreement reference. | Storing confidential agreement text, credentials, personal data, or unrelated incident notes. |
| Provider connection | The review needs account-, subscription-, project-, or tenancy-specific provider reports. | Loading published terms or using Dynatrace evidence. Those work without a provider credential. |
| Customer objective | A covered service should have an explicitly created, app-managed availability objective. | Measuring provider-wide uptime or counting provider reports as local health. |
| Appearance | A user wants system, light, or dark mode. | Shared workspace configuration. Appearance is personal. |

## Add a provider connection

Provider connections are optional and read-only. Before adding one:

1. Create a dedicated least-privilege identity in the provider account.
2. Put the secret in Dynatrace Credential Vault. Do not paste the secret into SLA Review, App Settings, a dashboard, a notebook, or the repository.
3. Allow only the adapter's documented outbound hosts under External requests.
4. Open **Settings > Provider connections**, choose the provider and customer scope, select the Credential Vault record, then run **Test connection**.
5. Save only after the test confirms the provider identity and requested scope.

AWS Health account events require an eligible AWS support plan. Azure, Google Cloud, and OCI have their own IAM and API prerequisites. Use the [Provider connection guide](provider-connections.md) for the exact requirements and removal steps.

## Safe operating boundary

- Published terms are a read-only reference. A private agreement or service-specific term may take precedence.
- Provider reports support a review but do not prove impact in this Dynatrace environment.
- Dynatrace Problems and telemetry show customer-observed impact but do not prove provider fault.
- App Settings are shared operational data. Store only bounded identifiers, explicit scopes, dates, checklist state, and concise notes.
- Provider secrets remain in Credential Vault. SLA Review stores only the selected credential record ID and non-secret provider scope.

## If something is missing

- No provider appears: confirm Smartscape or monitored-host read access and verify that provider-native topology is present in the selected time range.
- Published terms are unavailable: allow `sla.directory` under External requests and retry.
- A provider is detected but no service is matched: inspect Detected topology first. Confirm an SLA match only when a service relationship or source tag supports it.
- A view says access is unavailable: compare the user's grants with [Permissions](permissions.md). Do not interpret the empty area as zero data.
- Customer-scoped provider reports are unavailable: use **Test connection** and follow the adapter-specific failure message. Dynatrace evidence and published terms remain separate.

For local development, deployment, and secret inventory, see [Variables, configuration, and secrets](variables.md).

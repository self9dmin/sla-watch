# Getting started and configuration

SLA Review opens directly in Coverage. There is no required setup wizard and no provider credential is needed for the core review.

Coverage starts with what Dynatrace can already see. The three stages are **Identify**, **Evaluate**, and **Automate**. Published terms load from `sla.directory`, then the SRE reviews only the SLA matches that remain ambiguous. Settings is a separate administrative area for the few things that cannot be discovered safely.

## What works immediately

With the app installed and the required Dynatrace read access in place, SLA Review can:

- detect supported providers from bounded Smartscape topology, monitored-host context, exact provider identities, source tags, saved SLA matches, or enabled connections;
- show detected provider topology without assigning every tenant service to that provider;
- load published terms from `sla.directory` when that host is allowed under External requests;
- read AWS Health events already ingested into Grail through the tenant's Dynatrace AWS connection;
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
| FinOps operator | Reviewer access plus `openpipeline:bizevents:ingest` to queue a complete reviewed case or record later human feedback, and `storage:bizevents:read` to see route outcomes. Workflow status needs `automation:workflows:read` in the app, but another owner's private Workflows may remain invisible. Automate > Setup can send prefilled proposals to Workflows; a designated owner or Workflow admin first checks the tenant inventory and acknowledges that manual safeguard. A separately authorized operator inspects and saves the drafts there and verifies the local gateway and EdgeConnect before queueing. |
| Direct provider connection administrator | Reviewer access, permission to use the selected Credential Vault record, the provider's least-privilege IAM grants, and the exact outbound hosts for that adapter. Dynatrace-ingested AWS Health does not need this role. |
| Developer or deployer | Node.js 24, npm, the repository, and a deployment identity for the target environment. |

The exact scope-to-feature behavior is documented in [Permissions](permissions.md). Provider IAM and outbound hosts are documented in [Provider connections](provider-connections.md).

## First review

1. **Identify:** Open SLA Review in **Coverage**. Choose a provider if more than one is detected. **Detected topology** shows presence, not service attribution. Open **SLA matches** only for an uncertain relationship.
2. **Evaluate:** Open **Evidence** and follow the next action. When Dynatrace identifies only a provider, Evidence shows one product-coverage task with the related Problems underneath. Confirm the exact product in **Coverage** before applying terms. For exact matches, Evidence shows one investigation per provider product; open it to inspect separate episodes and their underlying Problems. The product view is navigation, not a combined outage or claim. Use **Provider terms** for published or custom terms. Save **Evidence review complete**, **Needs evidence**, or **Excluded from provider follow-up** after a human review of an episode. To record the same missing-evidence reason for several unresolved episodes with the same confirmed provider product and Dynatrace service, open **Triage matching episodes together**, select the exact Problems, inspect the preview, and confirm that the reason applies to each. Terms can differ between selected episodes. Check the terms, account, region, time window, and impact separately before completing each review. This action records only **Needs evidence** per selected Problem. It does not establish one outage, complete other reviews, queue local routing, or submit a claim. Custom terms are matched to the incident start date; published terms are the current directory reference and may need historical confirmation.
3. **Automate:** The **Overview** shows existing SLOs, visible Workflow state, the local decision path, and recent recommendations. **Service health** shows the detailed native SLO inventory. **Setup** holds guarded product-scope SLO creation and route/feedback Workflow preparation. Create a product-scope objective only when its evidence gates pass. A designated Workflow owner or admin checks for an existing private pair and acknowledges that manual check before preparing another proposal. Enter the private EdgeConnect origin, Credential Vault record ID, and local decision interface once, then prepare each prefilled Workflow proposal. An authorized operator checks and saves the editor drafts in Dynatrace Workflows, returns to Automate, and refreshes Workflow status. After the local gateway and Workflows have been configured and verified with a synthetic case, manually queue an eligible, complete case. **Settings > Automation** contains the **Automation controls**; automatic queueing and lane assignment start off. A model recommendation is not a credit decision or claim submission.

Evidence is the human review gate. A saved review can be copied or downloaded for an external handoff. After the local FinOps integration is configured and verified, a complete, closed, single-service case may be manually queued in Automate. Automatic queueing and lane assignment are separate settings that start off. The local model recommends an internal route; SLA Review does not decide provider fault or credit eligibility or submit a claim. See [FinOps routing setup](finops-agent.md).

## Check a new installation without changing data

1. Open the installed app. It should land in **Coverage** without a setup wizard. A tenant with no detected provider may show an empty or access-incomplete state; that is not a successful detection.
2. Open **Settings > Getting started**, then **Show quick tour**. Its three steps visit Identify, Evaluate, and Automate, then return to the starting page. Closing the tour should not change any saved setting or review.
3. Open **Evaluate > Provider terms**. Published terms should load when `sla.directory` is allowed, or the view should state why they are unavailable. No provider credential is needed for this check.
4. Open **Evaluate > Evidence**. Confirm that returned Problems and review cases appear, or that an empty, denied, unavailable, or limited result is explained. Do not save a decision just to complete this check.
5. Open **Automate > Overview**, then **Automate > Setup** and **Settings > Automation**. Check the SLO and visible Workflow states, including the Workflow actor and last execution when shown. A missing row does not prove that no private Workflow exists under another owner. Both automatic controls should be off until a separate synthetic end-to-end verification is complete. Do not select **Prepare route draft in Workflows** or **Prepare feedback draft in Workflows** during this read-only installation check. A sent proposal, Workflow draft, or status row does not prove that the gateway, Bindplane, or Phoenix are operating.

For a clean local development run, set `DT_APP_ENVIRONMENT_URL` to a real environment you may use, then run `npm ci`, `npm run verify:release`, and `npm run start` from the repository root. The checked-in URL is a placeholder. Local development and deployment may require interactive Dynatrace sign-in. See the [README](../README.md#install-or-develop) for commands; a passing local gate does not verify an installed version in the target tenant.

## Configure only when needed

| Setting | Use it when | Do not use it for |
| --- | --- | --- |
| Review defaults | The workspace needs a different focused provider, source-tag key, or evidence window. | Manually enabling providers. Provider detection is automatic. |
| SLA match in Coverage | Dynatrace cannot safely resolve a service-to-provider relationship, or an operator needs to correct a saved match. | Assigning every environment service because provider infrastructure exists. |
| Custom terms | A negotiated or private agreement differs from the published baseline. Set an explicit **Applies to** scope, effective dates, and a concise agreement reference. | Storing confidential agreement text, credentials, personal data, or unrelated incident notes. |
| Direct provider connection | The review needs a customer-scoped provider API that is not already represented in Dynatrace. | Loading published terms, using Dynatrace evidence, or reading Dynatrace-ingested AWS Health events. Those work without an app credential. |
| Customer objective in Automate | An exact, unambiguous provider-native or operator-confirmed product resource relationship has a known account and region, common terms target, and request evidence for every linked service. | Creating one objective per dependent service, treating customer telemetry as provider-wide uptime, or counting provider reports as local health. |
| Appearance | A user wants system, light, or dark mode. | Shared workspace configuration. Appearance is personal. |

## Add a provider connection

Provider connections are optional and read-only. For AWS, first enable Amazon EventBridge event ingest with source `aws.health` on the existing Dynatrace AWS connection. SLA Review reads those records from Grail and needs no Credential Vault entry.

Before adding a direct connection:

1. Create a dedicated least-privilege identity in the provider account. For AWS, prefer a base identity that can assume a dedicated Health read role.
2. Put the secret in Dynatrace Credential Vault. Do not paste the secret into SLA Review, App Settings, a dashboard, a notebook, or the repository.
3. Allow only the adapter's documented outbound hosts under External requests.
4. Open **Settings > Provider connections**, choose the provider and customer scope, select the Credential Vault record, then run **Test connection**.
5. Save only after the test confirms the provider identity and requested scope.

The optional direct AWS Health fallback requires an eligible AWS support plan. Enter the Health role ARN and vault only a durable base signing credential. The base identity needs `sts:AssumeRole` on that role; the role owns the three Health read actions. SLA Review obtains a fresh one-hour role session for each request and never stores that session. It cannot borrow the internal identity used by Dynatrace monitoring. Azure, Google Cloud, and OCI have their own IAM and API prerequisites. Use the [Provider connection guide](provider-connections.md) for the exact requirements and removal steps.

## Safe operating boundary

- Published terms are a read-only reference. A private agreement or service-specific term may take precedence.
- Provider reports support a review but do not prove impact in this Dynatrace environment.
- Dynatrace Problems and telemetry show customer-observed impact but do not prove provider fault.
- A provider-wide match (`*`) confirms provider identity only. It does not select a product SLA. Prior completed decisions under that broad mapping are retained but must be reviewed again before routing.
- If Problem counts or Smartscape inventory are incomplete, Evidence pauses completion and local routing. The bounded client-side read has not been validated for a 20,000-service tenant.
- App Settings are shared operational data. Store only bounded identifiers, explicit scopes, dates, checklist state, and concise notes.
- Provider secrets remain in Credential Vault. SLA Review stores only the selected credential record ID and non-secret provider scope.

## If something is missing

- No provider appears: confirm Smartscape or monitored-host read access and verify that provider-native topology is present in the selected time range.
- Published terms are unavailable: allow `sla.directory` under External requests and retry.
- A provider is detected but no service is matched: inspect Detected topology first. Confirm an SLA match only when a service relationship or source tag supports it.
- A view says access is unavailable: compare the user's grants with [Permissions](permissions.md). Do not interpret the empty area as zero data.
- AWS Health is empty: confirm the monitored account's EventBridge integration has event ingest enabled with source `aws.health`. No records can also mean no matching event occurred in the selected window.
- A direct customer-scoped provider report is unavailable: use **Test connection** and follow the adapter-specific failure message. Dynatrace evidence and published terms remain separate.

For local development, deployment, and secret inventory, see [Variables, configuration, and secrets](variables.md).

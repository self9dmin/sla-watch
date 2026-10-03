# SRE journey

## Persona and job

The primary user is an on-call SRE or platform engineer. When a monitored service degrades, they need to determine whether the affected service has a defensible SLA match and which published or custom terms apply, without treating correlation as proof of provider fault.

The first useful moment is not completing setup. It is seeing every loaded service classified from current Dynatrace evidence, with covered services and genuine review work clearly separated.

## Journey map

The primary navigation has three stages: **Identify** (Coverage), **Evaluate** (Evidence and Provider terms), and **Automate** (Overview, Service health, and Setup). Coverage is always the landing page. Evidence is the only case queue. Automate opens on existing SLOs, the actual Workflow state, and recent decisions. Service health shows native SLO evaluations; Setup holds guarded SLO creation and Workflow instructions.

| Stage | Touchpoint | User action | Likely reaction | Main risk | Product response |
| --- | --- | --- | --- | --- | --- |
| Install and open | Dynatrace Apps | Open SLA Review | “Show me what this environment already knows.” | A wizard delays evidence and repeats automatic detection | Open directly in Coverage and start read-only detection |
| Provider detection | Coverage status | Review detected providers and SLA-matched services | Confidence when the result reflects the environment | “Detected” could be mistaken for a confirmed SLA match | Label environment detection separately from provider terms, fault, and eligibility |
| Coverage review | Detected topology and SLA matches | Inspect provider topology first, then open SLA matches and focus All, Covered, or Needs review when a service relationship needs attention | Complete context without hidden states | Large environments become an unbounded checklist | Start on Detected topology, keep the SLA-match filters, search, paging, and incomplete-inventory disclosure |
| Review defaults | Settings | Choose the focused provider, tag convention, and evidence lookback | Consistent review behavior without duplicating provider setup | A stale focus could be mistaken for current evidence | Constrain the chooser to providers discovered from evidence, confirmed SLA matches, or enabled connections |
| Incident connection | Settings | Optionally connect account-specific provider notices | Useful only when customer-scoped provider evidence is needed | Credentials and IAM setup interrupt first value | Ask for credentials only after the user chooses a provider connection |
| Review triage | Evidence queue | Resolve one provider-product coverage task when the exact product is unknown, or open one product investigation and inspect its leading evidence episode | One clear next action, with related signals available on drilldown | Many historical Problems on one service can look like many claims, while an unsafe merge could hide distinct contract scopes | Keep Problems as supporting signals. Product investigations organize navigation only; merge episode evidence only when exact product, effective terms scope, time, and shared service or exact root cause support it |
| Evidence review | Evidence | Search or filter review cases, inspect readiness, customer telemetry, objective posture, terms, exclusions, and optional provider corroboration, then save Evidence review complete, Needs evidence, or Excluded from provider follow-up | One bounded decision with every underlying signal retained, a portable artifact, and a clear stop | Provider silence could be mistaken for proof against customer impact, or readiness for submission | Keep provider corroboration supporting only, persist the same outcome per included Problem, surface mixed or unavailable state, and state that nothing is sent and the provider determines fault, eligibility, and credit |
| Follow-up | Provider terms and Automate | Review filing requirements; after a complete human review, queue an eligible case for internal routing when the local gateway and Workflows have been configured and verified | Clear next action | A model recommendation could be mistaken for credit eligibility or provider submission | Keep automatic queueing and lane assignment off by default; require a person to record the later outcome and any external filing reference |

## Product decisions

- Keep the optional three-step quick tour aligned with the three primary stages, without a required setup wizard or duplicate provider confirmation.
- Make Coverage the first screen for every new and returning user.
- Keep provider additions and optional incident connections in Settings.
- Keep the quick tour optional, replayable, and non-mutating.
- Complete the human evidence review in Evidence before the Automate stage. Keep provider submission outside the app.
- Measure success by time to evidence, resolved coverage exceptions, and repeat incident review, not onboarding completion.

## Critical checks

- A fresh user reaches Coverage without making a configuration choice.
- Automatic provider detection is never described as proof of an SLA match, fault, impact, or eligibility.
- Global provider inventory and service-level attribution are shown as separate states. A detected cloud does not silently claim every service in the environment.
- No provider credential is requested until an administrator deliberately opens Provider connections.
- No access or upstream failure is converted into an empty or healthy state.
- Returning users keep their workspace configuration and do not see first-run ceremony again.
- Evidence does not ask the SRE to rediscover coverage or terms. A repair link carries the exact provider service and returns to the same review case.
- Missing or contradictory provider-owned evidence never erases a Dynatrace-observed customer-impact signal.
- Automatic case grouping requires one provider service, one effective terms scope, a bounded review window, and either one shared affected service or one exact returned root cause. Provider identity by itself is never enough.
- A provider-wide assignment, tag, or ambiguous topology result creates one coverage action, not one review task per Problem. An exact product match is required before applying SLA terms or routing.
- A provider-product investigation organizes reviews. It never sums Problem windows into provider downtime or treats a shared service as a shared outage.
- An incomplete Problem count or Smartscape inventory pauses completed reviews and local routing. The current bounded read is not a validated 20,000-service design.
- Host or location custom terms can prevent automatic case merging until the exact runtime scope is verified. This conservative boundary is visible in the queue.
- Manual bulk triage may include a missing-root-cause case only when every underlying Problem is closed, provider scope is confirmed, relationship and decision context are complete, and no prior decision exists.
- A bulk exclusion remains a human operational classification. It is not proof that the provider was uninvolved.
- Evidence review complete requires each published evidence requirement to be present and acknowledged; Needs evidence records what is still missing.
- Evidence separates facts collected automatically, facts confirmed externally, and missing items. Provider corroboration stays optional.
- Copying a follow-up summary or downloading the JSON review never submits, routes, or changes the saved decision.

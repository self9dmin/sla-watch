# SRE journey

## Persona and job

The primary user is an on-call SRE or platform engineer. When a monitored service degrades, they need to determine whether the affected service has a defensible provider boundary and which published or tenant-specific terms apply, without treating correlation as proof of provider fault.

The first useful moment is not completing setup. It is seeing every loaded service classified from current Dynatrace evidence, with covered services and genuine review work clearly separated.

## Journey map

| Stage | Touchpoint | User action | Likely reaction | Main risk | Product response |
| --- | --- | --- | --- | --- | --- |
| Install and open | Dynatrace Apps | Open SLA Review | “Show me what this environment already knows.” | A wizard delays evidence and repeats automatic detection | Open directly in Coverage and start read-only detection |
| Provider detection | Coverage status | Review detected providers and matched services | Confidence when the result reflects the environment | “Detected” could be mistaken for confirmed contract coverage | Label environment detection separately from provider terms, fault, and eligibility |
| Coverage review | Service coverage | See all loaded services, then focus Covered or Needs review | Complete context without hidden states | Large environments become an unbounded checklist | Default to All, keep visible filters, search, paging, and incomplete-inventory disclosure |
| Review defaults | Settings | Choose the focused provider, tag convention, and evidence lookback | Consistent review behavior without duplicating provider setup | A stale focus could be mistaken for current evidence | Constrain the chooser to providers discovered from evidence, confirmed coverage, or enabled connections |
| Incident connection | Settings | Optionally connect account-specific provider notices | Useful only when customer-scoped provider evidence is needed | Credentials and IAM setup interrupt first value | Ask for credentials only after the user chooses a provider connection |
| Incident triage | Incidents | Review active and provider-relevant Problems, use exact root-cause context, then choose Coverage, Evidence, native Problems, or a guarded bulk dismissal | A short, familiar worklist that makes repeated non-provider patterns faster to clear | Bulk action or a missing provider link could be mistaken for proof | Restrict bulk review to eligible closed Problems, require a second confirmation, save one audited decision per Problem, and hand deep investigation to Problems |
| Evidence decision | Evidence | Review customer telemetry, objective posture, terms, exclusions, and optional provider reports, then save Package ready, Not ready, or Not provider-related | A bounded decision with traceable context and a clear stop | Provider silence could be mistaken for proof against customer impact, or readiness for submission | Keep provider reports supporting only, persist the checklist and note, and state that nothing is sent and the provider determines fault, eligibility, and credit |
| Follow-up | Review terms and future FinOps Agent | Review filing requirements or hand off later | Clear next action | Planned automation could imply an available capability | Keep the agent disabled until a verified implementation exists |

## Product decisions

- Remove the five-step onboarding wizard and duplicate provider confirmation.
- Make Coverage the first screen for every new and returning user.
- Keep provider additions and optional incident connections in Settings.
- Keep the walkthrough explicit, replayable, and non-mutating.
- End the SRE path in Evidence with an explicit package-ready, not-ready, or not-provider-related state. Keep submission outside the current product.
- Measure success by time to evidence, resolved coverage exceptions, and repeat incident review, not onboarding completion.

## Critical checks

- A fresh user reaches Coverage without making a configuration choice.
- Automatic provider detection is never described as proof of contract coverage, fault, impact, or eligibility.
- No provider credential is requested until an administrator deliberately opens Provider connections.
- No access or upstream failure is converted into an empty or healthy state.
- Returning users keep their workspace configuration and do not see first-run ceremony again.
- Evidence does not ask the SRE to rediscover coverage or terms. A repair link carries the exact provider service and returns to the same Problem.
- Missing or contradictory provider-owned evidence never erases a Dynatrace-observed customer-impact signal.
- Root-cause-assisted bulk triage never includes active, provider-linked, incomplete, missing-root-cause, unconfirmed-scope, or previously reviewed Problems.
- A bulk outcome remains a human Not provider-related classification. It is not proof that the provider was uninvolved.
- Package ready requires each published evidence requirement to be present and acknowledged; Not ready records what is still missing.

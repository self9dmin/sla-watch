# SRE journey

## Persona and job

The primary user is an on-call SRE or platform engineer. When a monitored service degrades, they need to determine whether the affected service has a defensible SLA match and which published or custom terms apply, without treating correlation as proof of provider fault.

The first useful moment is not completing setup. It is seeing every loaded service classified from current Dynatrace evidence, with covered services and genuine review work clearly separated.

## Journey map

| Stage | Touchpoint | User action | Likely reaction | Main risk | Product response |
| --- | --- | --- | --- | --- | --- |
| Install and open | Dynatrace Apps | Open SLA Review | “Show me what this environment already knows.” | A wizard delays evidence and repeats automatic detection | Open directly in Coverage and start read-only detection |
| Provider detection | Coverage status | Review detected providers and SLA-matched services | Confidence when the result reflects the environment | “Detected” could be mistaken for a confirmed SLA match | Label environment detection separately from provider terms, fault, and eligibility |
| Coverage review | Service coverage | See all loaded services, then focus Covered or Needs review | Complete context without hidden states | Large environments become an unbounded checklist | Default to All, keep visible filters, search, paging, and incomplete-inventory disclosure |
| Review defaults | Settings | Choose the focused provider, tag convention, and evidence lookback | Consistent review behavior without duplicating provider setup | A stale focus could be mistaken for current evidence | Constrain the chooser to providers discovered from evidence, confirmed SLA matches, or enabled connections |
| Incident connection | Settings | Optionally connect account-specific provider notices | Useful only when customer-scoped provider evidence is needed | Credentials and IAM setup interrupt first value | Ask for credentials only after the user chooses a provider connection |
| Incident triage | Incidents | Review active and provider-relevant cases, inspect the root-cause and affected-service context, then choose Coverage, Evidence, native Problems, or a guarded bulk exclusion | Fewer review units without losing the source records | Same-vendor signals could be over-grouped or mistaken for a confirmed violation | Group only on provider service, effective terms scope, bounded time, and shared service or exact root cause; keep one audit record per Problem and reuse the Evidence state everywhere |
| Evidence review | Evidence | Search or filter review cases, inspect readiness, customer telemetry, objective posture, terms, exclusions, and optional provider corroboration, then save Ready for follow-up, Needs evidence, or Excluded from provider follow-up | One bounded decision with every underlying signal retained, a portable artifact, and a clear stop | Provider silence could be mistaken for proof against customer impact, or readiness for submission | Keep provider corroboration supporting only, persist the same outcome per included Problem, surface mixed or unavailable state, and state that nothing is sent and the provider determines fault, eligibility, and credit |
| Follow-up | Directory and future FinOps Agent | Review filing requirements or hand off later | Clear next action | Planned automation could imply an available capability | Keep the agent disabled until a verified implementation exists |

## Product decisions

- Remove the five-step onboarding wizard and duplicate provider confirmation.
- Make Coverage the first screen for every new and returning user.
- Keep provider additions and optional incident connections in Settings.
- Keep the quick tour optional, replayable, and non-mutating.
- End the SRE path in Evidence with an explicit ready-for-follow-up, needs-evidence, or excluded state. Keep submission outside the current product.
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
- Manual bulk triage may include a missing-root-cause case only when every underlying Problem is closed, provider scope is confirmed, relationship and decision context are complete, and no prior decision exists.
- A bulk exclusion remains a human operational classification. It is not proof that the provider was uninvolved.
- Ready for follow-up requires each published evidence requirement to be present and acknowledged; Needs evidence records what is still missing.
- Evidence separates facts collected automatically, facts confirmed externally, and missing items. Provider corroboration stays optional.
- Copying a follow-up summary or downloading the JSON review never submits, routes, or changes the saved decision.

# SRE journey

## Persona and job

The primary user is an on-call SRE or platform engineer. When a monitored service degrades, they need to determine whether the affected service has a defensible provider boundary and which published or tenant-specific terms apply, without treating correlation as proof of provider fault.

The first useful moment is not completing setup. It is seeing provider-backed services identified from current Dynatrace evidence and a short queue containing only coverage exceptions that need judgment.

## Journey map

| Stage | Touchpoint | User action | Likely reaction | Main risk | Product response |
| --- | --- | --- | --- | --- | --- |
| Install and open | Dynatrace Apps | Open SLA Review | “Show me what this environment already knows.” | A wizard delays evidence and repeats automatic detection | Open directly in Coverage and start read-only detection |
| Provider detection | Coverage status | Review detected providers and matched services | Confidence when the result reflects the environment | “Detected” could be mistaken for confirmed contract coverage | Label environment detection separately from provider terms, fault, and eligibility |
| Coverage review | Coverage exceptions | Resolve only ambiguous, conflicting, or manually requested mappings | Focused, low-noise work | Large environments become an unbounded checklist | Default to exceptions, keep search and paging, and expose incomplete inventory |
| Review defaults | Settings | Choose the focused provider, tag convention, and evidence lookback | Consistent review behavior without duplicating provider setup | A stale focus could be mistaken for current evidence | Constrain the chooser to providers discovered from evidence, confirmed coverage, or enabled connections |
| Incident connection | Settings | Optionally connect account-specific provider notices | Useful only when customer-scoped provider evidence is needed | Credentials and IAM setup interrupt first value | Ask for credentials only after the user chooses a provider connection |
| Incident review | Incidents | Compare a Dynatrace Problem with the applied provider terms | Faster triage | A service symptom could be presented as provider responsibility | Preserve exact entity boundaries and keep uncertainty explicit |
| Evidence decision | Evidence | Validate or dismiss a candidate for operational follow-up | A bounded decision with traceable context | Validation could be mistaken for claim approval | State that the provider determines fault, eligibility, and credit |
| Follow-up | Review terms and future FinOps Agent | Review filing requirements or hand off later | Clear next action | Planned automation could imply an available capability | Keep the agent disabled until a verified implementation exists |

## Product decisions

- Remove the five-step onboarding wizard and duplicate provider confirmation.
- Make Coverage the first screen for every new and returning user.
- Keep provider additions and optional incident connections in Settings.
- Keep the walkthrough explicit, replayable, and non-mutating.
- Measure success by time to evidence, resolved coverage exceptions, and repeat incident review, not onboarding completion.

## Critical checks

- A fresh user reaches Coverage without making a configuration choice.
- Automatic provider detection is never described as proof of contract coverage, fault, impact, or eligibility.
- No provider credential is requested until an administrator deliberately opens Provider connections.
- No access or upstream failure is converted into an empty or healthy state.
- Returning users keep their workspace configuration and do not see first-run ceremony again.

# Test coverage map

This document separates executable coverage from manual or proposed coverage. Passing local tests does not prove that tenant permissions, external allowlists, or the deployed Hub artifact are correct.

## Existing coverage

| Use case | Rule | Expected behavior, including negative case | Evidence | Status |
| --- | --- | --- | --- | --- |
| Provider setup advice | Missing provider labels must not become provider proof | A service inventory with no provider label produces a high-priority labeling recommendation and no outage claim | `tests/recommendations.test.ts` | Existing unit test |
| Provider setup advice | A wrong label must be distinguished from a missing label | Existing labels that do not match the selected contract produce a mapping recommendation | `tests/recommendations.test.ts` | Existing unit test |
| Access failure | Permission failure is not absence of data | Telemetry error produces an access recommendation and suppresses provider-label advice | `tests/recommendations.test.ts` | Existing unit test |
| SLO follow-up | SLO advice requires a known provider boundary | A matched provider label with owner context can suggest native SLO follow-up | `tests/recommendations.test.ts` | Existing unit test |
| External contract parsing | Untrusted directory payloads must be validated | Invalid envelope or service identity throws before data reaches the UI | `tests/slaDirectory.function.test.ts` | Existing unit test |
| Static quality | Type and lint errors block a change | `npm run typecheck` and `npm run lint` exit successfully | `package.json`, CI workflow | Existing CI gate |
| Bundle validity | App manifest and bundle must be accepted by `dt-app` | `npm run build` and `npm run analyze` exit successfully | `dt-app` output | Existing CI gate |
| Browser smoke | A deployed app exposes the watch, conservative posture, and theme switch | The Playwright suite reaches the watch and preserves the evidence surface | `tests/e2e/sla-watch.spec.ts`, `playwright.config.ts` | Prepared guarded E2E |

## Proposed tests

| Use case | Rule | Expected behavior, including negative case | Test type | Status |
| --- | --- | --- | --- | --- |
| Tenant access matrix | Each missing declared scope yields the documented degraded state | A test user without entities, events, logs, spans, metrics, or state access sees unknown/incomplete, never false absence | Guarded live integration | Proposed |
| External dependency | Upstream timeout, 4xx, 5xx, invalid JSON, and empty services remain safe | Directory status is unavailable and no contract result is reused as current | Automated function integration | Proposed |
| Browser first run | Onboarding completes and can be skipped | The app reaches the dashboard; skip does not fabricate provider evidence | `tests/e2e/sla-watch.spec.ts` | Prepared, guarded live run pending |
| Browser themes | Both themes retain readable status text and controls | Light and dark views preserve the evidence surface | `tests/e2e/sla-watch.spec.ts` plus visual review | Prepared, guarded live run pending |
| Shared state fallback | App-state denial is communicated accurately | The UI says local fallback, and never claims a workspace save succeeded | Manual smoke plus future denied-permission E2E | Partially verified |
| Hub install | Clean install from the release artifact | App launches, function runs with allowlist, and Technical information matches the manifest | Guarded live acceptance | Proposed |

## Gaps

1. No live IAM negative tests are committed because they require tenant identities and permission fixtures.
2. The Playwright suite is committed, but no authenticated CI run is recorded because test credentials must be supplied through CI secrets, never checked into the repository.
3. DQL query validity and the semantic scope of tenant-wide log/span counts still require a representative tenant test case.
4. The provider-service-to-Dynatrace-service join is not implemented, so no test can claim end-to-end contract eligibility.
5. No automated accessibility scan is wired into CI.

## CI policy

Pull requests must pass `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:ci`, `npm run build`, `npm run analyze`, and `npm audit --omit=dev`. Deployment is intentionally not part of the pull-request job.

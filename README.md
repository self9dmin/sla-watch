# SLA Watch

SLA Watch is a Dynatrace AppEngine app for evidence-first provider SLA attribution. It puts a provider contract beside the service boundary and telemetry needed to decide whether an SRE has enough evidence for a human review.

## Current capability

- Reads the tenant service inventory with DQL.
- Reads Davis Problems, logs, spans, and service-request telemetry for a selectable 24- or 72-hour window.
- Retrieves provider and service contract data from the versioned `sla.directory` JSON API through an AppEngine function.
- Provides an Incident review tab with observed Problem windows, provider-published credit terms, filing guidance, required evidence, and exclusions.
- Separates missing telemetry, incomplete entity access, missing provider labels, and labels that do not match the selected provider.
- Recommends setup actions for provider boundaries, ownership metadata, service naming, and native SLO follow-up.
- Keeps personal theme and onboarding state separate from shared watch configuration and workflow records.
- Records bug and change context without mutating Dynatrace entities or creating external tickets.

## Deliberate boundaries

SLA Watch does not issue credits, prove provider fault, mutate service tags, create SLOs, or silently infer ownership from a service name. A matching label and an active Problem are only a candidate for review. Provider terms and filing dates are planning references from the directory record, not an automated eligibility or approval decision. Provider service IDs are not yet joined automatically to Dynatrace service entity IDs, so the app must not be treated as an automated eligibility decision.

The runtime data path does not require an MCP server. `sla.directory` MCP is useful for agent-assisted research and contract discovery, while the deployed app uses the public versioned JSON API.

## Prerequisites

- Dynatrace AppEngine enabled in the target environment.
- A user or deployment identity with the app's declared scopes in `app.config.json`.
- `sla.directory` added as an allowed external host for AppEngine functions. The host entry is `sla.directory`, without a protocol or path.
- Node.js 24 for the supported local and CI toolchain.

The app requests only read access to Dynatrace telemetry plus read/write access to user and app state. It does not request settings, entity-write, credential-vault, or ticketing permissions.

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

User theme and walkthrough state use user app state. Provider selection, label convention, lookback, bug records, and change records use shared app state when the workspace scope is available. The browser fallback is local storage and is clearly surfaced when shared state cannot be written. App-state records expire after 90 days and are capped at 100 records per workflow type.

Do not enter secrets, credentials, or unnecessary personal data into bug or change records. No secret is bundled in the app or stored in this repository.

## Repository documentation

- [`documentation/architecture.md`](documentation/architecture.md) maps the system and trust boundaries.
- [`documentation/flows.md`](documentation/flows.md) describes load-bearing user journeys.
- [`documentation/permissions.md`](documentation/permissions.md) maps app scopes to operations and deny behavior.
- [`documentation/variables.md`](documentation/variables.md) records configuration and secret handling.
- [`documentation/tests.md`](documentation/tests.md) separates existing coverage from proposed tests and gaps.
- [`documentation/dependency-audit.md`](documentation/dependency-audit.md) records the production-clean audit and the upstream development-tooling finding.
- [`documentation/acceptance.md`](documentation/acceptance.md) records the manually verified tenant smoke scenarios for the release candidate.
- [`documentation/hub-readiness.md`](documentation/hub-readiness.md) records the Dynatrace Hub readiness audit and remaining portal-owned steps.

## License

The project declares the ISC license. See [`LICENSE`](LICENSE).

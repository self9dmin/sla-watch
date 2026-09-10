# SLA Watch

SLA Watch is a Dynatrace AppEngine app for evidence-first provider SLA attribution. It puts a provider contract beside the service boundary and telemetry needed to decide whether an SRE has enough evidence for a human review.

## Current capability

- Reads the tenant service inventory with DQL.
- Reads Davis Problems, logs, spans, and service-request telemetry for a selectable 24-hour to 90-day window.
- Retrieves provider and service contract data from the versioned `sla.directory` JSON API through an AppEngine function.
- Presents a compact Overview with the current state, supporting facts, and one recommended next action.
- Provides a focused Setup view for telemetry checks, provider-tag review, and service assignment.
- Lets an authorized user add the configured provider tag to explicitly selected service entities after a confirmation step. Existing tags remain in place, conflicts are held for review, and the last app action can be undone.
- Provides an Incidents view with an observed Problem queue, provider-published credit terms, filing guidance, required evidence, and exclusions.
- Stores tenant-owned custom SLA terms in Dynatrace App Settings while retaining the public `sla.directory` record as the comparison baseline.
- Assigns one custom SLA to one or more exact Dynatrace services, hosts, runtimes, or observed locations. Smartscape relationships supply service-to-runtime context, and entity IDs establish the boundary.
- Applies custom terms in the order host, location, service, provider-wide fallback, then public directory baseline.
- Separates missing telemetry, incomplete entity access, missing provider tags, and tags that do not match the selected provider.
- Recommends setup actions for provider boundaries, ownership metadata, service naming, and native SLO follow-up.
- Keeps personal theme and onboarding state separate from shared watch configuration.
- Provides a read-only application change log. Dynatrace Community support is visible as coming soon and remains disabled until public launch.

## Deliberate boundaries

SLA Watch does not issue credits, prove provider fault, create SLOs, or silently infer ownership from a service name. It changes a provider tag only after an authorized user reviews and confirms exact service entities in Setup. A matching tag, Smartscape relationship, SLA assignment, and active Problem are only inputs to a human review. Provider terms and filing dates are planning references, not an automated eligibility or approval decision.

Custom SLA assignments are explicit. An SRE selects the provider service and exact Dynatrace entity IDs that the private terms cover. When a Problem includes an assigned service, or Smartscape links it to an assigned runtime or location, the app can apply the matching terms. If more than one equally specific assignment matches, the operator chooses the boundary. The app never uses a similar service name to create that relationship.

The runtime data path does not require an MCP server or a user-supplied `sla.directory` credential. The installed app calls the public versioned JSON API automatically through its AppEngine function. `sla.directory` MCP remains useful for agent-assisted research and contract discovery.

## Prerequisites

- Dynatrace AppEngine enabled in the target environment.
- A user or deployment identity with the app's declared scopes in `app.config.json`.
- `sla.directory` added as an allowed external host for AppEngine functions. The host entry is `sla.directory`, without a protocol or path.
- Users who apply or undo provider tags need the Dynatrace permission to manage entity settings. Users without it keep a read-only Setup experience.
- Users who create or edit custom SLAs need App Settings write access for the `contract-overrides` schema. All authenticated app users can read these settings, so records must contain operational values and a concise source reference, not private contract text or credentials.
- Node.js 24 for the supported local and CI toolchain.

The app requests read access to Dynatrace telemetry and Smartscape, read/write access to user state, shared app state, and tenant SLA settings, plus `environment-api:entities:write` for the confirmed provider-tag action. It does not request credential-vault, ticketing, SLO-write, or Problem-write permissions. See [`documentation/permissions.md`](documentation/permissions.md) for the complete boundary.

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

User theme and walkthrough state use user app state. Provider selection, tag convention, and lookback use shared app state when the workspace scope is available. The browser fallback is local storage and is clearly surfaced when shared state cannot be written. App-state records expire within the platform's 90-day limit.

Custom SLA terms use the `contract-overrides` App Settings schema so they are shared and auditable in the Dynatrace environment. The app stores exact target IDs, display names, operational SLA values, effective dates, and a source reference. App Settings are readable by all authenticated users of the app and persist until changed or removed.

Do not enter secrets, credentials, or unnecessary personal data into app state. No secret is bundled in the app or stored in this repository.

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

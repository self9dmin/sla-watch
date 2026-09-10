# Dynatrace Hub readiness audit

## Scope and conclusion

This is a technical readiness audit of the repository and the last verified tenant deployment. It is not a claim that Dynatrace has approved the app for public Hub distribution. The public documentation describes Hub installation, app verification, code signing, manifest metadata, scopes, security, privacy, themes, dependencies, and testing. The final listing review and code-signing decision are portal-owned steps that cannot be completed by a local build.

The app is suitable for continued hardening as a custom AppEngine app. The reviewed source is now published at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch), but the app is not yet ready to represent itself as a generally available Hub listing until authenticated acceptance evidence, listing content, and the Dynatrace submission route are complete.

## Authority reviewed

- [Dynatrace Hub](https://docs.dynatrace.com/docs/manage/hub): listing contents, required install permissions, custom-app status, subscriptions, and standard verification/code signing.
- [App Toolkit](https://developer.dynatrace.com/quickstart/app-toolkit/): manifest fields, description limits, icon behavior, and configuration surface.
- [App naming guidelines](https://developer.dynatrace.com/design/patterns/app-naming-guidelines/): title case, 40-character limit, discoverability, and avoiding ambiguous names.
- [Permission scopes](https://developer.dynatrace.com/develop/guides/security/add-permission-scopes-to-use-dynatrace-apis/): manifest declaration, least privilege, and intersection with user permissions.
- [Deploy your app](https://developer.dynatrace.com/develop/guides/deploy-your-app/): deploy IAM permissions, CI variables, and version bump rule.
- [External requests](https://developer.dynatrace.com/develop/guides/app-functions/allow-outbound-connections/): outbound host allowlist and the risk of disabling enforcement.
- [Security guidance](https://developer.dynatrace.com/develop/guides/security/): scopes, CSP, secrets, dependency management, and effective permission checks.
- [Privacy by design](https://developer.dynatrace.com/develop/guides/privacy/): PII identification, minimization, and retention.
- [Unit testing](https://developer.dynatrace.com/develop/test-and-troubleshoot/test/create-unit-tests/) and [E2E testing](https://developer.dynatrace.com/develop/test-and-troubleshoot/test/create-end-to-end-tests/): Jest, Playwright, authenticated target-environment testing, and CI cleanup.
- [`documentation/dependency-audit.md`](dependency-audit.md): the production-clean audit result and the documented upstream development-tooling finding.

## Requirement matrix

| Area | Evidence | State | Closure action |
| --- | --- | --- | --- |
| Manifest identity | `app.config.json` uses `my.sla`, `SLA Watch`, version `0.0.23`, a maintained icon, and a sub-80-character description | Implemented locally and deployed at `0.0.23` | Confirm the permanent publisher-owned app ID and final Hub name. Do not change the ID casually after distribution. |
| Name discoverability | `SLA Watch` is short and title case | Likely compliant, uniqueness unverified | Check Hub for collisions and ensure the final name describes the use case. |
| Icon and listing media | A custom SVG icon is included; final Hub screenshots and listing media are not yet packaged | Partial | Review the icon and add final Hub screenshots/demo assets. |
| Runtime scopes | Manifest declares read-only telemetry plus user/app state scopes | Implemented | Test each scope with a least-privilege user and ensure the Hub Technical information page matches. |
| Runtime authorization | UI reports access-incomplete states and uses the current user's permissions | Implemented, live negative coverage missing | Add guarded IAM acceptance tests and consider effective-permission affordances if the UX needs preflight. |
| External API | `api/slaDirectory.function.ts` validates input, bounds time, validates the response, and preserves provider credit and filing fields | Implemented and confirmed connected in the `0.0.23` deployment | Re-verify `sla.directory` allowlisting after each environment install. |
| CSP | No custom CSP exceptions are needed; external API is server-side | Implemented | Keep external calls in the function. Do not add broad browser CSP exceptions. |
| Secrets | No secrets in source or bundle; no credential vault required for the public directory API | Implemented | Keep CI OAuth credentials in the CI secret store. |
| Privacy | App-state TTL is 90 days, workflow arrays are capped, and UI warns about local fallback | Implemented locally | Review operator guidance for PII and verify deletion/expiry behavior in a tenant. |
| Themes | Custom styles use theme variables and dark/light paths were manually verified in the target tenant | Verified at `0.0.23` after deployment | Add automated contrast or screenshot coverage before submission. |
| Dependencies | Production audit is clean after the React Router upgrade; current `dt-app` is `1.17.0` | Implemented locally | Keep Renovate enabled and review App Toolkit advisories separately as development-only risk. |
| Tests | Focused unit tests, typecheck, lint, build, and analyzer are present | Implemented locally; E2E and live permission tests are gaps | Add authenticated Playwright and tenant acceptance jobs using CI secrets. |
| CI | Pull-request workflow is repository-local and non-deploying | Verified in [GitHub Actions run 34491557401](https://github.com/self9dmin/sla-watch/actions/runs/34491557401) on Node 24 | Make the required checks branch-protection rules and keep deployment outside the pull-request job. |
| Public repository | Reviewed source and documentation are published at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch) on `main` | Published | Review the public tree and commit history, then keep future changes gated by CI and pull request review. |
| Hub verification | Standard verification, provider identity, integrity, and code signing are controlled by Dynatrace Hub | External dependency | Use the applicable Dynatrace community, partner, or Hub-subscription submission route. A local `dt-app deploy` cannot complete this step. |

## Release gates

The release owner should not request Hub review until all of the following are true:

- The final app ID, name, description, icon, publisher, and support URL are approved.
- The public repository at [self9dmin/sla-watch](https://github.com/self9dmin/sla-watch) has a clean history, license, security policy, contribution guidance, CI, and no tenant-specific secrets or auth state.
- The public repository uses `DT_APP_ENVIRONMENT_URL` or an explicit deployment flag for contributor and CI targets rather than relying on a private tenant default.
- `npm run verify` and `npm audit --omit=dev` pass on Node 24.
- A clean tenant install passes the browser smoke path in both themes.
- The target tenant allowlist, IAM policies, app-state behavior, and external API failure behavior are verified.
- The Hub Technical information, getting-started, use-case, content, release-notes, and permissions text match the shipped artifact.
- The Dynatrace owner confirms the submission route and completes standard verification/code signing.

## Known non-blocking product boundary

The provider-service-to-Dynatrace-service join and automated credit eligibility calculation are intentionally outside this release. The Incident review tab exposes provider terms and planning references, but does not make a vendor decision. That limitation is disclosed in the README and UI. Implementing a defensible service join is a product milestone, not a Hub-compliance shortcut.

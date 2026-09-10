# Release acceptance record

This record captures the manual target-environment smoke evidence for the `0.0.20` release candidate. It complements automated tests; it is not a substitute for authenticated least-privilege and Playwright acceptance jobs.

## Verified scenarios

| Scenario | Expected result | Evidence |
| --- | --- | --- |
| First-run onboarding | The app explains telemetry, identity, and eligibility; skipping reaches the watch without changing tenant data | Deployed browser smoke |
| Provider directory connection | The AppEngine function loads a provider contract through the allowlisted `sla.directory` host | Deployed browser smoke; connected directory status |
| Missing provider identity | Services and telemetry can be present while claim readiness remains `Needs labeling`; the app recommends a provider boundary and ownership context | Deployed browser smoke |
| App-state access denied | The app says shared state is unavailable and identifies browser-local fallback rather than claiming a workspace save | Deployed browser smoke |
| Theme support | Light and dark views preserve readable navigation, status cards, warnings, and setup recommendations | Deployed browser smoke |
| Release artifact | The `0.0.20` manifest, icon, function, and UI deploy successfully through `dt-app` | `npx dt-app deploy --environment-url ...` completed successfully |

## Not proven by this record

- A separate least-privilege user for every declared telemetry and state scope.
- Automated Playwright coverage against a disposable authenticated tenant.
- End-to-end provider-service ID correlation or automated credit eligibility.
- Dynatrace Hub listing approval, standard verification, or code signing.

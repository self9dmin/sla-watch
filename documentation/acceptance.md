# Release acceptance record

This record captures the manual target-environment smoke evidence for the `0.0.25` release candidate. The candidate was exercised through Dynatrace's authenticated local-development host; production installation remains a separate release step. This record complements automated tests and is not a substitute for least-privilege and Playwright acceptance jobs.

## Verified scenarios

| Scenario | Expected result | Evidence |
| --- | --- | --- |
| Compact Overview | The current evidence state, four supporting facts, assessment boundary, and one primary action fit in the initial desktop viewport | Authenticated local-development tenant smoke; no page overflow at 1659 x 769 |
| Evidence view | The evidence ladder, diagnostics, and setup checks are available on a dedicated route without changing tenant data | Authenticated local-development tenant smoke |
| Provider directory connection | The AppEngine function loads a provider contract through the allowlisted `sla.directory` host | Authenticated local-development tenant smoke; connected directory status |
| Incident review | The app shows observed Problem timestamps, provider-published filing terms, credit tiers, required evidence, and exclusions as planning information without declaring eligibility or approval | Existing deployed smoke plus automated regression coverage |
| Missing provider identity | Services can be visible while provider identity remains `Needs labeling`; missing telemetry remains a separate state | Authenticated local-development tenant smoke and unit tests |
| App-state access denied | The app identifies browser-local fallback in the document flow rather than covering the page with a fixed notification | Authenticated local-development tenant smoke |
| Theme support | Light and dark views preserve readable navigation, status, actions, diagnostics, and setup checks | Authenticated local-development tenant smoke |
| Shell navigation | The Telemetry Grand Prix-derived header structure remains unchanged while Watch also selects the Evidence route | Authenticated local-development tenant smoke |
| Change log and support | The header and settings rail open read-only release history; the support action opens the configured Dynatrace Community profile | Existing deployed smoke |
| Release artifact | The `0.0.25` manifest, icon, function, and UI pass the supported-runtime release gate | `npm run verify:release`; production deployment pending |

## Not proven by this record

- A separate least-privilege user for every declared telemetry and state scope.
- Automated Playwright coverage against a disposable authenticated tenant.
- End-to-end provider-service ID correlation or automated credit eligibility.
- Production installation of `0.0.25`.
- Dynatrace Hub listing approval, standard verification, or code signing.

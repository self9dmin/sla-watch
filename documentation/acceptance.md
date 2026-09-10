# Release acceptance record

This record captures manual target-environment smoke evidence for the current `0.0.30` installed release and retains the prior `0.0.29` record. It complements automated tests and is not a substitute for least-privilege and Playwright acceptance jobs.

## 0.0.30 verified scenarios

The `0.0.30` artifact from source commit `c8d3b6f` was deployed to the designated Dynatrace target environment and exercised through the installed application.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Focused navigation | Overview, Setup, and Incidents each expose one operational purpose | Installed production smoke |
| Desktop fit | All three normal desktop states have equal body client and scroll dimensions, with no page scroll | Installed browser dimension check at 1659 by 825 CSS pixels |
| Bounded collections | The six-service assignment list stays inside Setup instead of extending the page | Installed production smoke |
| Explicit provider-tag review | Review services requires an exact selection and a second confirmation before enabling the write; existing tag consumers are disclosed | Installed production smoke through confirmation; no tag was applied |
| Provider directory connection | The AppEngine function loads the AWS record through the allowlisted `sla.directory` host | Installed production smoke; connected status and filing window returned |
| Theme support | The compact shell, status text, controls, icons, and tooltips remain readable in light and dark themes | Installed production visual smoke |
| Release artifact | The `0.0.30` manifest, function, and UI deploy successfully from the release commit | Installed change log reports `0.0.30 Current release`; source commit `c8d3b6f` is retained in GitHub `main` history |

## 0.0.29 verified scenarios

| Scenario | Expected result | Evidence |
| --- | --- | --- |
| Compact Overview | The current evidence state, four supporting facts, assessment boundary, and one primary action fit in the initial desktop viewport | Installed production smoke; live nonproduction service and Problem counts |
| Evidence view | The evidence ladder, diagnostics, and setup checks are available on a dedicated route without changing tenant data | Installed production smoke at `/ui/apps/my.sla/evidence` |
| Evidence-stage markers | Each stage number remains centered in a fixed circular marker, and positive, warning, and neutral states remain distinguishable | Installed production smoke in light and dark themes at `/ui/apps/my.sla/evidence` |
| Provider directory connection | The AppEngine function loads a provider contract through the allowlisted `sla.directory` host | Installed production smoke; connected AWS directory status |
| Incident review | The app shows observed Problem timestamps, provider-published filing terms, credit tiers, required evidence, and exclusions as planning information without declaring eligibility or approval | Existing deployed smoke plus automated regression coverage |
| Missing provider identity | Services can be visible while provider identity remains `Needs labeling`; missing telemetry remains a separate state | Installed production smoke and unit tests |
| App-state fallback presentation | When remote state cannot be loaded, the app identifies browser-local fallback in the document flow rather than covering the page with a fixed notification | Authenticated local-development tenant smoke |
| Theme support | Light and dark views preserve readable navigation, status, actions, diagnostics, and setup checks | Installed production smoke in both themes |
| Shell navigation | The Telemetry Grand Prix-derived header structure remains unchanged while Watch also selects the Evidence route | Installed production smoke |
| Header action tooltips | Every icon-only header action retains its SVG, identifies itself on keyboard focus, uses an action-specific accessible name, and remains readable in light and dark themes | Authenticated local-development smoke plus installed production smoke |
| Header guide | The guide opens as a visible side panel and presents the operating sequence without obscuring the application shell | Installed production smoke in dark theme |
| Pre-launch Community gate | Community destinations are muted, disabled, labeled `Coming soon`, omitted from keyboard navigation, and not exposed as links in the header, settings, guide, or change log | Installed production smoke plus Playwright smoke assertions |
| Release artifact | The `0.0.29` manifest, icon, function, and UI pass the supported-runtime release gate and deploy successfully | Node 24 typechecks, lint, unit coverage, build, App Toolkit analysis, and production dependency audit passed; `dt-app deploy` completed; installed change log reports `0.0.29 Current release` |

## Not proven by this record

- A separate least-privilege user for every declared telemetry and state scope.
- A provider-tag write or undo against a disposable service under granted, denied, or management-zone-limited permissions.
- Automated Playwright coverage against a disposable authenticated tenant.
- End-to-end provider-service ID correlation or automated credit eligibility.
- Dynatrace Hub listing approval, standard verification, or code signing.

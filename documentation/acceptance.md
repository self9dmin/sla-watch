# Release acceptance record

This record retains the latest fully documented target-environment smoke evidence, which is for `0.0.35`, plus prior release records. This complements automated tests and is not a substitute for least-privilege and Playwright acceptance jobs.

## 0.0.35 verified scenarios

The `0.0.35` artifact from source commit `f1da4f2` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider tag, SLA override, provider connection, credential, or confirmed scope mapping was written during verification.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.35` manifest, three AppEngine functions, App Settings schemas, and UI deployed successfully | Supported Node 24 release gate and installed production browser smoke; source commit `f1da4f2` |
| Release gate | Type checks, lint, 13 test suites with 71 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `verify:release`; production dependency audit reported zero vulnerabilities |
| Multiple monitored providers | AWS and GCP remain configured at the same time, AWS stays active, and Azure, OCI, OpenAI, Anthropic, ElevenLabs, plus another directory provider are available without replacing the current provider | Installed Monitor settings smoke |
| Multiple Google Cloud projects | Provider connections is a collection-oriented setup surface with a saved-connection selector and `Add a new project` state rather than a one-project limit | Installed Provider connections smoke; no project credential was entered or saved |
| Scope map placement | The Smartscape-backed scope map is a dedicated Setup view and no longer appears in Directory | Installed Setup and Directory smoke |
| Scope mapping evidence | Setup returned four AWS service-to-runtime relationships, suggested Amazon EC2 from runtime metadata, and required explicit confirmation before reuse | Installed Scope map smoke; production remained at `0 of 4 confirmed` |
| Incident attribution fallback | A Problem affecting `wayfinder-engage-api-inter` had no exact confirmed mapping or unique Smartscape candidate, so Incident review showed `Provider-level terms (no service match)`, `Provider-wide scope`, and a `Review scope map` action instead of guessing | Installed Incidents smoke against 16 observed Problems |
| Directory separation | Directory contains only Published terms and SLA overrides; scope mapping stays in Setup | Installed Directory smoke |
| Desktop fit | Setup Scope map has equal body client and scroll dimensions, with no page scroll at the tested desktop viewport | Installed browser dimension check at 1646 by 747 CSS pixels |
| Provider status adapters | OCI, OpenAI, Anthropic, and ElevenLabs public-status adapters are included and covered by parser and response tests | Deployed `providerPublicStatus` function and automated tests; target-environment outbound-host access was not exercised in this smoke |
| Assessment boundary | Smartscape suggestions and confirmed mappings select evidence scope only; the UI does not claim provider fault, customer impact, SLA eligibility, or credit approval | Installed Setup and Incidents copy |

## 0.0.31 verified scenarios

The `0.0.31` artifact from source commit `887c847` was deployed to the designated Dynatrace target environment and exercised through the installed application. No provider tag or tenant SLA test record was written during verification.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.31` manifest, App Settings schema, function, and UI deployed successfully | Installed production deployment and browser smoke; source commit `887c847` |
| Tenant settings read path | The installed app registered the contract-override schema and returned the empty AWS tenant collection without an access or schema error | Installed Directory `SLA overrides` view reports `0 tenant overrides` and retains the public fallback |
| Full-page SLA editor | New custom terms open under Workspace settings instead of in a modal; leaving with Cancel returns to Directory without persisting data | Installed production browser smoke |
| Exact multi-entity boundary | One EC2 SLA accepted two selected runtime IDs and reported `2 exact targets`; service, host/runtime, and location modes are available | Installed production browser smoke; the editor was cancelled without saving |
| Smartscape scope map | The app returned four explicit service-to-runtime/location relationships for the available content-pipeline topology | Installed production `Scope map` smoke; entity IDs and locations were shown as evidence boundaries |
| Incident lookback | Incident review exposes 24 hours, 72 hours, 7 days, 15 days, 30 days, 60 days, and 90 days | Installed production browser smoke |
| Desktop fit | Overview, Directory, and Incidents have equal body client and scroll dimensions, with no page scroll at the tested desktop viewport | Installed browser dimension check at 1849 by 855 CSS pixels |
| Connection placement | The sla.directory connection state appears in Monitor settings and is not repeated in the operational header | Installed production Monitor and settings smoke |
| Theme support | Monitor, Directory, settings, controls, icons, and tooltips remain readable in light and dark themes | Installed production visual smoke and computed-style check |
| Assessment boundary | Exact assignments select applicable terms but do not claim provider fault, eligibility, or a credit decision | Installed editor, Scope map, and Incident review copy |

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
- A confirmed scope mapping carried from Setup into an incident against a disposable target-environment dataset.
- Target-environment outbound-host access for every optional public provider-status adapter.
- Automated credit eligibility or provider-side approval.
- Dynatrace Hub listing approval, standard verification, or code signing.

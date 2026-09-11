# Release acceptance record

This record retains the latest fully documented target-environment smoke evidence, which is for `0.0.44`, plus prior release records. This complements automated tests and is not a substitute for least-privilege and Playwright acceptance jobs.

## 0.0.44 verified scenarios

The `0.0.44` artifact from source commit `6934d0b` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, service mapping, custom terms record, evidence decision, Dynatrace entity, or cloud resource was created or changed. The production theme remained dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.44` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `6934d0b` |
| Release gate | Type checks, lint, 18 test suites with 105 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | Release commands completed locally with zero production dependency vulnerabilities; [GitHub Actions run 34618336974](https://github.com/self9dmin/sla-watch/actions/runs/34618336974) |
| Unified Coverage workflow | Smartscape-backed scopes and services without runtime context appeared in one `Provider coverage worklist` with one shared terms panel. The former Coverage view navigation, `Scope map`, and `Manual coverage` links were absent | Installed production accessibility-tree and interaction smoke |
| Incident-relevant priority | `wayfinder-engage-api-inter`, the exact service affected by eleven recent Problems, appeared first under Needs review. Confirmed Smartscape relationships remained available under Covered in the same list | Installed production Coverage smoke plus exact-ID unit coverage |
| Mapping continuity | Selecting a confirmed `content-pipeline-engage` runtime relationship showed its saved Amazon EC2 mapping, evidence note, effective terms, and update or removal actions without changing the record | Installed production Coverage interaction |
| Custom terms handoff | Selecting the service-only `wayfinder-engage-api-inter` row and opening Custom terms selected the service evidence boundary and exact `SERVICE-AA147ED7BD41422D` target | Installed production route and form-state smoke; the editor was left without saving |
| Desktop fit | The installed Coverage body reported equal client and scroll dimensions of 1659 by 769 CSS pixels. One worklist and one details panel were present, with no document scrolling | Installed production dimension check |
| Runtime quality | Production navigation, list selection, and the settings handoff completed without an application error | Installed production browser log and interaction smoke |

## 0.0.43 verified scenarios

The `0.0.43` artifact from source commit `7143467` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, service mapping, custom terms record, evidence decision, Dynatrace entity, or cloud resource was created or changed. Personal theme state was switched to light for visual verification and restored to dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.43` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `7143467` |
| Release gate | Type checks, lint, 18 test suites with 105 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `npm run verify:release`; zero production dependency vulnerabilities; [GitHub Actions run 34598900843](https://github.com/self9dmin/sla-watch/actions/runs/34598900843) |
| Coverage focus | The production AWS Manual coverage view showed one recommended ownership action instead of counting two optional SLO and cross-product tag suggestions as open work | Installed production Coverage smoke |
| Incident-relevant priority | `wayfinder-engage-api-inter`, the exact service affected by eleven recent Problems, appeared first in the six-service manual queue and displayed its Problem count. Services without affected-entity overlap followed alphabetically | Installed production Coverage smoke plus exact-ID unit coverage |
| Conservative evidence boundary | Eleven observed Problems still produced no AWS candidate because none overlapped the confirmed AWS boundary. Prioritizing setup did not change provider attribution or create evidence | Installed production Evidence smoke |
| Themes | The focused Coverage queue and recommendation panel remained readable in light and dark themes. The original dark preference was restored | Installed production visual smoke |

## 0.0.42 verified scenarios

The `0.0.42` artifact from source commit `ab0a671` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through the installed application. One exact, non-confidential service mapping and one evidence validation were created solely to verify the full operating loop. The validation was reset and the mapping was removed. Reload checks confirmed that neither temporary record remained. No Dynatrace entity metadata, provider credential, Credential Vault record, custom terms record, or cloud resource was created or changed. Personal theme state was switched to light for visual verification and restored to dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.42` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `ab0a671` |
| Release gate | Type checks, lint, 18 test suites with 103 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; production dependency audit reported zero vulnerabilities; [GitHub Actions run 34561366779](https://github.com/self9dmin/sla-watch/actions/runs/34561366779) |
| App-owned manual coverage | Coverage created an exact AWS mapping for `SERVICE-AA147ED7BD41422D` without modifying source tags or any Dynatrace entity. The mapped count increased and the service was labeled `Covered in app` | Installed production Coverage interaction |
| Coverage persistence | Reloading retained the exact service mapping and its provider-level terms | Installed production reload smoke |
| Candidate reuse | Evidence reused that mapping for Problem `P-260933`, identified `wayfinder-engage-api-inter` as the affected service, and stated that one operator-confirmed scope mapping qualified the candidate | Installed production Evidence interaction |
| Decision lifecycle | Validate required acknowledgement, persisted after reload, and exposed Reset decision. Reset returned the candidate to Needs review and persisted | Installed production Evidence interaction and reload smoke |
| Reversible cleanup | The exact temporary mapping was removed. Reload returned Manual coverage to zero app mappings, and Evidence returned no candidates or saved decision | Installed production Coverage and Evidence cleanup smoke |
| Conservative boundary | After cleanup, eleven observed Problems produced no candidate because none overlapped the remaining confirmed AWS scope. The app did not infer provider responsibility from service names | Installed production Evidence smoke |
| Live inventory behavior | The tenant changed from eight to seven services and from sixteen to eleven observed Problems during acceptance. The app refreshed without retaining the removed test boundary; final AWS state showed two of seven services covered by four pre-existing confirmed Smartscape rows and zero of five manually covered | Installed production refresh and reload smoke |
| Desktop fit and themes | Scope map, Manual coverage, and Evidence remained compact and readable in light and dark themes without unnecessary document scrolling | Installed production visual smoke; dark theme restored after acceptance |
| Removed entity-write dependency | Manual coverage is stored in the app's settings and the manifest no longer requests entity-write permission. Source provider tags remain read-only evidence | Manifest inspection, release analysis, and installed production copy |

## 0.0.41 verified scenarios

The `0.0.41` artifact from source commit `13e1a74` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, tag, scope mapping, custom terms record, or evidence decision was created or changed. Personal theme state was switched to light for visual verification and restored to dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The installed application frame reports `my.sla` version `0.0.41`; the manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully | Installed production deployment, change log, and Chrome smoke; source commit `13e1a74` |
| Release gate | Type checks, lint, 18 test suites with 107 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; production dependency audit reported zero vulnerabilities; [GitHub Actions run 34559101335](https://github.com/self9dmin/sla-watch/actions/runs/34559101335) |
| Candidate qualification | Only exact affected-service overlap with confirmed Coverage, an exact provider tag, or a same-provider Smartscape suggestion can create a candidate. Service names, lookalike tags, wrong-provider topology, and unrelated Problems remain excluded | `tests/evidenceCandidates.test.ts`; 12 focused tests passed |
| Decision loop | A representative local candidate showed one match explanation and one Decision area. Validate stayed disabled until acknowledgement; Dismiss without a note produced an inline error; the removed gate cards and candidate-level FinOps handoff were absent | Tenant-hosted local Chrome interaction smoke in light and dark themes; the temporary visual record was removed before the release commit |
| Decision freshness | A stored decision remains current only while its mapping basis, affected entity IDs, and provider-service IDs match the candidate. A changed boundary returns it to Needs review | Focused stale-decision and canonical-key unit coverage |
| Conservative production state | Sixteen Problems were observed in seven days, but none overlapped the current AWS boundary. Evidence returned no review candidates and did not infer one from a service name | Installed production Evidence and Incidents smoke |
| Provider-source boundary | Provider reports remained separate from Dynatrace-derived candidates and stated that an AWS account connection is optional, read-only provider evidence | Installed production Provider reports smoke; no connection was created |
| Desktop fit and themes | Coverage, Incidents, Evidence, Provider reports, and AWS terms each had equal body client and scroll dimensions of 1646 by 747 CSS pixels. The Evidence workflow and shell remained readable in both themes | Installed production dimension and visual smoke; representative candidate checked locally in both themes |
| Open mutation acceptance | The live tenant produced no valid candidate, so a production evidence-decision write was deliberately not forced. Least-privilege create, update, dismiss, read-only, and removal behavior remain open acceptance items | Target environment remained unchanged; pure decision and candidate logic passed automated coverage |

## 0.0.40 verified scenarios

The `0.0.40` artifact from source commit `dfa0a6e` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, tag, scope mapping, custom terms record, or evidence decision was created or changed. Personal theme state was switched to dark for visual verification and restored to light.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.40` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `dfa0a6e` |
| Release gate | Type checks, lint, 18 test suites with 100 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; production dependency audit reported zero vulnerabilities; [GitHub Actions run 34557378292](https://github.com/self9dmin/sla-watch/actions/runs/34557378292) |
| Coverage landing | The root route opens Coverage directly. The former Monitor summary page is absent, the four operational facts appear above the work area, and Scope map is the default view with Service tags secondary | Installed production navigation and accessibility-tree smoke |
| Coverage reuse | The live AWS view returned eight services and four Smartscape relationships. Four exact relationships were already confirmed as Amazon EC2, and the UI states that Incidents and Evidence reuse confirmed mappings | Installed production Coverage smoke; no mapping was changed |
| Evidence review | Evidence separates Review candidates from Provider reports and only offers validate or dismiss actions after an exact service overlap with confirmed scope, an explicit provider tag, or a Smartscape suggestion | Installed production Evidence smoke plus candidate unit tests |
| Conservative empty state | Sixteen Problems were observed in seven days, but none overlapped the current confirmed AWS scopes, explicit provider tags, or Smartscape provider-service suggestions. Evidence therefore showed no review candidates instead of inferring one from a name | Installed production Evidence and Incidents smoke |
| Directory completeness | `AWS terms` exposes Published terms, all 62 Services, Support, and Custom terms. The public reference, credit policy, filing process, required evidence, exclusions, provenance, official SLA, and claim destination remain source-labeled | Installed production Directory smoke against the live `sla.directory` response |
| Provider settings | Settings keeps AWS, Azure, GCP, OCI, OpenAI, Anthropic, and ElevenLabs configured together, keeps AWS as the active focused view, shows the `sla.directory` connection, and routes service assignment back to Coverage | Installed production settings smoke; no setting was saved |
| Desktop fit and themes | Coverage, Incidents, Evidence, and Directory each had equal body client and scroll dimensions of 1646 by 747 CSS pixels. Coverage remained readable in light and dark themes, and icon-only header actions retained accessible tooltips | Installed production visual, dimension, and accessibility-tree smoke |
| Settings schema guardrail | Dynatrace's App Settings maximum of 1,000 objects is enforced by a repository test across all committed schemas | `tests/settingsSchemas.test.ts`; the corrected `evidence-decisions` schema registered during deployment |
| Open mutation acceptance | No current Problem qualified as an Evidence candidate, so a live evidence-decision write was deliberately not forced. Least-privilege validate, dismiss, update, and read-only behavior remain open acceptance items | Target environment remained unchanged; automated decision-store and candidate coverage passed |

## 0.0.39 verified scenarios

The `0.0.39` artifact from source commit `a6c025e` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, tag, scope mapping, or custom terms record was created or changed.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.39` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `a6c025e` |
| Release gate | Type checks, lint, 16 test suites with 93 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; production dependency audit reported zero vulnerabilities |
| Product identity | The Dynatrace Apps list, browser title, AppHeader, and application frame identify the installed app as `SLA Review` | Installed production navigation and accessibility-tree smoke |
| Operational language | The operating heading is `Provider review`; navigation and accessibility labels use review language without changing evidence behavior | Installed production Overview smoke |
| Directory language | Directory displays `AWS terms` with Published terms, Services, Support, and Custom terms. The provider-owned `Official SLA` link remains explicit | Installed production Directory smoke against the live `sla.directory` response |
| Custom terms | Settings exposes `Custom terms`, the full-page editor uses terms language, and the public baseline remains visibly separate | Installed production settings smoke; no value was entered or saved |
| First run | The tenant-hosted local preview displayed the maintained mark, `SLA Review`, the one-line `Set up provider review.` heading, and a concise published-terms explanation | Chrome visual smoke against the authenticated target environment |
| UI quality | The required UI detector returned no findings, and both the production dark view and local light view remained compact and readable | Impeccable detector plus Chrome visual smoke |

## 0.0.38 verified scenarios

The `0.0.38` artifact from source commit `be06491` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider configuration, provider credential, Credential Vault record, tag, scope mapping, or SLA override was created or changed. Personal theme and onboarding state were exercised and returned to light theme with onboarding completed.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.38` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully; the installed change log reports `0.0.38 Current release` | Installed production deployment and Chrome smoke; source commit `be06491` |
| Release gate | Type checks, lint, 16 test suites with 93 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; production dependency audit reported zero vulnerabilities |
| Unified shell | The global header contains the SLA Watch identity and utility icons only. The operating shell presents Overview, Setup, Incidents, Provider notices, and Directory in that order | Installed production navigation and accessibility-tree smoke |
| Complete provider record | Azure Directory returned published availability, credit policy, filing process, evidence requirements, exclusions, provenance, 122 service records, support plans, and tenant overrides | Installed production Directory smoke against the live `sla.directory` response |
| Service catalog | The Services view displayed all 122 Azure records with search, SLA filtering, expandable details, and an internally bounded collection | Installed production Services smoke; body remained 1646 by 800 CSS pixels with no document overflow |
| Support boundary | Support response targets were labeled separately from the availability SLA and `Not credit-backed`; named plans and response targets remained visible without implying a service-credit remedy | Installed production Support smoke in light and dark themes |
| Onboarding | First-run guidance displayed the maintained SLA Watch mark, a one-line heading, concise setup explanation, and `Finish later and open Overview` | Installed production onboarding smoke after an explicit restart; onboarding was completed again afterward |
| Desktop fit and themes | Overview and every exercised Directory view had equal body client and scroll dimensions of 1646 by 800 CSS pixels; the support record remained readable in light and dark themes | Installed production visual and dimension smoke |

## 0.0.37 verified scenarios

The `0.0.37` artifact from source commit `5c59e1e` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider credential, Credential Vault record, provider connection, tag, scope mapping, monitor setting, or SLA override was created or changed.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.37` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully; the installed change log reports `0.0.37 Current release` | Installed production deployment and Chrome smoke; source commit `5c59e1e` |
| Release gate | Type checks, lint, 16 test suites with 91 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `npm run verify:release`; production dependency audit reported zero vulnerabilities |
| Setup landing | Setup opens directly on Scope map. The installed tenant returned eight services and four exact AWS service-to-runtime relationships without requiring a provider tag | Installed production Setup smoke |
| Recommended mapping | Smartscape runtime metadata selected Amazon EC2 as a recommendation, labeled it `Recommended match`, and presented `Confirm Amazon EC2` as the primary action | Installed production Scope map smoke; production remained at `0 of 4 confirmed` |
| Mapping boundary | An unconfirmed recommendation is described as a setup aid only. A confirmed exact scope can be reused by SLA Watch, but neither state establishes provider fault, customer impact, or credit eligibility | Installed Scope map copy and automated recommendation coverage |
| Secondary provider tags | `Service tags` is a secondary Setup view and states that confirmed Scope map assignments already work inside SLA Watch. Tagging remains available only for reuse by other Dynatrace features | Installed production Service tags smoke; no tag was applied |
| Exact SLA handoff | `Add SLA override` opened the full Settings editor with Amazon EC2, `Selected hosts or runtimes`, and the chosen runtime preselected | Installed production Chrome smoke; the editor was cancelled without saving |
| Optional provider connections | AWS, Microsoft Azure, Google Cloud, and OCI are peer connection types. The tenant reported `0 saved`, and the UI states that public SLA terms work without these optional read-only sources | Installed production Provider connections smoke |
| Connection guardrails | Every empty provider form disabled both Test and Save. Google Cloud displayed both required roles and both fixed outbound hosts | Installed production provider-form smoke; no provider identity or secret was entered |
| Onboarding truth | The installed guidance distinguishes monitored-provider preferences from credentials, telemetry, tags, claims, and fault decisions. The full local first-run flow routes users to Provider connections or Scope map and does not auto-start the responder walkthrough | Installed production guidance page plus tenant-hosted local first-run smoke |
| Desktop fit and themes | Scope map and Service tags had equal body client and scroll dimensions of 1646 by 800 CSS pixels in both light and dark themes, with no horizontal overflow | Installed production visual and dimension smoke |
| Live cloud connections | Not exercised because no disposable AWS, Azure, Google Cloud, or OCI identity, Credential Vault record, or provider event fixture was introduced | Open guarded acceptance items; production and personal provider accounts remain unchanged |

## 0.0.36 verified scenarios

The `0.0.36` artifact from source commit `44c853a` was deployed to the designated Dynatrace target environment on 2026-09-10 and exercised through the installed application. No provider credential, Credential Vault record, provider connection, tag, scope mapping, monitor setting, or SLA override was created or changed.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.36` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully; the installed change log reports `0.0.36 Current release` | Installed production deployment and Chrome smoke; source commit `44c853a` |
| Release gate | Type checks, lint, 16 test suites with 88 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `npm run verify:release`; production dependency audit reported zero vulnerabilities |
| Core cloud model | AWS, Azure, GCP, and OCI are peer provider connection types; a fresh workspace monitors all four and AWS is only the initial focused view | Installed Provider connections smoke, default-provider unit coverage, and provider-connection unit coverage |
| Multiple account scopes | The settings surface supports collections of AWS accounts, Azure subscriptions, Google Cloud projects, and OCI tenancies without one provider replacing another | Installed Provider connections smoke and provider-connection schema/unit coverage |
| Secret boundary | The form accepts only a Credential Vault record ID; AWS signing material, Azure client secrets, Google service-account keys, and OCI private keys are never entered into App Settings or returned to the browser | Local settings smoke, schema review, and function tests with synthetic credentials |
| One-screen layout | All four installed connection forms fit without settings-page scrolling in both dark and light themes at the tested desktop viewport | Each provider reported equal document and body client and scroll dimensions of 1646 by 800 CSS pixels in both themes |
| Operational paths | Monitor retained the existing AWS/GCP workspace state, Directory loaded AWS published terms and tenant overrides, and Provider notices requested an account-specific AWS source without substituting unrelated public data | Installed production Chrome smoke |
| AWS request boundary | The function validates the account, verifies it with STS, signs bounded Health requests, filters to account-specific events, and rejects a wrong-account credential before reading Health events | `tests/awsHealth.function.test.ts`, typecheck, lint, and production build |
| Azure request boundary | The function validates the subscription and vaulted client credential, uses fixed Entra and Resource Manager hosts, bounds Resource Health reads, and reduces provider markup to text | `tests/azureServiceHealth.function.test.ts`, typecheck, lint, and production build |
| OCI request boundary | The function accepts only validated commercial regions, constructs `announcements.<region>.oraclecloud.com`, signs a bounded read request, and reports auth or IAM errors without public fallback | `tests/ociAnnouncements.function.test.ts`, typecheck, lint, and production build |
| Live cloud connections | Not exercised because no disposable AWS, Azure, Google Cloud, or OCI identity, Credential Vault record, or provider event fixture was introduced | Open guarded acceptance items; production and personal provider accounts remain unchanged |

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
- Service-scoped coverage and evidence-decision behavior under denied, read-only, or management-zone-limited permissions.
- Automated Playwright coverage against a disposable authenticated tenant.
- Service-scoped coverage update behavior and evidence dismissal with a non-confidential note.
- Target-environment outbound-host access for every optional public provider-status adapter.
- Live customer-scoped AWS, Azure, Google Cloud, and OCI connections using disposable least-privilege identities.
- Automated credit eligibility or provider-side approval.
- Dynatrace Hub listing approval, standard verification, or code signing.

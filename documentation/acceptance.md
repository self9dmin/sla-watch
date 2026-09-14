# Release acceptance record

This record retains the latest fully documented target-environment smoke evidence, which is for `0.0.68`, plus prior release records. This complements automated tests and is not a substitute for least-privilege and Playwright acceptance jobs.

## 0.0.68 verified scenarios

The `0.0.68` artifact from source commits `f146db6` and `1a85666` was built and deployed to the designated Dynatrace target environment with Node 24.19.0 on 2026-09-13, then exercised through the connected Chrome profile. The production smoke was read-only and changed only the selected application view and a temporary search value. It did not change provider connections, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.68` manifest, six AppEngine functions, and revised detected-topology workspace deployed successfully under the unchanged `my.sla` application ID | Supported-runtime deployment and connected Chrome smoke; source commits `f146db6` and `1a85666` |
| Release gate | UI and API type checks, lint, 35 test suites with 193 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 83.97% statement coverage; zero production dependency vulnerabilities |
| Topology inventory | Azure Coverage presented all 12 returned Smartscape node types as larger readable cards, including complete raw type identifiers, without a nested list scroller | Installed Azure Coverage DOM and visual smoke |
| Topology search | The provider-scoped search matched both readable labels and raw node types; `network` reduced the live Azure inventory from 12 to 6 types and clearing the field restored the complete list | Installed Azure Coverage interaction smoke |
| Layout behavior | The topology workspace used one vertical scrolling surface, kept the mapping handoff sticky, and had equal body client and scroll widths at the production viewport. A local 420-pixel viewport also had no horizontal overflow | Installed DOM style and width checks; local responsive Chrome smoke |
| Installed version | The installed change log showed `0.0.68 Current release` and the detected-topology usability summary | Installed production change-log smoke |
| Runtime quality | Coverage and the change log rendered without captured browser warnings or errors | Connected Chrome post-deploy smoke and browser diagnostics |

## 0.0.67 verified scenarios

The `0.0.67` artifact from source commit `b26343f` was built and deployed to the designated Dynatrace target environment with Node 24.19.0 on 2026-09-13, then exercised through the connected Chrome profile. The production smoke was read-only and changed only the selected application views. It did not change provider connections, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.67` manifest, six AppEngine functions, shared evidence-state resolver, versioned review artifact, and revised Evidence workspace deployed successfully under the unchanged `my.sla` application ID | Supported-runtime deployment and connected Chrome smoke; source commit `b26343f` |
| Release gate | UI and API type checks, lint, 35 test suites with 193 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed. The Dynatrace build and analyzer were also run directly with Node 24.19.0 | `npm run verify:release`; 83.97% statement coverage; zero production dependency vulnerabilities |
| Review queue | Evidence opened on `Review cases`, exposed search and explicit All, Needs review, Needs evidence, Ready, and Excluded filters, and reported three excluded cases without truncating the queue | Installed Evidence DOM and visual smoke |
| Shared review state | Incidents organized seven Problems into three provider-relevant cases and showed the same three cases as Excluded. Evidence reported Needs review 0, Needs evidence 0, Ready 0, and Excluded 3. No stale `Potential SLA impact` label remained | Installed Incidents and Evidence DOM smoke |
| Readiness hierarchy | The selected case led with Coverage, Customer impact, Terms, optional Provider corroboration, Required items, and the explicit `Nothing has been sent.` boundary | Installed Evidence DOM and dark-theme visual smoke |
| Provider corroboration | The optional view stated that account-specific AWS events require a read-only connection and that Dynatrace Problems and directory terms remain available without one. It did not present missing provider data as healthy evidence | Installed Provider corroboration DOM smoke; no connection was created |
| Portable handoff | `Copy follow-up summary` and `Download evidence review` were available on the selected case. Their versioned content, UTC timestamps, state labels, and filename rules passed unit coverage; neither action was activated during production smoke | Installed control smoke and `tests/evidenceReviewArtifact.test.ts` |
| Installed version | The installed change log showed `0.0.67 Current release` and described the complete portable SRE handoff | Installed production change-log smoke |
| Runtime quality | Evidence, Provider corroboration, Incidents, and the change log rendered without horizontal page overflow or captured browser warnings and errors | Connected Chrome post-deploy smoke and browser diagnostics |

## 0.0.66 verified scenarios

The `0.0.66` artifact from source commit `50a0527` was built and deployed to the designated Dynatrace target environment with Node 24.19.0 on 2026-09-13, then exercised through the connected Chrome profile. The production smoke was read-only except for changing and restoring the focused provider. It did not change provider connections, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.66` manifest, six AppEngine functions, Smartscape-native service inventory, provider-aware direct topology, and optional Davis impact context deployed successfully under the unchanged `my.sla` application ID | Supported-runtime deployment and connected Chrome smoke; source commit `50a0527` |
| Release gate | UI and API type checks, lint, 33 test suites with 189 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 83.95% statement coverage; zero production dependency vulnerabilities |
| Service migration | `smartscapeNodes SERVICE` preserved the target tenant's six current service IDs and names during the read-only classic-equivalence probe; the installed Coverage model retained eight merged current or recently observed services | Target-tenant DQL probe, parser tests, and installed Coverage smoke |
| AWS direct topology | AWS retained three verified service links. Two services run on EC2, and `wayfinder-engage-api-inter` now visibly `calls` the exact AWS RDS node instead of being reduced to a generic runtime label | Installed AWS Coverage accessibility-tree smoke |
| Azure attribution boundary | Azure showed one subscription, one VM, one monitored host, and 12 Smartscape types, while reporting zero Azure service links across eight checked services | Installed Azure Coverage smoke after the provider and service queries settled |
| Problem continuity | Incidents retained all seven Problems and organized them into three provider-relevant cases. Stable Davis impact fields were accepted but absent in these records, so Incidents and Evidence displayed `Not returned` rather than inventing impact | Installed Incidents and Evidence smoke |
| Installed version | The installed change log showed `0.0.66 Current release` with the Smartscape service migration, relationship preservation, Davis context, and removed classic entity-read scope | Installed production change-log smoke |
| Runtime quality | The supported-runtime redeploy settled on AWS Coverage with three links, seven observed Problems, and no new app-origin browser warning or error | Connected Chrome post-deploy smoke and browser diagnostics |

## 0.0.65 verified scenarios

The `0.0.65` artifact from source commit `14b467b` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It changed only the focused provider and opened native Smartscape views in separate AppShell tabs. It did not change provider connections, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.65` manifest, six AppEngine functions, topology-first Coverage workspace, and provider-aware Smartscape handoff deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commits `90bdb36` and `14b467b` |
| Release gate | UI and API type checks, lint, 32 test suites with 182 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 83.77% statement coverage; zero production dependency vulnerabilities |
| Installed version | The installed change log showed `0.0.65 Current release`, the topology-first `0.0.64` record, and the provider-specific Smartscape handoff changes | Installed production change-log smoke |
| Topology-first landing | Azure opened on `Detected topology` because Dynatrace detected provider infrastructure but returned no verified Azure service relationship | Installed production Azure Coverage smoke |
| Topology evidence | Azure showed one subscription, one VM, one monitored host, and 12 Smartscape types. The bounded evidence included 121 availability-zone records, 109 location records, and the detected Azure resource categories without claiming they were services | Installed production Azure Coverage accessibility-tree and visual smoke |
| Service separation | `Service links` remained at zero for Azure and explicitly stated that all eight environment services were checked but none was attributed from provider presence alone | Installed production Azure Coverage smoke |
| AWS continuity | AWS opened on its service-link view with three verified service links across eight services, while retaining one account, nine EC2 instances, two monitored hosts, and 69 Smartscape types | Installed production AWS Coverage smoke |
| Provider-aware handoff | `Open Smartscape` opened the exact Azure overview in production. The AWS handoff opened the exact AWS overview in the tenant-hosted local release | Connected Chrome navigation smoke |
| Runtime quality | Both provider views remained bounded in the dark-theme workspace, and Chrome captured no production browser warning or error | Connected Chrome visual smoke and browser diagnostics |

## 0.0.63 verified scenarios

The `0.0.63` artifact from source commit `474402a` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It changed only the focused provider while checking both views. It did not change provider connections, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.63` manifest, six AppEngine functions, provider-attribution clarification, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `474402a` |
| Release gate | Type checks, lint, 31 test suites with 176 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 83.72% statement coverage; zero production dependency vulnerabilities |
| Installed version | The installed change log showed `0.0.63 Current release` and all four provider-attribution changes | Installed production change-log smoke |
| Provider and service separation | Azure reported one subscription, one VM, and 12 Smartscape types as provider-level infrastructure while `AZURE SERVICE LINKS` reported `0` | Installed production Azure Coverage smoke after both Smartscape queries settled |
| Evaluated inventory clarity | Coverage stated `8 environment services checked; none linked`, then grouped all eight records under `NOT LINKED TO AZURE` with `No Azure relationship` and `Not linked` on each row | Installed production Azure Coverage accessibility-tree and visual smoke |
| Manual attribution safety | The selected unlinked service opened with `Assign provider service` set to `Choose a provider service`, plus `No Azure service relationship found`; no provider-wide service was preselected | Installed production Azure Coverage detail smoke |
| AWS continuity | AWS reported three verified service links across eight evaluated environment services while retaining one account, nine EC2 instances, and 69 Smartscape types | Installed production AWS Coverage smoke |
| Runtime quality | The complete Azure worklist and detail panel remained inside the bounded dark-theme workspace, and Chrome captured no production browser warning or error | Connected Chrome visual smoke and browser diagnostics |

## 0.0.62 verified scenarios

The `0.0.62` artifact from source commit `2a2e18e` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.62` manifest, six AppEngine functions, bounded host cloud-context query, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `2a2e18e` |
| Release gate | Type checks, lint, 31 test suites with 176 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 83.72% statement coverage; zero production dependency vulnerabilities |
| Azure infrastructure candidate | Azure Coverage displayed one provider-level candidate from one monitored host with Azure metadata and one Azure VM in provider-native topology | Installed production Azure Coverage smoke after both Smartscape queries settled |
| Deduplicated uncertainty | The host and VM signals appeared once, explicitly stated that they were not assumed to represent the same resource, and did not assign any service | Installed production candidate card and automated infrastructure-candidate coverage |
| Service attribution boundary | Azure remained at `0 of 7` with all seven services under `NO SERVICE-LEVEL PROVIDER LINK`. Provider presence did not create service coverage or a service-level terms match | Installed production Azure Coverage worklist smoke |
| AWS continuity | AWS retained three of seven covered services, including two exact Amazon EC2 service-cloud-context matches, and did not display the fallback infrastructure candidate | Installed production AWS Coverage smoke |
| Provider context | The provider rail and Review defaults exposed AWS and Azure. AWS reported one account, nine EC2 instances, and 69 Smartscape types; Azure reported one subscription, one VM, and 12 Smartscape types | Installed production Coverage and Review defaults smoke |
| Release history | Change log showed `0.0.62 Current release` and the four conservative infrastructure-candidate details | Installed production change-log smoke |
| Bounded runtime | The Azure Coverage app frame reported equal client and scroll dimensions of 787 by 747 CSS pixels, with no document overflow and no captured browser warnings or errors | Connected Chrome dimension and browser-log smoke |

## 0.0.61 verified scenarios

The `0.0.61` artifact from source commit `ba2e647` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.61` manifest, six AppEngine functions, global provider-inventory query, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `ba2e647` |
| Release gate | Type checks, lint, 30 test suites with 170 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24 | Local release commands; 83.55% statement coverage; zero production dependency vulnerabilities |
| Global provider discovery | The production rail displayed both AWS and Azure even though only AWS had direct service-linked coverage. AWS showed one account, six zone records, and 69 resource types. Azure showed one subscription, 121 zone records, and 12 resource types | Installed production Coverage accessibility-tree smoke after the bounded Smartscape query settled |
| Service attribution boundary | Coverage reported three of eight loaded services covered and five not attributed. Unlinked rows appeared under `NO SERVICE-LEVEL PROVIDER LINK`, and the detail explained that environment inventory does not establish a service relationship | Installed production Coverage DOM and accessibility-tree smoke |
| Exact topology reuse | The two services with provider-native service cloud context remained automatically attributed to Amazon EC2, while isolated services such as `my.sla` remained unattributed | Installed production Coverage worklist smoke and prior Smartscape isolation check |
| Data minimization | The global provider query summarized counts by Smartscape node type and did not request account, subscription, project, or tenancy identifiers | Source review and `tests/queries.test.ts` |
| Release history | Change log showed `0.0.61 Current release` and `Separated provider presence from service attribution.` | Installed production change-log smoke |

## 0.0.60 verified scenarios

The `0.0.60` artifact from source commit `ce45979` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.60` manifest, six AppEngine functions, environment-driven provider rail, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `ce45979` |
| Release gate | Type checks, lint, 29 test suites with 166 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24 | Local release commands; 83.39% statement coverage; zero production dependency vulnerabilities |
| Applicable-provider rail | The target environment displayed exactly one provider button, AWS, with one selected bundled logo and no disabled Azure, GCP, or OCI placeholders | Installed production Coverage DOM and dark-theme visual smoke |
| Summary continuity | The Coverage provider fact settled on `1` and `AWS selected`, matching the visible rail | Installed production Coverage DOM smoke after asynchronous data loading completed |
| Empty environment | The local tenant-backed preview with no detected, confirmed, or connected providers omitted the rail and reported `0` with `none detected or configured` | Local App Toolkit visual and DOM smoke |
| Extensible marks | Unit coverage verifies bundled local marks for AWS, Azure, GCP, and OCI plus deterministic local monograms for dynamically detected provider slugs without a bundled mark | `tests/providerPresentation.test.ts` |
| Release history | Change log showed `0.0.60 Current release` and `Made provider context follow the environment.` | Installed production change-log smoke |
| Runtime observation | Local and production rail checks completed without a captured browser warning or error | Connected Chrome browser diagnostics |

## 0.0.59 verified scenarios

The `0.0.59` artifact from source commit `a78dfed` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.59` manifest, six AppEngine functions, grouped-case route synchronization patch, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `a78dfed` |
| Release gate | Type checks, lint, 28 test suites with 164 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24 | Local release commands; 83.29% statement coverage; zero production dependency vulnerabilities |
| Cold grouped-case route | A direct cold load for `P-260915` recomputed the selected review case after provider matching finished, opened page 1 of 5, and selected the three-Problem AWS impact review instead of a transient singleton on a stale page | Installed production direct-route smoke using `problem=P-260915` and `case=case:*:p-260915` |
| Source preservation | The selected case displayed `P-260915`, `P-260916`, and `P-260917` in the default-open Included Problems section, retained one affected service, and retained the 6:51 PM through 7:27 PM observed window | Installed production Incidents detail smoke |
| Release history | Change log showed `0.0.59 Current release` | Installed production change-log smoke |

## 0.0.58 verified scenarios

The `0.0.58` artifact from source commit `412cd5d` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.58` manifest, six AppEngine functions, review-case model, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `412cd5d` |
| Release gate | Type checks, lint, 28 test suites with 164 tests, production coverage collection, build, App Toolkit analysis, and production dependency audit passed under Node 24 | Local release commands; 83.29% statement coverage; zero production dependency vulnerabilities |
| Real-tenant consolidation | The 30-day AWS window retained all 94 Dynatrace Problems while reducing the operating worklist from 94 records to 78 review cases and from 12 pages to 5 pages of at most 16 compact cases | Installed production Incidents accessibility-tree and dark-theme visual smoke |
| Provider-relevant consolidation | Thirty-two provider-relevant Problems were organized into 16 cases. Ten cases still needed review and six reflected existing Not provider-related decisions | Installed production Incidents and Evidence smoke after scope and decision settings finished loading |
| Conservative live grouping | One selected AWS case combined `P-260915`, `P-260916`, and `P-260917` because they resolved to the same provider scope, shared one affected service, and occurred from 6:51 PM through 7:27 PM on 2026-09-01 | Installed production case detail; all three source Problems remained default-open and visible |
| Evidence continuity | Review evidence preserved the case route, displayed the same three supporting Problems, combined observed window and affected service, retained applicable terms, and kept one human stopping point | Installed production Evidence accessibility-tree and dark-theme visual smoke; no decision was saved |
| Truthful language | The consolidated unit is labeled Potential SLA impact and Correlated case. No screen labeled it an SLA violation, provider fault, eligibility finding, approved credit, or submitted claim | Installed production Incidents, Evidence, and release-history smoke |
| Release history | Change log showed `0.0.58 Current release` and all five case-review changes | Installed production change-log smoke |
| Runtime observation | Incidents and Evidence completed without a visible application error. Chrome recorded one outer-page extension message-channel error, not an app-frame exception | Connected Chrome visual smoke and browser diagnostics |

## 0.0.57 verified scenarios

The `0.0.57` artifact from source commit `a6bdd19` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.57` manifest, six AppEngine functions, four bundled provider SVGs, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `a6bdd19` |
| Release gate | Type checks, lint, 27 test suites with 156 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; 82.79% statement coverage; zero production dependency vulnerabilities |
| Provider context | AWS, Azure, GCP, and OCI remained visible in one compact provider rail. AWS was selected and clearly illuminated; Azure, GCP, and OCI were labeled unavailable because the environment did not evidence them | Installed production Coverage accessibility-tree and dark-theme visual smoke |
| Navigation placement | The provider rail aligned with the workflow navigation without an extra provider label, Directory appeared directly after Evidence, and the former Review terms header action was absent | Installed production Coverage and Directory smoke |
| Directory continuity | Directory loaded the AWS public record with 62 services, 99.99% availability, a 30-day filing window, credit tiers, submission process, evidence requirements, exclusions, support metadata, and provenance | Installed production Directory smoke against the deployed `slaDirectory` function |
| Theme treatment | The enlarged provider marks retained their text labels and selected-state contrast while the dark theme rendered their logo surfaces without white tiles | Connected Chrome dark-theme visual smoke |
| Release history | Change log showed `0.0.57 Current release` and all five provider-context changes | Installed production change-log smoke |

## 0.0.56 verified scenarios

The `0.0.56` artifact from source commit `3baed90` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke entered and exited the bulk-review confirmation path without saving a decision. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.56` manifest, six AppEngine functions, manual bulk-selection behavior, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `3baed90` |
| Release gate | Type checks, lint, 27 test suites with 156 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 82.79% statement coverage; zero production dependency vulnerabilities |
| Manual multi-select availability | Incidents loaded 94 Problems, 32 provider-relevant candidates, and 31 needing review. The formerly disabled control became `Select multiple (31)` even though Dynatrace had not returned root-cause entities for those candidates | Installed production Incidents accessibility-tree and visual smoke |
| Guarded bulk interaction | Two real closed candidates without returned root cause were selected together. The second step stated that both lacked root-cause evidence, identified the outcome as the operator's classification rather than proof, and exposed `Confirm 2 decisions` | Installed production Incidents interaction smoke; confirmation was not submitted |
| Safety continuity | Missing root cause no longer blocks manual review, but exact-root suggestions still require one returned root-cause identity. Active, selected-provider-linked, incomplete, unconfirmed-scope, and previously reviewed Problems remain ineligible | `tests/incidentTriage.test.ts`; six focused triage tests passed |
| Release history | Change log showed `0.0.56 Current release` and all three manual multi-select details | Installed production change-log smoke |
| Runtime quality | The final production Incidents layout remained bounded and the app frame emitted no captured browser warnings or errors | Connected Chrome visual and app-frame browser-log smoke |

## 0.0.55 verified scenarios

The `0.0.55` artifact from source commit `7e12e43` was deployed to the designated Dynatrace target environment on 2026-09-13 and exercised through the connected Chrome profile. The production smoke was read-only. It did not change provider configuration, credentials, mappings, custom terms, evidence decisions, objectives, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.55` manifest, six AppEngine functions, canonical Signal Review SVG, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `7e12e43` |
| Release gate | Type checks, lint, 27 test suites with 155 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 82.62% statement coverage; zero production dependency vulnerabilities |
| Local visual acceptance | The selected Signal Review mark rendered clearly at the actual 20-pixel AppHeader size in both light and dark themes. The embedded asset completed at its natural 150 by 150 dimensions, the original dark theme was restored, and no browser warnings or errors were captured | Connected Chrome local-development smoke |
| Production identity | The installed production shell displayed the Signal Review mark with the `SLA Review` title. The exact selected SVG loaded completely at 20 by 20 CSS pixels | Connected Chrome production DOM and visual smoke |
| Coverage continuity | Coverage finished Ready for AWS with eight loaded services, three covered, five not attributed, zero active incidents, seven Problems observed over seven days, and a 30-day filing reference. All, Covered, and Needs review counts remained consistent | Installed production Coverage smoke |
| Release history | Change log showed `0.0.55 Current release`, “Introduced the Signal Review app mark,” and all three release details | Installed production change-log smoke |
| Bounded runtime | The production page had matching client and scroll dimensions of 1694 by 803 CSS pixels, with no page overflow and no captured browser warnings or errors | Connected Chrome dimension and browser-log smoke |

## 0.0.54 verified scenarios

The `0.0.54` artifact from source commit `cb7cf52` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The production smoke was read-only. It did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.54` manifest, six AppEngine functions, root-cause decision fields, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `cb7cf52` |
| Release gate | Type checks, lint, 27 test suites with 155 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24.19.0 | `npm run verify:release`; 82.62% statement coverage; zero production dependency vulnerabilities |
| Release history | Change log showed `0.0.54 Current release` and the guarded root-cause-assisted triage details | Installed production change-log smoke |
| Coverage continuity | Coverage finished Ready with eight loaded services, three covered, five not attributed, and zero ambiguous matches. The provider-scope tile and All, Covered, and Needs review counts agreed | Installed production Coverage accessibility-tree smoke |
| Conservative incident triage | Incidents loaded seven provider-relevant Problems over seven days: six needing review, one existing Not provider-related decision, and zero active. Dynatrace returned no root-cause entity for these Problems, so Select multiple correctly remained disabled instead of treating missing data as provider absence | Installed production Incidents accessibility-tree and visual smoke |
| Evidence continuity | Evidence reported six Needs review, zero Not ready, zero Package ready, and one Not provider-related. The existing decision, current telemetry, terms, and no-submission boundary remained intact | Installed production Evidence smoke; no decision write was performed |
| Directory source | AWS published terms loaded through the deployed directory function with 62 services, 99.99% availability, a 30-day filing reference, credit policy, claim inputs, exclusions, support metadata, and record provenance | Installed production Directory smoke |
| Bounded runtime | The AppShell and app iframe had matching client and scroll dimensions of 1492 by 803 and 1444 by 803 CSS pixels, respectively, with no horizontal or document overflow and no captured browser errors | Connected Chrome dimension and browser-log smoke |
| Open bulk-mutation acceptance | Exact-root grouping, eligibility, per-Problem persistence, partial failure, stale-state invalidation, and the 50-record limit have executable coverage. The live tenant had no eligible Problem with a returned root cause, so production bulk persistence was deliberately not forced | `tests/incidentTriage.test.ts`, `tests/problems.test.ts`, `tests/evidenceCandidates.test.ts`; requires a disposable qualifying Problem for live mutation acceptance |

## 0.0.53 verified scenarios

The `0.0.53` artifact from source commit `12b2af9` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The production smoke was read-only. It did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.53` manifest, six AppEngine functions, updated evidence-decision schema, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `12b2af9` |
| Release gate | Type checks, lint, 25 test suites with 146 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `npm run verify:release`; 82.26% statement coverage; zero production dependency vulnerabilities |
| Release history | Change log showed `0.0.53 Current release` after a fresh app reload | Installed production change-log smoke |
| Coverage integrity | Production loaded eight services in All, with two covered and six not attributed. The provider-scope tile and worklist counts agreed | Installed production Coverage accessibility-tree and visual smoke |
| Real tenant triage | Incidents loaded 94 Problems over 30 days, four affected services, zero active Problems, and zero AWS evidence candidates. The selected Problem preserved its exact affected-service Coverage route | Installed production Incidents smoke |
| Objective continuity | Performance loaded the existing AWS customer objective and its native evaluation without introducing a second measurement source | Installed production Performance smoke |
| Directory and settings | AWS terms retained the complete public reference, 62 services, support and custom-term views; Settings reported the public directory source connected | Installed production Directory and Settings smoke |
| Evidence package logic | Exact affected-service request/failure aggregation, objective lookup bounds, provider-report correlation, provider-service route continuity, checklist gating, three persisted statuses, and legacy-decision compatibility passed focused automated coverage | `tests/serviceTelemetry.test.ts`, `tests/queries.test.ts`, `tests/providerNoticeCorrelation.test.ts`, `tests/reviewRoutes.test.ts`, `tests/evidenceCandidates.test.ts` |
| Conservative production state | The live AWS boundary did not overlap a current Problem, so Evidence correctly remained complete and empty instead of fabricating a provider candidate. No temporary production mapping was created solely to force a decision | Installed production Evidence smoke |
| Open authorization acceptance | Writer-side Not ready persistence and current-checklist Package ready behavior are implemented and unit tested. Live read-only, denied-write, and new-schema mutation acceptance still require governed test identities and a disposable qualifying Problem | Target environment remained unchanged; prior `0.0.42` acceptance covers create, reload, reopen, and cleanup on the earlier compatible decision lifecycle |

## 0.0.52 verified scenarios

The `0.0.52` artifact from source commit `a4caa5c` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The smoke was read-only. It did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.52` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `a4caa5c` |
| Release gate | Type checks, lint, 24 test suites with 140 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; 81.95% statement coverage; zero production dependency vulnerabilities |
| All-first Coverage | Coverage opened with All selected and showed eight loaded services in one grouped worklist: two covered and six without provider evidence. Covered and Needs review remained visible as focused controls | Installed production Coverage DOM and visual smoke |
| Unified totals | The provider scope tile reported `2 of 8`, the All control reported eight, Covered reported two, and Needs review reported zero from the same coverage model | Installed production Coverage smoke plus focused unit tests |
| Bounded layout | Coverage reported equal body client and scroll dimensions of 1646 by 803 CSS pixels, with no document scrolling or horizontal overflow | Installed production frame dimension check |
| Objective consistency | The selected covered service reported 63.794% observed availability and a 99.99% target in both Coverage and Performance | Installed production Coverage and Performance interaction smoke |
| Context-preserving handoff | Problem `P-260934` routed its exact affected service to Coverage with provider, Problem, service, and return context. Back to review restored the same Problem without saving a mapping | Installed production Incidents-to-Coverage navigation smoke |
| Evidence stopping point | Evidence clearly separated review candidates from provider reports, showed the completed empty state, and stated that nothing was submitted | Installed production Evidence smoke |
| Provider routing and actions | AWS custom terms opened the provider-specific settings page, the empty custom-terms view exposed one add action, and the missing provider-report source exposed one connection action | Installed production Directory, Settings, and Provider reports smoke |
| Release history | Change log showed `0.0.52 Current release` and the All-first Coverage, contextual handoff, and claim-package changes | Installed production change-log smoke |
| Runtime quality | Coverage, Performance, Incidents, Evidence, Directory, Settings, and change log loaded without a captured browser warning or error | Connected Chrome browser-log and interaction smoke |

## 0.0.51 verified scenarios

The `0.0.51` artifact from source commit `e55ba8c` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The smoke was read-only. It did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.51` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `e55ba8c` |
| Release gate | Type checks, lint, 22 test suites with 136 tests, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | Final `npm run verify`; production dependency audit reported zero vulnerabilities |
| Real tenant queue | Incidents loaded 94 Dynatrace Problems for the 30-day window and displayed a bounded page of eight items with 12 pages | Installed production Incidents accessibility-tree and visual smoke |
| Prioritization and pagination | The queue prioritizes active and provider-relevant Problems before recency, preserves source order for ties, and selected the first item on page two after Next | Focused unit coverage and installed production pagination interaction |
| Focused detail | The selected Problem showed affected service, provider match, root-cause availability, state, and observed window. Filing mechanics, credit, and terms details were absent | Installed production Incidents DOM, accessibility-tree, and visual smoke |
| Conservative routing | The live selected Problem had an affected service but no AWS coverage overlap, so the single contextual action routed to Coverage. Production reported zero Evidence candidates and did not infer provider relevance | Installed production Incidents smoke against live AWS data |
| Native Problems handoff | Open Problems launched the official `dynatrace.davis.problems` application | Installed production navigation smoke |
| Evidence continuity | Candidate selection is preserved in the Evidence route by automated coverage. The target environment had zero AWS candidates, so this handoff was not forced during the production smoke | End-to-end route coverage and unchanged target environment |
| Bounded layout | The production app body reported equal client and scroll dimensions of 1646 by 803 CSS pixels, eight incident tiles, and no document scrolling or horizontal overflow | Installed production frame dimension and DOM checks |
| Runtime quality | Incidents loaded and paginated without a captured browser warning or error | Connected Chrome browser-log and interaction smoke |

## 0.0.50 verified scenarios

The `0.0.50` artifact from source commit `b327e49` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The smoke was read-only apart from switching the personal theme from light to dark. It did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.50` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `b327e49` |
| Release gate | Type checks, lint, 21 test suites with 134 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | `npm run verify:release`; 81.02% statement coverage and zero production dependency vulnerabilities |
| SRE flow | The installed navigation presents Coverage, Performance, Incidents, Evidence, and the disabled FinOps Agent in that order | Installed production navigation and accessibility-tree smoke |
| Objective portfolio | Performance loaded one AWS customer objective and displayed compact status facts, an objective tile, and selected-objective detail inside the app shell | Installed production Performance smoke against live Dynatrace objective data |
| Objective evidence | `content-pipeline-catalog availability (AWS)` evaluated at 63.794% against a 99.99% target for the last 30 days, reported Below target, and showed a -36.196% error budget | Installed production Performance accessibility-tree and visual smoke |
| Native presentation | The Service objectives header and Open SLOs action use the native objective icon, and the observed result is rendered with the native single-value visualization | Installed production DOM and visual smoke; Open SLOs contained one SVG icon |
| Evidence boundary | Performance states that objective status comes from customer-observed Dynatrace service telemetry while provider reports remain separate evidence | Installed production Performance copy and selected-objective smoke |
| Bounded layout | The production app body reported equal client and scroll dimensions of 1646 by 803 CSS pixels in light and dark themes, with no document scrolling or horizontal overflow | Installed production dimension and visual checks |
| Release history | Change log showed `0.0.50 Current release` and the Performance portfolio details | Installed production change-log smoke |
| Runtime quality | Coverage, Performance, and change log loaded without a captured browser warning or error | Connected Chrome browser-log and interaction smoke |

## 0.0.49 verified scenarios

The `0.0.49` artifact from source commit `9b9c9ed` was deployed to the designated Dynatrace target environment on 2026-09-12 and exercised through the connected Chrome profile. The tenant returned one existing app-managed objective for the selected covered service. The smoke opened that record in the native Service-Level Objectives app but did not create, update, or delete an objective or change provider configuration, credentials, mappings, custom terms, evidence decisions, entities, or cloud resources. The production theme remained light.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.49` manifest, six AppEngine functions, App Settings schemas, new objective scopes, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `9b9c9ed` |
| Release gate | Type checks, lint, 21 test suites with 132 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed under Node 24 | Release commands completed locally; zero production dependency vulnerabilities |
| Exact service preview | Covered AWS service `content-pipeline-catalog` resolved to Amazon EC2 and displayed customer-observed request availability, the 99.99% target, a 30-day evaluation period, and `sla.directory` as the terms source | Installed production Coverage smoke against live Grail telemetry |
| Service-scale boundary | Coverage exposed one objective for the exact Dynatrace service while keeping its Smartscape runtime and location as supporting scope context. No host, process, or runtime objective fan-out occurred | Installed production Coverage accessibility-tree and interaction smoke |
| Existing-objective protection | The app detected the existing deterministic provider-and-service objective and showed `Open in SLOs` instead of another create action | Installed production Coverage smoke |
| Native handoff | `Open in SLOs` opened the native Service-Level Objectives app, where `content-pipeline-catalog availability (AWS)` showed a 99.99% target and Last 30 days evaluation | Installed production native-app handoff smoke |
| Explicit create guard | The local tenant-hosted build enabled creation only after the scoped Grail query completed, exposed a second confirmation, and returned safely to preview when Cancel was selected | Connected Chrome local-release smoke; no create request was submitted |
| Release history | Change log showed `0.0.49 Current release` and the customer-objective handoff details | Installed production change-log smoke |
| Runtime quality | The installed app and objective handoff completed without an application-frame warning or error | Connected Chrome browser-log and interaction smoke |

## 0.0.48 verified scenarios

The `0.0.48` artifact from source commit `b153ff6` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through the connected Chrome profile. No provider configuration, provider credential, Credential Vault record, service mapping, custom terms record, evidence decision, Dynatrace entity, or cloud resource was created or changed. The production theme remained dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.48` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and Chrome smoke; source commit `b153ff6` |
| Release gate | Type checks, lint, 20 test suites with 126 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | `npm run verify:release`; zero production dependency vulnerabilities |
| Direct Coverage entry | The installed app opened directly in Coverage, selected AWS from tenant evidence, and reported two services matched from provider-native topology without a setup wizard or provider checklist | Installed production Coverage smoke |
| Single mapping source | Incident review exposed no provider-service or Dynatrace-scope selector. It resolved the selected Problem through Coverage and conservatively used provider-wide terms when no unique mapping existed | Installed production Incidents smoke |
| Evidence separation | Evidence kept review candidates separate from provider reports and routed the missing AWS account source to Provider connections without treating it as local impact | Installed production Evidence and Provider reports smoke |
| Directory completeness | AWS terms exposed published availability, credit policy and tiers, filing instructions, evidence requirements, exclusions, vendor provenance, and the 62-service catalog entry point | Installed production Directory smoke against the live `sla.directory` response |
| AWS connection guidance | Provider connections required `health:DescribeEvents`, `health:DescribeEventDetails`, and `health:DescribeAffectedEntities`, accepted only a Credential Vault ID, and remained unsaved | Installed production Settings smoke; no credential was entered or stored |
| Release history | Change log showed `0.0.48 Current release` and the Coverage inheritance and exact AWS resource-correlation changes | Installed production change-log smoke |
| Runtime quality | Coverage, Incidents, Evidence, Directory, Settings, and change log loaded without a captured browser warning or error | Connected Chrome browser-log and interaction smoke |

## 0.0.46 verified scenarios

The `0.0.46` artifact from source commit `1dc26dd` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through a fresh Chrome session. No provider configuration, provider credential, Credential Vault record, service mapping, custom terms record, evidence decision, Dynatrace entity, or cloud resource was created or changed. The production theme remained dark.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.46` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and fresh Chrome smoke; source commit `1dc26dd` |
| Release gate | Type checks, lint, 19 test suites with 121 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | Release commands completed locally with zero production dependency vulnerabilities |
| Direct first use | The installed app opened directly in Coverage with no setup wizard, provider confirmation screen, or `Start setup` action | Fresh production startup and accessibility-tree smoke |
| Live provider evidence | Coverage selected AWS from the environment and loaded two services matched from provider-native topology, eight total services, and no evidence-backed exceptions | Installed production Coverage smoke |
| Optional guidance | Settings exposed one Walkthrough page, stated that the walkthrough changes nothing, and opened the five-step product tour only after an explicit action | Installed production Settings and walkthrough interaction |
| Release history | Change log showed `0.0.46 Current release` and the direct-to-Coverage release details | Installed production change-log smoke |
| Runtime quality | Production startup, navigation, provider evidence loading, Settings, change log, and walkthrough completed without a captured browser warning or error | Fresh Chrome browser-log and interaction smoke |

## 0.0.45 verified scenarios

The `0.0.45` artifact from source commit `7818b5c` was deployed to the designated Dynatrace target environment on 2026-09-11 and exercised through a fresh Chrome session. No provider configuration, provider credential, Credential Vault record, service mapping, custom terms record, evidence decision, Dynatrace entity, or cloud resource was created or changed.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Release artifact | The `0.0.45` manifest, six AppEngine functions, App Settings schemas, and UI deployed successfully under the unchanged `my.sla` application ID | Installed production deployment and fresh Chrome smoke; source commit `7818b5c` |
| Release gate | Type checks, lint, 19 test suites with 121 tests, coverage collection, production build, App Toolkit analysis, and production dependency audit passed | Release commands completed locally with zero production dependency vulnerabilities |
| Environment-driven providers | The production provider control enabled AWS from tenant evidence and did not present unavailable providers as active choices | Installed production Coverage and Settings smoke |
| Provider-native coverage | Coverage showed two AWS services matched from provider-native topology without requiring an operator confirmation step | Installed production Coverage smoke |
| Settings clarity | Provider Settings showed AWS as Detected and the remaining supported providers as Available, preserving deliberate opt-in for dependencies not visible in the environment | Installed production Settings smoke |
| Release history | Change log showed `0.0.45` as the current release with the environment-driven provider and coverage changes | Installed production change-log smoke |
| Runtime quality | Production startup, navigation, Coverage, Settings, and change log completed without an application error | Fresh Chrome interaction smoke |

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

# Load-bearing flows

These flows cover permission boundaries, external calls, data integrity, or operational handoff. Presentational-only interactions are intentionally omitted.

## Load the watch

Actor: signed-in Dynatrace user.

Precondition: AppEngine can run the app, and the user has the declared read scopes plus app run access.

Sequence:

1. `App` restores personal and workspace state. If app-state reads fail, it uses local browser state and displays the degraded storage message.
2. `Dashboard` issues bounded DQL reads for services, Problems, logs, spans, service-request telemetry, and preferred Smartscape coverage anchors. Separate aggregate queries verify whether the returned service or relationship inventory is complete. Exact affected-service IDs also drive incident-scoped topology, service, request, and failure reads, so Evidence does not depend on a global service-list cap.
3. `Dashboard` builds the active-provider list from detected topology, exact reviewed provider identities, cloud dimensions, source-owned provider tags, saved SLA matches, and enabled incident connections. Hosted GenAI identities resolve to the provider that owns the applicable SLA, while unknown identities and model or framework names remain ignored. It calls the `slaDirectory` AppEngine function with the focused provider slug. Unrelated catalog providers do not enter the operating selector.
4. The function validates the slug, calls the allowlisted public API, applies an eight-second timeout, validates the response, and returns normalized provider and service records.
5. The app reads active custom terms, confirmed SLA matches, and prior human evidence decisions from App Settings. It preserves the published terms as the fallback baseline.
6. Coverage reports loading, access incomplete, inventory incomplete, terms unavailable, action required, ready, or review available. It never reports complete coverage from a truncated or unverified inventory.
7. The operating shell presents three stages: Identify (Coverage), Evaluate (Evidence, Performance, and Provider terms), and Automate (local FinOps routing). Coverage is the landing workspace and places provider, service, Problem, and filing facts above one normalized service worklist. Detected topology opens first; SLA matches opens when a focused handoff identifies an exact service. Bounded global Smartscape inventory places providers in the rail, while only exact provider-native service topology, source tags, or saved SLA matches attribute a service. Ambiguous service-level evidence is queued for review, and services without an SLA match remain visible as not matched. Performance evaluates a bounded page of app-managed customer objectives for the active provider. Evidence is the single case queue and assembles Problems, provider scope, terms, and required evidence into a human-reviewed package while keeping provider reports separate. Same-day, same-service queue groups are presentation only; independent cases and human decisions remain separate. The app shows a result-limit warning when the Problems read is truncated and hands full causal investigation to the native Problems app. Provider terms exposes the complete normalized published provider record and custom terms. Automate reads route events only when the local integration has been configured and run.
8. Loading the workspace does not change a Dynatrace entity, tag, metric, Problem, SLO, custom terms record, evidence decision, or external ticket.

Deny or degraded behavior: a missing read scope is shown as access incomplete, not as no telemetry. A failed directory request is shown as unavailable, not as a provider breach.

The Automate route starts only after a complete human Evidence decision and separate local gateway and Workflow configuration. It does not run during first-use review. See [FinOps routing setup](finops-agent.md) for the event, gateway, Grail, and Phoenix checks.

## Configure provider defaults

Actor: user with `state:app-states:write`.

1. Settings lets the user choose among providers automatically placed in scope, then edit the tag key or evidence lookback. Providers enter scope from bounded Smartscape cloud inventory, exact reviewed provider identities, service-level Dynatrace evidence, confirmed SLA matches, or enabled incident connections. Standard identities are portable across tenants; uncommon providers can still use source metadata or a confirmed SLA match. Provider presence alone does not attribute a service.
2. Inputs are normalized before persistence. The focused provider is a valid lowercase slug and the operating surface constrains it to the runtime provider collection.
3. The context optimistically updates the UI and writes the workspace state with an expiry just inside the platform's 90-day limit.
4. If the shared write is denied, the same normalized value is kept in local storage and a status message explains the fallback.

Deny behavior: saving provider defaults never writes to Dynatrace entity settings or telemetry. A user without app-state write access can still inspect the app but cannot create a shared configuration. Failed discovery does not enable the entire provider catalog. Switching the active provider changes only the focused view.

## Read Dynatrace-ingested AWS provider notices

Actor: SRE reader with `storage:events:read`.

1. The existing Dynatrace AWS connection enables Amazon EventBridge event ingest with source `aws.health` for the monitored account and intended regions.
2. Evidence runs one bounded Grail query for Dynatrace event-ingest records whose source is `aws.health`.
3. The app retains the AWS account, region, Health event timing, provider service, explicit affected resources, and Smartscape source context returned by Dynatrace.
4. An event with no explicit affected resource remains provider-level corroboration. It is not matched to a service merely because Dynatrace linked it to the AWS account node.
5. Evidence compares explicit affected-resource identifiers with compatible Smartscape runtime identifiers and keeps provider evidence separate from customer-observed impact.

Deny or degraded behavior: denied event access is unavailable, not zero. An empty result says that no matching event was found or that EventBridge health ingestion is not enabled. It never establishes that the monitored services were healthy.

## Configure the optional direct AWS provider source

Actor: administrator with App Settings write access, access to the selected Credential Vault record, an AWS Health API eligible support plan, and permission to configure AWS IAM. This is a fallback for API lookback, not the default AWS path.

1. The administrator creates a dedicated AWS role with only `health:DescribeEvents`, `health:DescribeEventDetails`, and `health:DescribeAffectedEntities`.
2. The administrator creates or selects a dedicated base identity with `sts:AssumeRole` permission only for that role, then configures the role to trust that principal.
3. The administrator stores JSON containing the base identity's `accessKeyId`, `secretAccessKey`, and an optional `sessionToken` as a Token credential with AppEngine scope and application access limited to SLA Review.
4. The administrator allowlists `sts.us-east-1.amazonaws.com` and `health.us-east-1.amazonaws.com` in Dynatrace External requests.
5. The administrator enters a 12-digit AWS account ID, the non-secret role ARN, and the Credential Vault record ID under Provider connections. More than one account connection can be retained.
6. Test connection signs STS `AssumeRole` with the base credential, keeps the one-hour response only in function memory, then calls `GetCallerIdentity` and rejects an effective identity whose returned account differs from the configured account.
7. A new or access-modified connection can be saved only after the current fields pass Test connection. After account verification, the function signs bounded AWS Health `DescribeEvents`, `DescribeEventDetails`, and `DescribeAffectedEntities` requests with the assumed-role session and returns only events explicitly marked `ACCOUNT_SPECIFIC`.
8. Evidence compares returned affected-resource identifiers with Smartscape runtime identifiers only when account and location context are compatible. An exact match can identify overlapping Dynatrace services; account or region overlap alone never qualifies as local impact.
9. Live acceptance uses a dedicated, revocable least-privilege base identity. After a disposable test, the administrator removes the app connection, deletes the Credential Vault record, and revokes the AWS credential.

Deny or degraded behavior: a missing support plan, inaccessible base credential, denied role assumption, invalid signature, wrong account, Health IAM denial, throttled endpoint, malformed response, or unmatched resource identifier is shown explicitly. The app does not silently replace a selected AWS account with a public source, modify AWS, or represent an account event as proof of local impact or credit eligibility.

## Configure Azure provider notices

Actor: administrator with App Settings write access, access to the selected Credential Vault record, and permission to configure a Microsoft Entra application and Azure role assignment.

1. The administrator creates a dedicated Microsoft Entra application and service principal with a managed client-secret lifecycle.
2. The administrator grants only `Microsoft.ResourceHealth/events/read` on the intended Azure subscription.
3. The administrator stores JSON containing `tenantId`, `clientId`, and `clientSecret` as a Token credential with AppEngine scope and application access limited to SLA Review.
4. The administrator allowlists `login.microsoftonline.com` and `management.azure.com` in Dynatrace External requests.
5. The administrator enters the Azure subscription ID and Credential Vault record ID under Provider connections. More than one subscription connection can be retained.
6. Test connection exchanges the client credential for a short-lived token and reads bounded Resource Health events only for the configured subscription. A new or access-modified connection can be saved only after this test succeeds.

Deny or degraded behavior: an inaccessible or expired credential, invalid tenant, missing subscription permission, throttled endpoint, or malformed response is shown as unavailable. The app does not silently replace a selected Azure subscription with a public source, modify Azure, or represent a Service Health event as proof of local impact or credit eligibility.

## Configure Google Cloud provider notices

Actor: administrator with App Settings write access, access to the selected Credential Vault record, and permission to configure Google Cloud IAM.

1. The administrator enables `servicehealth.googleapis.com` in the target Google Cloud project.
2. The administrator grants a dedicated service account `roles/servicehealth.viewer` and `roles/serviceusage.serviceUsageConsumer` for that project, then creates a JSON key.
3. The JSON key is stored as a Token credential with AppEngine scope and application access limited to SLA Review. The secret is never entered in app settings.
4. The administrator enters a Google Cloud project ID and Credential Vault record ID under Provider connections. More than one project connection can be saved.
5. Test connection calls the personalized endpoint with fallback disabled. A new or access-modified connection can be saved only after this test succeeds. Save writes only the non-secret identifiers to `provider-connections`.
6. Evidence lets the operator choose a saved project or the public source. The function exchanges a short-lived Google OAuth token at request time and returns normalized event data only.

Deny or degraded behavior: a missing connection uses public Google Cloud Status and labels it non-project-specific. A failed saved connection can fall back to public status with a warning during monitoring. Test connection never hides a failure behind the fallback. No path creates a Dynatrace Problem, notification, ticket, provider mutation, or SLA claim.

## Review a public provider status source

Actor: signed-in Dynatrace user.

1. The operator selects OCI, OpenAI, Anthropic, or ElevenLabs as the active monitored provider and opens Evidence.
2. `providerPublicStatus` accepts only those provider slugs and maps each one to a fixed public JSON endpoint. No credential or authorization header is accepted or sent.
3. Statuspage incidents are filtered to the selected evidence window. OCI's public regional component endpoint is a current-state source, so the UI labels it as current coverage instead of a historical lookback.
4. The UI labels every record public and non-customer-specific and keeps it separate from Dynatrace Problems.

Deny or degraded behavior: an unsupported provider has no provider-owned incident source in this release. A failed or malformed public response is shown as unavailable, never as healthy. Public status never establishes account impact, local impact, provider fault, or credit eligibility.

## Configure OCI tenancy announcements

Actor: administrator with App Settings write access, access to the selected Credential Vault record, and permission to configure OCI IAM and API keys.

1. The administrator creates a dedicated OCI API user, uploads the public half of an RSA signing key, and records the user OCID and API-key fingerprint.
2. The administrator places the user in a group with exactly `Allow group AnnouncementListers to inspect announcements in tenancy` for summary announcement access.
3. The administrator stores JSON containing `userOcid`, `fingerprint`, and the unencrypted RSA `privateKey` as a Token credential with AppEngine scope and application access limited to SLA Review.
4. The administrator enters the tenancy OCID, one commercial OCI region, and the Credential Vault record ID under Provider connections. More than one tenancy can be saved.
5. The administrator allowlists the exact `announcements.<region>.oraclecloud.com` host in Dynatrace External requests. Test connection signs a bounded GET request and does not fall back to the public source. A new or access-modified connection can be saved only after this test succeeds.
6. Evidence lets the operator choose a saved tenancy or the public OCI regional source. OCI service names are mapped to `sla.directory` candidates only through a reviewed table. Ambiguous products remain unresolved.

Deny or degraded behavior: an inaccessible credential, invalid signature, missing `ANNOUNCEMENT_LIST` permission, invalid region, throttled endpoint, or malformed response is shown as unavailable. The app does not expose private key material, modify OCI, or represent an announcement as proof of local impact or credit eligibility.

## Review or confirm an SLA match

Actor: signed-in user with `app-settings:objects:write` for the app's `provider-scope-assignments` schema.

1. The user opens Coverage with All selected. One normalized worklist groups every loaded service as covered, needing review, or unattributed. Visible Covered and Needs review controls focus the same model without changing its totals.
2. Smartscape-backed rows show one representative host, cluster, or provider-native runtime anchor per service. Process and container relationships are not expanded into primary Coverage rows.
3. A fixed provider-specific table may resolve one provider-native runtime type to one provider service. That observed SLA match is used without writing one App Settings object per service.
4. Hostname-only patterns, conflicting provider services, and provider boundaries without a service match remain for review. The user can confirm or change the exact provider service.
5. App Settings stores an operator-confirmed SLA match with exact service and runtime IDs, display context, provider-service ID, and a concise evidence note.
6. Incidents and Evidence use matching custom terms first, then an operator-confirmed SLA match, then a unique observed topology match. The operator still determines whether the provider caused the incident or owes a credit.

Deny or degraded behavior: a missing Smartscape relationship is not replaced with a name-based guess. A lower-confidence or ambiguous candidate is not presented as observed. A read-only user can inspect automatic matches and candidates but cannot create, update, or remove an SLA match. If aggregate counts fail or exceed the loaded rows, Coverage reports incomplete inventory rather than complete coverage.

## Preview or create a customer screening objective

Actor: signed-in user with `storage:metrics:read`; discovery requires `slo:slos:read`, and creation also requires `slo:slos:write`.

1. Coverage shows customer service and native provider resource relationships. An unambiguous observed provider-native product match or an operator-confirmed match is required for the exact resource. A source tag or direct service fallback alone cannot create a product scope objective.
2. Automate groups those exact resources by provider product, account, and region. It requires valid classic IDs for every linked customer service, one common effective terms target across the exact service and resource contexts, and customer request telemetry for every linked service.
3. The bounded 30-day Grail preview shows the linked resources, dependent services, common target, and customer observed request availability. Provider notices remain separate.
4. The app reads the native objective inventory and blocks creation if that inventory is incomplete or if an existing SLO overlaps any linked service or the same account and region scope. It uses a deterministic product-scope external ID.
5. A user with write access explicitly confirms one create action. The custom SLI aggregates request and failure counts across the validated service IDs into one customer screening measurement.
6. Performance lists only app-managed objectives for the active provider, eight per page. It evaluates the visible page with bounded concurrency and shows status, observed value, target, error budget, and period inside the app shell.

Deny or degraded behavior: page load, preview, and Performance never create a resource. Missing exact account, region, product, unambiguous resource match, classic service ID, common target, metric access, query validation, complete objective inventory, or objective write access disables creation. A failed evaluation is shown as no result, not as healthy or breached. Runtime rows do not fan out into separate objectives. The generated objective screens customer impact in one product scope and does not establish provider fault or credit eligibility.

## Add or edit custom terms

Actor: signed-in user with `app-settings:objects:write` for the app's `contract-overrides` schema.

1. The user opens Settings, then Custom terms. New records use the full settings page; the dialog is reserved for quick edits to an existing record.
2. Under Applies to, the user selects Provider default, selected Dynatrace services, selected hosts or runtimes, or observed locations.
3. Service targets come from the entity inventory. Runtime and location targets come from the current Smartscape topology. The user may assign one terms record to multiple exact targets.
4. The app stores the target IDs and display names separately. IDs establish the match; names do not.
5. The user enters only operational values, effective dates, and a concise agreement reference. The UI warns that all authenticated app users can read the setting and that confidential agreement text or credentials must not be entered.
6. The app validates the effective dates, numeric ranges, Dynatrace targets, and duplicate scope before writing the record through App Settings V2.
7. Existing records can be disabled, edited, or removed. Removing a record restores the next matching custom terms or the published terms.

Deny or degraded behavior: without App Settings write permission, the page is read-only. Without service or Smartscape read access, unavailable target types are not fabricated; Provider default can still be selected. Saving no record leaves the published terms unchanged.

## Triage a provider-impact case for evidence review

Actor: signed-in Dynatrace user.

1. Incidents reads each Problem's stable Smartscape affected-entity and root-cause records, retaining deprecated classic fields only as a compatibility fallback, and reuses the canonical Evidence candidate rules.
2. The app creates one review case per Problem by default. It combines Problems only when all members resolve to one provider service and one effective terms scope, occur no more than 45 minutes apart within a six-hour maximum case span, and share either an affected service or one exact returned root cause. Host- or location-specific custom terms prevent automatic grouping.
3. Active cases are ordered first, then provider-relevant cases, then the newest remaining cases. The worklist is limited to 16 compact cases per page. Changing pages selects the first visible case instead of retaining hidden context.
4. The focused summary shows Problem count, affected services, provider service, root-cause signals, state, observed window, and a default-open list of every included Problem.
5. A provider-relevant case opens directly in Evidence with the same case selected. A case with affected scope but no provider overlap opens Coverage. Full causal investigation opens in the native Dynatrace Problems app.
6. An SRE may manually select eligible closed cases containing up to 50 Problems and explicitly confirm Excluded from provider follow-up. A missing root cause remains visible but does not block that human decision. Active, provider-linked, incomplete, unconfirmed-scope, and previously reviewed Problems stay protected.
7. The app writes one decision per underlying Problem. A partial batch failure leaves the affected case selected, refreshes once, and does not hide successful writes.
8. Terms details, filing mechanics, credit values, traces, logs, remediation, and full causal analysis stay out of Incidents. They remain in Directory, Evidence, or the native Problems app as appropriate. A provider-relevant case remains Needs review until a human outcome is current.

Deny or degraded behavior: missing topology, SLA matches, custom terms, decision-store access, or Problem access is surfaced as unavailable or incomplete. The case worklist remains usable when provider matching fails, but automatic grouping and bulk mutation are disabled when the evidence required to do them safely is incomplete. The app never groups on vendor alone, substitutes a name-based guess, treats absence of an SLA match as proof, or treats a lower-confidence Smartscape candidate as observed.

## Review an evidence case

Actor: signed-in user with `app-settings:objects:read`; saving a decision also requires `app-settings:objects:write` for `evidence-decisions`.

1. Evidence compares each returned Problem with exact saved SLA matches, explicit provider tags, observed provider-native topology, and lower-confidence Smartscape suggestions for the active provider, then reuses the same review cases created for Incidents.
2. A Problem enters the candidate queue only when at least one exact affected service overlaps one of those relationships. Saved SLA matches take precedence over provider tags, which take precedence over topology. Problems are combined only by the documented case rules, never by provider name alone.
3. The Review cases queue supports text search, current-state filters, accurate totals, and five cases per page without silently dropping additional cases. The case and queue share one page scroll, with a compact case picker on narrow screens. Incidents and Evidence use the same state resolver, including loading, unavailable, stale, partial, and mixed records.
4. The detail view leads with readiness and gives one direct explanation of why the case appears. It assembles the combined UTC window, every supporting Problem, affected services, exact incident-scoped request and failure totals, observed availability, up to three native objective snapshots, coverage basis, resolved terms, filing reference, exclusions, and published evidence requirements.
5. Evidence checks the optional provider source for time-overlapping corroboration. An exact affected-resource-to-Smartscape-runtime match is labeled exact; provider service plus time is supporting only. Public, missing, unavailable, or contradictory provider corroboration never invalidates customer-observed impact.
6. A Coverage repair preserves provider, case, lead Problem, affected service, selected provider service, and return destination. Provider-native topology is labeled observed, while hostname-only or conflicting topology remains visibly unconfirmed.
7. Marking Evidence review complete requires every published evidence item plus an explicit review-boundary acknowledgement. Saving Needs evidence requires a concise description of what remains. Excluding a case from provider follow-up requires a concise operational reason.
8. One case action writes the same outcome to one bounded App Settings record per underlying Problem. Each record retains its Problem snapshot, exact affected entity IDs, root-cause entity at review time, provider services, SLA match basis, three-state decision, acknowledged evidence items, review time, and concise note.
9. A case has one current state only when every included Problem has a current decision with the same status. Partial or differing records appear as Mixed review. A changed Problem or boundary returns the affected case to review. Reopening removes every decision in the case and requires the current checklist before a new Evidence review complete outcome.
10. The status grid distinguishes facts collected automatically, facts confirmed externally, and missing items. Copy follow-up summary and Download evidence review create portable artifacts without saving, routing, or submitting anything.

Deny or degraded behavior: a failed Problem, topology, directory, telemetry, objective, provider-source, custom-terms, or decision-store read is shown as incomplete rather than empty. A read-only user can inspect cases and saved decisions but cannot save, reopen, or change an outcome. A review case and its decision do not establish an SLA violation, provider fault, SLA eligibility, credit approval, or claim submission.

## Confirm service coverage without runtime context

Actor: signed-in user with `app-settings:objects:write` for the app's `provider-scope-assignments` schema.

1. The user opens Coverage and chooses a service without an SLA match.
2. The row identifies service inventory or a matching source tag as the available evidence. Existing provider tags are displayed only as source evidence.
3. The user selects one exact service and chooses Provider default or one provider service. Service names are context only and never create an automatic SLA match.
4. A confirmation screen names the Dynatrace service, provider, and provider service. Saving writes an app-owned SLA match to App Settings and does not modify Dynatrace entity metadata.
5. The saved SLA match is reused by Incidents and Evidence. The operator can update its provider-service selection or remove it to restore the unmatched state.

Deny or degraded behavior: no selection or confirmation means no write. Services with usable active-provider Smartscape relationships use their runtime-backed row instead of being duplicated. Services without an SLA match are not treated as default review work, even when global inventory proves that the provider exists elsewhere in the environment. A read-only user can inspect current coverage but cannot save, update, or remove a match. Existing source tags are never changed.

## Review the change log or get support

Actor: signed-in Dynatrace user.

1. The user opens the change log from the application header or settings rail.
2. The app renders the bundled version history as read-only release information.
3. Before public launch, each Dynatrace Community destination is visible as a disabled `Coming soon` item and exposes no external link. After the launch gate is enabled, those surfaces open the configured Community profile for support or issue discussion.

Deny behavior: these surfaces do not write app state, Dynatrace entities, telemetry, or external tickets. A disabled Community destination is not keyboard-focusable and cannot open a browser tab.

## Show the quick tour or change appearance

Actor: signed-in user with user app-state access.

1. A first-time or returning user opens directly in Coverage. Provider detection and service matching run against the current environment without a setup wizard.
2. The user can show the optional three-step quick tour from the header or Getting started in Settings. The tour visits Identify (Coverage), Evaluate (Evidence), and Automate, then returns to the starting view. It changes no provider, connection, SLA match, terms, telemetry, tag, objective, or evidence-decision state.
3. A selected theme is stored in user app state with an expiry just inside the platform's 90-day limit.
4. A theme-state failure falls back to local state without changing workspace configuration.

## External dependency failure

If `sla.directory` times out, returns a non-success status, or fails schema validation, the AppEngine function throws. The workspace keeps the provider posture unknown and surfaces the error. It does not reuse an unverified response or infer provider responsibility from tenant symptoms.

If personalized Google Cloud access fails during a normal provider-report read, the provider-notice function may return the public status feed with `connectionState: fallback`. The UI identifies the source and states that it is not project evidence. During Test connection, personalized access is required and the exact connection boundary is reported as unavailable instead of falling back.

If a selected AWS account or Azure subscription source fails, the corresponding function reports the failure and does not silently substitute a public source. The operator retains Dynatrace Problems, published terms, and SLA matches while the provider-owned source is unavailable.

If a selected OCI tenancy source fails, the function reports the failure and does not silently substitute public status. The operator can deliberately select the public regional source, which remains labeled non-customer-specific.

If a supported public provider endpoint fails, times out, or returns an invalid payload, the public-status function throws and the UI reports the source as unavailable. It never converts that failure into an empty or healthy status.

# Load-bearing flows

These flows cover permission boundaries, external calls, data integrity, or operational handoff. Presentational-only interactions are intentionally omitted.

## Load the watch

Actor: signed-in Dynatrace user.

Precondition: AppEngine can run the app, and the user has the declared read scopes plus app run access.

Sequence:

1. `App` restores personal and workspace state. If app-state reads fail, it uses local browser state and displays the degraded storage message.
2. `Dashboard` issues bounded DQL reads for services, Problems, logs, spans, service-request telemetry, and preferred Smartscape coverage anchors. Separate aggregate queries verify whether the returned service or relationship inventory is complete.
3. `Dashboard` builds the active-provider list from detected topology, cloud dimensions, source-owned provider tags, saved scope mappings, enabled incident connections, and explicit manual additions. It calls the `slaDirectory` AppEngine function with the focused provider slug. Unrelated catalog providers remain available only in Settings.
4. The function validates the slug, calls the allowlisted public API, applies an eight-second timeout, validates the response, and returns normalized provider and service records.
5. The app reads active tenant custom terms, confirmed provider-service scope mappings, and prior human evidence decisions from App Settings. It preserves the public directory record as the fallback baseline.
6. Coverage classifies the current provider boundary as loading, access-incomplete, inventory-incomplete, contract-unavailable, action-required, boundary-ready, or review-available. It never reports complete coverage from a truncated or unverified inventory.
7. The operating shell presents Coverage, Incidents, and Evidence. Coverage is the landing workspace and places provider, service, incident, and filing facts above an exception-first worklist. Provider-native matches are automatic, ambiguous provider evidence is queued for review, and unrelated loaded services stay out of the default queue. Incidents contains the observed Problem queue and effective filing references. Evidence combines Dynatrace-derived review candidates with a separate provider-reports view. Review terms exposes the complete normalized public provider record and tenant overrides.
8. Loading the workspace does not change a Dynatrace entity, tag, metric, Problem, SLO, custom terms record, evidence decision, or external ticket.

Deny or degraded behavior: a missing read scope is shown as access incomplete, not as no telemetry. A failed directory request is shown as unavailable, not as a provider breach.

## Configure provider defaults

Actor: user with `state:app-states:write`.

1. Settings marks providers detected in the current environment as enabled and read-only. The user may add providers that Dynatrace cannot observe directly, choose the focused provider, and edit the tag key or lookback.
2. Inputs are normalized before persistence. Provider slugs are restricted to lowercase slug characters, common cloud aliases are canonicalized, manual additions are stored separately, and the focused provider must belong to the resulting collection.
3. The context optimistically updates the UI and writes the workspace state with an expiry just inside the platform's 90-day limit.
4. If the shared write is denied, the same normalized value is kept in local storage and a status message explains the fallback.

Deny behavior: saving provider defaults never writes to Dynatrace entity settings or telemetry. A user without app-state write access can still inspect the app but cannot create a shared configuration. Failed discovery does not enable the entire provider catalog. Switching the active provider changes only the focused view.

## Configure AWS provider notices

Actor: administrator with App Settings write access, access to the selected Credential Vault record, an AWS Health API eligible support plan, and permission to configure AWS IAM.

1. The administrator creates a dedicated AWS identity with only `health:DescribeEvents` and `health:DescribeEventDetails`.
2. The administrator stores JSON containing `accessKeyId`, `secretAccessKey`, and an optional `sessionToken` as a Token credential with AppEngine scope and application access limited to SLA Review.
3. The administrator allowlists `sts.us-east-1.amazonaws.com` and `health.us-east-1.amazonaws.com` in Dynatrace External requests.
4. The administrator enters a 12-digit AWS account ID and Credential Vault record ID under Provider connections. More than one account connection can be retained.
5. Test connection signs an STS `GetCallerIdentity` request and rejects a credential whose returned account differs from the configured account.
6. A new or access-modified connection can be saved only after the current fields pass Test connection. After account verification, the function signs bounded AWS Health `DescribeEvents` and `DescribeEventDetails` requests and returns only events explicitly marked `ACCOUNT_SPECIFIC`.

Deny or degraded behavior: a missing support plan, inaccessible credential, invalid signature, wrong account, IAM denial, throttled endpoint, or malformed response is shown as unavailable. The app does not silently replace a selected AWS account with a public source, modify AWS, or represent an account event as proof of local impact or credit eligibility.

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

## Review or override a provider-service scope mapping

Actor: signed-in user with `app-settings:objects:write` for the app's `provider-scope-assignments` schema.

1. The user opens Coverage. The default queue contains only provider evidence that is ambiguous or does not resolve to one provider service. Unrelated services remain searchable under All loaded.
2. Smartscape-backed rows show one representative host, cluster, or provider-native runtime anchor per service. Process and container relationships are not expanded into primary Coverage rows.
3. A fixed provider-specific table may resolve one provider-native runtime type to one provider service. That observed match is used without writing one App Settings object per service.
4. Hostname-only patterns, conflicting provider services, and provider boundaries without a service match remain for review. The user can confirm or change the exact provider service.
5. App Settings stores an operator override with exact service and runtime IDs, display context, provider-service ID, and a concise evidence note.
6. Incidents and Evidence use exact tenant terms first, then an operator override, then a unique observed topology match. The operator still determines whether the provider caused the incident or owes a credit.

Deny or degraded behavior: a missing Smartscape relationship is not replaced with a name-based guess. A lower-confidence or ambiguous candidate is not presented as observed. A read-only user can inspect automatic matches and candidates but cannot create, update, or remove an override. If aggregate counts fail or exceed the loaded rows, Coverage reports incomplete inventory rather than a complete boundary.

## Add or edit a custom SLA

Actor: signed-in user with `app-settings:objects:write` for the app's `contract-overrides` schema.

1. The user opens Settings, then Custom terms. New records use the full settings page; the dialog is reserved for quick edits to an existing record.
2. The user selects a provider service and an evidence boundary: provider-wide fallback, selected Dynatrace services, selected hosts or runtimes, or observed locations.
3. Service targets come from the entity inventory. Runtime and location targets come from the current Smartscape topology. The user may assign one terms record to multiple exact targets.
4. The app stores the target IDs and display names separately. IDs establish the match; names do not.
5. The user enters only operational values, effective dates, and a concise contract or amendment reference. The UI warns that all authenticated app users can read the setting and that private contract text or credentials must not be entered.
6. The app validates the effective dates, numeric ranges, evidence targets, and duplicate scope before writing the record through App Settings V2.
7. Existing records can be disabled, edited, or removed. Removing a record restores the next matching tenant override or the public directory baseline.

Deny or degraded behavior: without App Settings write permission, the page is read-only. Without service or Smartscape read access, unavailable target types are not fabricated; a provider-wide fallback can still be defined. Saving no record leaves the public directory record unchanged.

## Match a Problem to effective terms

Actor: signed-in Dynatrace user.

1. Incidents reads the Problem's exact affected entity IDs.
2. It issues a sanitized, bounded Smartscape query for the Problem's affected service IDs so incident review is not limited to the global Coverage sample.
3. Active tenant overrides are evaluated by provider service, effective date, and exact target ID. Precedence is host, location, service, provider-wide fallback, then the public `sla.directory` record.
4. If one most-specific tenant contract scope matches, Incident review selects it. Otherwise it checks saved Coverage overrides. If there is no saved mapping, one unique provider-native Smartscape service match is selected as observed. A hostname-only unique candidate may be preselected but remains visibly unconfirmed.
5. If equally specific records or multiple provider-service candidates remain, the operator chooses the applicable boundary.
6. The UI shows the mapping source, applied terms source, and filing reference, but does not assert root cause, provider fault, credit eligibility, or claim approval.

Deny or degraded behavior: missing topology, scope settings, terms settings, or Problem access is surfaced as unavailable or incomplete. Invalid affected entity IDs are removed before query construction, and service IDs plus returned relationships are capped. The app never substitutes a name-based guess or treats a lower-confidence Smartscape candidate as observed.

## Review an evidence candidate

Actor: signed-in user with `app-settings:objects:read`; saving a decision also requires `app-settings:objects:write` for `evidence-decisions`.

1. Evidence compares each returned Problem with exact saved scope mappings, explicit provider tags, observed provider-native topology, and lower-confidence Smartscape suggestions for the active provider.
2. A Problem enters the candidate queue only when at least one exact affected service overlaps one of those boundaries. Saved mappings take precedence over provider tags, which take precedence over topology.
3. The detail view gives one direct explanation of why the candidate appears, identifies the mapping basis, and links to the incident, Coverage, and current terms. Provider reports stay separate and do not establish local impact.
4. The SRE reviews those records. Provider-native topology is labeled observed, while hostname-only or conflicting topology remains visibly unconfirmed.
5. Validation requires an explicit acknowledgement that the service scope and current terms were reviewed. Dismissal requires a concise operational reason.
6. App Settings stores one bounded Problem snapshot, exact affected entity IDs, provider services, mapping basis, decision, review time, and concise note.
7. A saved decision remains current only while the mapping basis, affected entities, and provider-service scope still match. A changed boundary returns the candidate to Needs review.

Deny or degraded behavior: a failed Problem, topology, directory, or decision-store read is shown as incomplete rather than empty. A read-only user can inspect candidates and saved decisions but cannot validate or dismiss. A decision does not establish provider fault, SLA eligibility, credit approval, or claim submission.

## Confirm service coverage without runtime context

Actor: signed-in user with `app-settings:objects:write` for the app's `provider-scope-assignments` schema.

1. The user opens Coverage, switches to All loaded, and selects a service without provider evidence.
2. The row identifies service inventory or a matching source tag as the available evidence. Existing provider tags are displayed only as source evidence.
3. The user selects one exact service and chooses provider-level terms or one provider service. Service names are context only and never create an automatic assignment.
4. A confirmation screen names the service, provider, and terms boundary. Saving writes an app-owned assignment to App Settings and does not modify Dynatrace entity metadata.
5. The saved mapping is reused by Incidents and Evidence. The operator can update its provider-service selection or remove it to restore the no-provider-evidence state.

Deny or degraded behavior: no selection or confirmation means no write. Services with usable active-provider Smartscape relationships use their runtime-backed row instead of being duplicated. Services with no provider evidence are not treated as default review work. A read-only user can inspect current coverage but cannot save, update, or remove it. Existing source tags are never changed.

## Review the change log or get support

Actor: signed-in Dynatrace user.

1. The user opens the change log from the application header or settings rail.
2. The app renders the bundled version history as read-only release information.
3. Before public launch, each Dynatrace Community destination is visible as a disabled `Coming soon` item and exposes no external link. After the launch gate is enabled, those surfaces open the configured Community profile for support or issue discussion.

Deny behavior: these surfaces do not write app state, Dynatrace entities, telemetry, or external tickets. A disabled Community destination is not keyboard-focusable and cannot open a browser tab.

## Replay onboarding or change appearance

Actor: signed-in user with user app-state access.

1. The user selects a theme, restarts onboarding, or replays the walkthrough.
2. The preference is stored in user app state with an expiry just inside the platform's 90-day limit.
3. A failure falls back to local state without changing workspace configuration.

## External dependency failure

If `sla.directory` times out, returns a non-success status, or fails schema validation, the AppEngine function throws. The workspace keeps the provider posture unknown and surfaces the error. It does not reuse an unverified response or infer provider responsibility from tenant symptoms.

If personalized Google Cloud access fails during a normal provider-report read, the provider-notice function may return the public status feed with `connectionState: fallback`. The UI identifies the source and states that it is not project evidence. During Test connection, personalized access is required and the exact connection boundary is reported as unavailable instead of falling back.

If a selected AWS account or Azure subscription source fails, the corresponding function reports the failure and does not silently substitute a public source. The operator retains Dynatrace Problems, published terms, and scope mappings while the provider-owned source is unavailable.

If a selected OCI tenancy source fails, the function reports the failure and does not silently substitute public status. The operator can deliberately select the public regional source, which remains labeled non-customer-specific.

If a supported public provider endpoint fails, times out, or returns an invalid payload, the public-status function throws and the UI reports the source as unavailable. It never converts that failure into an empty or healthy status.

# Load-bearing flows

These flows cover permission boundaries, external calls, data integrity, or operational handoff. Presentational-only interactions are intentionally omitted.

## Load the watch

Actor: signed-in Dynatrace user.

Precondition: AppEngine can run the app, and the user has the declared read scopes plus app run access.

Sequence:

1. `App` restores personal and workspace state. If app-state reads fail, it uses local browser state and displays the degraded storage message.
2. `Dashboard` issues DQL reads for services, Problems, logs, spans, service-request telemetry, and Smartscape service-to-runtime relationships.
3. `Dashboard` calls the `slaDirectory` AppEngine function with the configured vendor slug.
4. The function validates the slug, calls the allowlisted public API, applies an eight-second timeout, validates the response, and returns normalized provider and service records.
5. The app reads active tenant SLA overrides from App Settings and preserves the public directory record as the fallback baseline.
6. The UI classifies the first unresolved evidence boundary as loading, access-incomplete, telemetry-missing, service-inventory-incomplete, provider-unidentified, provider-mismatched, no-incident-in-scope, or candidate-for-human-review.
7. Overview presents that state with one next action. Setup contains the supporting diagnostics and provider-tag workflow. Incidents contains the observed Problem queue and effective filing references.
8. Loading or refreshing the monitor does not change a Dynatrace entity, tag, metric, Problem, SLO, custom SLA, or external ticket.

Deny or degraded behavior: a missing read scope is shown as access incomplete, not as no telemetry. A failed directory request is shown as unavailable, not as a provider breach.

## Configure the monitor

Actor: user with `state:app-states:write`.

1. The user edits provider slug, tag key, or lookback in Settings.
2. Input is normalized before persistence. The provider slug is restricted to lowercase slug characters.
3. The context optimistically updates the UI and writes the workspace state with an expiry just inside the platform's 90-day limit.
4. If the shared write is denied, the same normalized value is kept in local storage and a status message explains the fallback.

Deny behavior: saving monitor defaults never writes to Dynatrace entity settings or telemetry. A user without app-state write access can still inspect the app but cannot create a shared configuration.

## Add or edit a custom SLA

Actor: signed-in user with `app-settings:objects:write` for the app's `contract-overrides` schema.

1. The user opens Settings, then SLA overrides. New records use the full settings page; the dialog is reserved for quick edits to an existing record.
2. The user selects a provider service and an evidence boundary: provider-wide fallback, selected Dynatrace services, selected hosts or runtimes, or observed locations.
3. Service targets come from the entity inventory. Runtime and location targets come from the current Smartscape topology. The user may assign one SLA record to multiple exact targets.
4. The app stores the target IDs and display names separately. IDs establish the match; names do not.
5. The user enters only operational values, effective dates, and a concise contract or amendment reference. The UI warns that all authenticated app users can read the setting and that private contract text or credentials must not be entered.
6. The app validates the effective dates, numeric ranges, evidence targets, and duplicate scope before writing the record through App Settings V2.
7. Existing records can be disabled, edited, or removed. Removing a record restores the next matching tenant override or the public directory baseline.

Deny or degraded behavior: without App Settings write permission, the page is read-only. Without service or Smartscape read access, unavailable target types are not fabricated; a provider-wide fallback can still be defined. Saving no record leaves the public directory record unchanged.

## Match a Problem to effective SLA terms

Actor: signed-in Dynatrace user.

1. Incidents reads the Problem's exact affected entity IDs.
2. It adds Smartscape runtime and location context only for relationships connected to those affected services.
3. Active tenant overrides are evaluated by provider service, effective date, and exact target ID. Precedence is host, location, service, provider-wide fallback, then the public `sla.directory` record.
4. If one most-specific assignment matches, Incident review selects it. If multiple equally specific assignments match, the operator chooses the applicable boundary.
5. The UI shows the applied source and filing reference, but does not assert root cause, provider fault, credit eligibility, or claim approval.

Deny or degraded behavior: missing topology, settings, or Problem access is surfaced as unavailable or incomplete. The app never substitutes a name-based guess.

## Apply a provider tag

Actor: signed-in user with `environment-api:entities:write` in the app and the Dynatrace permission to manage entity settings.

1. Setup resolves the user's effective entity-write permission and displays whether the action is available, management-zone limited, denied, or unverifiable.
2. The user opens the service review. The app shows every returned service as already mapped, conflicting, or unassigned. Conflicting services cannot be selected in bulk.
3. The user explicitly selects exact unassigned service entities. Service names are context only and never create an automatic assignment.
4. A confirmation screen names the tag, selected service count, and common Dynatrace features that may consume tags.
5. On confirmation, the app calls the custom-tag API with an entity selector built only from the selected entity IDs. Existing tags remain in place.
6. The app reports the matched entity count, refreshes inventory, and retains the exact last action for an optional undo. Undo removes only that key/value pair from those exact entity IDs.

Deny or degraded behavior: no selection or confirmation means no write. Denied permission keeps the action read-only. Management-zone restrictions can yield a partial result, which is reported rather than represented as complete. A conflicting provider tag requires manual review. Undo is a compensating action and cannot reverse unrelated concurrent changes.

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

If `sla.directory` times out, returns a non-success status, or fails schema validation, the AppEngine function throws. The dashboard keeps the provider posture unknown and surfaces the error. It does not reuse an unverified response or infer provider responsibility from tenant symptoms.

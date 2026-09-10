# Load-bearing flows

These flows cover permission boundaries, external calls, data integrity, or operational handoff. Presentational-only interactions are intentionally omitted.

## Load the watch

Actor: signed-in Dynatrace user.

Precondition: AppEngine can run the app, and the user has the declared read scopes plus app run access.

Sequence:

1. `App` restores personal and workspace state. If app-state reads fail, it uses local browser state and displays the degraded storage message.
2. `Dashboard` issues DQL reads for services, Problems, logs, spans, and service-request telemetry.
3. `Dashboard` calls the `slaDirectory` AppEngine function with the configured vendor slug.
4. The function validates the slug, calls the allowlisted public API, applies an eight-second timeout, validates the response, and returns normalized provider and service records.
5. The UI classifies the first unresolved evidence boundary as loading, access-incomplete, telemetry-missing, service-inventory-incomplete, provider-unidentified, provider-mismatched, no-incident-in-scope, or candidate-for-human-review.
6. Overview presents that state with one next action. Setup contains the supporting diagnostics and provider-tag workflow. Incidents contains the observed Problem queue and provider filing references.
7. Loading or refreshing the watch does not change a Dynatrace entity, tag, metric, Problem, SLO, or external ticket.

Deny or degraded behavior: a missing read scope is shown as access incomplete, not as no telemetry. A failed directory request is shown as unavailable, not as a provider breach.

## Configure a watch

Actor: user with `state:app-states:write`.

1. The user edits provider slug, tag key, or lookback in Settings.
2. Input is normalized before persistence. The provider slug is restricted to lowercase slug characters.
3. The context optimistically updates the UI and writes the workspace state with an expiry just inside the platform's 90-day limit.
4. If the shared write is denied, the same normalized value is kept in local storage and a status message explains the fallback.

Deny behavior: saving watch defaults never writes to Dynatrace entity settings or telemetry. A user without app-state write access can still inspect the app but cannot create a shared configuration.

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

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
5. The UI classifies evidence as loading, access-incomplete, telemetry-missing, service-inventory-incomplete, provider-unidentified, provider-mismatched, or candidate-for-human-review.
6. The UI renders conservative setup recommendations. No Dynatrace entity, tag, metric, Problem, SLO, or external ticket is changed.

Deny or degraded behavior: a missing read scope is shown as access incomplete, not as no telemetry. A failed directory request is shown as unavailable, not as a provider breach.

## Configure a watch

Actor: user with `state:app-states:write`.

1. The user edits provider slug, label key, or lookback in Settings.
2. Input is normalized before persistence. The provider slug is restricted to lowercase slug characters.
3. The context optimistically updates the UI and writes the workspace state with a 90-day expiry.
4. If the shared write is denied, the same normalized value is kept in local storage and a status message explains the fallback.

Deny behavior: the app never writes to Dynatrace entity settings or telemetry. A user without app-state write access can still inspect the app but cannot create a shared configuration.

## Review the change log or get support

Actor: signed-in Dynatrace user.

1. The user opens the change log from the application header or settings rail.
2. The app renders the bundled version history as read-only release information.
3. The user opens the Dynatrace Community profile from the application header, help guide, change log, or dashboard support action when support or issue discussion is needed.

Deny behavior: these surfaces do not write app state, Dynatrace entities, telemetry, or external tickets. The community profile opens outside the app and follows the user's existing Dynatrace Community access.

## Replay onboarding or change appearance

Actor: signed-in user with user app-state access.

1. The user selects a theme, restarts onboarding, or replays the walkthrough.
2. The preference is stored in user app state with a 90-day expiry.
3. A failure falls back to local state without changing workspace configuration.

## External dependency failure

If `sla.directory` times out, returns a non-success status, or fails schema validation, the AppEngine function throws. The dashboard keeps the provider posture unknown and surfaces the error. It does not reuse an unverified response or infer provider responsibility from tenant symptoms.

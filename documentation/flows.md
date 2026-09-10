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

## Record a bug or change

Actor: user with shared app-state write access.

1. The user enters a bounded title and description, or a change scope and rollback plan.
2. The app captures the selected provider and lookback as evidence context for bug reports.
3. The record is prepended to the corresponding shared state collection and capped at 100 records.
4. The app displays the record in the workspace workflow list.

Deny behavior: no external ticket is created. When shared state is unavailable, the browser fallback is used and the app explicitly states that the record is local to that browser.

## Replay onboarding or change appearance

Actor: signed-in user with user app-state access.

1. The user selects a theme, restarts onboarding, or replays the walkthrough.
2. The preference is stored in user app state with a 90-day expiry.
3. A failure falls back to local state without changing workspace configuration.

## External dependency failure

If `sla.directory` times out, returns a non-success status, or fails schema validation, the AppEngine function throws. The dashboard keeps the provider posture unknown and surfaces the error. It does not reuse an unverified response or infer provider responsibility from tenant symptoms.

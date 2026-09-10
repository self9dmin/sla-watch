# Permissions

Dynatrace evaluates an app call using both the scope declared in `app.config.json` and the current user's IAM grants. The app must not assume that a declared scope is granted to every user.

## App-declared scopes

| Scope | Operation | Deny behavior |
| --- | --- | --- |
| `storage:entities:read` | Read `dt.entity.service` inventory | Show entity access as incomplete; do not claim that no services exist |
| `storage:events:read` | Read Davis Problems | Show the Problem check as unavailable; do not claim there are no Problems |
| `storage:metrics:read` | Read service request time series | Show metrics as unavailable; do not claim that traffic is absent |
| `storage:logs:read` | Count recent log records | Show log count as unavailable |
| `storage:spans:read` | Count recent spans | Show span count as unavailable |
| `state:user-app-states:read` | Restore theme, onboarding, and walkthrough state | Use browser fallback |
| `state:user-app-states:write` | Persist personal display and onboarding state | Keep the change in local browser state and show the fallback |
| `state:app-states:read` | Restore shared provider and watch configuration | Use local browser state and show the fallback |
| `state:app-states:write` | Persist shared provider and watch configuration | Keep the change local and show the fallback |

## Resource and operation matrix

| Resource | Read | Write | User-visible effect |
| --- | --- | --- | --- |
| Dynatrace service entities | Current-user scope | None | Inventory may be incomplete if denied |
| Problems, logs, spans, metrics | Current-user scope | None | Evidence posture becomes unknown when a read fails |
| `sla.directory` contract | AppEngine external request allowlist | None | Provider contract becomes unavailable when the function cannot run |
| User app state | User state read | User state write | Personal preferences remain local when denied |
| Shared app state | App state read | App state write | Workspace configuration remains local when denied |
| Dynatrace entity labels | Not accessed by this app | Not written by this app | The app recommends a labeling action but never applies it |
| SLOs, tickets, credits | Not accessed | Not written | No automated eligibility or remediation is performed |

## Deployment permissions

The identity used to install or deploy the app is separate from the app's runtime scopes. A local or CI deployment requires `app-engine:apps:install` and `app-engine:apps:run`; uninstalling requires `app-engine:apps:delete`. CI credentials are not stored in this repository.

## Authorization gaps to close before Hub submission

- Verify the target tenant's IAM policies for every declared scope with a least-privilege test user.
- Verify a user missing each scope receives the documented conservative state.
- Verify that shared watch configuration is not presented as globally saved when the write was denied.
- Verify the Hub listing's Technical information page matches this table.

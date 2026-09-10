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
| `storage:smartscape:read` | Read service-to-runtime and location relationships used for evidence-boundary selection | Hide unavailable topology choices; never infer them from entity names |
| `environment-api:entities:write` | Add or remove the configured provider tag on explicitly selected service entities | Keep Setup read-only and explain that entity-settings permission is required |
| `environment-api:credentials:read` | Read the administrator-selected AppEngine Token credential inside the provider AppEngine function | Keep customer-scoped provider notices unavailable; a supported public status source can remain available |
| `app-settings:objects:read` | Read shared tenant SLA overrides, provider connections, and confirmed provider-service scope mappings | Use public sources where possible and identify shared tenant configuration as unavailable |
| `app-settings:objects:write` | Create, update, disable, or remove explicitly confirmed tenant SLA settings and scope mappings | Keep the corresponding Settings and Setup actions read-only |
| `state:user-app-states:read` | Restore theme, onboarding, and walkthrough state | Use browser fallback |
| `state:user-app-states:write` | Persist personal display and onboarding state | Keep the change in local browser state and show the fallback |
| `state:app-states:read` | Restore shared provider and watch configuration | Use local browser state and show the fallback |
| `state:app-states:write` | Persist shared provider and watch configuration | Keep the change local and show the fallback |

## Resource and operation matrix

| Resource | Read | Write | User-visible effect |
| --- | --- | --- | --- |
| Dynatrace service entities | Current-user scope | Custom provider tag on exact confirmed IDs | Inventory may be incomplete if denied; tag action is unavailable without entity-settings permission |
| Problems, logs, spans, metrics | Current-user scope | None | Evidence posture becomes unknown when a read fails |
| Smartscape relationships | Current-user scope | None | Host, runtime, and location assignments are unavailable when denied; names are not substituted |
| `sla.directory` contract | AppEngine external request allowlist | None | Provider contract becomes unavailable when the function cannot run |
| AWS Health account events | Current-user plus app access to a selected Credential Vault record, AWS Health API plan access, `health:DescribeEvents`, `health:DescribeEventDetails`, and the fixed STS and Health hosts | None | Verify the credential account with STS and show any account, support-plan, signing, or IAM failure explicitly |
| Azure Service Health subscription events | Current-user plus app access to a selected Credential Vault record, `Microsoft.ResourceHealth/events/read` on the selected subscription, and the fixed Entra and Resource Manager hosts | None | Show the selected subscription source or its failure explicitly; never treat an event as proof of local impact |
| Google Cloud provider notices | Public status, or current-user plus app access to a selected Credential Vault record and Google `roles/servicehealth.viewer` | None | Show public, project-specific, or fallback source explicitly; never claim project impact from public status |
| OCI tenancy announcements | Current-user plus app access to a selected Credential Vault record, OCI `ANNOUNCEMENT_LIST`, and the exact regional outbound host | None | Show the selected tenancy source or its failure explicitly; never treat an announcement as proof of local impact |
| OCI, OpenAI, Anthropic, and ElevenLabs public status | AppEngine external request allowlist | None | Label records public and non-customer-specific; a source failure is unavailable, not healthy |
| Provider connection metadata | Authenticated app users with App Settings read access | Users with App Settings write access for `provider-connections` | Provider secrets remain in Credential Vault; settings contain only provider, scope, region, and credential IDs |
| Confirmed provider-service mappings | Authenticated app users with App Settings read access | Users with App Settings write access for `provider-scope-assignments` | Exact Smartscape service/runtime IDs are retained; candidates stay unconfirmed until saved in Setup |
| Credential Vault | Selected AppEngine credential only | None | The app cannot create, edit, list, rotate, or delete provider credentials |
| Tenant SLA overrides | All authenticated users of the app with App Settings read access | Users with App Settings write access for `contract-overrides` | Public terms remain unchanged; unavailable or denied settings fall back conservatively to the public record |
| User app state | User state read | User state write | Personal preferences remain local when denied |
| Shared app state | App state read | App state write | Workspace configuration remains local when denied |
| Dynatrace entity tags | Read through the service inventory | Add or remove one configured key/value through the custom-tag API | Existing tags remain; conflicts require review; a partial management-zone result is reported |
| SLOs, tickets, credits | Not accessed | Not written | No automated eligibility or remediation is performed |

## Deployment permissions

The identity used to install or deploy the app is separate from the app's runtime scopes. A local or CI deployment requires `app-engine:apps:install` and `app-engine:apps:run`; uninstalling requires `app-engine:apps:delete`. CI credentials are not stored in this repository.

The provider-tag operation also requires the signed-in user to have Dynatrace entity-settings management permission (`environment:roles:manage-settings`). Declaring `environment-api:entities:write` in the app manifest does not grant that user permission.

## Authorization gaps to close before Hub submission

- Verify the target tenant's IAM policies for every declared scope with a least-privilege test user.
- Verify a user missing each scope receives the documented conservative state.
- Verify granted, denied, management-zone-limited, partial-match, and undo outcomes for the provider-tag workflow.
- Verify App Settings read/write separation with a read-only user and confirm that tenant SLA records and provider-service mappings remain visible but immutable.
- Verify multiple Provider connections with least-privilege AWS identities, Azure service principals, Google service accounts, and OCI API users. Cover inaccessible credentials, wrong account or subscription scope, invalid IAM grants, duplicate validation, unavailable external hosts, deliberate public-source selection, and Google public fallback.
- Verify every fixed public provider endpoint with success, empty, malformed, timeout, and non-success responses.
- Confirm the Hub Technical information discloses the Credential Vault read scope and the administrator-owned lifecycle for provider credentials.
- Verify missing Smartscape permission removes runtime and location choices without producing a name-based assignment, and that Incident review does not present a missing mapping as confirmed.
- Confirm the Hub Technical information and installation copy clearly disclose the entity-write scope before distribution.
- Verify that shared watch configuration is not presented as globally saved when the write was denied.
- Verify the Hub listing's Technical information page matches this table.

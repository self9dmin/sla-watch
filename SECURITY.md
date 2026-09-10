# Security policy

SLA Watch is a Dynatrace AppEngine app. It runs in the Dynatrace platform and requests only the scopes listed in `app.config.json`.

## Reporting a vulnerability

Do not open a public issue for a suspected credential exposure, authorization bypass, cross-tenant data exposure, or malicious dependency. Contact the repository maintainer through the private channel used to manage the repository and include a minimal reproduction, affected version, and evidence. Remove or redact tenant identifiers and personal data from the report.

## Security commitments

- No credentials or tokens are bundled in the app.
- External provider data is fetched server-side through an allowlisted host.
- App input and external responses are validated before use.
- Runtime access is constrained by declared scopes and the current user's IAM grants.
- The entity-write scope is used only after explicit service selection and confirmation. The request targets exact service IDs, preserves existing tags, and exposes a last-action undo.
- Tenant SLA overrides are written only after explicit confirmation and are matched through exact Dynatrace entity IDs. Smartscape and entity names are never treated as proof of provider fault.
- All authenticated app users can read App Settings. Custom SLA records and confirmed provider-service mappings must contain operational values and concise evidence references only, never private contract text, credentials, or personal data.
- Shared monitor configuration expires after 90 days. Tenant SLA overrides, provider connection metadata, and confirmed scope mappings persist in versioned App Settings until changed or removed. The application does not persist bug reports or operational change records.
- Production dependency vulnerabilities are release blockers. Development-tool advisories are tracked separately when the current supported App Toolkit release is the affected dependency.

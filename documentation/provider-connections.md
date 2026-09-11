# Provider incident connections

Provider connections are optional, read-only sources of provider-reported service health. They supplement public `sla.directory` terms and Dynatrace evidence. They do not replace either source, prove that a Dynatrace service was affected, establish provider fault, or determine SLA credit eligibility.

An installed copy of SLA Watch can keep multiple AWS accounts, Azure subscriptions, Google Cloud projects, and OCI tenancies at the same time. Every connection belongs to the Dynatrace environment where it was created.

## What works without a provider connection

- Public SLA terms load automatically from `sla.directory`. The user does not supply an API key or configure the `sla.directory` MCP server.
- Monitor, Setup, Smartscape scope mapping, Directory, Incidents, custom SLA overrides, and Dynatrace telemetry review remain available.
- Google Cloud and OCI can use clearly labeled public status sources. Those feeds are not project- or tenancy-specific.
- AWS and Azure remain available for contracts and Dynatrace evidence, but account-specific provider notices require a configured connection.

## Administrator prerequisites

Before adding a connection, confirm all of the following:

1. The administrator can write the SLA Watch `provider-connections` App Settings schema.
2. The provider identity has only the read permissions listed below.
3. The provider secret is stored as a Token in Dynatrace Credential Vault with AppEngine scope.
4. Credential access is limited to SLA Watch and the users who must test or use it. Both the app and the current user need access.
5. Every exact provider hostname is allowed under Dynatrace **Settings > General > External requests**. Do not disable allowlist enforcement.

See the Dynatrace guidance for [Credential Vault](https://docs.dynatrace.com/docs/manage/credential-vault) and [external request allowlisting](https://developer.dynatrace.com/develop/guides/app-functions/allow-outbound-connections/).

## Supported provider scopes

| Provider source | One connection represents | Provider prerequisite | Credential Vault Token value | Required outbound hosts | Behavior without a connection |
| --- | --- | --- | --- | --- | --- |
| AWS Health | One 12-digit AWS account | An eligible AWS Health API support plan and `health:DescribeEvents`, `health:DescribeEventDetails` | JSON containing `accessKeyId`, `secretAccessKey`, and optional `sessionToken` | `sts.us-east-1.amazonaws.com`, `health.us-east-1.amazonaws.com` | No AWS provider notices; contracts and Dynatrace evidence remain available |
| Azure Service Health | One Azure subscription | A dedicated Microsoft Entra service principal with `Microsoft.ResourceHealth/events/read` on that subscription | JSON containing `tenantId`, `clientId`, and `clientSecret` | `login.microsoftonline.com`, `management.azure.com` | No Azure provider notices; contracts and Dynatrace evidence remain available |
| Google Cloud Personalized Service Health | One Google Cloud project | Enable `servicehealth.googleapis.com`; grant `roles/servicehealth.viewer` and `roles/serviceusage.serviceUsageConsumer` | The service account JSON key | `oauth2.googleapis.com`, `servicehealth.googleapis.com` | Public Google Cloud status remains available and is labeled non-project-specific |
| OCI Announcements | One commercial OCI tenancy and region | A dedicated API user in a group granted `Allow group AnnouncementListers to inspect announcements in tenancy` | JSON containing `userOcid`, `fingerprint`, and unencrypted RSA `privateKey` | Exact `announcements.<region>.oraclecloud.com` hostname | Public OCI regional status remains available and is labeled non-tenancy-specific |

AWS currently requires Business Support+, Enterprise Support, or Unified Operations for AWS Health API access. AWS recommends temporary credentials where practical. If temporary credentials are used, the Credential Vault value must be refreshed before they expire. See the [AWS Health API reference](https://docs.aws.amazon.com/health/latest/APIReference/Welcome.html).

Azure Service Health is read through the subscription-scoped Resource Health events endpoint. See the [Azure events API](https://learn.microsoft.com/en-us/rest/api/resourcehealth/events/list-by-subscription-id?view=rest-resourcehealth-2025-05-01).

Google documents `roles/servicehealth.viewer` as the read-only Personalized Service Health role and also requires Service Usage Consumer when calling enabled services. New events can take time to appear after the API is enabled. See [Manage Personalized Service Health access](https://docs.cloud.google.com/service-health/docs/manage-access).

OCI Announcements are retained by Oracle for 90 days. The app reads summary announcements and does not mark them as read or create subscriptions. See [Viewing OCI Announcements](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/announcements_topic-To_view_a_list_of_all_announcements.htm) and [OCI announcement policies](https://docs.oracle.com/en-us/iaas/Content/Identity/policiescommon/commonpolicies.htm).

## Add and verify a connection

1. Complete the provider-side identity and read permission.
2. Add the required hostnames to Dynatrace External requests.
3. Create the provider-specific Token in Credential Vault. Restrict it to SLA Watch and the intended administrators.
4. Open **SLA Watch > Settings > Provider connections**.
5. Select AWS, Microsoft Azure, Google Cloud, or OCI.
6. Select **Add a new account**, **subscription**, **project**, or **tenancy**.
7. Enter an operator-facing name, the exact provider scope identifier, the OCI region when applicable, and the Credential Vault record ID. Never paste the secret into SLA Watch settings.
8. Select **Test connection**. The app validates the identifier, Credential Vault access, provider authentication, and provider scope. A failed test is not saved as a usable connection.
9. After the test reports **Connection verified**, select **Save connection**.
10. Open **Monitor > Provider notices** and select the saved source when more than one source exists.

Repeat the process for every required account scope. Adding a second account, subscription, project, or tenancy does not replace the first.

## Interpreting the result

- **Connection verified** means the current user and SLA Watch could read the selected provider scope at test time. It does not mean an incident exists.
- **No notices returned** is a valid result when the provider has no relevant event in the selected lookback window.
- **Public** or **fallback** means the result is not customer-specific. It must not be used as proof of local impact.
- Authentication, support-plan, IAM, scope, outbound-host, and malformed-response failures remain visible. SLA Watch does not silently turn a failed account-specific AWS, Azure, or OCI request into public evidence.

## Change or remove a connection

- Editing the provider scope, OCI region, or Credential Vault ID requires a new successful test before the update can be saved.
- Renaming a connection or disabling its use does not change the provider credential.
- Removing the SLA Watch connection deletes only its non-secret metadata. It does not delete the Credential Vault record or revoke the cloud identity.
- To retire access completely, remove the connection, revoke or delete the provider-side key or secret, and delete the Credential Vault record according to the tenant's credential lifecycle.

## Current acceptance boundary

The adapters have automated tests with synthetic credentials, are deployed, and their setup forms have been verified in the target environment. Live least-privilege acceptance with disposable AWS, Azure, Google Cloud, and OCI identities remains a release acceptance task. Do not describe a provider connection as operational until **Test connection** succeeds in the installing tenant.

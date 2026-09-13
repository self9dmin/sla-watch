# Dynatrace source and skill map

## Purpose

This project treats Dynatrace topology, telemetry, Problems, SDK behavior, and native application contracts as external systems that must be discovered and verified. This record prevents a provider-specific assumption or a legacy entity model from silently becoming product logic.

## Authority order

1. Installed SDK and Strato package declarations for the versions in `package-lock.json`.
2. Current official [Dynatrace documentation](https://docs.dynatrace.com/) and [Dynatrace Developer](https://developer.dynatrace.com/) documentation.
3. Official [Dynatrace for AI](https://github.com/Dynatrace/dynatrace-for-ai) skills and their task-specific references.
4. Read-only target-environment discovery, including `describe`, `fieldsSnapshot`, `smartscapeNodes`, `smartscapeEdges`, app manifests, and effective permissions.
5. Repository tests and recorded production acceptance for this exact application version.

Examples and screenshots can suggest what to investigate. They do not define a stable field, relationship, SDK contract, or permission.

Primary platform references for this application are the [Smartscape semantic model](https://docs.dynatrace.com/docs/semantic-dictionary/model/smartscape), [DQL Smartscape commands](https://docs.dynatrace.com/docs/platform/grail/dynatrace-query-language/commands/smartscape-commands), [Davis semantic model](https://docs.dynatrace.com/docs/semantic-dictionary/model/davis), and [AppEngine navigation SDK](https://developer.dynatrace.com/develop/sdks/navigation/).

## Product model

Use this sequence throughout SLA Review:

```text
Provider topology present
  -> exact provider-resource context
  -> verified relationship to a Dynatrace service, if one exists
  -> Dynatrace-observed customer impact
  -> optional provider report
  -> human evidence decision
```

These stages are not interchangeable:

- Provider topology proves that Dynatrace observed provider infrastructure in the environment.
- A service link requires an exact Smartscape relationship, an exact source-owned tag, or an operator confirmation.
- A Dynatrace Problem and service telemetry establish customer-observed impact, not provider fault.
- A provider report is supporting evidence, not the arbiter of customer impact.
- Contract applicability, fault, eligibility, and credit approval remain human and provider decisions.

## Required skills for this app

| Product area | Load first | Then load when needed |
| --- | --- | --- |
| Any DQL | `dt-dql-essentials` | The task-specific DQL reference |
| Smartscape and classic migration | `dt-migration` | `smartscape-topology-navigation.md`, entity guide, relationship mappings |
| Provider inventory | `dt-obs-aws`, `dt-obs-azure`, or `dt-obs-gcp` | Provider resource, workload, ownership, and event references |
| Service performance and objectives | `dt-obs-services` | Service metrics and runtime reference |
| Host and process evidence | `dt-obs-hosts` | Inventory, host metrics, process, or container reference |
| Problem triage and evidence | `dt-obs-problems` | Impact, correlation, merging, and trending references |
| Trace evidence | `dt-obs-tracing` | Protocol or correlation reference |
| Alerts and workflows | `dt-alerting` | Detector, Davis event, or workflow reference |
| In-app dashboards and notebooks | `dt-app-dashboards`, `dt-app-notebooks` | Create/update and visualization references |
| AppEngine functions and SDKs | `dt-js-runtime` | Runtime limits, fetch, or exact SDK reference |
| Tenant operations | `dtctl` | Use only after the CLI and a least-privilege context are deliberately configured |

## Official catalog

The `Dynatrace/dynatrace-for-ai` `main` tree at commit `9ebe70d408ea59d2df4b371b745c6c2aa6229e5b` contained 33 skills when reviewed on 2026-09-13.

### DQL, platform, and migration

- `dt-dql-essentials`
- `dt-app-dashboards`
- `dt-app-notebooks`
- `dt-js-runtime`
- `dt-platform-costs`
- `dt-migration`

### Observability

- `dt-alerting`
- `dt-obs-analytics`
- `dt-obs-aws`
- `dt-obs-azure`
- `dt-obs-compliance-assistant`
- `dt-obs-ext-monitors`
- `dt-obs-frontends`
- `dt-obs-gcp`
- `dt-obs-genai`
- `dt-obs-hosts`
- `dt-obs-kubernetes`
- `dt-obs-log-semantic-mapping`
- `dt-obs-logs`
- `dt-obs-network-devices`
- `dt-obs-network-flows`
- `dt-obs-predictive-analytics`
- `dt-obs-problems`
- `dt-obs-services`
- `dt-obs-tracing`

### Security

- `dt-sec-contextualization`
- `dt-sec-insights`
- `dt-sec-ioc-hunting`
- `dt-sec-semantic-mapping`

### Mobile setup

- `dt-setup-android`
- `dt-setup-flutter`
- `dt-setup-ios`
- `dt-setup-react-native`

The official [dtctl repository](https://github.com/dynatrace-oss/dtctl) supplies a separate `dtctl` operational skill. Knowledge skills do not grant tenant access. The CLI, MCP connection, authentication, and permissions must be configured separately and with least privilege.

## Provider-specific topology rules

- Discover actual node and edge types in the target environment before encoding a join. Unknown types and edges can return an empty result without an error.
- AWS resources use `AWS_*` node types and commonly expose named structural edges.
- Azure resources use `AZURE_*` node types derived from ARM resource paths. Provider-resource traversals may require wildcard edge selection because relationship names can be empty.
- GCP resources use `GCP_*` node types derived from service APIs. Provider-resource traversals may also require wildcard edge selection.
- OCI is not covered by a dedicated skill in the reviewed official collection. Use current Dynatrace documentation, tenant discovery, and conservative generic Smartscape rules. Do not copy AWS behavior into OCI.
- A global `AWS_*`, `AZURE_*`, `GCP_*`, or OCI inventory query establishes provider presence only. It must not fan out that provider assignment to every service.

## Audit findings to resolve deliberately

1. `ui/app/data/queries.ts` still uses `fetch dt.entity.service` for two pure service-list queries. Current migration guidance favors `smartscapeNodes SERVICE`. Migrate only after live equivalence checks preserve service identity, names, tags, counts, filtering, and Problem correlation.
2. The shared service-runtime query currently restricts edges to `runs_on` and `belongs_to`. That is appropriate for verified named relationships but may not discover Azure or GCP provider-resource paths whose edge names are empty. Probe `smartscapeEdges "*"` by source and target type, then add provider-specific strategies with conservative matching and tests.
3. The Problem query already reads `smartscape.affected_entities` and root-cause fields. Evaluate adding native `dt.smartscape.service`, `dt.smartscape_source.id`, `dt.davis.affected_users_count`, and `dt.davis.impact_level` so Evidence can prioritize native impact without inventing another correlation system.
4. Cross-app navigation must distinguish manifest page tokens from URL routes. The 0.0.65 Smartscape handoff is isolated and production-verified because the installed Smartscape manifest exposed no page tokens.

These findings are not permission to broaden attribution. Each change still requires a target-environment probe, focused tests, release-gate completion, and a read-only production smoke.

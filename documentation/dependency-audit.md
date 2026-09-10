# Dependency audit note

This note records the dependency posture for the `0.0.36` release candidate, verified with Node.js 24.19.0. It is intentionally explicit so a public-repository reviewer can distinguish production risk from upstream development-tooling findings.

## Checks

- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit`: **4 moderate findings** in development-only tooling.
- `npm run verify:release`: passes the production audit gate, typecheck, lint, unit coverage, build, and App Toolkit analysis.

## Current findings

`adm-zip` is reported through `dt-app`. The advisory is [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9), which concerns extraction following destination symlinks. The package is used by the development and deployment toolchain, not by the shipped runtime dependency graph.

`fastify` is reported through the local-development `@dynatrace-sdk/dt-app-plugin-client-app-settings-v2` package. The reported advisories are [GHSA-w2qp-rph6-63g4](https://github.com/advisories/GHSA-w2qp-rph6-63g4) and [GHSA-3m5p-2c4r-xxw2](https://github.com/advisories/GHSA-3m5p-2c4r-xxw2). This plugin serves mocked App Settings during local development and is not included in the deployed application runtime. The current dependency tree reports no available fix for that path.

The audit command proposes `npm audit fix --force`, which would replace `dt-app` with `dt-app@0.0.0` and introduce a breaking, unusable toolchain change. That is not an acceptable remediation.

## Disposition

The release gate remains the production-only audit because these findings are outside the deployed bundle. The repository keeps the current supported Dynatrace toolchain, avoids an unreviewed override, and tracks upstream fixes through dependency review and Renovate. Re-run the full audit whenever `dt-app` or the App Settings development plugin changes, and remove each exception when its upstream dependency is remediated.

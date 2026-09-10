# Dependency audit note

This note records the dependency posture for the `0.0.18` release candidate. It is intentionally explicit so a public-repository reviewer can distinguish production risk from an upstream development-tooling finding.

## Checks

- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm audit`: **2 moderate findings** in the development-only `dt-app` toolchain.
- `npm run verify:release`: passes the production audit gate, typecheck, lint, unit coverage, build, and App Toolkit analysis.

## Current finding

`adm-zip` is reported through `dt-app`. The advisory is [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9), which concerns extraction following destination symlinks. The package is used by the development and deployment toolchain, not by the shipped runtime dependency graph.

The audit command proposes `npm audit fix --force`, which would replace `dt-app` with `dt-app@0.0.0` and introduce a breaking, unusable toolchain change. That is not an acceptable remediation.

## Disposition

The release gate remains the production-only audit because the finding is outside the deployed bundle. The repository keeps the current supported `dt-app` version, avoids an unreviewed override, and tracks the upstream fix through dependency review and Renovate. Re-run the full audit whenever `dt-app` changes, and remove this exception when the upstream dependency is remediated.

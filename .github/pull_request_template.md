## Summary

<!-- What changed, and why? -->

## Evidence

- [ ] `npm run verify:release` passes on Node 24.
- [ ] The relevant unit, integration, or browser evidence is included.
- [ ] Degraded and denied behavior is covered.
- [ ] The relevant architecture, permissions, variables, tests, or acceptance documentation is updated.

## Dynatrace release checks

- [ ] No tenant credentials, tokens, auth state, customer data, or deployment artifacts are included.
- [ ] Any `app.config.json` change includes an app-version bump.
- [ ] External hosts remain allowlisted and server-side.
- [ ] Hub-facing claims match the implemented and verified capability.

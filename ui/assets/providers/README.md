# Provider marks

These SVG marks are copied from the public `https://sla.directory/logos/` paths by
`npm run assets:providers`. They are bundled with the app so the UI never loads
remote image content at runtime.

The import script only reads `sla.directory`. It validates file size and rejects
active content or remote references before writing assets in this repository.
Provider and product marks remain the property of their respective owners.

Having a bundled mark does not enable or detect a provider. The app displays a
mark only after Dynatrace evidence, a saved Coverage mapping, a source tag, or an
enabled connection puts that provider in the current environment.

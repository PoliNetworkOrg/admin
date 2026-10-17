# Vendored packages

`polinetwork-backend-*.tgz` is `@polinetwork/backend` built from PoliNetworkOrg/backend#73 (`feat/esign`), so the
dashboard type-checks against the `esign` router before that version is published. Once the backend release with the
e-signing router is on npm, replace the `file:vendor/…` dependency with that version and delete this folder (and the
`COPY vendor` line in the Dockerfile).

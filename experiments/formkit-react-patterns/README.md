# Isolated FormKit React-pattern experiment

Review branch only. No production package replacement, PR, merge or release is implied. Existing FormKit work continues separately.

Start with core/README.md and core/SCHEMA.md, then RUN.md. Inspect core/index.mjs and core/schema.mjs, shared harness/, and independent SCHEMA-REVIEW.md plus FORM-REVIEW.md. Earlier review reports preserve adverse findings and their scoped fixes.

The experiment uses Marionette Views/Regions with FormKit observer caches, microtask subscriptions, official form/text definitions and restricted conditional-schema projection. It is **not** a complete React binding port, full FormKit renderer or performance winner.

Shared JSDOM checks cover Vue, React, source-built compatible adapter303ddfbb and experiment, including200/400 fields. Browser timing is not established: cloud browser launch/access constraints remain. No benchmark ranking is claimed.

Source, tests, lockfile, review reports, source provenance and a generated first-party comparator bundle are included. No installed dependencies, caches, browser profiles or bundled third-party code. current-303ddfbb/index.mjs bundles only the first-party comparator source; third-party dependencies remain external. current-303ddfbb/ is a frozen source comparator, not the proposed replacement; its13 source blobs match the recorded provenance. MIT notices retained.

From this directory: npm ci --ignore-scripts --cache ./npm-cache, then the commands in RUN.md. Review actual supported behavior, lifecycle cleanup, subscription costs, missing upstream behavior and fixture fairness. Do not infer full parity from the passing narrow suite.

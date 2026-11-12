# Isolated FormKit React-pattern experiment

Review branch only. No production package replacement, PR, merge or release is implied. Existing FormKit work continues separately.

Start with core/README.md and core/SCHEMA.md, then RUN.md. Inspect core/index.mjs and core/schema.mjs, shared harness/, and independent SCHEMA-REVIEW.md plus FORM-REVIEW.md. Earlier review reports preserve adverse findings and their scoped fixes.

The experiment uses Marionette Views/Regions with FormKit observer caches, microtask subscriptions, official form, group and supported native-input definitions, scoped value/state conveniences and restricted conditional-schema projection. It is **not** a complete React binding port, full FormKit renderer or performance winner.

Shared JSDOM checks cover Vue, React, source-built compatible adapter303ddfbb and experiment, including200/400 fields. Separate browser studies are coordinated independently; this source checkpoint does not establish a benchmark ranking or full parity.

Source, tests, lockfile, reports, provenance and generated first-party comparator bundle are included. No installed dependencies, caches, browser profiles or bundled third-party code; comparator dependencies remain external. current-303ddfbb/ is a frozen source comparator, not the proposed replacement; its13 source blobs match the recorded provenance. MIT notices retained.

From this directory: npm ci --ignore-scripts --cache ./npm-cache, then the commands in RUN.md. Review actual supported behavior, lifecycle cleanup, subscription costs, missing upstream behavior and fixture fairness. Do not infer full parity from the passing narrow suite.

## Latest successor
Actual published React2.5 context/store bindings now replace the earlier stub; official text-definition section schema drives the renderer instead of hand-coded field markup. Extraction is reproducible with core/extract-bindings.mjs. Read SECTION-REVIEW.md and evidence/react-context-successor/COUNTERS.md. Renderer counters are not browser timing or whole-adapter scaling. The official root form schema, nested groups, limited scoped slots, native checkbox/select/textarea slices and scoped value/state facade are now implemented. Extra field hosts and unsupported feature limitations remain explicit in core/README.md.

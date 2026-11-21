# Parallel FormKit React-pattern experiment

Authorization: parallel isolated experiment, not adoption, publication, or replacement of current FormKit work. Main PR3831 and all existing source/review directories remain untouched.

## Frozen first slice

Published FormKit2.5.0 Vue/React references; React19.2.0, Vue3.5.44, Marionette5.0.0; exact installed integrity/version graph in package-lock.json. The experimental core adapts per-section observer class caching and a versioned microtask store. It is NOT a full port of React context/schema machinery. Initial group-root checkpoint is preserved. Current core uses actual upstream form/text definitions and submit feature with a narrow context plugin. Separate schema controller uses official compile/provide and observer tracking for flat text fields and restricted supplied-$values conditionals. No Pro, general schema expressions, slots, summary, registry or existing custom ownership parity is claimed. MIT notice is retained in core/LICENSE.formkit.

## Functional comparison

Each arm in a new Node/JSDOM process, identical named required text fields, English labels, empty values, delay0, live validation and section classes. Counts20/200/400. Check DOM/Core field count, required messages, classes, label/error ID associations, six input-event mutations, retained focused input, external Core input, reset, dynamic add/remove, destroy. All failures retained. JSDOM synthetic events are NOT real typing or layout/accessibility proof.

Current adapter fourth arm is source-built private303ddfbb: all13 source files independently match the previously verified head-map Git blob identities; isolated copy and provenance.json retained. This is not a packed-install test.20/200/400-field arms passed. Do not substitute historical timing for a new comparison. Accepted private303ddfbb and public588891f1 must remain labeled separate revisions.

## Timing gate (not run)

First require sandbox-enabled cloud browser preflight and exclusive host/serial benchmark coordination. Existing independent study previously failed before page execution with process_singleton socket EPERM; no no-sandbox or other security weakening allowed. Fresh supported preflight needed, not assumption of unchanged access.

Bundle each reference and candidate with same production pipeline. Use same Genesis CSS in browser. Freeze bundle hashes and versions, run semantic checks before scoring. Use200/400 themed fields, balanced seeded arm order,2 warmup and10 retained paired measurement blocks, fresh contexts, serial arms. Measure mount through semantic settled state and real six-key typing through same state; include validation, cross-field updates, dynamic fields, reset and teardown as distinct cases. No performance-only exclusions or sample cherry-picking. Retain failures and report sample counts/ranges and paired ratios; no claim of paint latency from DOM settlement.

A within2x Vue target is exploratory, not an established CI gate. A minimal hand-coded text renderer cannot be called faster-equivalent to full schema/feature bindings. Expand equivalent fixture coverage before choosing architecture.

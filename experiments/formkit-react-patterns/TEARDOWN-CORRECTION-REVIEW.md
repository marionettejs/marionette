# Independent corrected teardown and retained-placement review

Frozen index SHA256 `35ba15da356e3f077e3cccd189977096ca73986e74d8e357de0779de5837069e`; renderer `955c491c8405f2977cedc41ba19708cf7d7e77f19bab2f6bf3694bf438036dcd`.

## Correction

My earlier root-first scoped pass omitted pending ledger settlement and deep lifecycle behavior. It is withdrawn, not evidence that root-first was safe. Zero root commit observations after clearing the root emitter did not prove zero underlying work. This candidate restores ordinary child-first Core destruction and retains only subscription/renderer disposal without per-descendant DOM removal, followed by one root DOM clear.

## Independently verified corrected cleanup

- core/teardown-test.mjs:200/400 fields preserve200/400 observed parent commits;201/401 nodes destroyed/deregistered; blocking ledger zero and settled promise completes; one root DOM mutation record. Live removal commits normally.
- review/pending-validation-teardown.mjs: nested group with actual pending asynchronous rule starts root blocking1/validating1; after destroy both0 and both settled promises complete. Late rule resolution produces no further metrics. Three created/three destroyed.
- review/nested-teardown-childfirst.mjs: destroyed order x→inner→outer→form; all captured registry IDs removed, context subscriber sets cleared, detached input/blur events inactive, double destroy stable, no later slot renderer activity. Before-detach/detach/destroy remain Marionette-owned. Its inherited output label saying parent-first is stale; asserted order and recorded array are child-first.
- core/submit-completion-test.mjs passes synchronous/async completion-driven owner destruction, destruction while returned promise settles, and original sync/async errors.

## Position-aware placement

review/placement-check.mjs independently verifies an unchanged setFields on a retained three-field host produces0 root childList mutations and retains focused input plus selection. Reorder c,a,b produces the correct order with same Core values and same input DOM identities. JSDOM loses focus when the currently focused host moves; this remains a limitation, not a new regression. Running equivalent probe against checkpoints/pre-teardown-simplified shows unchanged update previously produced6 mutation records and lost focus; reorder also lost focus. Current reorder uses4 records in this fixture. These are fixture observations, not a minimum-move proof or browser timing.

## Verdict and limits

The corrected child-first/bulk-DOM cleanup and position-aware no-op placement are accepted within these tested workflows. No root-first optimization is accepted. No unsupported destructive-callback recovery was required. Tests do not prove exhaustive heap cleanup, all internal operation counts, browser focus behavior, or broad schema/component support. Source unchanged by reviewer; no push.

# Proposed next contracts

Server-baseline and error-policy items remain recommendations for review, not
implemented APIs or accepted feature exclusions. The nested item has since been
explicitly authorized; its bounded implementation is tracked in
[NESTED-ROWS.md](NESTED-ROWS.md). Existing actor/application ownership remains
authoritative.

- **Server baseline:** `resetForm(values?)` explicitly adopts a complete snapshot
  when values are supplied, restores it on later reset, clears interaction/server
  state and cancels pending effects. Ordinary `setValues` never silently rebases.
  Empty and keyed/nested snapshots need explicit tests. The package performs no
  server I/O or actor reset. The host decides when a save/reload is accepted as the
  new baseline. This remains an optional proposal, not a prerequisite for an
  application whose discard already destroys and reloads its form.
- **Nested custom rows:** reuse `parent`/`rowKey` with keys unique per owned list.
  Value order and errors follow the full ancestor-key chain; outer removal ends
  all inner resources, and reorder preserves matching controls. The separately
  authorized two-level implementation uses full ancestor-key addressing and
  requires owned RowView groups at every array boundary. No new form root or
  generic composition facade is added. The host supplies stable keys; broader
  depth and raw unowned arrays remain unverified. See NESTED-ROWS.md for checks.
- **Error clearing:** the official Vue binding clears imperative auto-clear
  errors on input-node commits unless `preserveErrors` is enabled; it does not
  automatically clear group/root errors. MN's changed-native-edit root clearing
  and clear-before-submit are adapter behavior, not universal FormKit defaults.
  Validation stays rule-owned;
  declarative `errors`/`inputErrors` replace or withdraw only their source. Specify
  retry/reset ownership in full tests. Existing external engine errors remain
  application-owned: preserve their stored state through edits, distinguish
  display suppression from clearing, and clear at the actual engine-submit
  transition. Do not silently replace that policy with `setErrors` messages.

The inspected application has actor-owned persistence/submission. Its existing
discard behavior is a fresh application lifetime, not an established live-reset
event. Private source reconciliation is recorded outside public artifacts; it
does not certify a running host transport or resolve its error-routing mismatches.
No new reset or automatic save policy is invented. Paid controls require an existing
authorized runnable Pro bootstrap/entrypoint, without further credential probes.

## File safeguard evaluation

The proposed adapter guard is **not accepted and does not ship**. A root-owned
block prevented two reproduced stale-byte submissions but failed four independent
normalizer/canonical-parent/legitimate-retry cases. Reliable generic support would
need more proposal-ordering and ownership/propagation state; expanding that layer
for this edge case would work against the small native adapter boundary.

The exact candidate remains on local branch
`experiment/mnjs-formkit-file-safeguard`, commit `7804108b`, with all failed probes
and an independent review. The delivered28-commit checkpoint and source ZIP remain
unchanged. Same-metadata replacement remains an explicit unsupported Core upload
path: a distinct File may retain the previous bytes. Normal uploads after an empty
selection and replacements with Core-distinguishable values remain bounded tested
paths; consumers cannot infer successful replacement from matching file names.

One separate wrapper correction forwards distinct opaque native value props to the
actual input pipeline. Its regression uses a genuine normalizer, verifies one
actual proposal, accepted value and stable control/focus; it does not bypass Core
or guarantee replacement of an unnormalized equal-metadata File. Strict File and
Vue terminal-lifetime failures remain retained, not hidden by coverage.

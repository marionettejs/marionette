# Independent official-section successor review

Frozen hashes:
- index `44a83038d320f803619a45c285d5cebc6bd4ed61a0ab26adc990dd0a526899a3`
- upstream-bindings `73ab5be840812f825598a39c967facfed82000f94407f0f3ca528d8d9b8561c9`
- section-renderer `794ad922879b93d8198f683667f3de761d9390b33337918630b3c545227cf025`

## Verdict

Substantive real-context/official-text-schema integration, but one concrete DOM binding precedence defect remains. No full parity/performance acceptance.

## Passing independent checks

- `node core/extract-bindings.mjs`: exact published-source extraction plus explicit recorded adaptations matches.
- Unchanged `review/upstream-bindings-probe.mjs`: later subscriber calls after owner destroy=0; class computations after destruction=0; post-destroy class read empty. Both prior terminal regressions repaired.
- `core/sections-test.mjs`: official wrapper/inner/input shape, notified mutable attrs bag, help text, blur visibility, describedBy, valid/complete state, retained control and real context-store teardown pass.
- Shared `harness/check.mjs experiment 20` passes.
- `core/submit-terminal-test.mjs`, `core/schema-test.mjs`, `core/regressions.mjs` pass.
- `review/section-messages.mjs`: create error First, replace same-key error with Second, remove error; displayed text updates and input is retained. Stored separate result.

## Must-fix: bind bag overrides explicit schema attributes on refresh

`review/section-precedence.mjs` mounts one labeled text field, changes `node.context.attrs.id='different'` and `.class='injected'`, then emits a supported notification by changing `node.props.help`. The bind effect reapplies the attrs bag. Explicit schema id/class effects skip because their token values have not changed. Result: input.id='different', label.for remains original generated id, input.class='injected' rather than official computed class. This breaks label association and can disconnect validation ID references.

Initial drawing applies bind before explicit attrs, which is correct; later updates must preserve that same precedence. Avoid independent effects competing over the same final attribute. A focused fix can exclude explicitly declared keys from bind application/removal, or compose final attribute values with explicit bindings consistently. Preserve removal behavior and handler identity; add a regression with add/change/delete of conflicting id/class/disabled/value keys. This is not a claim that arbitrary nested attrs input syntax is equivalent across public adapters: the failure is within the declared notified context-bag behavior and official section schema.

## Remaining limitations

Root form shell/incomplete list and per-field host remain adapter-owned; text section rendering is not complete form rendering. Icons/raw HTML, slots, arbitrary components, generalized loop keys and dynamic tags/section overrides remain unsupported. Conditional-attribute then/else expressions are not recursively evaluated in current renderer, but the known official text usage is in excluded icon branches; do not broaden the claim without implementing/tests.

Shallow token comparison passed the tested same-key message update, but does not prove every mutable object/function dependency. Context notifications scan registered field bindings; counters exclude Core/observer/aggregate snapshot work. No timing, browser layout, real keyboard, memory/listener leak count or speed conclusion was established by this review.

## Scoped correction recheck: d9582314

Renderer SHA256 `d9582314dac41a958959b03db115ca94058ef6f086357f7db70534f7c59bbfc2` collects explicit schema attribute names and excludes those keys from bind writes and tracked bind removals. Inspected the small change; previous boundKeys contains only bind-owned keys, so subsequent removal cannot erase schema-owned attributes.

Independently reran unchanged review/section-precedence.mjs: input id and class remain official values and label points to that input. Separate corrected output preserved in review/section-precedence-d9582314.json. Independently ran core/precedence-test.mjs: all5 cases pass (initial, notified mutation, deletion, bind-only update/removal, replacement bag). The reported precedence defect is accepted as fixed within these tested paths. No new broad audit, timing or full renderer acceptance is implied.

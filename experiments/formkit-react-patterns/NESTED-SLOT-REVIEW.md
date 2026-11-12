# Independent nested/group-slot review

Frozen index SHA256 `561feec9c6e1bbff1589091e462f1ba581860b31b1bdbf2c05424a968dd99803`; renderer `ee8f0cd3249ac43ab9e9afcfda7faec45c53b473a05dcbe365d69174a11b3cc0`.

Verdict: ordinary nested group/cross-field slot fixture passes, but two correctness/ownership defects block acceptance.

## Independently reproduced defects

Run `node review/nested-adverse.mjs`; result preserved in review/nested-adverse-561feec9.json.

1. **Slot content update loses user data.** Replacing label-slot schema for the same named text field destroys and recreates its Core node based on children object identity. A field edited to `user edit` becomes empty; node identity changes. This also affects a newly allocated but equivalent children object. Update slot renderers while preserving the field node/input where possible, or explicitly reject unsupported live slot replacement before changing anything. Do not silently erase values for presentation changes.
2. **Invalid expression corrupts topology and leaks an owned child.** `setFields([{name:'new',children:{label:{$el:'label',children:'$values.x + ('}}}])` passes structural validation, destroys previous field, creates new Core node, then compile throws E104 before field enters ownership map. Safe prior field is gone; new Core child exists while fields map is empty. After owner destruction, metrics created3/destroyed2. Preflight supported expression compilation before topology mutation and ensure failed renderer/field construction rolls back all created resources. Structural-key validation alone is insufficient.

## Upstream comparison and limitations

A direct attempted FormKitSchema fixture using `children:{label:...}` failed in both upstream Vue and React: their schema parser treats a non-array children object as a conditional, not a named-slot map. This experiment's named schema-slot shape is therefore an adapter API, not demonstrated identical upstream schema vocabulary.

An equivalent **component-slot** fixture was then run in each upstream binding (`review/nested-component-upstream.mjs vue|react`). It uses official group/text components and updates label-slot content. With stable initial value identity, both preserve edited value, Core child and input DOM while changing label text. Logs retained. The initial React fixture allocated a new initial-value object each render and reset its value; corrected to stable input identity before drawing the comparison. No upstream defect inferred from that harness mistake.

## Passing independent evidence

`core/nested-slot-test.mjs` passes its8 cases: official group parentage, supplied root-data cross-field label, identity on value update, reset, nested removal, group removal and ordinary teardown, unsupported component key rejected before mutation. These do not cover the defects above. Root-value observer drives slot refresh; this is not fine-grained branch dependency tracking or performance evidence.

General components, keyed lists, arbitrary types and full schema remain explicitly unsupported. No code edits, timing runs or push performed.

## Scoped correction re-review

Frozen index `5fb6fc3ec8dbc38c57f68a841a2f899e22d2360cb7376a2df8e34842484527a6`; renderer `4f4d46f768be3eeaa48a6632ae496be308e5779f5b8da60a0e71dfc01adfbcd9`.

Independently reran unchanged nested-adverse reproduction:
- Label-slot update preserves `user edit` and original Core node.
- Malformed expression rejects E104 before node creation/removal: created delta0, safe node retained, no new node, ownership map remains safe.
- After destruction created2/destroyed2.

Added review/nested-runtime-failure.mjs. Both a staged new slot renderer's unsupported raw-HTML failure and an original user class callback error leave the old field present, discard the failed new node, and end with created3/destroyed3. User error identity is preserved. Outputs saved separately from adverse originals. core/nested-slot-test.mjs independently passes all8 cases.

Inspection confirms expressions precompile before reconcile, new fields stage before removal, createField failure tears down partial renderer/child ownership, and renderer initial construction errors destroy registered ranges/effects. Slot replacement constructs replacement renderer first and retains the existing field/Core node. The two originally reported defects are accepted as fixed on these paths.

This is not a guarantee of transactional rollback for every failure during updates to multiple existing fields, or complete callback/conditional-runtime failure handling. Full schema, broad components, timings and exhaustive memory accounting remain outside acceptance. Source unchanged by reviewer; no push.

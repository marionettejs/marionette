# Known FormKit Core File equality failure

A distinct File with identical name, size, type and lastModified is treated as
equal by Core2.1.2 input; the old object is retained even when contents differ.
This fails through the named FieldView bridge, bare public Core input, and actual
Vue2.1.2 model updates. The stronger strict assertion remains failed in
`known-core-file-equality.spec.mjs` and independent installed evidence; it is not
skipped, counted as accepted, or described as fixed.

The initial full-suite attempt with this stronger assertion reported2467 passed
and one failed. After identifying the shared Core behavior, the repository bridge
regression uses explicitly different File metadata and keeps the same strict
reference/callback/focus assertions. That supported case and the stricter known
failure are different outcomes. Existing frozen authoring tests are unchanged.

Normal installed replay evidence is in the local handoff's independent-review/
portability-corrections/installed-replay: supported.log9/9, limitation.log0/2.
The Vue model red is independently retained under deep-adapter-evidence/probes/
vue-opaque.log. These are dependency limits, not broad framework certification.

Core's input short circuit is source-linked at:
https://github.com/formkit/formkit/blob/411222eefaef67fb75abc1216108b2c8a6216033/packages/core/src/node.ts#L1889

No merge-strategy override, temporary blank write, hidden value metadata, vendor
patch, dependency upgrade, or publication was used to turn this failure green.
File-reference copying remains supported; guaranteed distinct same-metadata File
replacement requires an upstream solution and remains blocked.

The final lint pass removed only unused copied fixture imports/helpers from this
probe; its complete strict test body is unchanged and remains failing. The original
file bytes are retained in local evidence/g7-final/known-core-file-equality-original.spec.mjs.

# FormKit package source and reproducibility

## Current package-only candidate

Release base: [`1b694b5420391f4800f00cb032981262d0b3b2a0`](https://github.com/marionettejs/marionette/commit/1b694b5420391f4800f00cb032981262d0b3b2a0).
This private package uses official Marionette/Radio/Utils5.2.0 and an aligned
FormKit2.9.0 graph. It has no runtime, build, test or extraction dependency on a
working experiment directory. The consumer runtime dependency list excludes React,
Vue, licensed Pro, private TCM and benchmark harnesses.

The exact retained local package SHA256 is
`d310f35567f0ed731faccc6ef797e257f838fae14443d576d6782ab56cc1ff8a`.
Its maps supply22runtime modules; its ESM/CJS scopes supply the public declarations.
The compatibility checkpoint adbaa3c163908f55265dceab994b6759ec99adbf rebuilt all six
retained executable JS files byte-identically before three local parameter renames
required by release lint. Original private development-tree/history provenance is
not recovered and is not implied. The source scaffold/tests come from identified
public sources, with exact hashes in the scoped integration evidence.

## Locked binding adaptation

`npm run check:bindings` resolves @formkit/react from this package's package.json,
checks its exact2.9.0 lock URL/integrity and published ESM file hash, selects the
recorded reactive-store/binding slice, and applies exact recorded line edits.
The output must match the checked-in adapted module byte-for-byte and match its
recorded hash. `npm run extract:bindings -- --stdout` generates that source;
`--write` is an explicit developer regeneration command. There is no network,
formatter-dependent output or2.5.0 fallback/bootstrap. React is development-only
reference material and is never executed by this tool or imported by the runtime.

The adaptation manifest and readable diff are in scripts/bindings-adaptation.json
and scripts/bindings-adaptation.patch. Ownership/dead-context cleanup, class-cache
refresh, scoped list keys and retained2.9parity changes are explicit adaptations,
not a claim that this is untouched React2.9code. The original module's2.5attribution
records its historical starting point; current reproducibility is against the
locked2.9published reference. FormKit's MIT notice remains in LICENSE.formkit.

## Historical experiments remain available

The prior public draft snapshot is preserved at immutable commit
[`6d0c2c7513549f97bc49df99239dfdf4a238b7ff`](https://github.com/marionettejs/marionette/tree/6d0c2c7513549f97bc49df99239dfdf4a238b7ff).
Its [historical experiments and receipts](https://github.com/marionettejs/marionette/tree/6d0c2c7513549f97bc49df99239dfdf4a238b7ff/experiments/formkit-react-patterns)
are historical reference, not a directory to copy/install and not fresh acceptance
of this package. No old remote branch, working example, receipt or experiment
history is deleted or rewritten by this scope. A local archive ref anchors that
known snapshot. The new clone is shallow; full ancestry recovery is not claimed.

All package behavior guards/fixtures and licenses remain package-owned. Additional
public settlement/projection/ownership regressions come unchanged from known
2dff34b95f8028925267c4f3daadfb0fa19119bd source; their historical passes are not
reused as current results. Performance f3bc1810 is held after a stale-state
counterexample and is NOT included here. Future performance changes need separate
correctness review, reproduction updates and matched browser evidence.

No publication, remote PR mutation, merge, force update, Mac/browser execution,
TCM or licensed provider transfer occurs. Package-private and release guards stay.

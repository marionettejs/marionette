# FormKit package source and reproducibility

## Locked binding adaptation

`npm run check:bindings` resolves @formkit/react from this package's package.json,
checks its exact 2.9.0 lock URL/integrity and published ESM file hash, selects the
recorded reactive-store/binding slice, and applies exact recorded line edits.
The output must match the checked-in adapted module byte-for-byte and match its
recorded hash. `npm run extract:bindings -- --stdout` generates that source;
`--write` is an explicit developer regeneration command. There is no network,
formatter-dependent output or 2.5.0 fallback/bootstrap. React is development-only
reference material and is never executed by this tool or imported by the runtime.

The adaptation manifest and readable diff are in scripts/bindings-adaptation.json
and scripts/bindings-adaptation.patch. Ownership/dead-context cleanup, class-cache
refresh, scoped list keys and retained 2.9 parity changes are explicit adaptations,
not a claim that this is untouched React 2.9 code. The original module's 2.5 attribution
records its historical starting point; current reproducibility is against the
locked 2.9 published reference. FormKit's MIT notice remains in LICENSE.formkit.

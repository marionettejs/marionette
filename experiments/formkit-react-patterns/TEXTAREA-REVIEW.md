# Textarea independent scoped review

Index SHA256 `3f9b203a6bda10b0aa869d0f5a9d27f1cbe0801dee6a840c598bec82325aa371`; renderer unchanged `df349fb68769137a6a6e8beaa17de8ad315c88203480f11041149fc5f10295fc`; parity fixture `cb6659260f46c941e4e85c83dd0e508fa08f2808772c149a15c06b93b78a1f45`.

Scoped source/behavior acceptance for native textarea and browser testing. It uses official definition/features and existing value-property renderer. Notified attrs replacement is limited to textarea and honors schema-owned attribute precedence. No novel callback recovery or general schema claim.

Candidate and Vue parity fixtures pass: multiline input, external input, nested parentage, required validation, label/help/error IDs, rows/cols/maxlength/disabled, retained node/control, reset and teardown. React first run failed disabled=true assertion at line34 even with explicit initial false; two subsequent unchanged runs passed. Preserve first failure: this fixture uses fixed30ms sleeps and is not yet deterministic readiness evidence. Do not misdescribe that failure as solely the separate absent-disabled divergence. No adapter shim warranted from this observation.

Independent `review/textarea-retention.mjs` passes schema-ID precedence against attrs ID, removal of obsolete cols/maxlength, unrelated attribute changes retaining focused selection/direction, nonempty multiline initial-value reset, detached input listeners quiet, owned node cleanup. Existing select test and composed mixed-form probe pass again.

Upstream componentprops versus adapter attrs-bag mapping is explicit in fixture. JSDOM does not verify actual maxLength typing enforcement, native keyboard, IME, layout or disabled native-user activation. Browser owner retains those gates. This review does not establish full original-adapter parity or timing improvement. No source edits or push.

## Semantic settling test correction

Test-only change authorized/coordinated with sole runtime writer. Original fixed-delay fixture preserved byte-for-byte as `review/textarea-parity-fixed-delay.mjs` (historical snapshot; its relative import still expects original core location). Updated `core/textarea-parity.mjs` SHA256 `0b065d71813318a84c5d0b15c14ae761173d08e97d4b6488d202ae587dc84f56` polls observable mount/validation, value/validation, external rendering, disabled+attributes, enable and reset states with2second deadline/10ms polling. No runtime source changes.

Final intended fixture passes React/Vue/alternative. An intermediate version only waited on disabled; absent-disabled exploratory run exposed another fixed-delay validation assertion (blocking2 vs0). Final predicates replace that wait too. Final React absent-disabled run reaches and times out specifically at enabled update, preserving genuine omission divergence rather than concealing it. This supports inadequate fixed sleeps for earlier intended-case failures, but finite passes do not prove universal scheduling stability. No browser/IME claim.

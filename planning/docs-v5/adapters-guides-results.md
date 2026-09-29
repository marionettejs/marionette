# Optional adapters, independent guides, and upstream reassessment

2026-09-30. Working slice based on `10e88e8c`, on `docs/v5-reset`.

## Delivered

- An optional adapter reference for Backbone, XState, Lit, Morphdom, and jQuery,
  including configuration, source ownership, limitations and exported types.
- Independent guides for local editing, adopting existing HTML, and refreshing
  data while retaining UI. Local interaction uses a View; readiness and active
  requests use an Application. The records example is unchanged.
- Executable guide fences from installed documentation and browser checks of
  focus, native controls, retained DOM identity and cleanup. Optional data remains
  observable state with a separate API/persistence responsibility.

## Verification

The integrated docs check verifies 29 packaged consumer pages, 37 executable
examples, 20 declaration fixtures, 11 TypeScript examples, and seven consumer
configuration checks. Site validation covers 75 HTML files and 937 internal links.
The API inventory tests pass all 10 cases; metadata records 48 documented semantic
families and eight partial families. These counts are not completeness scores.

Three browser scenarios run in Chromium, Firefox and WebKit (nine cases), using
actual Markdown code from the packed candidate. The refresh fence also checks
abort-ignoring stale responses, rejection, stop/restart and early destruction.
Three temporary mutations of request authority/cancellation were rejected.
See the [refresh audit](evidence/retained-refresh-guide-audit.md),
[editing/adoption audit](evidence/editing-html-guide-audit.md), and
[adapter audit](evidence/adapters-reference-audit.md).

Installed evidence and browser package identities are retained in
[evidence/adapters-guides-installed.json](evidence/adapters-guides-installed.json)
and [evidence/adapters-guides-browser-candidate.json](evidence/adapters-guides-browser-candidate.json).
These identify locally tested artifacts, not registry publication or website deployment.
The full runtime suite was not rerun for this documentation slice.

## Compare with upstream now

The read-only baseline is upstream `marionettejs/master`, commit
`74534f719e9ae6bf00fb6061e9f8cb712e92e2ef`, a v5 rc.2 candidate.
Its navigation has 58 consumer and 21 maintainer pages. The rebuilt navigation has
29 consumer pages. Those counts describe organization; they do not measure quality
or retained coverage. Compare reader tasks and supported contracts instead.

The comparison identifies material unfinished work:

1. A verified v4-to-v5 migration path: package/import changes, fixed roots, removed
   options, data configuration and Radio migration. Verify each against current v5.
2. Runnable consumer testing: interaction, replacement and teardown, using public
   outcomes and a realistic installed setup.
3. Practical TypeScript: initialization options, event targets and lifecycle results.
4. External hosting/routing and production/development behavior, including cleanup,
   navigation fallbacks, source maps and HMR ownership.
5. Framework-wide accessibility and safe rendering guidance. Existing interpolation,
   native controls and focus checks are useful but do not cover this whole need.

These are coverage requirements, not a request to restore every old page or helper.
The new corpus is not yet a complete upstream replacement.

## Review and corrections

Claude received the documentation map, all four new pages, our goals, and the
upstream gap/baseline assessment. It supported the reference/companion/guide split
and prioritized migration and consumer testing. It found a Lit ownership conflict
in local editing: directly changing an interpolated element's text can break later
rendering. A forced-render regression check was added and the example was simplified
to normal Lit rendering with its `live` input binding.

Other review suggestions were assessed against source and existing evidence:
installed execution already checks the refresh signatures, package lookup and typed
fences; refresh/adoption assertions already cover most suggested lifecycle tests.
The shared state reference already describes provider-specific disposal. Adapter
setter-order wording was clarified. We retained explicit refresh ownership and
its documented policy rather than adding another abstraction.

Claude incorrectly assumed upstream was v4 documentation; this baseline is v5.
Its review does not certify revised code or teaching effectiveness. Tests verify
our corrections independently.

## Are we on track?

Yes on structure and technical verification. The reference covers classes and
shared contracts independently, optional integrations have their own location,
and separate guides show different ownership needs. No guide requires the records
example or a mandatory persistence layer. Real-browser checks now complement
installed-package execution.

The main weakness is incomplete reader coverage. There is also no controlled
proof yet that this corpus teaches better architecture than upstream. The retained
refresh guide is relatively long because it makes request policy explicit; future
reader evidence should determine whether that detail belongs here or in reference.

Before an effectiveness comparison, freeze both docs conditions against one
compatible runtime and the same dependency versions, tools, budgets and task
requirements. Six runtime files already differ between this branch and upstream:
`mixins/behaviors`, `mixins/destroy`, `mixins/view`, `modules/application`,
`modules/behavior`, and `modules/region`. Comparing branches directly would mix
runtime and documentation effects. A historical run can inform hypotheses, not
provide that control. Check baseline-doc compatibility before interpreting results.

Reserve tasks across lookup, migration, local interaction, feature readiness,
extension and debugging. Grade behavior, ownership, API misuse, discovery and
effort separately, including failures and tasks where upstream does better. Keep
reader requirements independent of examples. Agree the bounded trial configuration
before launching it; this slice does not launch a paid campaign.

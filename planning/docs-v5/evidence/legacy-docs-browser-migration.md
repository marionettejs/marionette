# Retired documentation browser tests: disposition

Date: 2026-09-30. Four browser suites imported documentation removed by the v5
reset. They could no longer load. This migration removes those imports and
preserves browser-specific framework assertions in independent fixtures.

It does not restore the retired examples, treat them as architecture guidance,
or count their custom application behavior as covered by lower-level tests.

## Case-by-case disposition

| Retired test | Preserved framework evidence | Explicit remaining gap |
| --- | --- | --- |
| `application-effects.spec.mjs`: effects survive denied stop and release on successful deactivation | `application-state-events.spec.mjs` exercises active state delivery during pending/rejected stop, retained root/draft, successful teardown, stopped-state suppression, restart, and borrowed state identity. `test/unit/mixins/radio.spec.js` separately checks native declarative Radio binding ownership. | The removed `StatusFeature` implemented custom activation-scoped request registration and cleanup. There is no replacement browser recipe test proving that custom behavior or teaching it. Ordinary declarative Radio bindings intentionally survive Application stop. |
| `application-refresh.spec.mjs`: refresh preserves focus/draft and commits latest result | `application-prepared-view.spec.mjs` covers retained root/content/focus across sibling replacement. `collection-removal-survivors.spec.mjs` covers node identity, focus, selection, and media state through collection changes. | Latest-request resolution, obsolete rejection suppression, active-refresh retry, and post-stop result suppression belonged to the removed helper/feature. Those recipe behaviors remain untested until a current refresh guide provides its own example. |
| `application-refresh.spec.mjs`: feed retry and pagination preserve a sibling draft | The prepared-view tests exercise sibling replacement without rerendering retained content. Existing `application-start-region.spec.mjs` and `application-child-activation.spec.mjs` separately cover root/child lifecycle and cancellation; these were inspected, not rerun in this focused command. | The old feed's API calls, retry forwarding, pagination state, and late page-result suppression are retired example assertions. No end-to-end feed coverage is claimed. |
| `docs-interaction-boundaries.spec.mjs`: actual hover and nested click | Moved to `interaction-boundaries.spec.mjs` with an independent View fixture: browser mouse movement, delegated target/relatedTarget checks, nested button action and row click. | It verifies browser delegation and the explicit handler guards, not a new public interaction recipe. |
| `docs-interaction-boundaries.spec.mjs`: loaded iframe retained by Morphdom | Preserved unchanged in `interaction-boundaries.spec.mjs`. Tests iframe element/document identity and browsing state after rerender, contrasted with native replacement. | None for this existing independent assertion. |
| `docs-form.spec.mjs`: form validation, save, retry, draft, focus, teardown | `native-form.spec.mjs` tests native required validation, keyboard submit, cancellation of the submit event, delegated input delivery, focus/selection/node retention, Region teardown, and release of handlers on detached native nodes. | Save deduplication, dirty-baseline derivation, busy UI, safe failure messaging, retry, and abort/late-save handling were custom `ProfileForm` behavior. They are not covered by the new native form test. A current forms guide must supply and test its own policy when written. |

The release-validation owner updated browser filenames/titles and removed the
three retired application-example cases. The independent form and interaction
tests have names that describe what they actually validate.

## Verification performed

Command:

```sh
npm run test:browser -- test/browser/interaction-boundaries.spec.mjs test/browser/native-form.spec.mjs test/browser/application-state-events.spec.mjs test/browser/application-prepared-view.spec.mjs test/browser/collection-removal-survivors.spec.mjs
```

**39 passed**: 13 cases across Chromium, Firefox, and WebKit. All three new or
preserved independent cases passed on all engines. The ten existing lifecycle,
composition, and survivor cases also passed on all engines.

The standard repository browser fixture packed the existing built `.package`
and companion packages with `--ignore-scripts` and used their public browser
exports. No shared build or runtime change was made. Exact candidate hashes are
written by that fixture to `test/tmp/browser/candidate.json`; test results are
in `test/tmp/browser/results.json` until overwritten by a later browser run.

`npx eslint test/browser/interaction-boundaries.spec.mjs test/browser/native-form.spec.mjs`
also passed.

## Interpretation

This restores runnable browser validation against supported library behavior.
It does not complete the missing forms, retained-refresh, active-effect, or
navigation teaching paths, and it does not demonstrate documentation
comprehension. Those remain explicit reader-coverage work rather than silently
inheriting acceptance from removed examples.

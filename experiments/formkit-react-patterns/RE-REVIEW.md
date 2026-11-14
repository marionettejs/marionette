# Independent re-review: 8cf063cc

Frozen core/index.mjs SHA256 `8cf063ccc1d3d6bfb3f6168f19999fb9635829698a736b850f6d1bd3e7d4db56`.

## Scope verdict

The three originally reported defects are fixed on the tested paths:

- Two forms using the same field name now have distinct input/message IDs.
- `setFields` after destruction no longer creates Core children, subscriptions or detached inputs.
- Destruction or unsubscription during store dispatch prevents later subscriber calls.

Independently reran `node core/test.mjs` (13 checks), `node core/regressions.mjs` (5 checks), and unchanged `node review/adversarial.mjs`. All original failure indicators are now zero/empty. Exact new output saved separately in `review/adversarial-result-8cf063cc.json`; initial adverse output remains unchanged.

## Remaining lifecycle edge

`node review/reentrant.mjs` registers a `before:render` handler that destroys the form, then calls `form.render()`. Result: `isDestroyed:true` but `isRendered:true`. The render override checks terminal state before the callback, but not afterward, so it marks an already destroyed View rendered. No new child is created because setFields is guarded, and no post-destroy callback fired in this reproduction. This is narrower than the repaired resurrection defect but should be fixed before claiming faithful Marionette lifecycle: stop after user callbacks if owner became terminal and test the before-render destroy path.

All first-review fixture/capability limitations remain. No browser, performance, full schema, current-adapter fourth-arm, Pro, or overall lifecycle acceptance follows from these narrow repaired regressions.

## Final narrow recheck: e7c25f21

Core SHA256 `e7c25f2186a89c2224345aa6cc430492520c0c17f1b6a6a6a0afa417ef017474` now rechecks `_ending || isDestroyed()` immediately after `before:render`. Independently rerunning unchanged `review/reentrant.mjs` yields `{isDestroyed:true,isRendered:false,rendersAfterDestroy:0}`. The specific destruction-during-before-render state regression is fixed. This is scoped acceptance of that guard only; the evolved shared harness and overall behavior/performance were not re-reviewed here.

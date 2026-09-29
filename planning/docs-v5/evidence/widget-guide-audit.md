# Imperative control guide audit

2026-09-30. `docs/guides/widgets.md` uses the actual browser-native `HTMLDialogElement` API rather than a fake widget or a new dependency. One View owns a modal dialog, its opening interaction, and cleanup. No Application, data provider, renderer adapter, or generic control helper is introduced.

## Contract grounding

- `src/modules/common/monitor-view-events.ts` emits `dom:remove` when an attached, rendered View begins render or detach, and `dom:refresh` after attached rendering or rendered attachment. The example closes its dialog in `onDomRemove` and `onBeforeDestroy`.
- `src/modules/behavior.ts` forwards host notifications but its direct `destroy()` emits no independent lifecycle notifications. The guide explains that reusable integrations with direct Behavior removal must clean resources in a repeat-safe `destroy` override and delegate to the base method.
- The [HTML Standard dialog contract](https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-showmodal) requires a connected element for modal display and supplies modal/focus behavior. The example opens through a click after Region mounting.

## Local checks

The actual JavaScript fence passes against built public exports with JSDOM. `test/docs/widget-guide-checks.mjs` exports `assertions['guides-widgets-1']` for the shared harness; no preparation or HTML fixture is required because the fence creates its mount. It verifies mounted dialog markup, native form configuration, fresh nodes after native rendering, DOM-removal notifications, detach/re-show retention, destruction, and Region ownership. Scoped lint passes.

The local assertions do not call or emulate `showModal`/`close`. JSDOM lacks these modal methods here. This check therefore does not establish modal cleanup or focus behavior.

## Browser verification plan

Load the actual packed guide fence and expose `HelpView`, `help`, `region`, and `mount` to the existing browser harness. Exercise the real API in Chromium, Firefox, and WebKit:

1. Click Help; assert modal `open`, dialog visibility, and focus on its autofocus Close button. Close through the native form, then re-open and close with Escape.
2. Open, then render the attached View. Observe `dom:remove` after its hook and confirm the old dialog is already closed while still connected; assert a new dialog node is produced.
3. Open, then `region.detachView()`. Confirm the old dialog closes before removal and the View remains live. Re-show the same View, verify it retains its dialog node, and open again.
4. Open, then `region.empty()`. Observe `before:destroy` after its hook; confirm the dialog is closed before teardown, then confirm root removal and terminal View state.

Checking closure before removal distinguishes lifecycle cleanup from the browser's automatic effects of removing a dialog. Temporarily omitting the close call should fail these checks if mutation sensitivity is requested.

## Limits

This is an imperative browser-control integration, not a tested adapter for an external editor/chart library. Those libraries have their own creation, updating, suspension and disposal rules; the prose gives Marionette boundaries without pretending they share one generic API. Behavior reuse is explained from the source contract but not duplicated into another example. Passing the guide does not establish accessibility quality or reader effectiveness.

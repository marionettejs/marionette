# Focus-preserving reorder review plan

Baseline probe: review/reorder-a11y-probe.mjs. No source edits. Existing no-op placement preserves focused input, backward selection, value and Core node. Actual flat and ancestor-group reorder retains node/value but loses focus. Removing the focused field detaches it and does not refocus it, which is expected.

## Focused acceptance cases

- Repeating identical ordered fields: zero host moves, no focus/blur events, same activeElement and selectionStart/End/direction.
- Moving a retained focused text field: correct order, same input/Core node/value, focus and selection preserved.
- Moving siblings around focused control: same guarantees without avoidable focus churn.
- Moving retained ancestor group containing focus: nested control remains active and selected.
- Nested child reorder and label/help updates: ordinary node ownership and values intact.
- Removing the focused field or destroying the form: no restoration to removed nodes, no new focus target invented, existing cleanup remains intact.
- Browser keyboard follow-up: type into retained field after reorder and Tab/Shift+Tab follow new DOM order. Check actual blur/focus events and scroll position. A fallback that blurs/refocuses is observably different from a state-preserving move and should be disclosed, not silently called identical.

IME composition cannot be validated by dispatching synthetic compositionstart/end events alone. Do not promise composition preservation without real browser/platform evidence; avoid implementing artificial value resets or focus restoration that knowingly interrupts it. Native state-preserving DOM movement, when available, is preferable to detach-and-restore, but API support and disconnected-node constraints need verification.

No new callback recovery, all-or-nothing rollback, or focus preservation for removed controls is required. No performance conclusion follows from these functional cases.

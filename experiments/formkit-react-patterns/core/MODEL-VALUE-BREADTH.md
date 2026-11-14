# Value adapter contract

On initial construction, an explicit entry in the form's `values` object wins. Otherwise a field uses `modelValue`, then `value`, then a cloned `defaultValue`. Undefined means absent, matching upstream React's value aliases.

`setFields` applies changed declared `modelValue`/`value` to the existing Core node. `defaultValue` is initialization-only. Repeating an unchanged controlled declaration does not overwrite later input. This adapter is imperative: it does not run a React render loop or automatically restore a controlled value after every input.

The current field's `onInputRaw(value, node)` and `onInput(value, node)` run from Core's `modelUpdated`. Modeled fields additionally call `onUpdateModelValue(value)`, `onUpdate:modelValue(value)` and `onChange(value, node)`. Replacing callbacks through `setFields` does not install additional listeners. Disposal removes the receipt.

Focused JSDOM coverage is in `model-value-breadth-test.mjs`; comprehensive controlled-flow/browser compatibility remains deferred.

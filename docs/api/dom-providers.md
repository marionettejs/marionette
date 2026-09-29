# Rendering and DOM providers

[API index](../api.md) · [Runtime configuration](runtime.md) · [View rendering](view-runtime.md#templates-and-data)

Choose an existing integration when it fits. A renderer evaluates a template; DomApi applies the output and performs DOM operations; EventDelegator installs DOM listeners. These independent boundaries let a View keep its lifecycle and ownership rules while changing its integration.

## Renderer

`setRenderer(renderer)` accepts a synchronous function `(template, data) → output`, invoked with the View as `this`. The default calls `template(data)` without binding the template function to the View. It does not compile strings. `template: false` skips template rendering.

Marionette serializes data and applies template context before calling the renderer; a falsy final data value becomes `{}`. It passes every return value to `attachElContent`, whose default calls `Dom.setContents(el, output)`. A Promise is not awaited, and `undefined` does not mean “skip insertion.” If a renderer performs insertion itself, override `attachElContent` to match that strategy and keep the View's fixed root. Usually, putting insertion in DomApi keeps the responsibilities simpler.

The native `setContents` treats strings as HTML. Choose an integration such as [Lit](../setup.md#configure-once) for templated UI with ordinary text interpolation. This small text-only class demonstrates a typed DomApi overlay without building a new template engine:

```ts
import { View, type DomApiContract } from 'marionette';

const TextDom = {
  setContents(el: Element, value: string) {
    el.textContent = value;
  },
} satisfies Partial<DomApiContract<ArrayLike<Element>, string>>;

const Label = View.extend({
  template: ({ label }: { label: string }) => label,
}).setDomApi(TextDom);

const label = new Label({ model: { label: '<Draft>' } });
label.render();
```

Only content insertion changes; native root creation, queries and placement remain inherited. This class displays literal text, not HTML templates. The [scope rules](runtime.md#choose-a-configuration-scope) explain when to configure a class or a whole family.

## DomApi

`setDomApi(mixin)` overlays methods on `Dom`. Methods are called on that provider object. Implement only the operations being replaced, while keeping their inputs/outputs compatible with the remaining methods. Publicly import the default value as `DomApi`; import the interface as `DomApiContract`.

| Method | Required behavior and native default |
| --- | --- |
| `createElement(tagName) → Element` | Create a root element. Native uses `document.createElement`. |
| `createBuffer() → DocumentFragment` | Create a buffer for batch child insertion. |
| `getDocumentEl(el) → Element \| null` | Return the document root used for attachment checks. Native uses `el.ownerDocument.documentElement`. |
| `findEl(el, selector) → Query` | Return an array-like collection of matching descendants. Native returns a static `NodeList`; excludes the root. |
| `hasEl(el, childEl) → boolean` | Test strict containment. Native checks the child's parent, so an element does not contain itself for this operation. Nullish child returns false. |
| `detachEl(el)` | Remove the element from its parent while preserving the element and listeners for possible reuse. |
| `replaceEl(newEl, oldEl)` | Replace the old element in its parent. Native does nothing for identical elements or a parentless old element. |
| `setContents(el, output)` | Apply renderer output within the root. Native uses `innerHTML`, with nullish output clearing contents. Match this method to the renderer's output. |
| `setAttributes(el, attributes)` | Apply attributes. Native uses own enumerable keys, removes `null` values, ignores `undefined`, and stringifies other values. Unmentioned attributes remain. |
| `appendContents(el, contents)` | Append an Element/DocumentFragment to the parent Element/DocumentFragment. |
| `moveEl(el, parent, before?)` | Insert or move the element before the reference node; append when omitted/null. Native uses `moveBefore` for an existing child of that parent when available, otherwise `insertBefore`. |
| `hasContents(el) → boolean` | Report child-node presence. Native returns false for a nullish element. |
| `detachContents(el)` | Remove contents while retaining the root. Native clears `textContent`. This operation does not establish View destruction by itself. |
| `notifyAttach(el)` | Notify content integration that the View's element has attached. Native does nothing. |
| `notifyDetach(el)` | Notify content integration that the View's element has detached. Native does nothing. |

Marionette owns View/Region lifecycle and child cleanup around these operations. Providers must preserve the root identity and must not destroy unrelated Views or borrowed sources. Preserve renderer markers when moving child elements; a provider must support the actual content it created. The Lit adapter implements content insertion and attachment notifications so its directive connection state follows View attachment.

Attachment notifications follow monitored Marionette lifecycle, including construction on an attached root. `monitorViewEvents: false` on the View class disables that monitoring. Integrations such as Lit rely on these notifications for directive connection state, so disabling monitoring also disables that integration behavior. Arbitrary external DOM movement is not observed.

DOM methods are synchronous; they are not lifecycle preparation hooks. View/Region ownership and notifications remain defined in their class references. `notifyAttach`/`notifyDetach` communicate connection changes, not ownership transfer or a general-purpose resource disposer.

## EventDelegator

`setEventDelegator(provider)` replaces the entire provider. Its required method is:

`delegate({ eventName, selector, handler, rootEl }) → cleanup`

Install the listener on `rootEl` and return a function that releases exactly that subscription. Cleanup should be safe to repeat. Preserve the event passed to `handler`; the View/Behavior binding layer already selects the callback context. An empty selector represents the root listener. Marionette calls the cleanup on undelegation/destruction; detaching a live View preserves its bindings.

The native provider:

- Uses capture for `focus` and `blur`, and normal bubbling for other events.
- With a selector, walks from the event target toward the root and calls the handler once for the nearest matching descendant. The root is excluded.
- Sets `event.delegateTarget` to that matched descendant. `event.target` retains the original target.
- Without a selector, invokes the handler for events reaching the root listener, without adding a matched delegate target.

A custom provider controls its event matching behavior. Keep [View DOM events and triggers](view-runtime.md#dom-events) compatible with what consumers expect. Behavior has its own configured EventDelegator; changing only a host View subclass's provider does not change its Behavior classes. Family-wide setters configure both.

## TypeScript

Import `Renderer<Receiver, Template, Data, Output>`, `DomApiContract<Query, Content>`, `EventDelegator`, `DelegateOptions`, and `DelegatedEvent` from `marionette`.

`Query` extends `ArrayLike<Element>`. The default DomApi's direct `findEl` returns `NodeListOf<Element>` and also accepts DocumentFragment; the `DomApiContract` interface accepts Element or Document. The content parameter defaults to `never`, keeping an unconfigured content slot opaque. Specify your output type when authoring a concrete provider, as above. Configuration does not infer or enforce a matching renderer/output/query type across all consumers.

`DelegateOptions` supplies a string selector and a handler accepting arbitrary arguments; `DelegatedEvent` adds optional `delegateTarget` to the native Event type. Use the [configuration setters](runtime.md#choose-a-configuration-scope) or the class's current provider when composing integrations.

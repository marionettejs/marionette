# Choose integrations without changing the whole stack

An adapter connects a specific capability to Marionette. It does not select the
rest of your application architecture. Keep integrations that already satisfy
the task; add a dependency only when the required behavior needs it.

## Make the decision in this order

1. **Inspect the project.** Read its package versions, initialization code, View
   subclasses, and existing adapter configuration. Follow its established
   integrations unless the requested change includes replacing them.
2. **Name the missing capability.** Examples: observe model changes, retain DOM
   contents across a render, or subscribe to an actor snapshot. “Use an adapter”
   is not itself a requirement.
3. **Use the smallest matching integration.** Keep Marionette's defaults for
   capabilities that do not need to change. Prefer an existing, verified adapter
   over introducing a custom implementation of the same contract.
4. **Check ownership and verification.** Identify who creates the source, who
   releases subscriptions, and which behavior demonstrates that the integration
   works. Configure it before constructing the affected owners.

For a new application with no integration requirements, start with plain
objects, arrays, native DOM operations, and template functions. Plain data is
not observable: explicitly update the UI when it changes. If the task requires
observable models and ordered collections without an existing provider,
use [`@mnjs/data`](../packages/data/readme.md) as the starting choice.
Backbone models and collections are also observable: keep them and select
`BackboneApi` when the application already uses Backbone. “Optional” means
Backbone is not required by core, not that its data is static.
`@mnjs/data` includes DataApi and StateApi implementations; it does not add persistence
or REST synchronization. Choose another provider when a requirement calls for
its additional behavior, such as state-machine actors or an existing persistence
layer.

## Select each capability independently

| Capability | Default | Change it when | Contract |
| --- | --- | --- | --- |
| Read models, serialize data, track collection identity/order, observe entity changes | Plain objects and array snapshots | Views consume another provider's models or collections | [DataApi](./data.api.md) |
| Subscribe to an owner's state and dispose owned state sources | Plain objects with no subscriptions | `stateEvents` must observe a provider, or owned sources need disposal | [StateApi](./marionette.state.md#stateapi) |
| Create, query, attach, and update DOM elements | Native browser APIs | Required DOM operations or content updates differ | [DomApi](./dom.api.md) |
| Evaluate a template with serialized data | Call a template function | A template engine needs another evaluation function | [Renderer](./view.rendering.md#using-a-custom-renderer) |
| Bind View/Behavior `events` and `triggers` declarations | Native delegated DOM events | The binding mechanism itself needs replacement | [EventDelegator](./dom.interactions.md#eventdelegator-adapter) |
| Match URLs and control browser history | None | The application requires routing | [Router integration](./routing.md) |

A state source and a View's model can use different providers. A single provider
may implement both DataApi and StateApi, but configuring one does not configure
the other. Changing DomApi does not change EventDelegator. A template renderer
produces a value; DomApi applies that value to the element.

## Match an existing provider

These entrypoints are supplied by this repository. Check their package and peer
versions against the source revision or release you are using; an older alpha
package may not contain an entrypoint described by current source docs.

| Existing requirement | Integration | Scope and consequence |
| --- | --- | --- |
| Backbone models or collections | `@mnjs/adapters/backbone` as DataApi | Observes Backbone model and collection events while preserving their native vocabulary |
| Backbone state | The same `BackboneApi` object as StateApi | A separate configuration decision from model/collection data |
| XState actor data or state | `@mnjs/adapters/xstate` | Select the actor snapshot event explicitly; collection selectors return stable child actor references |
| jQuery DOM queries or attachment operations | `@mnjs/adapters/dom/jquery` | Does not install jQuery event delegation or create `$el` |
| Morphdom updates to a View's HTML contents | `@mnjs/adapters/dom/morphdom` | Keeps the View root; does not preserve child Views owned by Regions across parent render |
| Lit template results | `@mnjs/adapters/dom/lit-html` | Applies Lit results through DomApi; requires attachment monitoring for directive connection cleanup |

Read the [adapter package guide](../packages/adapters/readme.md) for exact
imports, provider constraints, ownership, and setup examples. There is no root
`@mnjs/adapters` export. Import the subpath you use; importing it does not
configure Marionette or select any other adapter.

For example, a View may use Backbone data with native DOM operations and a
plain template function. Adding Morphdom to its content updates would not
require changing its models, state, or router.

## Configure the narrowest appropriate scope

Configure a View subclass when the integration belongs to that component:

```javascript
import { View } from 'marionette';
import BackboneApi from '@mnjs/adapters/backbone';

const AccountView = View.extend({
  template: () => '<span class="name"></span>',
  modelEvents: { change: 'render' },
  onRender() {
    this.el.querySelector('.name').textContent = this.model.get('name');
  }
});
AccountView.setDataApi(BackboneApi);
```

This configures DataApi for `AccountView` and its subclasses. It does not choose
StateApi or change sibling View classes. Use top-level setters when the whole
application intentionally shares that configuration. Use an
[isolated runtime](./runtime-isolation.md) when independently configured
application surfaces must coexist.

Setters overlay supplied adapter methods. When composing DOM operations,
configure a general adapter such as jQuery before an adapter that replaces
content updates, such as Morphdom. Do not switch content adapters after a View
has rendered. Changing a live object's source contract is an application
migration, not a configuration shortcut.

## Add a custom adapter only for an unmet contract

Before implementing one, write down:

- The required methods and source event payloads, using the relevant contract.
- Stable model identity and ordered collection snapshots, if it is a DataApi.
- Borrowed versus owned sources, callable subscription cleanup, and which owner disposes each registration.
- Failure behavior when subscription setup, rendering, or source updates throw.
- A test with two consumers of one source, followed by destruction of one
  consumer. The surviving consumer must keep working.

For editable collection children, also verify draft/focus retention when a
model stays the same, and the documented destruction/recreation behavior when
an immutable replacement supplies a different model with the same key.
An adapter's type declaration alone does not establish these runtime behaviors.

## Explain choices to an agent or reviewer

Record the chosen integration once where the application configures it. A useful
decision states the capability, existing constraint, configuration scope, and
verification, for example:

> This feature already uses Backbone models. Configure BackboneApi on its View
> subclasses, retain native DOM events, and verify that model changes render
> once and that destroying one View leaves another observer subscribed.

When several providers meet the same requirements, preserve the existing one.
For a new project, choose the simplest option that meets the stated capability;
ask for a preference only when the choice changes a meaningful product or
maintenance constraint. Do not introduce additional providers just because
examples for them appear beside each other in this guide.

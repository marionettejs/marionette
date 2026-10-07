# Migrate from v4 to v5

Upgrade one application and its messaging participants together. Start from a working v4 application with checks for its important interactions, then change installation and integration setup before changing feature ownership. This guide covers common v4 application code; custom providers and low-level overrides should also be checked against their [reference contracts](../api.md).

## 1. Replace installation and configure integrations

Replace `backbone.marionette` with the matching `marionette` v5 candidate. Follow [candidate installation](../quick-start.md#install-the-release-candidate) for the current package artifacts and companion versions. If you already use named imports, change their package path. Replace default namespace imports with named imports: `import { Application, View, MnObject, Radio } from 'marionette'`. The former namespace's `Object` alias becomes `MnObject`.

Core supplies native DOM operations and accepts plain objects and static arrays. Backbone, jQuery, and Underscore are no longer required by core. Remove a dependency only when the application itself no longer uses it.

Configure the data sources and rendering your application actually uses in one setup module, imported before constructing consumers:

- An existing Backbone application can retain its Models, Collections, and persistence operations. Import `BackboneApi` from `@mnjs/adapters/backbone`, then call `setDataApi(BackboneApi)`. Call `setStateApi(BackboneApi)` separately when owners use Backbone state. This connects existing data without changing Backbone objects or their native methods.
- For new observable data, [@mnjs/data](../packages/data.md) provides local Models and Collections. Use its `DataApi` and, when needed, `StateApi` as described in [setup](../integrations/setup.md). It is optional and incomplete: fetching and persistence need an API layer or another data solution. Replacing Backbone's `save`, `fetch`, or server-side `destroy` requires a deliberate data-layer change.
- The default renderer calls a template function with its data; it does not compile template selector strings. Preserve an application template compiler through `setRenderer` when needed. For Lit templates, configure `LitDomApi` from `@mnjs/adapters/dom/lit-html` with `setDomApi`.
- Code requiring jQuery query or content methods can explicitly select `JQueryDomApi` from `@mnjs/adapters/dom/jquery`. This adapter does not create `$el` or restore jQuery event delegation. Its peer requirement is jQuery 4; verify application plugins before selecting it.

See [adapters](../packages/adapters.md) for installation, provider behavior, and tested peers. Ordinary applications can use the default runtime setters; [runtime configuration](../api/runtime.md) also supports class-specific setup and isolation.

Replace every `backbone.radio` import with the selected runtime's Radio in the same upgrade, including publishers and requesters outside Marionette classes. The old and new buses have independent channels, so leaving either participant on the old bus disconnects communication. Default-runtime code can import `Radio` from `marionette`; isolated runtime code must use that runtime's `Radio`. Replace `Radio.DEBUG = true` with `Radio.setDebug()`. See [Radio](../packages/radio.md) for registry scope and request/reply methods.

### Import and configure existing Backbone data

This upgrade retains Backbone persistence. Change every Radio participant together:

```diff
-import Mn from 'backbone.marionette';
-import Radio from 'backbone.radio';
+import { View, Radio, setDataApi } from 'marionette';
+import BackboneApi from '@mnjs/adapters/backbone';
+setDataApi(BackboneApi);

-const Editor = Mn.View.extend({ modelEvents: { change: 'render' } });
+const Editor = View.extend({ modelEvents: { change: 'render' } });
```

### Replace jQuery event assumptions

Native delegated events require explicit cancellation. `getUI()` still returns a
collection, so select its element before using DOM properties:

```diff
 onSave(event) {
-  const title = this.getUI('title').val();
+  event.preventDefault();
+  const title = this.getUI('title')[0].value;
   this.model.save({ title });
-  return false;
 }
```

This example assumes the Backbone provider above and a single named input. Add
`event.stopPropagation()` when stopping propagation was part of the intended v4
behavior; cancelling a form submission alone does not require it.

## 2. Update Views and composition

The root remains fixed for each View's lifetime. Resolve selector strings to actual elements before supplying `el`; unwrap an existing jQuery element with `[0]`. To use a different root, destroy the old View and construct a new one. Regions still accept selector strings as mount points.

| Existing code or assumption | v5 change |
| --- | --- |
| `setElement(...)`, inherited `remove()` | Construct with the intended `el`; use `destroy()` for complete teardown. |
| `$el`, jQuery methods on `ui.name`, `getUI(...)`, or `this.$(selector)` | Native UI queries return array-like collections. Use `this.getUI('name')[0]` for one element. With the jQuery DOM adapter, UI queries return jQuery collections; create `$(this.el)` explicitly if the application needs a root wrapper. |
| jQuery delegated events, `return false`, event namespaces | Native handlers receive a DOM event. Use `event.delegateTarget` for a selector match and explicit `preventDefault()` / `stopPropagation()` when needed. Core does not inherit singular `delegate` / `undelegate` helpers. |
| Collection-only templates reading `items` | Read `models`, the array of serialized model values. This change applies to a View's collection template data. |
| `region.show(stringOrOptions)` or `showChildView(name, template)` | Construct the intended View explicitly and pass its instance. |
| `getRegion`, `getRegions`, or `hasRegion` implicitly rendering a layout | These are inspection methods. Use `showChildView` for composition, or explicitly render before showing directly through a selector Region. |
| View Region registration/removal events | Put setup alongside registration and observe the Region's own destruction when needed. The View's `add:region` / `remove:region` notifications are removed. |
| Global `setEnabled` / `isEnabled` calls | Remove the registry. Configure `childViewEventPrefix` on the View and `preventDefault` / `stopPropagation` on individual trigger definitions. Move application settings to explicit configuration or state. |
| Lifecycle hooks supplied as constructor options | Define hooks on the class or instance. `triggerMethod` resolves instance/prototype methods. |
| `bind` / `unbind`, or space-separated framework event names | Use `on` / `off`. Each event or request name is literal; use maps or separate calls for multiple names. Backbone sources retain their own native event semantics. |
| Root imports of target-first utility wrappers | Prefer the object's method, or use the receiver-based functions from [@mnjs/utils](../packages/utils.md). |

The UI query and native DOM handler changes also apply to Behaviors; their element and delegated interactions belong to the host View. See [Behavior](../api/behavior.md) for that contract.

Keep root attributes distinct from template contents. `renderAttributes()` refreshes declared root attributes; `render()` refreshes contents. Native attribute removal requires `null`, and boolean HTML attributes should be present or absent rather than assigned `false`. Set live input values through DOM properties. See [View bindings](../api/shared/view-bindings.md) for templates, attributes, UI, and events.

For CollectionView customizations, `attachHtml(els, container)` receives a native container. The child container supports iteration and its documented helpers; replace removed Underscore aliases or iteratee shorthand with explicit callbacks/native array operations. Sorting and filtering remain supported; verify the [CollectionView reference](../api/collection-view.md) when overriding them.

## 3. Make feature readiness and ownership explicit

In v4, `Application.start()` fired notifications synchronously on every call and returned the Application. v5 adds `stop()`, `restart()`, and `isRunning()`. Await `start()` and `restart()`: they return `Promise<boolean>` and can reject. `stop()` and `destroy()` return synchronous booleans; remove Promise chaining and asynchronous teardown hooks. Starting an already-running Application does not repeat preparation. Handle failure at the boundary that requests the operation.

Move work required before showing a feature from an async `onStart` or `onRender` into `prepareStart(options, { signal })`. Pass the signal to the request; return the ready result for `onStart(app, options, result)`. Notification hooks remain synchronous and their returned Promises are not awaited. The [Application reference](../api/application.md#prepare-before-showing-ui) contains a complete readiness example and explains cancellation and failure.

Use `onStart` to apply the ready result. Construct the shell and its connections once if it should survive restart; `viewEvents` observes root intent without rebinding on every start. When composing before attachment, call `setView(page)`, then the page's `showChildView(...)`, then `showView()`. The Application owns its selected root; stop destroys it, and a later start creates a new one. A Region built from constructor configuration is owned; a supplied Region instance is borrowed and remains reusable.

Register child Applications through `childApps` or `addChildApp` when the parent should own their lifetime. Registration does not start them: request their start explicitly and handle that Promise. Parent stop stops registered children; parent destruction destroys them. Keep local input/model edits in their View when they need no feature coordination; Application is useful when readiness, shared workflow, or lifetime requires an owner.

`restart()` repeats preparation without stopping the active run. Keep the root and its child Views in `onStart` when preserving focus and input; see [retained restart](retained-restart.md). Restart leaves registered children active, so restart a child explicitly when its readiness must change too. Use `app.stop(); await app.start(options)` for reconstruction or host relocation. Finish required saves before calling synchronous stop/destroy. Ordinary `listenTo` subscriptions to surviving sources remain bound across stop and restart.

## 4. Verify the migrated application

Check the installation and actual entrypoint first, then exercise representative behavior. The [consumer-testing guide](testing.md) supplies runnable checks for interaction, replacement, readiness and teardown:

1. A successful start shows ready UI; a failed or superseded start does not commit obsolete UI. Verify that callers handle rejection.
2. Local edits and collection membership/order changes update through the chosen data provider. Existing Backbone persistence still uses its intended API.
3. Events and Radio requests reach every intended participant. Check event maps and former whitespace-separated names.
4. Replacing a panel destroys the old View while surviving shared data remains usable. Stopping and starting a feature recreates its root; restart preserves the intended controls through loading, failure, and the chosen successful update.
5. Successful owner destruction removes its UI and releases its subscriptions. A surviving listener receives the final `destroy` notification, then the destroyed Marionette source releases incoming listeners automatically. Extra destroy-to-`stopListening(source)` handlers are unnecessary for Marionette sources; external sources keep their own cleanup contracts.

Remove manual root/registered-child destruction that duplicates Application ownership. Continue releasing application-owned timers, external subscriptions, and operations outside preparation according to their lifetime; framework cleanup cannot infer those resources. Use public behavior checks rather than private event registry assertions. See [event cleanup](../api/shared/events.md#cleanup) and the class references when deciding who disposes a resource.

# @mnjs/utils

The small helpers behind Marionette, available for your own components.
Marionette and `@mnjs/data` import these same implementations.

```bash
npm install @mnjs/utils@5.0.0-beta.2
```

Use the same version for all Marionette packages. Core and data
install utils automatically as a regular dependency. Add it directly when your
application imports it.

## Building a component

Methods such as `getOption`, `normalizeMethods`, and `triggerMethod` use their
receiver as the component. Mix them into a prototype or call them with `.call()`.

```js
import { Events, getOption, normalizeMethods, triggerMethod } from '@mnjs/utils';

const component = {
  ...Events,
  getOption,
  normalizeMethods,
  triggerMethod,
  options: { label: 'Inbox' },
  onOpen() {
    return this.getOption('label');
  }
};

component.triggerMethod('open'); // 'Inbox'
component.normalizeMethods({ open: 'onOpen' });
```

## Events

`Events` is the shared event implementation used by Marionette, Radio, and native
data. Mix it into an object with `Object.assign({}, Events)` to use `on`, `off`,
`trigger`, `listenTo`, and `stopListening` without core.

## Helpers

Use object spread or `Object.assign` for ordinary copying and composition.
Inherited enumerable parent statics are copied only inside `extend`.

- `getValue(object, key, fallback)` reads a value and calls it on the object if it
  is a function. `getOption` reads from `this.options`, then the receiver.
- `mergeOptions(options, keys)` copies selected options onto the receiver.
- `normalizeMethods(map)` resolves method names on the receiver.
  `resolveMethod(context, method, name)` resolves one handler.
- `bindEvents` and `unbindEvents` use the receiver's listening methods.
  `bindRequests` and `unbindRequests` register or remove channel replies with
  the receiver as their context. `normalizeBindings(context, map)` resolves an
  event map without subscribing.
- `triggerMethod(eventName, ...args)` invokes the matching `onEventName` method
  and triggers the event.
- `extend` is the function-constructor inheritance helper used by Marionette.
- `MarionetteError` is the same error constructor exported by Marionette.
- `isString` recognizes primitive and boxed strings. `setProperty` assigns a
  property, treating `__proto__` as an own data property.

ES modules, CommonJS, and TypeScript declarations are included. The package has
no runtime dependencies and declares no side effects. Bundlers can retain only
the imported helpers. Marionette's standalone UMD bundles include these helpers;
module consumers share the installed package.

Event-building helpers `buildEventArgs`, `eventSplitter`, `callHandler`, and
`onceWrap`, plus `uniqueId`, are shared by core and Radio.

# FormKit configuration through Marionette Application ownership

`FormKitApplication` is the portable Application-level counterpart for FormKit's
configuration-provider/lazy-provider roles. It is an actual Marionette
`Application`, using `prepareStart` for readiness, a normal View factory for
presentation, and Application/Region ownership for cancellation and teardown.
It imports no React or Vue runtime.

```js
import { FormKitApplication } from './core/index.mjs';

const app = new FormKitApplication({
  region: { el: document.querySelector('main') },
  configFile: new URL('./formkit.config.mjs', import.meta.url).href,
  form: {
    fields: [{ name: 'email', type: 'email', validation: 'required|email' }],
    formProps: { actions: false },
  },
});

const started = await app.start(); // false if preparation was cancelled
if (started) console.log(app.getView().node.value);
app.destroy();
```

`configFile` is dynamically imported. A default export is selected when present;
otherwise the module namespace is used. A synchronous exported factory is called
once per uncancelled preparation. A `config` object/factory can be supplied instead
of a file. Its shape is FormKit options (`inputs`, `plugins`, `rules`, `icons`,
`locales`, and nested root `config`), while `form` contains ordinary adapter View
options. Module loading may be asynchronous; config factories are synchronous, as
in the installed official loaders.

No form View/Core nodes are created while initial config is pending. Preparation
errors reject `start()`/`restart()`; callers handle those Promises. Failed initial
preparation stays stopped. Active restart retains the old View while loading and
on preparation failure; successful restart replaces it with a View using the new
configuration. Synchronous construction/notification failures keep Marionette's
ordinary no-rollback boundary.

`stop()`, `destroy()`, and a superseding `restart()` cancel obsolete preparation.
ES module evaluation itself cannot be aborted. An aborted result cannot invoke
the post-import config factory or create a late View/Core tree. This follows
Marionette's preparation signal contract. The installed React/Vue loaders still
invoke their config factory after unmount when an already-started import finishes,
but also suppress child rendering.

## Shared and owned scopes

An Application without a Region provides configuration without creating UI.
A consumer's `provider` is a prerequisite: it awaits the provider's ordinary
`start()`, then borrows its ready scope. An inherited scope bypasses the consumer's
`configFile` and `defaultConfig` setting, matching the official LazyProvider's
inherited-options bypass.

```js
const provider = new FormKitApplication({ configFile: configUrl });
const editor = new FormKitApplication({
  provider,
  region: { el: editorHost },
  form: { fields: editorFields },
});
provider.addChildApp('editor', editor);
await editor.start();
```

Readiness and ownership remain separate. `provider` borrows configuration;
`addChildApp` establishes lifetime ownership. Destroying a consumer does not
cancel a borrowed/shared provider. An owner stops/destroys registered consumers
through the existing Application contract. A provider's successful restart does
not automatically restart its registered consumers; explicitly restart consumers
when they must adopt a replacement scope.

`getFormKitScope()` returns the ready `{ options, defaultConfig, rootConfig }`
scope, or `undefined` while stopped. Consumers share the Core `rootConfig`;
notified changes such as `scope.rootConfig.rootClasses = ...` reach their live
nodes. `getFormOptions(formOptions)` resolves View options against that scope.
`createFormView(options)` is the normal overridable View factory. A borrowed
Region remains borrowed and is not destroyed by this Application.

## Raw configuration

`defaultConfig` defaults to true. `defaultConfig:false` disables the adapter's
default input-library, theme, binding, validation and i18n plugins. The raw config
must supply its required library/context plugins, including the `form` definition
for the adapter's root. The same flag is available on synchronous `mount`.

```js
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { bindings } from './core/upstream-bindings.mjs';
export default {
  plugins: [createLibraryPlugin(inputs), bindings],
  config: { locale: 'en' },
};
```

Top-level `locale` is a default-config convenience; raw mode uses `config.locale`.
There is no silent addition of native types or validation to a raw pipeline.

## Application and nested scopes

Application remains the owner for full FormView readiness and shared configuration.
For a provider within an already-owned form, registered `FormKitProvider` and
`FormKitLazyProvider` factories now carry an explicit lexical options scope;
see [NESTED-PROVIDERS.md](NESTED-PROVIDERS.md). They create no second form or Core
container. This does not make Vue/React component objects portable.

A supplied `config.rootConfig` is retained by identity. Its locale/classes and
notified changes remain shared rather than being wrapped in a second root. This
matches installed React2.5 normalization. The installed Vue2.5 provider wraps an
already-normalized root in the focused fixture and loses its initial locale/classes;
that difference is recorded, not silently described as identical behavior.

Validation: `application-config-test.mjs` covers module forms, pending/rejection,
cancellation/supersession, inheritance/shared updates, raw pipelines, View factory
and Region ownership. `lazy-provider-upstream.mjs react|vue` exercises actual
installed providers. `application-root-config-test.mjs adapter|react|vue` records
the supplied-root contract and reference difference. These are focused DOM/Core
checks and do not establish browser or performance parity.

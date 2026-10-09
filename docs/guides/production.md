# Build and deploy an application

Deploy the application bundle with its configured providers and verify it through the server that will serve users. Marionette manages UI ownership and lifecycle; your bundler and server provide the build and delivery boundaries.

## Keep installed packages coherent

These docs target **5.0.0**. Follow the [quick start](../quick-start.md) to install matching package versions; keep the lockfile and use the documentation bundled with that installation. Verify your application against that exact installation before deployment.

Use named ESM imports from `marionette` and the documented adapter subpaths. Build against installed packages rather than repository source aliases. Include the template engine required by the chosen adapter. Choose observable data and API access through [setup](../integrations/setup.md).

Configure providers before constructing consumers. A shared setup module suits one class family; class setters such as `View.extend(...).setDomApi(LitDomApi)` suit a configured subclass. Configure CollectionView and its child View classes when both consume that adapter. Use an isolated runtime when independently configured features coexist. [Runtime configuration](../api/runtime.md) explains these scopes; changing providers on live instances does not rebuild them.

## Build the browser artifact

In the quick-start project, run `npm run build` and deploy the resulting `dist` directory. Preview that output locally with `npx vite preview`; Vite's preview server is for local verification. Configure the bundler's public base when serving from a subdirectory, and check the emitted asset URLs at that location. See Vite's [deployment guide](https://vite.dev/guide/static-deploy.html) and [public base configuration](https://vite.dev/guide/build.html#public-base-path).

Run the application's lint and TypeScript checks separately from bundling. The [tooling guide](../tooling.md) supplies installed-package configurations. A successful build does not establish readiness, cleanup, or browser interaction behavior; [consumer tests](testing.md) exercise those boundaries.

## Handle startup at its owner

Put required asynchronous readiness in Application `prepareStart`, pass its signal to cancellable requests, and connect the ready UI in synchronous `onStart`. The caller of `start()` handles rejection and decides whether to show an error, offer retry, or end the feature. Retain the Application so the owner can call synchronous `stop()` for reuse or `destroy()` when its lifetime ends.

See the [Application failure contract](../api/application.md#preparation-cancellation-and-failure) for cancellation, partial activation and lifecycle results.

Use [retained restart](retained-restart.md) to repeat preparation while preserving the active page. Create retained shells once and update only the source or child Region that changed. Embedded features follow the [existing UI ownership boundary](existing-ui.md); their host must end the feature before removing its mounting content.

## Serve direct links deliberately

Serve the application and API over HTTPS in production. Relative fetch URLs use the application's origin.

For path-based navigation, serve the application entry for recognized document routes, including direct visits and reloads. Keep asset and API handling separate: a missing JavaScript file or API resource must retain its appropriate error response rather than receiving application HTML. Test an unknown document route according to your chosen server/client not-found policy. Fragment routing does not require a separate server path for each fragment. The [navigation guide](routing.md) covers URL ownership.

Publish an entry document with the assets it references. Choose caching rules that allow clients to obtain a coherent build, and check an upgrade from a previously loaded version as well as a clean visit. Include the deployed base path and API origin in those checks.

## Check the deployed application

Verify a clean load, direct route reload, navigation, missing asset/API responses, failed readiness and retry, and feature removal while preparation is pending. Exercise keyboard interaction and focus in a real browser. Preserve errors with their stack and Marionette diagnostic code so the [installed lookup](../tooling.md#look-up-a-diagnostic) matches the runtime.

The framework's browser test configuration runs Chromium, Firefox and WebKit through Playwright. Its browser transpilation query is `baseline widely available`. Those choices describe the repository's validation and transpilation profile; they do not establish behavior in every browser/device or supply missing browser APIs. Select and test your application's actual browser targets with its renderer, providers and deployed bundle.

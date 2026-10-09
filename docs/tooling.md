# Check and debug an application

Use these checks in the application created by the [quick start](quick-start.md). Marionette includes declarations, an ESLint plugin, and a version-matched diagnostic catalog. They check specific contracts; they do not decide where your application's workflows belong.

## Lint JavaScript

Install the development tools in your application directory:

```sh
npm install --ignore-scripts --save-dev --save-exact eslint@10.11.0 typescript@6.0.3
```

Create `eslint.config.mjs`:

```js
import marionette from 'marionette/eslint';

export default [
  {
    ...marionette.configs.recommended,
    files: ['**/*.js', '**/*.mjs'],
    ignores: ['dist/**', 'node_modules/**']
  }
];
```

The recommended configuration enables `marionette/no-private-framework-members`. It reports recognized access to Marionette internals, such as `view._isRendered`, and directs you toward supported APIs such as `view.isRendered()`. It is a JavaScript analysis rule, not a complete type checker: indirect values or dynamic property names can prevent it from identifying a framework member. It does not prohibit your own private fields or determine whether a service call belongs in a View.

For example, this `interaction.js` uses public APIs and keeps a local interaction in its View:

```js
import { View } from 'marionette';

export const ToggleView = View.extend({
  events: { 'click button': 'toggle' },
  toggle() {
    this.trigger('toggle', this);
  }
});
```

Run the rule against your JavaScript:

```sh
npx eslint . --max-warnings=0
```

Add other ESLint rules according to your application's needs. TypeScript linting also needs a TypeScript parser and configuration; the configuration above covers JavaScript only.

## Check TypeScript against the installed package

For a browser application built by Vite or another bundler, create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": false,
    "types": []
  },
  "include": ["*.ts"]
}
```

Adjust `include` to match your source directories. Node applications need configuration suited to their module system. The package supplies its own declarations; do not install declarations for Marionette v4 or alias the package to repository source files.

This `screen.ts` checks a Region and View against the installed declarations:

```ts
import type { RegionInstance, ViewInstance } from 'marionette';

export function showScreen(region: RegionInstance, view: ViewInstance): void {
  region.show(view);
}
```

Use instance types such as `RegionInstance` and `ViewInstance` in annotations; the `Region` and `View` exports are constructors. Run the compiler independently of the bundler:

```sh
npx tsc -p tsconfig.json
```

For example, passing a string to `region.show()` produces a type error because that method expects a View. A successful build may only mean that TypeScript was transformed into JavaScript; run the type check explicitly. Types do not prove that a selector exists, an event happens at the intended time, or a workflow has the right owner.

For typed initialization, DOM handlers, state and lifecycle results, follow [Use TypeScript](guides/typescript.md).

## Look up a diagnostic

When an error includes a code such as `MN0003`, use the lookup helper shipped with the same package:

```sh
node node_modules/marionette/skills/marionette/scripts/docs.mjs --diagnostic MN0003
```

The result includes the catalog explanation and any documented recovery guidance. Use the code from the actual error, preserve its stack trace, and read the associated API contract before changing the code. The [agent guide](agents.md#local-contract-lookup) explains lookup when a package lives in an external store.

For runnable interaction, replacement, readiness and teardown tests, follow [Test an application](guides/testing.md).

## Debug the failing boundary

1. Identify the installed version and configured renderer or data provider. A DOM, template, or persistence problem may belong to that integration.
2. Reproduce the operation with the smallest relevant owner: a local edit in its View, a replacement in its Region, or readiness and shared coordination in its Application.
3. Inspect public state such as `view.isRendered()`, `view.isAttached()`, and `view.isDestroyed()`. Observe lifecycle events instead of reading internal flags. For asynchronous operations, retain and inspect the returned Promise so a failure remains visible.
4. Test the user-visible outcome and teardown. For a replaced panel, verify that the old panel is removed and its owned subscriptions stop reacting. For a failed start, verify the intended error UI and retry behavior.

Use browser developer tools for the actual DOM, network, and event timing. Lint, declarations, and diagnostic lookup complement those checks. None measures architectural quality or proves that an agent understood the documentation; use the [ownership guide](architecture.md) and review observable behavior for that.

## Agent installation

The installed package includes `skills/marionette`. The skill routes to that application's installed docs and includes an offline lookup helper. Reading `SKILL.md` directly also works.

For a Codex project, copy the complete folder to `.agents/skills/marionette` in your application and invoke `$marionette`. Keep the scripts with the entrypoint. For other clients, use their documented skill location and invocation support. See [Codex skill installation](https://learn.chatgpt.com/docs/build-skills).

The `marionette` plugin is distributed through repository marketplaces, separately from the npm package. Its version tracks the loader and connection, independently of the framework. The plugin locates the application's installed package and loads that package's skill; it does not bundle a newer copy of the API instructions. In a Codex client supporting local marketplaces, add a checkout with `codex plugin marketplace add /absolute/path/to/checkout`, then install Marionette using the client's plugin interface. See [OpenAI plugin installation](https://developers.openai.com/plugins/build/plugins). The repository also includes Claude Code and Cursor marketplace manifests.

The loader recognizes `backbone.marionette` 4.x as a v4 installation and identifies older releases separately. Keep existing application work on its v4 contracts. For migration, choose the target v5 release and read that release's [migration guide](guides/migration.md); installing the plugin does not upgrade the application. When both packages are present, select guidance based on the feature's imports.

Choose the copied package skill for local lookup without MCP. The plugin can also use the hosted connection, subject to the identity check below. A release without a packaged skill needs its own documentation or exact source revision.

## Hosted documentation MCP

The plugin's connection is `https://mcp.marionettejs.com/mcp`. Before searching it, read the `marionette://catalog` resource. Compare both `provenance.packageVersion` and `provenance.sourceRevision` with the application's installed package and `docs-manifest.json`. A matching version alone does not establish the same contract, including when the hosted catalog serves a development candidate. Follow the catalog's `requestIdentity` field for required tool arguments. Pass the exact `version`; for a development candidate, also pass the matching `sourceRevision` on search and read calls, including `search_docs`, `search_sections`, and retrieval of their returned IDs. Do not use a latest-version alias.

A reused prerelease version can contain different contracts. A manifest with `sourceDirty: true` includes changes beyond that revision, so its local docs remain authoritative. If either revision is unavailable, the identities differ, or the service is unavailable, use installed Markdown and the local helper. Hosted results do not override the installed artifact's contract. Copying the skill alone requires no hosted connection; disable the bundled server only through your client's supported settings if using the plugin without MCP.

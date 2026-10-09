# Records example

Follow the [records lesson](../../docs/records.md) for the ownership and event flow.

The installed documentation includes this source for reading alongside the lesson. The commands below run from the Marionette repository checkout and use its linked local packages. To create an application from installed packages, start with the [quick start](../../docs/quick-start.md).

Use the repository's pinned [source toolchain](https://github.com/marionettejs/marionette/blob/master/config/release-profile.json)
(Node 24.19.0 and npm 11.17.0). These commands build linked source packages;
the broader [packaged consumer range](../../docs/quick-start.md) does not select
the source build toolchain.

From the repository root:

```sh
npm run check:release-profile
npm ci --ignore-scripts
npm --prefix examples/records ci --ignore-scripts
npm --prefix examples/records run dev
```

Open http://127.0.0.1:5193. For a production build and preview:

```sh
npm --prefix examples/records run build
npm --prefix examples/records run preview
```

Both `dev` and `build` rebuild the linked Marionette packages first. The
`prepare:local` script can also be run independently. It uses the runtime and
TypeScript declaration builds without invoking documentation packaging.

The example imports public package exports. Its dependencies link to this
checkout, so a successful build verifies those local built exports. It does
not verify published tarballs or documentation discovery in an installed package.

## Verify

Stop the preview server first; these checks start their own server from this checkout. From the repository root:

```sh
npx playwright install chromium firefox webkit
npx playwright test --config examples/records/playwright.config.js --workers=3
```

These use the repository’s Playwright dependency. Browser tests exercise the dev server; `build` separately verifies production bundling.

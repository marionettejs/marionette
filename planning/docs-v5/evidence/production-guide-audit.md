# Production guide source audit

Date: 2026-09-30. Public guide: `docs/guides/production.md`.

## Contracts inspected

- `package.json`: version 5.0.0-rc.2; named entry/subpath export map; Node >=24; browser transpilation query.
- `docs/quick-start.md`: installed matching local candidate tarballs, Vite build producing dist.
- `docs/api/runtime.md`: class/family configuration before construction; CollectionView and child configuration; isolated runtimes; no live provider migration.
- `docs/api/application.md#preparation-cancellation-and-failure` and `src/modules/application.ts`: prepareStart readiness and signal; synchronous onStart; boolean lifecycle result; failed start can follow activation; successful stop before error replacement.
- `docs/integrations/setup.md#observable-data-and-api-access`: optional incomplete data layer and separate API/persistence.
- `playwright.config.mjs`, `config/release-profile.json`, `scripts/checks/browser-profile.mjs`: Chromium/Firefox/WebKit projects and locked Baseline transpilation profile. Guide does not turn this into browser support certification.
- Existing routing and UI integration guides: direct URL boundary and host teardown.

## Primary external sources checked

- https://vite.dev/guide/static-deploy.html (2026-09-30): default dist output and preview limited to local verification.
- https://vite.dev/guide/build.html#public-base-path (2026-09-30): base configuration adjusts emitted asset URLs.

## Verification scope

Guide is prose with links to existing executed recipes; no new JS fence or toy service introduced. Run documentation site/link and installed-package discovery checks after parent integrates navigation. A real application production build, deployment, CDN/cache policy, upgrade and direct-link server checks remain consumer work. No deployment or release publication performed.

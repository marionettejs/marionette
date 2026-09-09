# Browser contract matrix

This finite v5 browser inventory closes the platform-specific scope of
[#145](https://github.com/marionettejs/marionette/issues/145). The release profile
pins Chromium, Firefox and WebKit through Playwright; it does not promise an
untested minimum browser version. `config/release-validation.json` enumerates
**46 named cases** and requires each on all three engines, with no skipped or
flaky cases accepted for certification.

| Accepted workflow | Browser evidence | Complementary evidence |
| --- | --- | --- |
| Detached roots and foreign owner documents | `attachment-owner-document.spec.mjs` | Source, distributions and installed attachment fixtures |
| Portable TypeScript starter, Vite code replacement, pending cancellation and authored source maps | `starter-development.spec.mjs` | Relocated candidate kit; npm ci, typecheck, lint, tests and production build |
| Removal-only collection changes, surviving identity/focus/drafts, explicit roots and optimized rendering | `collection-removal-survivors.spec.mjs`, `data-package.spec.mjs` | Native data and CollectionView public unit suites; installed data and optimized-child fixtures |
| Focus/blur capture, target delegation and undelegation | `event-delegator-focus.spec.mjs` | EventDelegator unit contracts |
| Region replacement, placeholder restoration, detach/adopt and subsequent-owner cleanup | `ownership-boundaries.spec.mjs` | Region and View ownership unit suites |
| Behavior and host delegation across render, direct Behavior destruction and host teardown | `ownership-boundaries.spec.mjs` | Behavior initialization, entity events and cleanup unit suites |
| Native Error identity and usable stack with/without `captureStackTrace` | `ownership-boundaries.spec.mjs` | Diagnostic catalog and error unit contracts |
| Native, jQuery, morphdom and lit-html DOM behavior, stable roots, attach/detach and destruction | `dom-adapters.spec.mjs`, `adapters-package.spec.mjs` | Shared `test/contracts/dom-adapters.js` and installed adapter fixtures |
| Explicit root attribute refresh, null removal and undefined preservation | `view-render-attributes.spec.mjs` | Root attribute unit and installed package contracts |
| Labeled form controls, keyboard/focus behavior and safe text output | `docs-form.spec.mjs`, `beta-starter.spec.mjs` | Executable documentation fixtures; this is not an accessibility audit of a real application |
| Async Application cancellation/restart and borrowed/owned state cleanup | Browser performance lifecycle/state workloads | Held-promise public unit and bounded model-based suites; JS scheduling contracts do not require a duplicate browser test for every transition |

The three added ownership/error cases passed all nine engine combinations on
2026-09-09 using the pinned profile. Full matrix and exact-tarball validation are
reported by the accompanying PR and final release certificate; this page does
not turn a focused test run into a complete release result.

The inventory covers accepted platform-dependent contracts. It does not add
Shadow DOM, SSR/hydration, synchronous recovery, a new resource registry, or
arbitrary third-party widget behavior. Such additions need a consumer contract
before they can create a release gate. Garbage-collection observations are
separate from successful teardown; see [performance evidence](../performance-baselines.md).

# @mnjs/test verification and handoff

## Native Cypress example correction — 2026-10-13

The example now follows app-frontend's native container and awaited teardown
pattern, using `@cypress/mount-utils` 4.0.0 and the public custom dev-server
function from `@cypress/vite-dev-server` 8.0.0. Vue and `@cypress/vue` were removed
from its manifest and lock. Helper runtime source and package exports are unchanged;
`cy.mountMarionette` remains an example command registered by the linked support
file, not a package export. The updated package README changes the tarball hash;
the artifact hash in the older record below describes its historical README.

On the correction's working patch, full build/declaration checks and lint passed.
All 30 helper tests passed with 100% coverage: 38/38 lines, 22/22 branches,
13/13 functions and 48/48 statements. The isolated packed consumer passed ten
stages, including ESM/CJS imports/runtime, strict types, four JSDOM cases,
four Vitest Browser cases and three Playwright gallery cases using existing system
Chromium 154.0.8037.57. Configuration import and a static Vite support-module build
passed with no Vue modules. Independent source/lock/ownership review accepted the
correction. These are distinct from Cypress execution: Cypress remains held, and
its updated component specs have not been run. No binary download or alternate
runner simulation was used to claim a Cypress result.

## Earlier verified checkpoints

The record below is preserved source-owner evidence from the old environment.
Current canonical verification on 2026-10-12 passed 2,144 tests across 147 files,
with both helper modules at 100% in all four coverage metrics. Build, types,
lint, public-test, source and distribution checks passed. The strengthened
isolated consumer passed ten stages, including four JSDOM cases, four Vitest
Browser cases and three Playwright gallery cases. It records exact source and
artifact hashes rather than attributing uncommitted bytes to the baseline HEAD.
The helper tarball still matches the transferred artifact SHA-256
`ae6c70a58ce6f1766fe9cdbd3ba8900111a928e2237d9e3c8fcdf72aa6889442`.
System Chromium 154.0.8037.57 supplies supplemental evidence; the pinned browser
installer was blocked by HTTP 403 and Cypress was not executed. Actual native
FormKit dogfooding and independently replayed regressions are documented in the
[current FormKit verification record](../formkit-test-package/VERIFICATION.md).

Verified on 2026-10-11 in the authorized mounted `marionette-develop` checkout.
Branch: `feat/mnjs-test-initial`. Implementation commit:
`760124c6742fcf5ac4e77bde8727abc3017a6b19`; strengthened tests and final
consumer verifier: `044cba0e7f72aaab2975870504bed86b5e9d53c1`.
A subsequent evidence-only commit adds this report. No push, PR, package
publication, merge, deployment or customer-forms migration was performed.

The package is an unpublished `@mnjs/test@0.1.0` development dependency. Core
Marionette has no new runtime dependency or production-path cost. Its API comprises
`mountView`, `mountApplication`, and `createTestScope`. The mounts expose actual
instances and DOM, use real Regions, preserve borrowed sources/destinations, and
surface disposal errors. Initial Application readiness is its native start Promise;
there is no universal settled Promise or leak-detection claim.

## Canonical contracts and environment

Archived source base: `89adc9158d447bf13932841a39833037e97ee544` (`5.0.0-rc.2`).
Canonical stable source: `0f2284ad4bbfe8c82ce82714471697a68c2acaeb` (`5.0.0`).
Fetched the exact canonical commit. Relevant Application, Region, View, destroy,
runtime construction and ownership source was byte-identical; stable Application
docs supplied the improved required-child cancellation policy. The framework
checkout was preserved, rather than relabeled as a stable checkout.

Toolchain: Node **24.19.0**, npm **11.17.0**, TypeScript **6.0.3**, Vitest **5.0.3**.
Source release-profile validation passed. Some early nested npm commands used the
host default 11.9.0; final build/verification used the pinned npm on PATH.

Installed integration fixture: published Marionette **5.0.0**, Playwright/Test
**1.63.0**, Testing Library DOM **10.4.1**, user-event **14.6.1**, JSDOM **30.1.1**,
Vitest Browser Playwright **5.0.3**. Playwright's installed types and implementation
were checked for the current built-in gallery `mount()` API before using it.

## Passing checks

| Check | Executed evidence |
| --- | --- |
| `npm run build` | Full core/optional-package build, source types, generated ESM/CJS declarations, existing type consumers and docs packaging passed. |
| `npm run lint` / `npm run check:public-tests` | Complete repository lint and public-test boundary passed. |
| `npm run coverage` | **147 files / 2,137 tests passed**, including **30 helper tests**. Original coverage thresholds and exceptions are unchanged. Each helper source file has 100% statement/branch/function/line coverage; existing reviewed core gaps remain reported. |
| `npm run test:source` / `npm run test:dist` | Existing production graph and built-distribution checks passed. |
| Relevant core Chromium suites | **13 tests passed** for ownership, Application host binding/prepared roots/children and owner-document attachment. These tests remain independent of `@mnjs/test`. |
| Isolated tarball consumer | Nine stages passed: pack, extract, locked install, exact versions, ESM/CJS import without DOM, runtime/types, JSDOM, Vitest browser and Playwright gallery. |
| ESM/CJS runtime and declarations | Both runtime forms passed using stable Marionette. Both TypeScript module forms preserve subtype inference and reject caller-supplied startup Regions. No skipLibCheck/source aliases. |
| Realistic forms | Same four tests passed in JSDOM and Chromium Vitest Browser Mode: semantic queries, validation/focus, keyboard submission, save failure/retry, readiness/cancellation and teardown during pending save. |
| Playwright gallery | Three Chromium tests passed: state-preserving update, actual keyboard submission and unknown-story rejection; unmount removes UI. |
| Existing docs | Routing/export/reference examples/build/link/package stages passed. Final installed-doc check passed with 55 examples, 20 type fixtures and 15 TypeScript examples. |

The first core browser/docs-installed attempts failed because npm's default cache
was outside the writable workspace. Retried with `NPM_CONFIG_CACHE=/workspace/.npm-cache`;
those checks then passed. Chromium was downloaded and ran. Firefox/WebKit integration
runs were not executed; WebKit installation reported missing host libraries including
GTK4, Graphene, HarfBuzz ICU, Manette, Hyphen and GLESv2.

## Independent review and regression evidence

Architecture review was read-only in a separate agent (`contract_review`, inherited
model configuration). Implementation review used an independently configured
`gpt-6-astra` reviewer, high reasoning, fresh context. Test-quality review used an
independently configured `gpt-6.1-sol` reviewer, high reasoning, fresh context.
These are the accepted requested tool configurations; agents do not introspect
backend model identifiers. Reviews bound to the initial implementation commit and
recorded source/test hashes. Final helper production source is unchanged from that
reviewed implementation; strengthened tests are in `044cba0e`.

Implementation findings were reproduced before fixing:

- Microtask-deferred cleanup let immediately ready startup commit before cancellation.
  The regression expected `ready === false`, observed `true`, and now passes because
  cleanup begins disposal synchronously with its Promise already published.
- Separately registered Application/Region disposers repeated a failing Region
  `before:empty` callback. The regression observed two errors/attempts, expected one,
  and now passes with dependent teardown grouped. Core failures still abort core work.
- `Omit<ApplicationStartOptions, 'region'>` did not exclude an indexed Region option.
  Reconstructed pre-fix declarations fail both negative consumers with unused
  `@ts-expect-error`; current declarations pass using `region?: never`.

Saved isolated pre-fix replays reproduce the first two failures against the current
30-test suite. The main checkout's production source was not mutated.

The dedicated test-quality reviewer found five assertion gaps using six controlled
variants. **All original 26 tests stayed green for those variants**. Strengthened
assertions now reject every variant at its intended public contract:

| Incorrect behavior | Sensitive assertion |
| --- | --- |
| Owned cleanup method loses its receiver | Resource's observable connection state changes through its actual method. |
| Initial show options are dropped | Exact forwarded options and actual Region/View identity. |
| Initial replacement option becomes persistent | A subsequent ordinary `region.show()` restores normal slot mounting. |
| Borrowed siblings are replaced by clones | Actual sibling identity and its surviving event listener. |
| Borrowed container is reparented when attachTo is also supplied | Host remains under its original parent; alternative destination stays empty. |
| Errors are cloned, losing their payloads | Original TypeError/non-Error identity, order and same aggregate rejection on repeated cleanup. |

The reviewer independently reran all 30 helper tests, the isolated variants and the
four stable-v5 JSDOM form examples. This is bounded assertion-sensitivity evidence,
not a comprehensive mutation score. Saved summaries, hashes and failing/passing
logs accompany the artifact handoff.

## Remaining limits and blockers

- **Cypress component execution is blocked.** npm installation and supported Vue/Vite
  dependency configuration resolve, but both official binary endpoints
  `download.cypress.io` and `cdn.cypress.io` return proxy HTTP **403**. `cypress verify`
  and the actual component command report the absent **16.1.1** executable. No Cypress
  pass is claimed. Independent source review found repeated mounts losing the prior
  Marionette handle; the command now awaits prior cleanup and an actual repeated-mount
  Cypress regression is present. Its failing-before/passing-after runtime execution
  remains unproven because of this blocker. No substitute runner was called Cypress.
- **Actual FormKit dogfooding remains pending.** Owner task
  `01a12919-08a1-7710-a1ab-11824741002f` is in another container. This environment has no
  callable cross-task messaging tool. Dogfooding is already authorized; the missing
  input is the owner's current tested artifact, checksum and revision. Library
  title searches and the recent-file listing found no current FormKit package.
  Its branch and work were not modified. Local purpose-built forms do not count
  as FormKit.
- Cypress E2E, Jest, Node-runner lifecycle integration, MSW, axe-core, visual baselines,
  additional browser engines and the consumer Node-LTS matrix are compatibility
  guidance or unexecuted checks. Installed ESM/CJS Node smoke is verified separately.
- Package registry publication, a clean stable-source rebuild/certification, hosted
  website delivery and cross-container receipt are not established by local checks.

## Supported artifacts

The final handoff directory is `/workspace/mnjs-test-artifacts`:

- `mnjs-test-0.1.0.tgz`: exact compiled package tested in isolation.
- `report.json`: artifact SHA-256, source revision, fixture-lock hash and passing stages.
- `mnjs-test-source.bundle`: the isolated branch commits for applying in another checkout.
- `mnjs-test-source.patch`: textual branch changes from the authorized archived base.
- `mnjs-test-examples.tar.gz`: locked executable fixtures plus the consumer verifier.
- `reviews/` and logs: independent test-review and before/after evidence.
- `SHA256SUMS`: handoff file checksums.

Local artifact validation establishes byte integrity and consumption here. A recipient
must transfer these files through an available supported handoff mechanism; local paths
alone do not establish receipt in another container. FormKit handoff requires the
owner's current tested artifact before integration claims can be made.

### Library transfer attempt

The Library batch upload helper first failed during hosted-app tool discovery,
before reserving any session. Its unchanged workflow was then connected through a
local bridge to the available Library app tools. Preparation succeeded for the
package, source bundle, examples, evidence archive and this report. The app returned
signed storage URLs rather than already-transferred workspace paths. The returned
`sdmntprwestus.oaiusercontent.com` byte-transfer endpoint failed with
`Tunnel connection failed: 403 Forbidden` from the environment proxy. Pending
transfers were stopped; all five helper results are `transfer_failed`. No
finalization was called and no successful Library file ID or recipient receipt is
claimed. No alternative endpoint or mirror was used. Resume the authorized
FormKit integration when a supported artifact transfer becomes available.

Cypress's exact denied official URLs are:

- `https://download.cypress.io/desktop/16.1.1?platform=linux&arch=x64`
- `https://cdn.cypress.io/desktop/16.1.1/linux-x64/cypress.zip`

A search of `/workspace/.cache`, `/home/agent/.cache`, `/opt`, `/usr/local` and
`/tmp` found no existing Cypress executable. The installed Cypress npm package
does not supply the missing binary. Installed Chromium is usable and passed the
other browser checks; it cannot substitute for the Cypress runner.

### Verified FormKit handoff reference; download blocked

The coordinator subsequently supplied Library artifact
`libfile_fdf1b801c2888191bb2e374cb3e39946`, named
`mnjs-formkit-9849a57b-handoff.zip`, with expected ZIP SHA-256
`8dadeda58bf704f1e5a55d99b353ed5e89e3bd60963872d3491f2b2f36e326a0`.
The resolved-reference Library materialization action succeeded and returned a
signed download transfer. The current bundled file-transfer helper was invoked
once with that complete transfer. It exited 1 with
`library file transfer failed: download failed`, leaving no local ZIP. The
helper did not expose an HTTP status or a more specific cause; this is not
classified as the earlier upload 403. No alternate route or retry was attempted.

Consequently the expected ZIP checksum, readable archive, contained development
tarball and actual FormKit public APIs could not be verified in this executor.
Real FormKit rendering, input/validation, asynchronous submission/cancellation/reset,
destruction and controlled-variant assertion sensitivity remain unexecuted.
The independent FormKit/framework tests were untouched; Pro remains outside this
dogfood slice. Resume from this exact artifact reference when supported local
materialization succeeds.

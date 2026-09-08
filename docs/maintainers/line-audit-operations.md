# Operations documentation line audit

Audited on 2026-09-08 in the documentation worktree based on
`5bb66c7f1559ae3902db06847a378e9e5c3907a7`, including existing working changes.
This is a finite review of the 24 assigned files below. Every line was read;
initially truncated output was reread in smaller sections. Generated evidence pages
are outside this assignment. The ranges below describe the corrected files at the time of this audit, before
later publication edits; they do not assert line coverage for subsequent revisions.

## Coverage

| File | Lines reviewed | Evidence and review focus |
| --- | --- | --- |
| `docs/agent-tools.md` | 1–114 | skills/marionette/scripts/docs.mjs; scripts/docs/package.mjs; package exports; Context7 primary setup/ownership docs |
| `docs/agents.md` | 1–130 | src/modules/application.ts; src/mixins/state.ts; src/create-marionette.ts; source/data and lifecycle references |
| `docs/application-agent-template.md` | 1–58 | application instruction policy; package provenance and independent integration contracts |
| `docs/diagnostic-catalog.md` | 1–146 | catalog schema and loader; packages/utils/src/error.ts; source MN0020 reproduction |
| `docs/forms-and-accessibility.md` | 1–154 | complete example read; docs-application-guides fixture assertions; WAI notification guidance |
| `docs/installation.md` | 1–265 | root/adapters/data/utils/radio package manifests; runtime exports; native DomApi and adapters |
| `docs/migration-from-v4.md` | 1–163 | all ledger rows read; current class/mixin/helper implementations; source copying and detach reproductions |
| `docs/performance-baselines.md` | 1–74 | config/performance.json; CI base/candidate size and timing lanes; bundle-size measurement graph checks |
| `docs/production-and-performance.md` | 1–83 | collection rendering/ownership contracts; DomApi and lifecycle monitoring; MDN caching guidance |
| `docs/release-profile.md` | 1–96 | config/release-profile.json; .nvmrc; .npmrc; CI workflow; live profile check commands |
| `docs/release-promotion.md` | 1–132 | config/release-promotion.json; release workflow and build-artifact.mjs; npm trusted-publisher requirements |
| `docs/routing.md` | 1–174 | complete navigation/controller/router snippets; Application operation semantics; docs-routing fixture assertions |
| `docs/security.md` | 1–91 | default template and DomApi HTML sinks; complete text/URL helpers; OWASP primary guidance |
| `docs/task-recipes.md` | 1–118 | complete widget example; monitored dom:refresh/dom:remove behavior; fixture ownership assertions |
| `docs/testing.md` | 1–103 | complete Node/jsdom test; package scripts; docs-application-guides extraction and subprocess execution |
| `docs/typescript.md` | 1–126 | public View/DelegatedEvent types; actual TypeScript fixture manifests; both complete TypeScript fences |
| `readme.md` | 1–115 | root exports and package files; installed docs packaging; current prerelease boundary |
| `upgradeGuide.md` | 1–475 | all migration sections; source helpers/adapters/lifecycle; imperative request cleanup and detach reproductions |
| `CONTRIBUTING.md` | 1–153 | package scripts, source layout, fixture runner and release policy; runtime diagnostic policy |
| `AGENTS.md` | 1–25 | library-maintainer scope and links; declared production/static cost and authorization rules |
| `docs/maintainers/readme.md` | 1–100 | all source/test starting paths and command scripts; fixture runner arguments and pretest/build checks |
| `docs/maintainers/types.md` | 1–173 | authored implementation types; declaration generator; per-package tsconfigs and installed type-fixture compiler versions |
| `docs/maintainers/documentation.md` | 1–169 | export/packaging and guidance ownership; Context7 source rules; static hosting policy |
| `docs-site/README.md` | 1–139 | export/package/build inputs; CNAME and gated Pages workflow; primary hosting and Context7 sources |

## Corrections

- The diagnostic example now disables the host template so the missing Region
  operation actually reaches `MN0020`, rather than failing on an undefined template.
- Migration copying rules now include own enumerable symbols for native spreads
  in extension definitions, options, template context, and DomApi overlays.
  The string-only `mergeOptions` rule remains explicit.
- Native and jQuery detachment both preserve handlers/data on retained nodes.
  Removed the false claim that jQuery is required for this retention and described
  the actual distinction for jQuery content replacement.
- Imperative `bindRequests` on arbitrary channels requires explicit `unbindRequests`
  cleanup. Configured `radioRequests` remains separately managed by its owner.
- Type-maintenance notes now use `DomApi<Query, Content>`, application-owned `$el`,
  the current `MarionetteExtend.call` interface, correct declaration dependencies,
  and the actual TypeScript 6/7 fixture matrix rather than obsolete 4.6 claims.
- The release profile now identifies the enabled three-engine browser CI lane.
  Its manifest check is kept distinct from executing browser tests.
- Publication guidance distinguishes the catalog diagnostic domain/routes from
  the runtime error URL, which still uses the legacy versioned prefix.
- Clarified packaged-document availability for earlier alphas, optional jQuery
  selection, independent Backbone state setup, and a duplicated migration phrase.
- Replaced the Read the Docs pricing citation with its primary platform-choice
  page, which directly supports the Community hosting and advertising claim.

## Executed validation

- `npm run check:release-profile`: passed, Node 24.19.0 / npm 11.17.0.
- `npm run check:browser-profile`: passed, Playwright 1.62.1 / 128 locked Baseline targets.
- `npm run check:diagnostics`: passed, 39 catalog entries.
- Four `node --input-type=module` source probes passed:
  1. An unconfigured host template throws TypeError before missing-Region lookup;
     `template: false` reaches a `MarionetteError` with code `MN0020`.
  2. Both native and jQuery `detachContents` remove children while a retained button
     keeps native listeners, jQuery listeners, and jQuery data.
  3. Extension definitions, options, template context, and DomApi overlays retain
     own enumerable symbols; `mergeOptions` skips symbol keys.
  4. An imperative request reply survives ordinary owner destruction until
     `unbindRequests(channel)` removes it.
- `npm view marionette@5.0.0-alpha.2 version gitHead --json` returned the alpha and
  source `53da4e7215e3ec721523407e384d142ef41a8e53`, older than this worktree base.
  The local `v5.0.0-alpha.2` tag also exists; remote target occupancy was not changed.
- `git diff --check`: passed before recording this report.

## External source checks

Read-only primary-source checks confirmed the quoted service and platform boundaries:

- [Cloudflare static pricing](https://developers.cloudflare.com/pages/functions/pricing/)
  and [limits](https://developers.cloudflare.com/pages/platform/limits/).
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- [Read the Docs platform choices](https://about.readthedocs.com/choosing-a-platform/).
- [Context7 source configuration](https://context7.com/docs/library-owners),
  [ownership](https://context7.com/docs/howto/claiming-libraries), and
  [plans](https://context7.com/plans).
- [WAI notifications](https://www.w3.org/WAI/tutorials/forms/notifications/),
  [OWASP DOM XSS](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html),
  and [CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
  [jQuery detach](https://api.jquery.com/detach/), and
  [MDN caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

## Limits and follow-up boundary

This pass did not modify runtime code, deploy, publish, enable billing, or change
service configuration. The legacy runtime error URL is a publication prerequisite:
align its destination and the served diagnostic domain in a separately reviewed
change once publication is authorized. This audit corrects the documentation claim
without implying that live diagnostic URLs have been repaired.

The form, widget, routing, testing, and TypeScript examples were read against their
fixture code; this subtask did not rerun the complete packed-fixture suite or build.
The coordinating audit runs those once after edits freeze. Source probes do not
establish the final packed artifact or a real browser/accessibility result.
Historical v4 descriptions were read for migration consistency; this was not a
fresh execution of every v4 behavior against the released v4 package.
The website prototype claims and generated links require the coordinating website
and docs checks; no live publication or account-specific free-plan setting was inferred.
Full application tests, screen-reader review, release-host runs, and the scored
agent benchmark remain outside this documentation subtask.

## Current-base addendum

After the worktree advanced to upstream `2b5fde97` on 2026-09-08, a bounded
follow-up inspected the complete Region/data runtime delta from `5bb66c7f`, its
changed lifecycle assertions and type contracts, and consequential claims in the
migration ledger, upgrade guide, operations, agent, and application task guides.
The auto-merged migration rows correctly distinguish destroyed Regions from
destruction in progress: `empty` and `reset` remain usable during cleanup, and
`isDestroyed()` becomes true after reset, before the final destroy event.

The new native data rules preserve supplied Model identity, use exact-member/id/cid
lookup precedence, resolve bulk removals against one snapshot, and make attributes
and conversions partial in the types. The assigned guides do not promise the
superseded instance conversion, lookup ordering, or complete attribute shape;
their existing ownership, cancellation, and retained-row advice remains applicable.
No further normative edits were needed in this follow-up. Its source review does
not extend the earlier test results to the new base; final tests are coordinated
separately. Core Region references and native data references are covered by their
respective current-base audits.

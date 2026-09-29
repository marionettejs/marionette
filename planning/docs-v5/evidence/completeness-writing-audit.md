# Public documentation writing and agent-use audit

Date: 2026-09-30

Scope: documentation index, agent routes, architecture, task guides, tooling, llms discovery file, and module declaration examples. This is a source/content audit, not a model-effectiveness trial.

## Changes made

Changed JSDoc examples in `src/modules/view.ts` and `src/modules/collection-view.ts`:

- Removed two inline `escapeHtml` helpers.
- Used the existing Lit adapter with class-scoped configuration and ordinary text expressions.
- Kept the original teaching goals: named Region composition and repeated child ownership.
- Added native button `type="button"` in the row example.

Added one prose sentence to the retained-refresh authority section: an external host must cancel/destroy its feature when removing its mount, with a link to existing UI. No runtime, declaration signatures, guide fences, or shared discovery files changed. Source-comment delivery requires declaration rebuild and package preparation.

Both extracted JSDoc examples passed local public-export/JSDOM execution checks. Those checks rendered normal and HTML-like text, verified child replacement/destruction, and checked row selection and final owner cleanup. Focused ESLint passed for both changed source files. These checks do not establish installed-artifact delivery or reader outcomes.

## Framework-wide direction

The current corpus supports independent task guidance. Installation is a minimal View/Region; local editing, hosting, controls, and lists keep genuinely local interactions in Views. Readiness and shared lifetimes use Applications. Navigation explains why its Application owns a browser subscription and stable shell. Retained refresh distinguishes ongoing request policy from framework start/stop results. These choices match the architecture's responsibility table and avoid a blanket rule based on the mere presence of async code.

The records example is optional in the index, agent workflow, and llms paths. None of the reviewed task guides requires that example's classes or endpoint. The newer independent examples cover source, DOM, lifecycle, and host boundaries rather than repeating one feature's implementation.

`@mnjs/data` is repeatedly labeled optional/incomplete, including migration, local editing, lists, TypeScript, production, architecture, and agent guidance. Migration appropriately permits keeping existing Backbone persistence without presenting it as the default for new code. No reviewed guide assumes native Model.save.

The guide examples use direct APIs and controlled scope. Retained refresh's request identity function expresses an actual freshness policy; existing UI's mount function expresses the host boundary. Neither is an example-only correctness utility. Widget disposal covers real connected-element and direct-destruction contracts. Avoid expanding these into generalized framework helpers.

## Discovery recommendations for parent

1. The agent row “Share observable data and state” currently routes to @mnjs/data first. Consider linking the state/provider contract before the optional package so a user with another data solution reaches the right boundary immediately. Keep native-package lookup reachable in that row.
2. The index's Common tasks section has blank gaps among groups without headings. Remove the extra gaps for a single concise task list, or group only if readers need meaningful categories. This is minor presentation, not an architectural issue.
3. README currently sends every new reader through install -> architecture -> task. Agent guidance already starts from the task. Consider keeping install as a clear first-time route while making task lookup equally immediate for an existing installation; avoid adding another onboarding page.

None of these requires new pages or another docs tooling layer. The llms file and agent table currently expose every added task guide, and links route to exact references for method details.

## Remaining content questions

- Production covers build/deploy boundaries but no practical HMR teardown or source-map recipe. This is a remaining development ergonomics gap, not a reason to weaken current lifecycle teaching. Add only when a specific supported consumer build setup can be verified.
- Accessibility guidance explicitly limits its browser evidence and does not claim conformance. TypeScript guidance separates shape checking from event delivery and response validation. Keep those limits; avoid making the caveat prose longer than the useful action.
- The corpus still needs fair reader-effectiveness evidence. More executable fences and passing browser checks establish technical correctness for examples, not discovery quality or unseen-task transfer. Use a frozen runtime and docs comparison for those claims; do not rewrite to benchmark prompts.

## Verification and change accounting

- Markdown JS/TS fence count changes: zero.
- Parent assertion/harness changes required by this audit: none.
- JSDoc @example count: remains two; content changed.
- Two source-comment files and one guide prose clarification, no executable-code or type-shape change.
- Declaration build required: yes, for editor-visible emitted comments.
- Local focused lint: passed.
- Extracted public-export/JSDOM example checks: two passed.

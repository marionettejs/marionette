Publication note: referenced browser/preflight.html and evidence/browser-preflight logs/profile are local-only, omitted from this branch. browser/page.mjs is source, not verified rendered evidence.

# Experiment checkpoint

Isolated parallel work, existing adapter unaffected. No PR, merge, release or deployment.

- Runnable constrained Marionette View/Region core with FormKit Core/validation, section observer cache and microtask store.
- MIT notice and explicit limitations included.
- Vue2.5/React2.5/experiment same20/200/400-field structural/input/reset/topology validation checks passed in JSDOM. Stronger checks include all-field reset/value/validation and Core topology, not counts alone.
- Current private303ddfbb source identified by13 matching Git blob identities, isolated and built;20/200/400 same checks pass.
- Independent review found and verified fixes for duplicate IDs, post-destroy topology resurrection and subscriber callbacks after destroy. Final before:render destroy guard is also independently verified at e7c25f21.
- No browser execution, layout/real typing, speed or full feature equivalence is established. Existing cloud browser failure is historical and needs fresh supported preflight; no bypass/security flags used.

Next coherent milestone: add observed/cross-field class fixtures and upstream form/schema behavior before fair browser performance conclusions. Minimal text/group renderer cannot win a comparison against fully featured forms merely by omitting their work.

## Official-form milestone

Core fd68608e replaces group-only root with actual upstream form and text input definitions/features. Original19 checks and7 submit-specific checks pass. Shared invalid/valid submission/reset passes all4 arms at3 fields; shared20-field structural checks pass. Shared tracked sibling-value class fixture passes all4 arms at20 fields. Reference Vue/React arms now use actual FormKitSchema. Independent async/teardown review underway. Minimal context and field renderer still lack general schema, Pro, slots and full prop semantics.

Fresh Chromium preflight failed in this run before any page execution: process_singleton socket() EPERM, exit134; raw logs in evidence/browser-preflight. Sandbox left enabled. No timing samples.

## Conditional-schema and terminal-submission successor

Same actual schema conditional fixture now passes all4 arms: show/hide based on supplied root values, removed Core value, retained toggle input, fresh branch node on re-add, destroy. Experimental schema uses official compile/provide and observer; intentionally supports only named flat text fields and restricted conditionals, rejecting other constructs.

Independent form review found destruction inside raw-submit callback let upstream continuation clone null. Vue reproduces inherited error, React did not in the reviewed case. Experimental owner now cancels only terminal continuations using a private sentinel at its submit boundary, while preserving user synchronous exceptions and asynchronous rejections.5 regressions pass. Frozen core39ab2474 and schema36115e06 await final independent checks. No timing samples.

Final independent checkpoint: SCHEMA-REVIEW.md accepts restricted schema behavior across all4 arms, queued-update cancellation on owner/controller destruction, malformed-expression rejection, and terminal-submit regression correction preserving user errors. Core39ab2474/schema36115e06.200/400 latest official-form/schema-reference correctness runs pass; no browser timing. RUN.md contains reproduction commands. Main adapter and prior review targets unchanged.

## Supported browser discovery

Catalog shows the connected Dot cloud computer and connected Mac only; Mac not used. Saved cloud configurations include marionette and benchmark environments, but no new task/environment was created. Supported managed cloud Chrome is available; attempted own file-based preflight was explicitly rejected by URL policy because only http/https protocols are allowed. Stopped that route; no protocol/security bypass, publication or transfer. Self-contained browser/preflight.html is prepared locally but not rendered/QA-verified. It bundles production dependencies with same Genesis CSS and visible controls; no timed samples collected.

## React-context and official-text-section successor

The hand-coded text markup and stub field context have been replaced. Actual published React2.5 context/store bindings are extracted reproducibly (without React runtime), with documented observer/lifetime adaptations. Official text definition section schema drives wrapper/inner/label/input/help/messages via individually patched compiled bindings. Root form shell/incomplete UI and per-field host remain adapter-owned, and general schema/slots/icons are not supported.

Renderer-only counter evidence for200/400 fields: mount token checks50,400/100,800; expressions23,800/47,600; counted DOM writes5,800/11,600. First Core edit at both sizes:3local context notifications,180token checks,6expression evaluations,5DOM writes,1structural change. These exclude whole Core/observer/snapshot/layout cost and are not browser timing or a speed ranking.

Actual context dispatch/class cache terminal regressions were fixed; extraction and section/context suites pass. Independent section review found bind-bag attrs could overwrite higher-priority explicit schema attrs; corrected rendererd9582314 excludes explicit keys from lower-priority writes/removals, with5regressions. Same-key message updates were independently tested. See SECTION-REVIEW.md and UPSTREAM-BINDINGS-REVIEW.md for exact scope. Browser timing gate remains unchanged, zero samples.

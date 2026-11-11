# Performance evidence: 2026-11-07 frozen candidate

**Historical source checkpoint:** this report measures the pre-compiler candidate, which retained production sanitizer hooks. The 2026-11-08 compiler/runtime changes require new measurements and are not covered by these numbers.

Status: renderer experiments and both application comparisons are complete. The separately labeled lifecycle follow-up passed all 1,100 observations after an unresolved baseline timeout stopped the original lifecycle run. This is not a universal parity claim or a release approval.

## How the comparison was made

Lit 3.3.3 and the fork were frozen and built through equivalent production bundling/minification. The complete Marionette application fixtures use the same Marionette 5.0.1, data, templates and events; only renderer/DOM integration changes. There are separate original-monitoring and lifecycle-enabled application fixtures.

The renderer supplement measures synchronous template/data allocation and rendering, excluding layout/paint and Marionette. It uses paired, balanced order, warmups and 20 independent blocks per browser. The higher-resolution confirmation times 200 operations per batch after 50 warmups. Confidence intervals bootstrap whole paired blocks, not individual inner operations. No observations were removed. The initial runs, attribution experiments and confirmation are separate results, not a selection of favorable samples.

Latest binaries: Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6. One Mac is not representative of every device or supported historical browser.

Application runs use the actual Playwright runner and trace parser from js-framework-benchmark commit ca8715d9ae84916fd24de3a79457d8c328f9b766, on an Apple M2 Pro (12 logical CPUs, 16 GiB) with Node 24.15.0. Ten balanced paired blocks preserve the pinned runner’s effective workload counts and CPU throttling. The shared x16/x2/x8 IDs do not mean those repetitions in this Playwright implementation. Installed Playwright 1.63.0 and yargs 18.1.0 differ from the pinned lock; full deviations, source receipts and hashes are retained. CPU timings exclude memory/startup/transfer benchmarks. Do not compare directly with published Puppeteer scores.

## Completed js-framework-benchmark application comparison

The original-monitoring-off pair completed all 1,100 planned observations over ten paired blocks, with no failures in that mode. These are the pinned Playwright runner's nine CPU workloads, not a reproduction of published default-Puppeteer scores. The same Marionette 5.0.1 application is used in both arms. Times below are arithmetic means in milliseconds; paired changes use geometric means of paired block ratios.

| Workload | Lit mean ms | @mnjs/html mean ms | Paired total-time change | Pointwise 95% CI |
| --- | ---: | ---: | ---: | --- |
| 01_run1k | 40.935 | 40.497 | -1.07% | -1.43% to -0.70% |
| 02_replace1k | 44.349 | 44.605 | +0.58% | -0.32% to +1.47% |
| 03_update10th1k_x16 | 22.003 | 21.953 | -0.23% | -1.80% to +1.68% |
| 04_select1k | 4.752 | 4.754 | +0.04% | -1.60% to +1.50% |
| 05_swap1k | 23.752 | 23.556 | -0.84% | -1.71% to +0.08% |
| 06_remove-one-1k | 18.026 | 17.886 | -0.78% | -1.94% to +0.26% |
| 07_create10k | 444.075 | 442.074 | -0.45% | -1.07% to +0.11% |
| 08_create1k-after1k_x2 | 45.711 | 44.906 | -1.77% | -2.62% to -0.86% |
| 09_clear1k_x8 | 24.841 | 25.183 | +1.40% | -0.91% to +3.89% |

Total-time paired changes range from -1.77% to +1.40%. All nine simultaneous one-sided 95% upper bounds are below the provisional 5% engineering threshold. This is not proof of no slowdown and does not make that threshold user-approved. Script-only replacement has a small positive result: +1.22% (95% CI +0.12% to +2.26%). Script, paint and total time are separate metrics.

The direct DOM API's causal speed gain was not isolated: this comparison evaluates the combined optimized candidate. The application fixture uses Marionette-owned row movement, so it does not erase or test away the separate repeat/moveBefore reversal cost below.

The original lifecycle-enabled study stopped after 69 observations when baseline Lit failed to create its first row after an initialization click. The exact historical cause is unresolved, not an established candidate defect. Those incomplete observations retain no inferential confidence intervals. A separate fixed 100-page diagnostic passed 50 pages per arm and 600 replacement clicks with no page errors/request failures. A fresh, separately labeled ten-block lifecycle comparison completed all 1,100 observations without failure; no old samples were pooled into it. Total-time paired changes range from -2.51% to +0.64%, with all nine simultaneous one-sided 95% upper bounds below 1.6%. Append was +0.58% (pointwise 95% CI +0.04% to +1.15%); clear was -2.51% (-4.77% to -0.59%). The successful diagnostic and follow-up do not explain the original timeout or justify deleting it.

### Completed lifecycle-enabled follow-up

The following total-time table uses the same arithmetic-mean and paired-ratio conventions as the original-monitoring table. These are a separate study, not pooled samples or a causal estimate of lifecycle overhead.

| Workload | Lit mean ms | @mnjs/html mean ms | Paired total-time change | Pointwise 95% CI |
| --- | ---: | ---: | ---: | --- |
| 01_run1k | 42.789 | 42.439 | -0.81% | -1.98% to +0.31% |
| 02_replace1k | 48.528 | 48.518 | -0.02% | -0.50% to +0.47% |
| 03_update10th1k_x16 | 22.432 | 22.213 | -0.97% | -2.75% to +0.98% |
| 04_select1k | 4.750 | 4.692 | -1.22% | -3.11% to +0.78% |
| 05_swap1k | 23.997 | 24.152 | +0.64% | -0.43% to +1.39% |
| 06_remove-one-1k | 18.283 | 18.306 | +0.13% | -0.59% to +0.92% |
| 07_create10k | 468.220 | 468.180 | -0.01% | -0.75% to +0.80% |
| 08_create1k-after1k_x2 | 47.685 | 47.965 | +0.58% | +0.04% to +1.15% |
| 09_clear1k_x8 | 36.275 | 35.367 | -2.51% | -4.77% to -0.59% |

## Higher-resolution Chromium confirmation

Times are median block means in milliseconds per operation. Each list operation uses 1,000 items. Paired changes are geometric means of paired ratios, so they need not equal the ratio of the two aggregate medians. Lower is better.

| Workload | Lit ms | @mnjs/html ms | Paired change | Pointwise 95% CI |
| --- | ---: | ---: | ---: | --- |
| text-update | 0.2427 | 0.2397 | -0.2% | -0.9% to +0.5% |
| property-attribute-update | 0.9195 | 0.9143 | -0.7% | -1.7% to +0.1% |
| nested-update | 0.2605 | 0.2602 | +0.4% | -0.4% to +1.2% |
| nested-noop | 0.1038 | 0.1053 | +3.7% | +1.4% to +6.6% |
| repeat-update | 0.1142 | 0.1140 | -0.1% | -1.6% to +1.5% |
| repeat-swap | 0.0680 | 0.0710 | +1.8% | +0.1% to +3.6% |
| repeat-reverse | 0.4957 | 0.5323 | +7.4% | +6.9% to +8.0% |

Earlier approximately 4–5% text/nested-update differences did not persist with longer batches. A small nested-noop difference remains, with substantial between-block variation. Native reversal remains reliably slower in Chromium: about 0.037 ms per 1,000-item reversal, in exchange for preserving focus, text selection and native element state. Firefox reversal is about +2.3%; WebKit, which uses insertBefore fallback, is about -0.2% in the paired confirmation. Do not describe this as uniformly faster or zero-regression.

The optimized mount run found Chromium +0.8% (95% CI -0.6% to +2.2%), Firefox +2.6% (-0.3% to +5.7%), and WebKit -0.4% (-5.8% to +5.2%). Those intervals include no difference; they do not prove equality.

The analysis files also show a provisional 5% engineering bound. That is not a user-approved tolerance and does not replace the user's no-slowdown goal.

## What the attribution experiments changed

- Removed production foreign-value misuse checks after isolating their measurable nested/no-op cost. Development diagnostics and namespaced engine boundaries remain.
- Kept sanitizer hooks but avoided their identity-call/empty-text-node work until a policy is installed.
- Matched upstream assignment-style class-field emission, eliminating extra type-only fields.
- Kept state-preserving moveBefore for content, while moving only the renderer's two empty boundary comments with insertBefore and checking native support once per range. Disabling native moves entirely was not adopted merely to improve a score.
- Integrated the Marionette DOM API directly with its bounded ChildPart. The complete application results evaluate all changes together; they do not isolate the causal gain of this integration.

## Size, a separate measure

| Bundle | Lit raw / gzip / Brotli bytes | @mnjs/html raw / gzip / Brotli bytes |
| --- | ---: | ---: |
| Core exports | 7,144 / 3,108 / 2,810 | 7,636 / 3,330 / 2,977 |
| Core plus repeat | 9,393 / 3,902 / 3,528 | 9,800 / 4,139 / 3,712 |
| Complete original-monitoring Marionette application | 71,174 / 20,629 / 18,451 | 71,339 / 20,647 / 18,470 |
| Complete lifecycle-enabled Marionette application | 71,174 / 20,630 / 18,426 | 71,339 / 20,647 / 18,471 |

Standalone bundles use the same Rollup 4.63.5 and Terser 5.51.2 finishing pipeline, with equivalent html/render/nothing exports and optional repeat; compression uses Node's gzip/Brotli defaults. The complete-application measurements use gzip level 9 and Brotli quality 11. Compare renderer arms within each row, not the two compression setups.
The original prototype was 3,525 core / 4,367 core-plus-repeat gzip bytes. Restored opt-in APIs do not enter the core bundle unless imported. The fork retains production sanitizer capability that upstream production omits. The complete application figure is fixture-specific and must not substitute for the standalone figures.

## Evidence and remaining limits

The following paths describe historical local archives, not evidence included in a clean checkout. Their availability and hashes have not been reverified here. Treat these measurements as historical reports rather than reproducible evidence for the current PR head. Current package and browser checks produce new ignored evidence files, uploaded by the HTML workflow.

Machine-readable renderer and application summaries, correctness results and source hashes are in evidence/improvements-2026-11-07/. Full raw samples, frozen fixtures, harness provenance and the interrupted original lifecycle study are retained in the sibling `../mnjs-html-benchmark-evidence-2026-11-07/` directory. Its `retention-manifest.json` verifies every file’s SHA256/byte count and every symlink target before/after retention. The optimized study’s `RESULTS.md` includes full total/script/paint tables. See the local evidence index for specific paths. Clean production-only dependency installation passed offline; the full development npm ci remains blocked by registry access and a missing cached archive.

The application comparisons support practical similarity on this machine and workload, with small positive and negative differences. They do not prove the absolute no-slowdown goal: the focused repeat reversal and nested-noop results remain above Lit, and a finite suite cannot establish universal parity. State-preserving native movement was retained as useful functionality rather than removed to improve a benchmark. No benchmark-specific heuristics were added.

# FormKit native invalidation checkpoint (2026-11-05)

Executable source: `83f236c6d8074769a1e950799fc30cd65db01d5c` on `codex/formkit-master-integration-20261103`; source-tree SHA-256 `5cbbff1464a249612c9fae073b117ee2ef10e28c05555ea0338c1ea5956531b3`. Baseline: `85f6e5389c8c0734087b62e9273c4288892e1cc3`. The final candidate bundle SHA-256 is `e58fb880a2883d04c21a11a8d18b3d8e61d0faed1b35e3f9c29f0c6006a9e929`. This note records a bounded adapter improvement, not a release or parity claim.

Native projections now reuse an input render only when its captured context, configuration inheritance, ownership, slots, attributes and pending work remain provably independent of the update. Root count notifications remain public; the flat native schema skips root reconciliation only after proving its rendered dependencies unchanged. Dynamic schemas, custom getters/hooks and uncertain ownership keep the full path. An ignored submit control retains the form's configuration after Core detaches its value parent; its original configuration ancestry is included in that proof.

Local gates: 2,820 tests passed plus one expected failure under unchanged canonical coverage thresholds; build, lint, API inventory, public-test boundary, packed ESM/CommonJS consumer and declaration checks passed; 19 Chromium journeys passed. The first coverage run timed out in five existing row/lifecycle cases. Both affected files then passed 43/43 in isolation, and the unchanged full replay passed. The cause of the first timeout is unresolved. Independent read-only source/oracle review cleared the frozen candidate; independent real-Pro replay is pending.

Matched Chromium 154 results below are medians in milliseconds from two fresh browser trials per arm and cell, with no warmups. Each form has the same 100 or 200 text fields, blank controlled values, `delay: 0`, and optional live required validation. Every trial checked field-owned messages, description links, values, settlement, edit identity/focus, controlled replacement and reset. Native also checked `aria-invalid`. Vue and React use their official FormKitSchema components at Core-family 2.1.2. Production-minified bundles used corrected Rolldown `transform.define` settings. Browser launch was approved in the cloud with `chromiumSandbox: true`; 32 launch logs contained no sandbox-disabling flag. Kernel namespace/seccomp state was not independently attested.

| Fields / actions | Published native | Candidate native | Vue | React |
| --- | ---: | ---: | ---: | ---: |
| 100 required / no actions | 4,259 | 821 | 682 | 634 |
| 200 required / no actions | 17,061 | 2,465 | 2,211 | 1,349 |
| 200 no validation / no actions | 959 | 932 | 1,168 | 616 |
| 200 required / default actions | 15,328 | 2,014 | 1,288 | 691 |

All 32 final trials completed without page errors or timeouts. Native public `form:state` counts were unchanged between baseline and candidate for each cell (1,101 at 100 required; 2,201 at 200 required; 801 at 200 without validation). An initial logging attempt stopped before any application trial because Chromium did not expose the CDP command-line method without `--enable-automation`; the corrected launch used standard Playwright logging and did not alter browser flags. These two-sample timings are environment-specific. Edits were synthetic input events, not trusted keyboard actions. Real Pro controls, online license validation, other browsers, and host-application acceptance were not tested on this revision. At 200 required fields, the remaining gap is substantial and the performance goal remains open.

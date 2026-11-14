# Visibility checks

Run `node core/validation-visibility-ownership-test.mjs` from the experiment directory for the thirteen declaration/plugin/onNode ownership assertions. It is also included by `core/verify-free.mjs`.

`probe.mjs` runs twelve scenarios against adapter, react or vue (first CLI argument). Its default adapter is the current `core/index.mjs`; `VISIBILITY_CANDIDATE` can select another explicitly verified runtime. `VISIBILITY_REPORT` selects the JSON output. The default output is `<arm>-results.json` in the caller directory. Use an external temporary directory for reports.

`regressions.mjs` reads adapter-proposal-results.json, react-frozen-results.json, vue-frozen-results.json and adapter-frozen-results.json from its caller directory, then performs the seventeen inherited-mode/removal assertions against the current adapter. Generate the first three with the probe's adapter/react/vue arms. The historical adapter-frozen report is preserved as `evidence/visibility-frozen-reference.json`, recorded from the exact aef737b runtime. It is historical before-failure proof, not a current result. `core-inheritance.mjs` separately records the pinned public Core property/config behavior. `ownership-peers.mjs` checks the onNode contract in all three installed bindings.

The branch receipts include fresh before/current/peer runs in the isolated cloud workspace. These are JSDOM/Core checks, not licensed Pro/browser/performance certification. Explicit override removal deliberately restores Core inheritance, differing from pinned React/Vue omission behavior as documented in the current source ledger.

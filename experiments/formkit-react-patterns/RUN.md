# Reproduce functional experiment

Use Node24 and `npm ci --ignore-scripts --cache ./npm-cache`. Exact dependency graph in package-lock.json. No install/global config changes required.

```
node core/test.mjs
node core/regressions.mjs
node core/submit-test.mjs
node core/submit-terminal-test.mjs
node core/schema-test.mjs
node core/sections-test.mjs
node core/precedence-test.mjs
node core/extract-bindings.mjs
for arm in vue react current experiment; do
  node harness/check.mjs "$arm" 20
  node harness/cross-field.mjs "$arm" 20
  node harness/submit.mjs "$arm" 3
  node harness/context-check.mjs "$arm"
  node harness/schema-check.mjs "$arm"
done
```

`harness/check.mjs` accepts200/400; existing logs preserve those correctness-only results. Current adapter is isolated source-built303ddfbb,13 files checked against prior verified Git blob map in current-303ddfbb/provenance.json. Not packed-install certification.

All commands above use JSDOM. They cannot establish browser timing, keyboard/touch/layout, complete accessibility or general FormKit feature parity. Do not rank speed from these runtimes. See PROTOCOL.md for the unexecuted fair browser protocol and scope limitations.

The fresh sandbox-enabled Chromium preflight failed before page execution. Do not add no-sandbox/disable-setuid-sandbox flags or change security settings to make it run.

Renderer-only counters: `node harness/counters.mjs 200` and `400`. These do not measure wall-clock/browser performance or whole Core work.

# Chromium retention evidence — September 9, 2026

The complete report is [report.json](./report.json). It records clean source
`7a61aa8c`, exact runner/workload/profile and built-runtime hashes, Node 24.19.0,
and headless Chromium 153.0.8010.12 on macOS arm64.

Reproduction after building that source:

```sh
node scripts/performance/retention.mjs --output test/tmp/performance/retention.json
```

Two warmup batches and six retained batches each ran 50 cycles of four public
workflows: native-data list mutation/render/destruction, replacement Region
adoption, Application cancellation/restart/owned-child teardown, and borrowed/owned
state cleanup. Across all batches this tracked 16,800 references. In each batch,
450 external inputs remained reachable while every destroyed owner, owned state
and tracked root was collected. After releasing those inputs, no tracked reference
remained. Removed/reset Models were kept alive too, so their leaked subscriptions
could not disappear as unreachable source/owner cycles.

The positive control used a destroyed View: it stayed alive while strongly held
and was collected after release. Every batch ended with one document, seven DOM
nodes and zero JavaScript event listeners. Heap sizes remain in the raw samples;
they are observations, not a portable leak threshold or timing measurement.

This proves collection in the selected successful workflows using consumer-held
WeakRefs and CDP collection. It does not inspect framework private fields, claim
universal absence of leaks, or promise synchronous failure recovery. The report
precedes the documentation-only commit that stores it; its recorded source and
runtime hashes identify the actual measured inputs.

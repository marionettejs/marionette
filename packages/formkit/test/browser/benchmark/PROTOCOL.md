# Public FormKit 2.9.0 peer benchmark

This measures the public adapters, not private TCM. The existing exact packed
browser job is an infrastructure/correctness precedent, not a timing baseline.

- Run a separate opt-in public diagnostic, not a default latency CI gate. Use
  the sandbox-capable Linux VM, pinned Chromium 159.0.8154.6 and exact pack
  plus released Marionette 5.2.0, FormKit Core/Vue/React 2.9.0, locked Vue and
  React. Save PR head and tested merge SHA, lock digest, tarball digest, engine
  version, CPU/runner identity, and fixture/app output digests.
- Start with two shapes (flat text; required validated text), each at 450
  and 1,500 fields. Use the same schema, stable field IDs, synthetic initial
  data already satisfying validation, same commit delay, same DOM/viewport,
  matched initial/blank page state. Arrays/lists are a subsequent independent
  workload. Require exact field count/value and two known sibling values,
  validated submit payload, and empty host after teardown in untimed checks.
- Record initial mount as call-to-full-input DOM plus separate form settlement.
  Keep fresh mount and teardown per sample. Use a trusted first edit directly
  after readiness; second edit after the first verified aggregate commit;
  late control after two animation frames and 600 ms, with distinct same-length
  text. Interval labels distinguish harness/transport delay, input capture to
  observed aggregate commit, and frame callbacks; do not call them CPU or paint.
  Record actual intervals, so a late first action cannot be counted as immediate.
- Two warm-up triplets and all six framework orderings per shape/size, one
  serial browser/CPU owner. A broken triplet is invalid; retain errors rather
  than comparing partial triplets. Analyze within-triplet paired median delta,
  min/max, and sign consistency; no broad performance claim from six pairs.
- Run separately labeled CDP CPU and retained heap checks after primary timing.
  Same steps/tasks, controlled GC only for retained-heap samples, no forced GC
  inside latency samples. Keep peak separate from retained. Separate clips
  for tracing attribution, never combine trace-enabled and primary samples.
- Build each arm in its own production artifact for actual Brotli JS/CSS bytes
  and initial-route versus lazy coverage. The shared comparison fixture cannot
  tell what each framework would independently ship.

## Run on a sandbox-capable Linux VM

Use the same Node pin, lockfiles and browser installation as the FormKit browser
job. From the checkout root, after dependency installation:

```sh
mkdir -p packages/formkit/test/tmp/browser
npm --prefix packages/formkit run build
(cd packages/formkit && npm pack --ignore-scripts --pack-destination test/tmp/browser --json > test/tmp/browser/pack.json)
FORMKIT_BROWSER_BUILD_ONLY=1 node packages/formkit/test/browser/browser.mjs
node packages/formkit/test/browser/benchmark/run-samples.mjs
python3 packages/formkit/test/browser/benchmark/analyze.py packages/formkit/test/tmp/browser/benchmark-samples-results.json
```

Retain the provenance and raw samples with the build revision. Do not run any
competing browser workloads or builds during sampling.

The separate `FORMKIT_BENCH_READINESS=1` run is a correctness control, not a
second timing comparison. It seeds failing required and length sentinels,
checks field errors and a rejected Save, repairs the fields, verifies the full
payload, and observes the root and every leaf's destruction beyond the final
destruction event's microtask. Receipt timing reflects the extra instrumentation.

For the independent renderer and retention diagnostic, run the same command
with `FORMKIT_BENCH_PROFILE=1`. It currently samples only the mounted 1,500-text
case: position a trusted keystroke in the first viewport or at the midpoint,
check full Core disposal, and collect held-live and post-GC measurements across
five cycles with an idle control. An additional unmeasured mount counts
elements, text, and comment markers attached within the host. CDP's DOM
counter is broader than that attached census. The thread-time stages include
browser and driver instrumentation and do not isolate framework JavaScript;
the heap checkpoints are not process RAM or peak memory.

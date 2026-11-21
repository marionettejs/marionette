# Installed router timing

This harness measures the current route-owning contract. Historical result files
measure their recorded earlier API, including its broader structural-key domain. It is informative,
not a release gate, a production latency prediction or a comparison with another
router. It consumes an exact prepared archive and published Marionette/Utils/Radio
5.0.1 peers. Nothing imports checkout router source or private implementation APIs.
Keep builds, suites and other controlled benchmark loads stopped while measuring.

Use the pinned source Node/npm toolchain and a clean committed harness. Prepare
the archive with [the existing procedure](../../../packages/router/RELEASING.md).
Keep its `router-candidate.json` receipt beside it; the archive source and harness
revision are recorded separately. Run from the repository root:

```sh
npm run performance:router -- --artifact /absolute/path/mnjs-router-0.1.1.tgz --sha256 RECORDED_SHA256 --output /absolute/path/new-study
npm run performance:router -- --native --output /absolute/path/new-study --chromium-executable /absolute/path/chromium
```

The CPU phase creates the isolated consumer and retains its lockfile. The native
phase consumes that same installation after CPU completion; it does not reinstall
or repack. Each phase refuses to overwrite its JSON receipt. Failed phases retain
their error and completed samples. There are no retries, exclusions or automatic
sample replacements. A failure stops the phase. Keep failed invocations separately.

## Protocol, fixed before measurements

There are five CPU warmup blocks and twenty measured blocks. Workload order is
shuffled in every block using seed 1729 (measured blocks add 1000 to the seed).
Each workload occurs once per block. Setup, compilation and lifecycle assertions
are outside timed batches; the batch includes the public calls, loop bookkeeping,
outcome accumulation and required awaits. No timer overhead is subtracted. V8
optimization and garbage collection are left enabled without forced collection.

| CPU workload | Operations per sample |
| --- | ---: |
| `match`, `url`, 10 / 100 / 1,000 routes | 3,000 / 1,000 / 200 |
| Named `memory-navigate`, 10 / 100 / 1,000 routes | 200 / 100 / 40 |
| Scalar and fresh two-field same-key reuse | 1,000 each |
| Changed two-field key, stop/start of the same child | 1,000 |
| Two same-key callers joining one deferred preparation | 100 pairs |
| Reused 100-field key, snapshotted each selection (stress) | 200 |

Catalogs alternate static paths with one-parameter paths. A deterministic stride
of 37 distributes targets across each catalog; it is coprime to all three sizes.
Named URL generation includes the intentional round-trip identity check.
Memory navigation awaits `finished`, using replace/manual focus/manual scroll.
Every catalog is checked for matching and URL round trips before timing.
Selection batches check returned authority and the applicable start/preparation
and running/current invariants. The pending pair includes changed-key stop/start, deferred
allocation, two callers and `Promise.all`: it is not a pure join-only microbenchmark.
Both same-key callers receive the same selected child; the second joins the first options.
Fresh small keys include their allocation; the larger stress key reuses its input
object but still incurs the supported snapshot cost. These are different workloads,
not equivalent treatments whose difference isolates one implementation cost.

Native timing has three warmup blocks and twelve measured blocks, ten sequential
named navigations per sample, with the same seeded ordering and target stride.
Each sample constructs/starts one Router outside timing, normalizes its location,
then measures from the named call through awaited native `finished`. The Router
is destroyed outside timing. This avoids simultaneous routers intercepting one
event. Setup can still affect garbage collection and browser state. A single
fresh headless context uses a 1280x720 viewport and en-US locale; modules are loaded
from the installed export map over loopback HTTP. Replace/manual focus/manual
scroll and a synchronous no-op handler isolate routing/native commit work.
There is no View rendering, data loader, deliberate delay or external network work
inside samples. This is not interaction-to-paint or application presentation latency.

Native launch requires `chromiumSandbox: true`. Do not disable the sandbox or alter
browser policy/helper permissions to obtain measurements. If a managed command
wrapper prevents the helper from operating, use only a supported approved execution
boundary. Record failures and the actual successful launch command; a requested
sandbox is not independent kernel namespace/seccomp attestation. Unavailable native
samples remain unavailable and are separate from CPU results.
The ordinary `--enable-automation` flag permits the browser to report its effective
command line; it does not replace or disable sandboxing.

## Evidence and interpretation

`cpu.json` and `native.json` retain the protocol, every warmup/measured batch,
order, timestamps, iterations, units, success state and summaries. Quantiles are
across **batch means**, not individual-operation tail latency. Report median,
p25/p75, p95, min/max and successful/planned samples. The twenty/twelve correlated
batches do not establish a population confidence interval; no inferential interval
or aggregate speed score is calculated. No outliers are removed.

Receipts record the archive/source/harness hashes, npm/Node, registry identities,
lockfile, OS/CPU/memory/cgroup limits and load averages. Native evidence adds the
browser/automation version, launcher/actual binary hashes, effective argv, context,
XDG paths and server URL. Preserve logs and hash all evidence files when handing
off a study. Do not include `consumer/node_modules` or npm caches in that handoff.

The 14d384c8, b010e353 and f6654e88 archives have identical emitted ESM and CJS
runtime files (source maps/declarations/docs are distinct). Comparing their timings
would not measure a router code change. The older a613f8de contract predates key
snapshots and several correctness repairs; a comparison must label those semantic
differences. This harness deliberately makes no historical speedup claim.

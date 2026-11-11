# Installed router study — 2026-11-11

This is one informative cloud run of the current repaired contract, not a
speedup comparison or release certificate. Every declared batch passed. No timing
sample was retried, removed or replaced. Production router source is unchanged.

Runtime source: `14d384c835df1b73c347fc57d4ee54061446ba4d`; exact prepared archive
SHA256 `97a32b89d4c4791f6b158b50df1f3eac3443496848994eef331ae859e065cbda`.
The ESM/CJS runtime bytes also match the accepted f6654e88 and b010e353 archives.
Their documentation, declarations and source maps are distinct.

CPU harness: `50c92378add9e9ca27a4dddee02f19f9b3fb2772`. Native harness:
`dc0d15d353b55cb4127cf3d14122cd70e1343c26`. The only intervening code change
adds the ordinary `--enable-automation` flag for command-line metadata; CPU
workloads and timing code are identical. The evidence preserves both exact patches.

Node 24.19.0, npm 11.17.0, Playwright 1.64.1, Debian 13/Linux 6.18.57 x64,
Intel Xeon Platinum 8573C. The container exposes five logical CPUs, four available
CPUs and a four-CPU quota, with a 16 GiB cgroup memory limit. Published
Marionette/Utils/Radio 5.0.1 locators and integrities are retained in the lockfile.
The existing Rollup ES/CJS build externalizes the peers; no alternate optimizer
or experimental build mode was used. Samples ran serially without overlapping
controlled builds/tests/benchmarks. Shared-host interference and GC are possible.

## CPU public operations

Twenty measured and five warmup batches per workload: 300 measured plus 75 warmup
batches, all passed. Values below are microseconds per operation/selection, except
the pending workload which is microseconds per two-caller join pair. Quantiles are
across batch means; they are not individual-operation tail latency.

| Workload | Median | p25–p75 | p95 | Min–max |
| --- | ---: | ---: | ---: | ---: |
| match/10 | 18.02 | 17.50–20.28 | 24.95 | 16.49–25.72 |
| url/10 | 27.93 | 26.82–34.13 | 47.53 | 25.58–48.79 |
| memory-navigate/10 | 133.89 | 111.89–172.15 | 240.59 | 100.04–247.61 |
| match/100 | 77.89 | 74.22–82.09 | 90.11 | 71.97–95.52 |
| url/100 | 87.02 | 85.28–91.86 | 101.25 | 81.41–102.86 |
| memory-navigate/100 | 281.16 | 245.12–289.95 | 464.49 | 217.64–470.32 |
| match/1000 | 721.33 | 712.57–742.53 | 872.01 | 684.53–1090.74 |
| url/1000 | 720.19 | 698.20–751.35 | 778.37 | 678.32–1106.24 |
| memory-navigate/1000 | 1688.58 | 1606.70–1751.47 | 1904.69 | 1528.02–2350.86 |
| selection-reuse/scalar | 1.12 | 1.02–1.22 | 1.41 | 0.95–1.47 |
| selection-reuse/flat-fresh | 2.82 | 2.61–2.94 | 3.38 | 2.40–12.84 |
| selection-reuse/nested-fresh | 6.12 | 5.61–6.97 | 18.03 | 4.99–26.80 |
| selection-changed/flat-fresh | 4.07 | 3.89–4.70 | 5.21 | 3.39–95.20 |
| selection-pending/same-key-pair | 7.60 | 6.97–8.33 | 12.52 | 5.98–24.45 |
| selection-reuse/stress-100-fields | 42.64 | 40.49–48.72 | 76.96 | 37.84–125.79 |

Scalar/small-key operations take a few microseconds in this fixture. A reused
100-field mutable key still incurs a snapshot: it is a stress case, not the
recommended resource-key shape. Catalog scaling is material: matching and checked
named URL generation scan the compiled table, and named navigation includes both
URL generation and matching. For a large link list, those repeated costs can add
up. This run does not justify removing round-trip checks or adding a speculative
index/cache. A concrete consumer should measure its actual catalog and link counts.

The changed-key maximum of 95.20 microseconds per selection is retained despite
a 4.07 microsecond median. No outlier trimming or claim of uniform latency is made.
The pending-pair cost includes stop/start, deferred allocation and Promise.all;
comparing it directly to one running-child reuse would compare different work.

## Native routing completion

Chromium 154.0.8037.57, fresh headless context, 1280x720, en-US. Sandbox-enabled
launch succeeded in the approved outer execution boundary. No no-sandbox flag
was used; effective kernel namespace/seccomp modes were not independently attested.
The evidence records actual argv, launcher/binary hashes, HTTP origin and XDG paths.

Twelve measured plus three warmup batches per catalog, ten navigations per batch:
36 measured plus nine warmup batches, all passed. Milliseconds per navigation:

| Routes | Median | p25–p75 | p95 | Min–max |
| --- | ---: | ---: | ---: | ---: |
| 10 | 0.60 | 0.46–0.69 | 1.28 | 0.41–1.28 |
| 100 | 1.02 | 0.94–1.17 | 3.81 | 0.83–3.81 |
| 1,000 | 6.24 | 5.01–6.90 | 10.30 | 4.71–10.30 |

These samples measure named calls through awaited native completion, using
replace/manual focus/manual scroll and synchronous handlers. They exclude View
rendering, data loading, external network work and interaction-to-paint. Router
construction/initial dispatch occurs outside each timed batch, but may affect GC.
Node and Chromium results use different engines/execution contexts and are not
paired treatments from which to attribute a browser overhead ratio. With only
twelve native batch means, nearest-rank p95 is the maximum, not a population
tail estimate. There is no cross-browser certification claim.

## Preserved setup failures and limits

Before measurement, the command-wrapper sandbox helper failed its ownership
check. The approved outer launch succeeded, but managed policy denied the data:
preflight URL; it was not retried. The actual HTTP fixture uses the explicitly
allowed HTTP policy, without changing settings. An initial npm exec command tried
to resolve a registry Node package; strict script policy stopped it before the
harness ran. The normal npm script uses the pinned existing runtime instead.

The first actual native invocation reached HTTP but failed command-line metadata
capture because the automation flag was absent. It produced zero timing rows.
That receipt and log remain alongside the successful native invocation. The flag
was added before the first native timing sample. None of these setup failures
was substituted for or hidden among successful timing samples.

Both phases retain every warmup/measured row, correctness outcomes, order, timestamps,
protocol, dependency identities and source/harness hashes. Raw evidence and failed
invocations are preserved separately; consumer node_modules/caches are excluded.
See [the protocol and reproduction commands](README.md). No production fix or
automatic lifecycle/activation API is introduced by this study.

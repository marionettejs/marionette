# Native data audit fixes

This pass fixes observable defects without adding a new data abstraction or a
`Collection.set()` reconciliation API. The latter is a separate feature decision;
keeping it out avoids expanding the mutation contract while fixing current methods.

## Correctness and maintainability

- A Collection preserves every supplied native Model instance. Its configured
  factory constructs raw attributes only. No instance-to-attribute conversion or
  compatibility fallback remains.
- Collection lookup is exact member instance, then application id, then cid.
  Reordering does not change this precedence. Batch lookup uses the same precedence
  against a current snapshot, so silent id changes need no persistent index.
- Bulk removal uses a temporary identity Map and removal Set instead of repeated
  scans. A regression test limits ID reads to at most twice the collection length.
- The array removal overload is reachable. Collection types account for both
  supplied Models and the actual factory. Partial attributes and known-key writes
  no longer promise values the model can lack or reject in object-form writes.
- Documentation makes reference equality, defaults, sparse change maps, nested
  writes, membership events, and explicit sorting clear.

These are behavior and contract improvements, not a synthetic code-quality score.
The production change introduces no dependency, persistent cache, queue, public
method, or duplicate compatibility path.

## Local removal measurements

Baseline: `5bb66c7f`. Node 24.19.0, macOS arm64. Both variants use the same current
shared utilities. The source blob hashes and all samples are recorded in
[the measurement JSON](./data-package-removal-2026-09-08.json).

Two warmups and nine samples per variant, alternating execution order. Construction,
cleanup, and explicit GC are outside the timer. Mutations are silent. Tests and
builds were not run concurrently with the reported measurement. These are local
microbenchmarks, not browser or production throughput claims.

| Collection size | Removed inputs | Before median | After median | Ratio |
| ---: | --- | ---: | ---: | ---: |
| 1,000 | All Model instances | 5.294 ms | 0.609 ms | 8.69x faster |
| 1,000 | All ids | 5.102 ms | 0.565 ms | 9.03x faster |
| 10,000 | All Model instances | 531.228 ms | 6.266 ms | 84.78x faster |
| 10,000 | All ids | 487.548 ms | 6.689 ms | 72.89x faster |
| 1,000 | One Model instance | 0.044 ms | 0.050 ms | 0.006 ms slower |
| 10,000 | One Model instance | 0.588 ms | 0.555 ms | 0.033 ms faster |

The bulk improvement is supported by deterministic work counts: 10,000 exact
instances formerly required 49,995,000 ID reads; the new batch index needs 20,000.
Single-removal differences are small and mixed; no general single-removal speedup
is claimed.

Reproduce from a checkout containing this change:

```sh
baseline=$(mktemp -d)
for file in index model collection api; do
  git show "5bb66c7f:packages/data/src/$file.ts" > "$baseline/$file.ts"
done
node --expose-gc scripts/performance/data-package-removal.mjs "$baseline"
```

Both revisions were also compiled with the same Rollup/Babel configuration and
compressed with Brotli quality 11. Current generated output was byte-compared
against the ordinary package build:

| Artifact | Before | After | Change |
| --- | ---: | ---: | ---: |
| Data ESM, Brotli | 2,602 B | 2,726 B | +124 B |
| Data CommonJS, Brotli | 2,668 B | 2,781 B | +113 B |

The small bundle increase is justified by the correctness fixes and removal
improvement. No size budget or baseline was relaxed.

## Validation

- 2,004 unit tests, 100% lines and branches.
- Full build and core declaration/consumer checks.
- Packed native-data ESM and CommonJS declarations with TypeScript 7.0.2, plus the
  TypeScript 4.6.4 consumer fixture.
- Packed native-data runtime in Chromium, Firefox, and WebKit.
- Source ESM validation, lint, documentation examples, and 506 internal links.
- Deterministic bulk-removal complexity regression and the timing cases above.

No library release or application deployment is implied by these results.

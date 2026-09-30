# Entry and retrieval efficiency

2026-10-01. The entry instructions are shorter and focused section lookup now
accepts ordinary documentation links. Consistent reader efficiency and lower
build time or cost remain unestablished. Expansion is paused.

## What the recorded runs showed

An independent audit of seven recorded attempts found eight failed helper responses
across six attempts. Seven failures were hidden by shell pipelines returning zero.
Four readers combined page and section selection; other failures involved headings,
Markdown anchors and a missing path prefix. Broad reference reads followed some
failures. This supports fixing retrieval syntax, without treating every full-page
read as wasted work.

The attempts did not traverse the skill, agent page and index as separate entry
reads. Entry duplication therefore does not explain their observed cost regression.
Three revised attempts also inspected optional rendering dependencies despite an
available installed default. The amount of necessary reading and the dollars
attributable to individual documents are unknown.

## Changes

- Reduced `docs/agents.md` from 8,837 to 4,617 characters and the skill from 5,378
  to 3,995. Routes have one primary target; readers choose a contract directly.
- Moved installation and hosted MCP identity instructions into their owning tooling
  sections. Across the five canonical entry/tooling files, net prose fell by 2,782
  characters; the generated plugin copy is excluded.
- Made provider inspection conditional on the task and distinguished existing-app
  work from first-project setup. Preserved local View work, Application readiness
  and the optional data/persistence boundary.
- Preserved route fragments and generated section IDs from the same heading anchors
  used by HTML. The helper accepts `--section SOURCE#ANCHOR` and
  `--page SOURCE --section 'Heading'`. Ambiguous headings fail with exact choices.
  Manifest/hash validation remains required.

The section-ID change applies to newly generated artifacts. Frozen comparison
artifacts keep their identifiers. No inspected consumer required literal line-number
IDs. API/reference prose, runtime, examples and the ranking algorithm were unchanged
in this pass; section offsets and boundaries retain their existing behavior.

## Small independent reader check

Two ordinary requests and their criteria were frozen before edits. Four fresh
internal readers answered them once each, using copied before/after packages.
The baseline is the rebuilt corpus before tightening, rather than upstream docs.
An independent assessor graded required correctness before joining condition/read
metrics. All four answers and their required citations passed: 14 required clauses
in total, zero failures.

| Request | Before returned characters | After returned characters | Lookup requests |
| --- | ---: | ---: | --- |
| A | 44,892 | 31,798 | 3 → 3 |
| B | 28,886 | 33,174 | 2 → 3 |

This is a mixed efficiency result. A's new reader selected one section in place of
a full page; B's new reader added a full reference. No reader used the product
helper, so this check does not demonstrate adoption of its repaired lookup modes.

The wrapper supplied the skill and full package metadata in both conditions,
including roughly 10,000 metadata characters that were measurement overhead.
Its common direct-anchor reader was available to both conditions. Logged characters
are decoded output, not tokens; full thinking time and billing were not collected.
One reader per cell cannot estimate variability. Wrapper access was capped, but
other filesystem access was not independently excluded. Two supplementary claims
retain source-verification limits; required answers passed. No additional reader
attempts or external provider calls were made, and docs were not retuned afterward.

## Verification and disposition

- `npm run test:agent-docs`: 39 passed.
- `node --test test/docs/build.test.mjs`: 4 passed, including corpus anchor parity.
- `npm run docs:check`: passed, including 48 executable fences, declarations,
  links, export, fresh installed discovery and scoped helper reads, consumer testing
  and the quick-start production build. Its initial run exposed a missing shared
  heading import; that was repaired before the successful full rerun.
- All 82 original-run and 1,994 second-cohort frozen input hashes remain unchanged.
  The four short-check package copies also remained unchanged across 608 files.
- Skill frontmatter parity passed using the installed Node YAML parser. The official
  Python validator could not run because PyYAML is absent.

These checks establish delivery and contract preservation. They do not establish
browser behavior, registry acquisition, deployed website alignment or cheaper
independent application builds. The current local candidate has 38 consumer pages
and 26 assets; its manifest content hash is recorded in
[the evidence](evidence/efficiency-tightening-20261001.json).

**Strength:** fewer compulsory entry reads and working focused access without
shrinking framework coverage or adding example helpers. **Weakness:** readers can
still choose broad references, and the narrow screen did not show a consistent
reading reduction. Keep cost/read efficiency open. Further changes need an ordinary
reader problem supported by evidence; do not expand the corpus or tune it to these
now-exposed requests.

## Routing and coverage follow-up

2026-10-01. A fresh Astra/high review retained the structure and identified two
specific corrections. DOM event/trigger tasks now link directly to their shared
contract; named-element tasks have a UI-bindings route. Renderer/data configuration
links to configuration scope. The generated skill/plugin tables match. The API index
now acknowledges the completed Application binding/reentry sections and retains
the custom-store gap. No runtime or example changed.

After these corrections, `npm run test:agent-docs` passed all 39 tests and
`npm run docs:check` passed, including fresh installed discovery. Link checking
covered 84 HTML files and 1,084 internal links. The candidate has 38 consumer pages
and 26 assets, content SHA-256
`c22a3bdbc9e7f8ed6903fa69c1120303fce08ef536ec6c2f94b4236a96a4a1d0`.
The earlier screen and its hashes remain evidence for the earlier candidate.

The user authorized a new bounded comparison, delegated to the independent review
chat. It will reuse the existing runner for two reserved build/maintenance tasks,
with two attempts per condition per task (eight total), matched runtime and common
updated retrieval tooling. Helper and Markdown use remain optional. The maximum
is $12 CLI-estimated across the cohort; provider billing is not independently
capped. This is a new tooling cohort, separate from previous results. Preparation
and execution are complete: [eight attempts](reader-comparison-v3-results.md)
passed all 80 required behavior checks. Maintenance improved in both repetitions;
build results were mixed, with one limited attempt omitting its explanation.
Total CLI-estimated cost was $5.42. These pilot results do not establish consistent
efficiency or satisfy the separate stable usability evaluation.

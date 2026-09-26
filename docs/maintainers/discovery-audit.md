# Agent documentation discovery audit

Audited on 2026-09-25 against `a7b6d4b1c59125d102f60d29897fe38169ce4042`
(merged #588), independently of the entry-point edits in #589. This is a trace-led
editorial and retrieval audit, not a new agent run or a framework comparison.

## Evidence and method

Inspected tool commands from the 18 Marionette ticket transcripts in Stringent's
`content-dev-pilot-{1,2,3}` and `expense-dev-pilot-{1,2,3}`, T1–T3. Read assistant
messages around the expense pilot's discovery and repair episodes; compared the
queried contracts with current documentation and their source implementations.
Commands below are numbered by `tool_use` blocks in each ticket's `messages.json`.
A read command shows where the agent looked, not that it understood all returned
text. Question labels below are inferred from symbols queried unless the agent
explicitly explained the question. Read counts alone do not establish wasted work.

Both pilots used Claude Code 2.1.280, `claude-sonnet-5`, high effort, with an
80-call and 1,800-second limit per ticket. The expense manifest records installed
package files, no skill activation, no documentation MCP, and no network. Its
package was the RC.2 candidate at `b0a9fa81`; the content pilot used RC.1.
These are different development workloads and artifacts, not a controlled
before/after documentation experiment. No held-out tests were consulted or changed.

The raw transcripts remain in Stringent; they are not distributed with this
library. The following digests identify the inspected inputs, not a public
replication dataset. Paths below are relative to the Stringent repository root
(the directory containing `runs/`), with literal `/` separators and no leading
`./`. Each column lists one workload's complete input set in hash order:

| Content workload | Expense workload |
| --- | --- |
| `runs/content-dev-pilot-1/marionette/T1/messages.json` | `runs/expense-dev-pilot-1/marionette/T1/messages.json` |
| `runs/content-dev-pilot-1/marionette/T2/messages.json` | `runs/expense-dev-pilot-1/marionette/T2/messages.json` |
| `runs/content-dev-pilot-1/marionette/T3/messages.json` | `runs/expense-dev-pilot-1/marionette/T3/messages.json` |
| `runs/content-dev-pilot-2/marionette/T1/messages.json` | `runs/expense-dev-pilot-2/marionette/T1/messages.json` |
| `runs/content-dev-pilot-2/marionette/T2/messages.json` | `runs/expense-dev-pilot-2/marionette/T2/messages.json` |
| `runs/content-dev-pilot-2/marionette/T3/messages.json` | `runs/expense-dev-pilot-2/marionette/T3/messages.json` |
| `runs/content-dev-pilot-3/marionette/T1/messages.json` | `runs/expense-dev-pilot-3/marionette/T1/messages.json` |
| `runs/content-dev-pilot-3/marionette/T2/messages.json` | `runs/expense-dev-pilot-3/marionette/T2/messages.json` |
| `runs/content-dev-pilot-3/marionette/T3/messages.json` | `runs/expense-dev-pilot-3/marionette/T3/messages.json` |

For each file, hash its raw bytes with SHA-256 without parsing or normalizing JSON.
Encode one record as UTF-8 path bytes, one NUL byte (`0x00`), the file digest's
64 lowercase ASCII hexadecimal characters, and one LF byte (`0x0a`). For each
workload separately, concatenate its nine records from top to bottom and hash
those bytes with SHA-256; report the result as lowercase hexadecimal. Do not
include the absolute checkout path, table markup, or an extra separator:

- Content transcript-set SHA-256: `ef3769ba3b06358568b1c312b795cc3000aaed7a4f8476fb87a3ca13f9a8222f`.
- Expense transcript-set SHA-256: `091bcad26c7a18217c2ebbaeb3e5d8b9d7c84cb93f8ecbe98d57ba9fa3b910b7`.

## Discovery episodes and disposition

| Episode | Observed path and result | Current diagnosis and action |
| --- | --- | --- |
| Content pair 2, T1 calls 8–31 | Recipes → CollectionView → DataApi → rendering → forms → constructor/Region/runtime queries. | Broad initial framework discovery. The current quick-start contract table and task routing cover several of these decisions. Do not attribute the entire sequence to one missing fact or impose one data architecture. |
| Content pair 2, T2 calls 4–7 | Package listing → runtime searches for `getUI`, binding, and delegation. | Repeated API-boundary discovery also appears in the expense pilot. Give binding and delegation their own compact sections with results, timing, and cross-links. |
| Expense pairs 1–3, T1 | All read quick start and forms. Pair 1 calls 9–12 continue to compact contracts, Region, View, and prerendered DOM; pair 3 calls 12–15 read rendering in four chunks. | Some reading is legitimate for a new framework. Existing examples remain useful; wholesale shortening would remove needed contracts. Focus retrieval on the question instead of adding another mandatory overview. |
| Expense pair 1, T2 calls 5–9 | Retrieval guide → routing → wrong `scripts/docs.mjs` path → runtime `getUI` and `delegateEvents` searches. | #588 already fixed the installed helper path. Remaining exact-symbol retrieval should land on the main contract rather than an incidental Behavior or CollectionView discussion. |
| Expense pair 1, T3 calls 8–10 and 28–35 | Runtime searches for destruction, trigger, Events, stopListening, and Region teardown. Later replaces completion-event bookkeeping with a longer-lived callback. | #588 already documents save/data ownership separately from UI lifetime. Add the public `showChildView` and `destroy()` entry points to that existing explanation so symbol-based retrieval finds it. Do not add synchronous recovery behavior. |
| Expense pair 3, T1 call 24 and adjacent explanation | After earlier documentation reads, queries `currentTarget`/`delegateTarget` and explicitly identifies `currentTarget` as the wrong element. | Application mistake despite available documentation. A replay also exposes a separate ranking defect: a common heading word can crowd the complete answer out of the top five. Fix retrieval, without claiming this would have prevented the mistake. |
| Expense pair 2, T2; pair 3, T3 | No framework documentation reads. | Useful negative controls: discovery cost is not universal or necessarily repeated every ticket. Do not mandate re-reading for each change. |

## Deterministic query replay

The agents did not use section search in these episodes. The queries below were
constructed during this audit from observed symbols and questions; these ranks
are retrieval regression evidence, not replayed agent outcomes. Baseline uses the
corpus and search implementation at `a7b6d4b1`; updated results use this change.
The existing form/list queries are retained controls, not new acceptance targets.

| Query | Target contract | Baseline rank | Updated rank |
| --- | --- | --- | --- |
| `getUI` | DOM interactions: getUI | 1 | 1 |
| `bindUIElements` | DOM interactions: dedicated binding contract | Absent | 1 |
| `delegateEvents` | DOM interactions: delegation contract | 2, inside View events | 1, dedicated section |
| `event currentTarget delegateTarget` | DOM interactions: Read the matched control | Outside top five | 3 |
| `showChildView destroys listeners` | Region: Pending work after replacement | Outside top five | 1 |
| `save after destroy` | Region: Pending work after replacement | 5 | 2 |
| `initialize options` | Common: initialize | 1 | 1 |
| `childViewEvents arguments` | Events: CollectionView childViewEvents | 1 | 1 |
| `unsaved changes form focus` | Forms: save without losing focus | 1 | 1 |
| `preserve editable rows sort` | Lists: editable rows | 1 | 1 |

The scorer now prioritizes sections containing every query term, then retains
heading specificity and shorter-section tie-breaking. Ranking every partial match
by term count was rejected: it displaced the editable-list guide with broader
pages. No stemming, task-specific synonyms, model routing, or search service was
added. Lexical search still cannot resolve every paraphrase or infer all required
setup; the caller must read relevant linked contracts.

Run `npm run test:agent-docs` to check these contracts against the real consumer
corpus and a synthetic ranking regression. `npm run docs:package` stages the same
helper for direct `--search` / `--section` inspection. Section IDs are snapshot-local.
The tests establish retrieval and content presence, not the runtime claims alone.
The documented binding/delegation behavior is also checked by the existing
`ui-binding-diagnostics`, `destroyed-bind-ui-elements`, and `view-dom-delegation`
unit suites. No production code or executable example changed.

## Access modes and limits

| Access mode | What this audit establishes | Still unverified |
| --- | --- | --- |
| Package-only Markdown | Observed in Claude traces; readme/llms helper discovery and contract sections inspected. | Whether fresh agents use the improved helper rather than whole-file reads. |
| Copied or plugin skill | Canonical/plugin tree equality and local helper behavior are tested; Claude Code, Copilot, Cursor, and portable manifests share that tree. | Native client activation, interpretation, and task outcomes in each client/model. |
| Documentation MCP | Canonical prose can be distributed through the matching corpus; provenance still needs to match. | The hosted server's search ranking is separate code in the website repository. This change does not update or validate that implementation. |

The change adds no production imports, resources, or instrumentation. It does not
claim lower token cost, faster completion, or improved correctness across models.
Existing frozen pilot snapshots and their outcomes remain unchanged.

## Next independent validation

Use fresh development tasks before another held-out evaluation. Compare exact
before/after artifacts within each model/client/access mode, holding task, tool
access, environment, and budget fixed. Keep package-only, activated-skill, and MCP
conditions separate so installation or service differences are not attributed to
the prose. Confirm browser availability and network limits in both conditions.

Measure completed user behavior and retained requirements first, then discovery
calls/output, time to first working interaction, and repair effort. Record which
question each extra read resolves; a necessary contract read is not a failure.
Validate any repair ticket against realistic earlier implementations so it contains
an actual defect. Follow the [evaluation plan](../../benchmarks/agent/evaluation-plan.md)
for approval, frozen inputs, spend, and stopping limits before new paid runs.

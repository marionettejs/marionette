# Navigation implementation trial

Implemented `solution.mjs`, exporting synchronous `createNavigation({ el, loadRecord })` with asynchronous `navigate(id)` and synchronous, idempotent `dispose()`.

## Contract and documentation used

- Read `TASK.md`, `.agents/skills/marionette/SKILL.md`, and the task's `package.json`. No project lockfile or application runtime configuration was present in the initial directory listing; the task itself specified the integrations.
- Ran the skill's `scripts/docs.mjs` helper with `--project /tmp/marionette-docs-trial-20260908-a/latest-navigation --list` and `--page docs/agents.md`. These initially succeeded under the default Node v22.16.0; after receiving the existing Node 24 path, reran both with `/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node` and successfully read `--page docs/routing.md` with that runtime as well.
- Helper provenance: Marionette `5.0.0-alpha.2`, source revision `5bb66c7f1559ae3902db06847a378e9e5c3907a7`, `sourceDirty: true`, content SHA-256 `36a974040fa13f483e68a213029e313c96339dd16384343a39e40964ac373f00`. The helper's documentation integrity checks succeeded. This is a local artifact, not proof of an immutable published release.
- Used task-local packaged pages under `node_modules/marionette/dist/docs/docs/`: `agents.md`, `routing.md`, `marionette.region.md` (ownership, synchronous show and destroy), `view.lifecycle.md` (render/attachment/destruction states), `marionette.view.md`, `view.rendering.md` (plain model serialization), `security.md` (fixed markup and textContent), and introductory sections of `installation.md`, `choosing-integrations.md`, and `marionette.application.md`.
- Inspected the installed package manifest's exports and engine requirement, and `dist/types/esm/index.d.ts` for named View and Region exports. No library checkout, acceptance tests, sibling trial directories, network, or dependency modifications were used.

## Integration and ownership decisions

Kept plain records, default native DOM behavior, and function templates. The View renders fixed `<h1></h1>` markup and assigns the record title through `textContent`, preserving untrusted markup as literal text. No providers, renderer changes, router, or isolated runtime were added.

A standalone Region is sufficient because this controller only loads and replaces Views; it does not need an Application start/restart boundary. The controller owns that Region and the pending AbortController. Each navigation gets a distinct request identity, including repeated ids. It aborts the previous request and checks current identity, disposal, and signal state after loading and before any View creation. Stale failures resolve false, while current load failures reject and retain the displayed page. An identity-guarded finally block cannot clear a newer cancellation handle.

The Region owns all displayed Views and destroys them on replacement. Disposal marks the controller permanently inactive before aborting work and destroys the Region through its public API. Default Region containment preserves the supplied mount element.

## Commands and validation

Read-only inspection used `pwd`, `ls -la`, `cat`, targeted `sed`, `rg`, `head`, and `node --version`. The initial `git status --short` returned exit 128 because this task directory is not a Git repository. That was an inspection limitation, not a validation pass.

In addition to the helper commands above, ran:

```sh
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node --test smoke.test.mjs
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node --check solution.mjs
```

Both passed. The smoke suite reports 1 test, 1 pass, 0 failures. It uses installed jsdom and the installed Marionette runtime to exercise initial display, literal untrusted title, previous page retention during loading, repeated-id races with an abort-ignoring loader, stale success and failure, current failure and recovery, public View destruction state during replacement and disposal, cancellation signals, repeated disposal, no post-disposal loading, late results after disposal, and mount preservation. A test-only wrapper around the public Region.show method captures Views for public lifecycle assertions; production code contains no instrumentation.

## Uncertainty and untested boundaries

No real browser or router/history deployment was exercised. DOM and lifecycle checks ran in jsdom; there are no focus or event interactions in this task. Documentation hashes do not prove the dirty source's runtime matches every documented behavior, so the smoke test is the evidence for the exercised installed contracts. As in the documented navigation pattern, if a loader ignores cancellation, a canceled navigate promise settles false when that loader eventually settles; the controller does not terminate the loader itself. Render-failure transactionality is not promised by Region replacement and was outside the requested current-load-failure contract.

# Documentation implementation trials

These focused tasks test whether an agent can use the distributed skill and
matching package documentation to implement an application change. They are
editorial regression trials, separate from the scored release benchmark in
[benchmarks/agent](../agent/README.md). They do not establish comparative accuracy,
model superiority, a release gate, or complete application quality.

## Run an independent attempt

Build the packages, then prepare a new directory outside the repository:

```sh
npm run build
node benchmarks/docs/prepare.mjs /absolute/new/trial-directory
```

The preparer packs the current artifacts and installs each task into an independent
workspace. It copies the distributable skill into that workspace. It does not call
an AI provider or enable a hosted service. npm may download the pinned DOM test
dependency. `provenance.json` records the exact documentation snapshot.

Give a fresh agent only its workspace and this instruction:

> Use the Marionette skill in `.agents/skills/marionette/SKILL.md` to complete
> `TASK.md`. Work only in this task directory. Read the installed package docs as
> needed. Do not inspect the library checkout or acceptance tests.

Do not give it the expected approach, previous conversation, other task outputs,
or a model solution. Record the model, available tools, and whether invocation was
explicit. This procedure tests skill use after explicit invocation; it does not
prove automatic skill discovery. Use an existing authorized agent session or an
explicitly budgeted evaluation; no paid inference is configured by the harness.

After the agent finishes, copy `acceptance/run.mjs` to the task workspace as
`acceptance.mjs`, then run from that workspace:

```sh
node acceptance.mjs latest-navigation
# Or editable-list / widget-lifetime for the corresponding workspace.
```

Keep acceptance tests outside the agent-visible workspace until it finishes.
Inspect its code as well: a DOM result alone cannot prove use of Marionette's
ownership model or absence of an unnecessary integration. Save its report and
actual command outcome. A failed or interrupted attempt remains a recorded attempt.

## Interpret the evidence

- `latest-navigation` checks repeated ids, ignored cancellation, late success and
  rejection, current error preservation, safe text rendering, and disposal.
- `editable-list` checks public native collection operations, surviving row/input
  identity and draft values, accessible naming, and owned child destruction.
- `widget-lifetime` checks attachment requirements, cleanup before host removal,
  rerender, detach/reuse, and final destruction.

The acceptance runner uses jsdom. It does not establish browser focus, keyboard
navigation, visual layout, screen-reader behavior, or real network cancellation.
Use browser tests for those boundaries. Record manual/browser follow-up separately.

When a task fails, identify the earliest misleading or missing document, correct
that source, and retry with a fresh agent/workspace. Retain the original failure.
Do not tune a passing claim by dropping difficult tasks or giving the next agent
the hidden assertions. A finite passing trial is evidence for these tasks only.

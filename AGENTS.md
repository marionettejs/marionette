# Working on Marionette

These instructions are for changing this library. For building an application
with Marionette, start with [the consumer agent guide](docs/agents.md).

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and repository conventions.
2. Use the [maintainer guide](docs/maintainers/readme.md) to select the public
   contract, source, and checks for the task. Load only the relevant references.
3. Follow [ROADMAP.md](ROADMAP.md) for architecture and release decisions. A
   roadmap item is planned work until source and public evidence establish it.

Before editing, inspect the branch and worktree. Preserve unrelated changes.
Identify the requested behavior and whether its cost is documentation/static,
development/test, an existing production path, or an opt-in runtime path.
Implement one canonical behavior. Do not add compatibility paths without a
verified requirement and a removal condition.

Use authored TypeScript source and public package APIs. Keep agent guidance,
benchmarks, inspection tools, and development helpers out of production imports.
An unused optional feature must add no per-instance resources or global registry.

Run the smallest checks that prove the change, then the broader checks required
by its contracts. Report exactly what ran, what it proves, and any remaining
uncertainty. Do not infer behavior from declarations, doc markers, or green CI
alone. Do not publish, release, or deploy without authorization for that action.

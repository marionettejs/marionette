# Working on Marionette

These instructions are for changing this library. For building an application
with Marionette, start with [the consumer agent guide](docs/agents.md).

Use [CONTRIBUTING.md](CONTRIBUTING.md) for setup and repository conventions,
[the maintainer guide](docs/maintainers/readme.md) to locate an affected contract
and its checks, and [ROADMAP.md](ROADMAP.md) for architecture or release decisions.
Read the sections needed for the task; roadmap plans are not available APIs.

Before editing, inspect the branch and worktree. Preserve unrelated changes.
Identify the requested behavior and whether its cost is documentation/static,
development/test, an existing production path, or an opt-in runtime path.
Implement one canonical behavior. Do not add compatibility paths without a
verified requirement and a removal condition.

During v5 stabilization, flag any necessary production-library change before
applying it. Present the supported public reproduction, proposed source/API change,
and runtime cost so the maintainer can scrutinize it. Tooling, test, or mutation
failures alone do not authorize changes to `src/` or `packages/*/src/`.

Use authored TypeScript source and public package APIs. Keep agent guidance,
benchmarks, inspection tools, and development helpers out of production imports.
An unused optional feature must add no per-instance resources or global registry.

Completion means the requested behavior is implemented, superseded code and
associated contracts are updated, and relevant checks establish the result.
Continue through failures caused by the change within the authorized scope.
Report the source revision, commands actually run, results, and remaining gaps;
declarations, doc markers, and green CI alone do not prove runtime behavior.
Do not publish, release, or deploy without authorization for that action.

## Tests are public contracts

- Import supported package entrypoints: `marionette`, `@mnjs/utils`, `@mnjs/radio`, `@mnjs/data`, and documented adapter subpaths.
- Never call, read, override, spy on, stub, or assert private framework members. Do not create production APIs solely for tests.
- Assert observable DOM, identity, public events, return values, ownership, and externally tracked subscription cleanup. Internal source dependency checks belong to architecture tooling, not runtime contract tests.
- Use explicit Vitest imports and native mocks. No global Mocha wrappers or Sinon. Prefer called matchers so lint can detect missing assertions and unawaited asynchronous assertions.
- Create an isolated runtime with `createMarionette()` for configuration changes. Core tests use native data or small neutral contract fixtures. Use Backbone when specifically testing the optional Backbone adapters.
- Destroy owned objects and release fixtures in each test. Never make a test pass by relying on another test's configuration or cleanup.
- When a public refactor exposes unreachable defensive code, document it in `config/coverage-exceptions.json`. Each other source file remains at 100% coverage. Never add coverage ignores or private probes to manufacture 100%.

## Lifecycle and failure boundary

Follow the public [synchronous failure contract](docs/view.lifecycle.md#synchronous-failures): valid adapters and working cleanup callbacks are required. Synchronous registration, construction, rendering, and teardown failures abort the operation. Public-only tests, retention checks, coverage gaps, and mutation survivors do not authorize a new recovery contract.

- Do not add constructor or partial-registration `try`/`catch` rollback, attempt-all/first-error cleanup, per-instance recovery bookkeeping, or hot-path guards for unsupported callback mutation without an explicit user decision.
- Preserve documented ownership/idempotence guards, successful cleanup, and Application's existing asynchronous readiness, cancellation, and restart semantics. This is not a general ban on guards or asynchronous error handling.
- If new consumer evidence suggests another contract, explain the real public use case and the complexity/performance tradeoff before coding; obtain the user's decision on that change.
- Include this boundary in reviewer prompts. Reviewers must distinguish a defect in an accepted public workflow from a request for unsupported synchronous recovery. Do not implement the latter merely to satisfy a review comment or kill a mutant.

## Find and verify the change

[Test guide](test/README.md) maps contracts to suites, commands, reports, and replay instructions.

- Fast iteration: `npm test -- <file> -t '<contract>'` or `npm run test:watch -- <file>`.
- Choose checks for the affected contract. `npm run verify` and `npm run verify -- --full` are broader local validation options, not requirements for every edit.
- Lint is read-only: `npm run lint`. Apply fixes explicitly with `npm run lint:fix`.
- Source changes require `npm run build` before direct browser, distribution, or consumer-type checks.
- Release candidates require a clean source commit, `release:artifact`, then `release:validate` against those exact tarballs. Never publish packages/tags or deploy documentation as a side effect of testing.

## Implementation and evidence

- Use stable diagnostic codes for invariants. Do not make agent workflows depend on exact prose or undocumented maintainer knowledge.
- New async CLI code must await work and propagate failures. Preserve concise failure output plus detailed machine-readable artifacts.
- Coverage and a successful reference solution do not establish agent usability; that requires the frozen usability evaluation and public application evidence in ROADMAP.md. Comparative research is separate from release readiness.
- Do not run paid agent pilots or evaluations without a predeclared model/runner profile, permissions, run count, spend and elapsed-time budget, and authorization for that envelope. Follow [the evaluation plan](benchmarks/agent/evaluation-plan.md).

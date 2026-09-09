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

During v5 stabilization, flag any necessary production-library change before
applying it. Present the supported public reproduction, proposed source/API change,
and runtime cost so the maintainer can scrutinize it. Tooling, test, or mutation
failures alone do not authorize changes to `src/` or `packages/*/src/`.

Use authored TypeScript source and public package APIs. Keep agent guidance,
benchmarks, inspection tools, and development helpers out of production imports.
An unused optional feature must add no per-instance resources or global registry.

Run the smallest checks that prove the change, then the broader checks required
by its contracts. Report exactly what ran, what it proves, and any remaining
uncertainty. Do not infer behavior from declarations, doc markers, or green CI
alone. Do not publish, release, or deploy without authorization for that action.

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
- Local review: `npm run verify`; complete local validation: `npm run verify -- --full`.
- Lint is read-only: `npm run lint`. Apply fixes explicitly with `npm run lint:fix`.
- Source changes require `npm run build` before direct browser, distribution, or consumer-type checks.
- Release candidates require a clean source commit, `release:artifact`, then `release:validate` against those exact tarballs. Never publish packages/tags or deploy documentation as a side effect of testing.

## Implementation and evidence

- Make the requested behavior canonical. Avoid aliases, fallbacks, dual paths, or new runtime infrastructure without a verified consumer and removal condition.
- Keep test, lint, benchmark, and diagnostic tooling outside production import graphs. Runtime cost remains part of review.
- Use stable diagnostic codes for invariants. Do not make agent workflows depend on exact prose or undocumented maintainer knowledge.
- New async CLI code must await work and propagate failures. Preserve concise failure output plus detailed machine-readable artifacts.
- Report commands actually run, source revision, failures, and gaps. Coverage and a successful reference solution do not establish agent readiness; that requires the frozen benchmark and scored evidence.
- Do not run paid agent benchmarks without the predeclared profile, model, permissions, run count, spend and elapsed-time budget required by #128.

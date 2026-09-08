# Working on Marionette

Read the linked issue, [ROADMAP.md](ROADMAP.md), and the affected public contract before changing behavior. Keep changes focused and preserve unrelated work. Use isolated worktrees when other tasks are active.

## Tests are public contracts

- Import supported package entrypoints: `marionette`, `@marionette/utils`, `@marionette/radio`, `@marionette/data`, and documented adapter subpaths.
- Never call, read, override, spy on, stub, or assert private framework members. Do not create production APIs solely for tests.
- Assert observable DOM, identity, public events, return values, ownership, and externally tracked subscription cleanup. Internal source dependency checks belong to architecture tooling, not runtime contract tests.
- Use explicit Vitest imports and native mocks. No global Mocha wrappers or Sinon. Prefer called matchers so lint can detect missing assertions and unawaited asynchronous assertions.
- Create an isolated runtime with `createMarionette()` for configuration changes. Backbone integration is opt-in; core tests must exercise the neutral default too.
- Destroy owned objects and release fixtures in each test. Never make a test pass by relying on another test's configuration or cleanup.
- When a public refactor exposes unreachable defensive code, document it in `config/coverage-exceptions.json`. Each other source file remains at 100% coverage. Never add coverage ignores or private probes to manufacture 100%.

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

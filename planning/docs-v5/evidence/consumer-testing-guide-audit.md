# Consumer testing guide audit

2026-09-30. Bounded authoring audit for `docs/guides/testing.md`.

The guide supplies four runnable files: a JSDOM preload, a local editing View, a readiness-owning Application, and five public-outcome tests. It uses Node 24's built-in test runner and mock API plus JSDOM 30.1.0. All JavaScript fences are extracted into consumer files by `test/docs/consumer-testing.mjs`, which runs the actual documented command. The guide's data and Lit imports resolve through the consumer's installed packages when invoked by the installed-package harness.

## Contracts checked

- Input dispatch changes the local Model and rendered preview; the input node survives rendering and external Model updates reach it.
- Region replacement destroys the old View, disconnects its root, leaves the borrowed Model alive, and removes delegated input handling and Model subscriptions.
- Startup readiness prevents activation and UI until a controlled response resolves. Stop destroys the owned root, and destruction disposes the configured Region.
- A rejected fetch leaves the initially stopped feature without a root View.
- Stopping pending readiness aborts its signal; a response that ignores cancellation cannot subsequently activate the Application.

The Application uses direct `fetch` in `prepareStart`. Tests mock that existing boundary with `t.mock.method`, which restores it after each test. No configurable production service or testing-only application abstraction is introduced. Tests remain sequential because their DOM and fetch environment are shared.

## Sensitivity and verification

The five tests pass against local built public package exports in a disposable consumer directory. A temporary mutation replaces `modelEvents` with an unmanaged `model.on` subscription. It specifically fails the Region replacement test: a spy on public `render` detects the disposed View reacting to the borrowed Model. Checking only unchanged DOM would miss this error because a destroyed View's render may do nothing. Restoring the documented file returns all five tests to passing. The validator requires the failing TAP entry for that test, so an unrelated failure cannot count as mutation sensitivity.

Scoped ESLint and whitespace validation pass. Root integration supplies the separate installed-tarball proof; this local audit alone does not establish registry installation or package delivery.

## Limits

This recipe verifies consumer setup and public outcomes, not real-browser layout, keyboard focus/caret behavior, navigation, or accessibility quality. The guide directs those checks to a built consumer in a browser. It does not test every lifecycle transition or prescribe an application's error presentation. Passing recipes do not demonstrate reader effectiveness or architectural transfer; those require independent tasks and a controlled comparison.

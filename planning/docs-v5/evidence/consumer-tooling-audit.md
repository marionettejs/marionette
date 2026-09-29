# Consumer tooling recipe audit

Date: 2026-09-30

## Scope

`docs/tooling.md` gives a JavaScript ESLint configuration, a bundler TypeScript configuration, installed diagnostic lookup, and a short debugging workflow. It describes the actual packaged lint rule and its analysis limits. Architecture decisions remain a review responsibility; local View interaction is accepted.

The recipes use ESLint 10.11.0 and TypeScript 6.0.3, matching the existing consumer-lint fixture. The TypeScript example uses exported `RegionInstance` and `ViewInstance` types. An initial check rejected constructor exports used as type annotations; the published recipe was corrected before completion.

## Verification

`test/docs/consumer-tooling.mjs <consumer-directory>` reads the installed page and extracts its JavaScript, JSON, TypeScript, and shell fences. It executes the documented lint and compiler arguments with the consumer's local binaries. It asserts installed tool versions and performs seven checks:

- documented lint configuration loads;
- public View interaction passes;
- a private framework member access fails with the expected lint rule;
- documented TypeScript compiles against installed declarations;
- an invalid Region argument fails with TS2345;
- restored valid examples pass again;
- the installed helper returns the requested MN0003 diagnostic.

The isolated recipe check passed using local tarballs from the existing staged package, local utils/Radio packages, and the authored tooling page copied into that isolated installation. No repository aliases, global module lookup, or shared build were used. The final normal installed-package check separately verifies delivery of this page and reruns the validator from the packaged documentation.

Scoped ESLint passed for the validator. These checks demonstrate runnable tooling and useful rejection controls; they do not demonstrate browser behavior, lint completeness, application architecture quality, or reader effectiveness.

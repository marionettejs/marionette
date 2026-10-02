# Working on Marionette

This checkout is the framework repository. For an application consuming Marionette,
use its version-matched [consumer guidance](docs/agents.md). For library work, read
the source and public contract relevant to the requested change; a full documentation
survey is not a prerequisite.

## Find the contract

- Core classes and their declarations live in `src/modules/`; shared capabilities
  in `src/mixins/`; configurable providers in `src/runtime/`.
- Optional packages live in `packages/<name>/src/`. Public imports follow their
  package exports, independently of the source folders.
- The [API index](docs/api.md) routes to class and provider references.
  [CONTRIBUTING.md](CONTRIBUTING.md) explains source, package and review workflow.
- [ROADMAP.md](ROADMAP.md) owns project strategy and release acceptance;
  [config/release-profile.json](config/release-profile.json) pins the toolchain.

## Make the smallest complete change

Preserve unrelated work. Update source contracts, tests, documentation and diagnostics
affected by the behavior. Remove superseded paths rather than adding aliases or
fallbacks without a verified consumer and removal condition.

Use established Marionette ownership and lifecycle. Local View interactions can stay
local; Application preparation establishes readiness and explicit operations handle
active feature work. Optional `@mnjs/data` supplies observable data, with API access
and persistence provided separately. Do not add helpers solely to make an example
appear complete.

Tests use public imports and observable outcomes. Avoid private member access, private
spies/overrides, or internal runtime imports. Synchronous callback failures do not
imply rollback or attempt-all cleanup; distinguish a supported-workflow regression
from a new recovery feature. See the [test guide](test/README.md).

## Verify proportionately

Start with the affected test or static check. [The test guide](test/README.md#choose-the-smallest-useful-check)
lists the suites. `npm test -- <test-file>` runs unit tests without a hidden build.
Rebuild with `npm run build` after source changes before distribution, declaration
consumer or browser checks. `npm run docs:check` verifies documentation delivery and
executable recipes; it does not establish reader effectiveness.

Report the checks actually run and their limits. Broaden validation for shared
contracts, package delivery, or unexpected failures. Do not run model evaluations,
publish artifacts, or push refs without task authorization. A passing local build
does not confirm registry contents or website deployment.

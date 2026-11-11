# Compatibility

The native adapter supports FormKit **2.5.0 and compatible 2.x releases** through
`^2.5.0` constraints. Core is a peer dependency; the runtime siblings use the same
floor. The current lock resolves that family to 2.5.0. Future versions admitted by
the range still need application testing; a caret range is not advance certification.

## Share one Core instance

Application code, the adapter and plugins must resolve the same Core module.
Check the installed dependency graph and exercise registry lookups with the
application's `getNode` and external nodes. An application Core below 2.5.0 is
intentionally rejected by normal peer resolution. Avoid mixing independently
pinned sibling packages, separately bundled Core copies or ESM/CommonJS graphs.
Matching version strings alone does not establish a shared registry.

## Verified behavior and boundaries

The public regression suite covers native inputs, conditional schemas, validation,
cross-node and registry updates, slots, values/reset, submit/focus ordering and
owned teardown. Upgrade regressions additionally cover combined validation
visibility, `describeForm`/`fillForm`, empty aggregates, hydration/removal and
duplicate registry ownership. Use the [verification instructions](OWNERSHIP.md)
to test the current checkout or installed artifact.

- `validationVisibility` accepts combinations such as `blur dirty`.
- Optional `@formkit/addons@^2.5.0` inspection/fill helpers operate on `form.node`.
  Their default descriptions omit values; password/hidden redaction remains an
  upstream helper contract, not a new adapter API.
- The native renderer does not populate the Vue/React `node.context.refs` map.
  Keep DOM references through the owning Marionette View.
- Core 2.5.0 still retains an older File when a replacement has identical metadata.
  The [strict diagnostic](https://github.com/marionettejs/marionette/tree/codex/formkit-master-integration-20261103/packages/formkit/acceptance)
  remains available; it is not a passing gate or an adapter correction.
- Current Node/JSDOM checks do not certify browser keyboard/layout behavior,
  heap collection, performance parity or future dependency releases.

## Optional Pro

Pro is not an adapter dependency. Pro 0.131.0 declares Core/utils/inputs peers that
include 2.5.0. Clean consumer imports, declarations and builds are distinct from
actual licensed-control browser acceptance. The
[Pro fixture](https://github.com/marionettejs/marionette/tree/codex/formkit-master-integration-20261103/test/fixtures/formkit-pro)
documents that distinction and preserves the scenario helpers.

Historical Pro studies used Core 2.1.2. They include shared popup-placement,
inline typing/model and panel-focus limitations, and two unexplained React
follow-on interaction failures. They do not establish those outcomes on 2.5.0.
The original 158-case helper is unavailable and has not been replayed. Online
license validation remains unverified. Current browser verification is incomplete;
no new Pro or framework-parity certificate follows from the dependency upgrade.

Full older results remain recoverable from the
[immutable historical tree](https://github.com/marionettejs/marionette/tree/9b031550bb2737f052896ee0a0bfe032a54d5b55/packages/formkit/acceptance).

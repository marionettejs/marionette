# Provenance

Package architecture is based exactly on Git revision
`0078606dbe3937d730f81728c90d64161eb3e09e`.

Runtime source was read and bundled without modification. Its bindings include
published FormKit React 2.5 MIT adaptations with the React hook removed;
`LICENSE.formkit` retains the upstream copyright and license.
No React/Vue runtime or licensed Pro vendor source is imported or copied.

The package facade is new code under the repository MIT license.

| Active runtime source | SHA256 at the frozen base |
| --- | --- |
| `experiments/formkit-react-patterns/core/index.mjs` | `489ff23cbf965ff1fb5b07311a5e6210b95684d3522804615b67af943fca9c00` |
| `experiments/formkit-react-patterns/core/upstream-bindings.mjs` | `61291d23f5d95311730445b073e07fc47a3e09ac1ead9d082a47876b97fd1344` |
| `experiments/formkit-react-patterns/core/helper-components.mjs` | `fa217d88388a3728bc984727332016bdd6f37f83fe314002940d76c46511c3cc` |
| `experiments/formkit-react-patterns/core/provider-scope.mjs` | `2c7c42c975f80a008f2166a655d136b491f7b44f13dbfa6eacc56b880242afd0` |
| `experiments/formkit-react-patterns/core/structural-components.mjs` | `a5ac28e15400d8a3792be5827f3287973b2940a0c9176de6a4a5dba25e1e5245` |
| `experiments/formkit-react-patterns/core/config-scope.mjs` | `0f4a9406a05af6aaf1caa644b1e8c3994b2a01880ae06d4d59abe5bdd9d56f1d` |
| `experiments/formkit-react-patterns/core/native-types.mjs` | `1b20278b11968bc1279e8bd44df876825d1e44772f17c1d693e39e80ed630e0a` |
| `experiments/formkit-react-patterns/core/provider-components.mjs` | `bfa70038bcbe312beae42ff6728e5d272bc67ae9e984633f63d1d3ed90dbd190` |
| `experiments/formkit-react-patterns/core/formkit-application.mjs` | `6535edfb2564b057699f35b1e4f9c1b9f99d9b213f0e188f23ffb4aeb6d02238` |
| `experiments/formkit-react-patterns/core/section-renderer.mjs` | `4bef0234a3c272480045ed04047ff31b2f3087395715d0735647add6ffbc5864` |
| `experiments/formkit-react-patterns/core/component-library.mjs` | `ded0fc66cc2dbe0703c2954994299e4842c6af675616f59fda8fb0aaefb14e8f` |
| `experiments/formkit-react-patterns/core/value-facade.mjs` | `d644545536adee04fbeaf1d401dffcc290671cf1e4deade84afbd9eb3660d4ba` |
| `experiments/formkit-react-patterns/core/schema-layout.mjs` | `7dd2e36c73d5da043d1bb7f1fa234ef06e04fa3d45ecffd5d42b4d6b70415718` |
| `experiments/formkit-react-patterns/core/root-slots.mjs` | `fdae5a1b69311e961a5d87d5e4e1f64aa9953e0a7d7042cbdd52ba7144f85ca4` |
| `experiments/formkit-react-patterns/core/schema-registry.mjs` | `8fa4068bb88e0380bfb43984c6d40d5c4e7758f68f46190ce8596583707a551a` |
| `experiments/formkit-react-patterns/core/schema.mjs` | `db81cf28bca4325ef56edf8ae74cbb5ac8cfb45ee091ca57bcc40d2659035f3a` |

Validation used Node 24.22.1 and npm 11.9.0 in Linux cloud, with installed
Marionette 5.1.1, FormKit 2.5.0, Vitest 5.1.0, TypeScript 6.0.3 and Rollup 4.68.0.
This is not the pinned release-toolchain certification or an automated Mac run.

When runtime fixes or relocation are integrated, update this provenance and
rebuild/retest the resulting candidate. These hashes identify this baseline; they
are not a claim to include newer runtime task results.

## Later independent review of this frozen source

The review titled "Independent defaults rereview: 0078606d" approves only the
optional type/name defaults correction and holds the combined tree for raw
explicit identity-override mapping failures. The independent dynamic native-list
review confirms missing $items row inputs/validators and native submission of an
empty required row. Those remain blockers; package construction is not release
readiness evidence.

The accompanying additional-concerns review corrects historical README wording:
a real focus/blur text-input probe matches the pinned Vue/React 2.5 default
visibility, with no own validationVisibility prop. The separate declaration
ownership suite passes. Default-mode agreement must not be broadened into a
claim covering every explicit override-removal sequence. Package docs reflect
that distinction; no runtime correction is claimed from these documentation edits.

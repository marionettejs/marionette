# Provenance

Original package architecture baseline:
`0078606dbe3937d730f81728c90d64161eb3e09e`.

The original package facade used that frozen runtime. This isolated integration
replays the experiment-only history onto master
`1d428966cb30b932c3801896ed4882104def2dc6` and imports the exact supplied runtime
`c353a4d627bcd62a82a3417b5b545c7d21969ba5` patch. Its 17 runtime module hashes
match the owner manifest. Scoped independent schema review clears the
candidate's dynamic-list, raw identity and mixed-source cases; broader review remains pending. The frozen
source worktree is untouched. This integration then imports exactly
`04e0c7db96d2e9109c0a7cf78e079c73bf547140` (mechanical formatting) and
`cb9db2800871754850dc3115b3bc82484207ab1c` (extraction repair). Scoped review
approves the mechanical formatting and exact extraction; broader review remains
pending. Runtime source was copied as provided, without integration-owner
correctness or formatting edits. Its bindings include
published FormKit React 2.5 MIT adaptations with the React hook removed;
`LICENSE.formkit` retains the upstream copyright and license.
No React/Vue runtime or licensed Pro vendor source is imported or copied.

The package facade is new code under the repository MIT license.

| Active runtime source | SHA256 in the imported cb9 runtime candidate |
| --- | --- |
| `experiments/formkit-react-patterns/core/index.mjs` | `fa32ac1c8cae048d8ae9fb7cd312b819c20773efda2bcbdc1f204f89ca054e6b` |
| `experiments/formkit-react-patterns/core/upstream-bindings.mjs` | `06e4be4451b06b86127a34f32046aefa44dd5856c46474fe43f1940ebf9ff4a8` |
| `experiments/formkit-react-patterns/core/helper-components.mjs` | `1caa01158a82b85d9e92db6e822e17dfde04d8c32781bc3e33f764c5b4775c7f` |
| `experiments/formkit-react-patterns/core/provider-scope.mjs` | `a4f1576dcace711dda3b9cf0062cd76ca435da4b101358728c581dd856a9a469` |
| `experiments/formkit-react-patterns/core/structural-components.mjs` | `ecb3053caf6df5d44ecbfb3d328bf5f0749fd9091bfb4d9c24e69c851da99972` |
| `experiments/formkit-react-patterns/core/config-scope.mjs` | `7851e0940a3201e7f70fe42b60ad9690698bead56c8683e391ac90ef833e730c` |
| `experiments/formkit-react-patterns/core/native-types.mjs` | `1b20278b11968bc1279e8bd44df876825d1e44772f17c1d693e39e80ed630e0a` |
| `experiments/formkit-react-patterns/core/provider-components.mjs` | `d582a4e8aea0d33dbb7468c579b937ff162e1566416bf11d9d6ce40d953115aa` |
| `experiments/formkit-react-patterns/core/formkit-application.mjs` | `be78f446ad2019ccf4dcadc4867f36448be7667de16f9c49998ec50aad71a08a` |
| `experiments/formkit-react-patterns/core/section-renderer.mjs` | `b335defdc585cd9646086a97312b5e9d53fcbd2c893d0310cdd59756da612eb8` |
| `experiments/formkit-react-patterns/core/component-library.mjs` | `ded0fc66cc2dbe0703c2954994299e4842c6af675616f59fda8fb0aaefb14e8f` |
| `experiments/formkit-react-patterns/core/value-facade.mjs` | `635d91d0f4fcdf70b91c5b07a1d4455a885f7c3c95e9e85eee73751a55842cd3` |
| `experiments/formkit-react-patterns/core/schema-layout.mjs` | `82f81b41a883d1b3263d73ed2f0f97858eec0de8c511975110b3280fa0ad5b61` |
| `experiments/formkit-react-patterns/core/root-slots.mjs` | `56a6ed2241ddb0bc6c509910b9e43979aef2fc1a92557814b4297ebcd9196993` |
| `experiments/formkit-react-patterns/core/schema-registry.mjs` | `0b6feddce925dbf2763f7d6720e9651ad2caefe2fdc53e34f8c5353130f7c190` |
| `experiments/formkit-react-patterns/core/schema.mjs` | `666856df2726f8eec512f4ae1de5639a90746ed8ad54e094b19c30910bb369ef` |

Validation used Node 24.22.1 and npm 11.9.0 in Linux cloud, with installed
Marionette 5.1.1, FormKit 2.5.0, Vitest 5.1.0, TypeScript 6.0.3 and Rollup 4.68.0.
The reconciled lockfile and fresh CI-style install additionally use pinned npm
11.17.0. Local Node remains 24.22.1 rather than the source pin 24.19.0. These
checks are not full pinned release-toolchain certification or an automated Mac run.

When runtime fixes or relocation are integrated, update this provenance and
rebuild/retest the resulting candidate. These hashes identify this baseline; they
are not a claim to include newer runtime task results.

## Later independent review of this frozen source

The review titled "Independent defaults rereview: 0078606d" approves only the
optional type/name defaults correction and holds the combined tree for raw
explicit identity-override mapping failures. The independent dynamic native-list
review confirms missing $items row inputs/validators and native submission of an
empty required row. Scoped schema review now approves those c353 corrections; broader review and
combined certification remain blockers. Nested peer-reset and real-browser
confirmation remain unestablished. Package construction is not release readiness evidence.

The accompanying additional-concerns review corrects historical README wording:
a real focus/blur text-input probe matches the pinned Vue/React 2.5 default
visibility, with no own validationVisibility prop. The separate declaration
ownership suite passes. Default-mode agreement must not be broadened into a
claim covering every explicit override-removal sequence. Package docs reflect
that distinction; no runtime correction is claimed from these documentation edits.

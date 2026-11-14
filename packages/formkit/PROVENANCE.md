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

This isolated follow-on imports the sole runtime writer's exact lint-cleanup
candidate `b4e2a3b85fbaf3a8d9472fe62e87305598f42d5c` against integration baseline
`ac080a9bcb90ed78e7bbd002c02aa961a1235b71`. All changed existing baseline hashes
and all final hashes were checked, including the new internal scope-properties
module. It is cleanup, not new component support. Scoped independent review now approves this cleanup, including 61 focused
checks, eight before/after comparisons and strict extraction. Broader review
and root-wide lint remain separate gates; publication is still disallowed.

| Runtime/verification inventory source | SHA256 in the imported b4 runtime candidate |
| --- | --- |
| `experiments/formkit-react-patterns/core/index.mjs` | `6d0bb7ba41ad370dbb7919f38085f9b120e8ea164d459aa32836c0a587a5bc64` |
| `experiments/formkit-react-patterns/core/upstream-bindings.mjs` | `6a086696dfde2881ba8e68be36ed5a9b95958466304dec9c35e0c0012f9376ac` |
| `experiments/formkit-react-patterns/core/helper-components.mjs` | `97c7d1af4d237eeb252248b09e88d96801748bfa051f76eab230a876bb98a266` |
| `experiments/formkit-react-patterns/core/provider-scope.mjs` | `a4f1576dcace711dda3b9cf0062cd76ca435da4b101358728c581dd856a9a469` |
| `experiments/formkit-react-patterns/core/structural-components.mjs` | `85f9ee28cf6c42e41062444c8a9a47a5932f133e1970ccf4c4543f84b3fbab3e` |
| `experiments/formkit-react-patterns/core/config-scope.mjs` | `7851e0940a3201e7f70fe42b60ad9690698bead56c8683e391ac90ef833e730c` |
| `experiments/formkit-react-patterns/core/native-types.mjs` | `1b20278b11968bc1279e8bd44df876825d1e44772f17c1d693e39e80ed630e0a` |
| `experiments/formkit-react-patterns/core/provider-components.mjs` | `10d76c979b3c7cd2f994248864ca8cb51e857ae7b37bbf8e8403be5057574971` |
| `experiments/formkit-react-patterns/core/formkit-application.mjs` | `9b4f3c2dc3476b7b1d3362b4c8d374f5c12a75b6e5ae94b0c3b937f5f1fc8b43` |
| `experiments/formkit-react-patterns/core/section-renderer.mjs` | `1e44011592c539d09ee4450e2ac65c5424d2d017de95f7dfc72a4740687122b6` |
| `experiments/formkit-react-patterns/core/component-library.mjs` | `ded0fc66cc2dbe0703c2954994299e4842c6af675616f59fda8fb0aaefb14e8f` |
| `experiments/formkit-react-patterns/core/value-facade.mjs` | `0b33e5368e553ecf1b5a8401a1eee1c302252280ad3aa6fbc1e90467513cd4a7` |
| `experiments/formkit-react-patterns/core/schema-layout.mjs` | `5d7ccac7752a3dd2bf0e672b0ac9ec7281001709330a3bbd9c024e29fba7c1e8` |
| `experiments/formkit-react-patterns/core/root-slots.mjs` | `d7b89467696fb8ff8bca322669ffa2f8c46c01f489642078a91937efc596843d` |
| `experiments/formkit-react-patterns/core/schema-registry.mjs` | `875976e270aa860e9ef80f9b3d85f5ef69256b0aa1092f976d4561ab60ed506c` |
| `experiments/formkit-react-patterns/core/scope-properties.mjs` | `f570755542251b990dfb35c1c94f1487ca03de029337f3af719d7bce11fe5745` |
| `experiments/formkit-react-patterns/core/schema.mjs` | `4ef3bf5f965df1d177262f62c1f5930a158a8e97efcbc04b74438d4b846af308` |

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

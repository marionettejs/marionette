# Local FormKit integration with released Marionette 5.2.0

This candidate is private and unpublished. Its repository base is the exact
Marionette release commit 1b694b5420391f4800f00cb032981262d0b3b2a0. The release
itself contains no FormKit package. The older public draft is used only for the
identified development scaffold. Runtime modules and declarations come from the
verified d310f355 retained tarball, preserving its FormKit2.9 parity changes.

Eight modules match the draft, nine differ and five are absent there. All22retained
runtime sources were preserved before the three local shadowed-parameter renames
required by current release lint rules. These renames change no public arguments,
return values or command/settlement policy. The first rebuilt package's six
executable JavaScript files exactly matched d310f355. No wrapper-v3/browser patch
or missing private test tree is reconstructed from summaries.

Use source profile Node24.19.0/npm11.17.0. From the repository root, install both
frozen graphs (the root tools are needed by the shared ESLint configuration):

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix packages/formkit ci --ignore-scripts --no-audit --no-fund --workspaces=false
npm --prefix packages/formkit run check
npm --prefix packages/formkit run coverage
```

These are separate normal dependency directories, not an artificial root symlink
to package dependencies. Install scripts are disabled; explicit checks run afterward. The package graph uses official npm
marionette/@mnjs/radio/@mnjs/utils5.2.0 and all FormKit runtime/reference peers2.9.0.
The package-private flag and root released workspaces/release guards are preserved.
No credentials, TCM source, licensed Pro, Mac tests, remote push or npm release.

Fresh check results and exact commands are under the sibling integration evidence
directory. Initial source35/35, strict declarations and packed ESM/CJS behaviors
pass; initial lint's three no-shadow diagnostics are preserved separately. Extra
unchanged public regressions are restored from known2dff34b test source, with exact
file hashes, and must be freshly run on this graph. Their old results are not reused.
Final counts/any failures belong to the final evidence receipt, not this paragraph.

The source snapshot/declarations and new package hashes identify this candidate;
version0.1.0 alone does not. Scope is package compatibility and retained behavior.
Historical TCM, actual Pro, browser/device/IME/physical focus/performance and full
host persistence are not certified. Chromium timing work is owned separately.

Package-only scope retains the compatibility baseline and excludes the held startup
performance candidate. Current binding reproduction is package-local/locked2.9;
historical sources are immutable links, not live relative dependencies.

## Package-scoped hosted verification

`.github/workflows/formkit.yml` verifies this private, non-workspace package against
its released npm peers. It uses the repository source toolchain profile, installs
repository lint tools with scripts disabled, then installs the package-local lock
with `--workspaces=false` and runs `npm --prefix packages/formkit run check`.
That command verifies binding reproduction, lint, build, public source tests,
strict types and actual packed consumers. A separate coverage step verifies that
the report includes every active runtime module and retains coverage/verification
reports on both success and failure. Root installation supplies the shared
ESLint configuration's imports; it does not build or select local Core artifacts.
FormKit is not added to root workspaces, release units or publication workflows.
Hosted execution requires a pushed revision; local replay is separate evidence.

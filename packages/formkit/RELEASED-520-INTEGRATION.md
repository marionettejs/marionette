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

Use the package-local frozen lock and source profile Node24.19.0/npm11.17.0.
`npm ci --ignore-scripts --workspaces=false`, then run check:bindings, build, test, check:types,
check:package and lint. Scripts are disabled during dependency install; explicit
build/check scripts are run afterward. The package graph uses official npm
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

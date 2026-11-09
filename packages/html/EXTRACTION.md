# Runtime-only extraction: 2026-11-08

The initial package now contains the browser renderer and Marionette DOM API.
Experimental compiler/Vite work is preserved separately, not discarded:

- Full working-tree backup: `../mnjs-html-compiler-extracted-2026-11-08/full-working-tree/`.
- Extracted files: `../mnjs-html-compiler-extracted-2026-11-08/extracted-files/`.
- Verification: `../mnjs-html-compiler-extracted-2026-11-08/backup-manifest.json`.

Before removal, all 1,533 regular files/symlinks were compared by SHA256/length
or target (41,480,653 file bytes). Git state, licenses, source, generated output,
compiler toolchain, tests and evidence were included. External dependency
symlinks remain recorded external dependencies, not a standalone installer.

Removed from the initial runtime surface: compiled factories/descriptors,
compiled-only entrypoints and helper types, compiler/Vite scripts and tests.
Useful ordinary tags, directives, asynchronous cleanup, static and trusted
markup APIs remain. The internal `lit-html.ts` file is now `renderer.ts`;
public package imports and upstream notices are unchanged.

The separate experiment retains its early-call ESM cycle limitation and
unverified consumer TypeScript emission concerns for later work. These are not
features of the runtime-only package. Earlier compiled CPU/memory results remain
bound to their frozen artifacts in the sibling benchmark evidence directory;
new package output must be compared before applying those measurements.

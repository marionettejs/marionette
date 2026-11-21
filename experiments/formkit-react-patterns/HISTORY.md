# Historical experiment receipts

The active runtime lives in `packages/formkit/src/runtime`. Current executable
acceptance/reference fixtures remain under `core`, using those package sources.

191 generated receipts and16 inactive checkpoint files are retained permanently
at published commit [`8f0c03fc`](https://github.com/marionettejs/marionette/tree/8f0c03fc79420981b5400d50f39b3a66ab5f0013/experiments/formkit-react-patterns).

- [Exact historical evidence tree](https://github.com/marionettejs/marionette/tree/8f0c03fc79420981b5400d50f39b3a66ab5f0013/experiments/formkit-react-patterns/evidence), Git tree `d93ea54f3a9d9cc70d3d0036acd60a6d8a5729e2`.
- [Inactive checkpoint source](https://github.com/marionettejs/marionette/tree/8f0c03fc79420981b5400d50f39b3a66ab5f0013/experiments/formkit-react-patterns/core/checkpoints), Git tree `4665eb900402a7e312bd7d5ee86e4ae07ceb9990`.

Source links and receipt counts in older reports retain their creation-time
meaning. Resolve their historical evidence/checkpoint paths at that immutable
commit. The three `checkpoints/pre-teardown-simplified` modules remain here because
the retained placement comparator imports them. The current comparator's original
TypeScript provenance remains intact.

This is review-scope cleanup after all872pre-cleanup files passed root lint;
no active diagnostic or maintained test was removed. A complete Git-produced
archive is retained in the relocation handoff, SHA256 `a40dae35106bad35ac18cfdaf3ba14f6ea98ddec9ab849b22e5faaa3f9dad97a`. The published
commit, rather than a local workspace, is the durable source of every removed file.

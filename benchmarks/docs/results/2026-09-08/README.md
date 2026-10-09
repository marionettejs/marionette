# September 8 documentation trial evidence

Three independent Codex subagents received one task each in fresh directories,
with installed package artifacts and an explicitly invoked copied Marionette
skill. They had no previous implementation conversation or acceptance tests.
The exact model identifier was not captured; these results are not a reproducible
model comparison. No provider API or paid inference service was configured.

All three implementations completed and passed their own checks. After completion,
the controller copied the withheld acceptance runner into each workspace and ran:

```sh
node acceptance.mjs latest-navigation
node acceptance.mjs editable-list
node acceptance.mjs widget-lifetime
```

Each command exited successfully and printed its passing task name under Node
24.19.0 with jsdom 30.0.1. The saved solutions, self-authored checks and reading
reports are included beside the exact documentation snapshot identity. The
snapshot includes local changes; its base commit alone cannot reconstruct them.
This record does not claim an immutable released artifact or scored benchmark.

The widget reader identified an inaccurate instruction implying a detached View
needed a new Region. The same emptied Region can show it again; the canonical
Region prose was corrected in the subsequent line audit. No acceptance failure
was discarded. The navigation agent initially found Node22, then reran its helper
and tests with the available Node24 executable.

These are finite implementation and retrieval trials, with explicit skill
invocation. They do not measure automatic discovery, token savings, comparative
reliability, real-browser focus, assistive technology, or complete-application
composition. The current task runner and acceptance tests are described in the
[parent procedure](../../README.md).

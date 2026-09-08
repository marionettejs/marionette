# Editable list implementation trial

## Reading path

1. Read `TASK.md` and `.agents/skills/marionette/SKILL.md` in this task directory.
2. Inspected `package.json`; there is no application lockfile or existing runtime configuration in the task root. The dependencies are local tarball builds, not a verified published release. No dependencies were changed.
3. Ran the installed skill's `scripts/docs.mjs --project /tmp/marionette-docs-trial-20260908-a/editable-list --list` and `--page docs/agents.md` with Node 24.19.0.
4. Read the installed documentation for installation, integration selection, CollectionView, DataApi, and the data package. The initial combined read was truncated, so I subsequently read the CollectionView rendering/lifecycle sections directly. Read relevant View attributes, Region destruction, and View attachment sections, then the forms/accessibility guide. Checked the data package's exports and declaration entrypoint.

The helper verified the packaged documentation and reported Marionette `5.0.0-alpha.2`, source revision `5bb66c7f1559ae3902db06847a378e9e5c3907a7`, `sourceDirty: true`, and content SHA-256 `36a974040fa13f483e68a213029e313c96339dd16384343a39e40964ac373f00`. The optional Marionette packages in the manifest also use `5.0.0-alpha.2`. Dirty-source provenance does not establish an immutable release or independently prove runtime/documentation equivalence; the implementation was exercised against this installed runtime.

No library checkout, acceptance tests, sibling trial directories, network sources, or documentation-linked test fixtures were inspected.

## Choices

- `solution.mjs` exports `createList({ el, records })` with the requested view, native Collection, mutations, and disposal operation.
- Configure `DataApi` on the row and list subclasses before constructing them. Native DOM behavior and function templates remain in use. No StateApi, router, isolated runtime, or extra integration is needed.
- A Region owns placement of the list inside the supplied mount. The CollectionView owns row creation, ordering, and destruction.
- Each row renders fixed markup with a wrapping native label. Record labels enter the input through its `value` property, and ids enter the root through declarative attributes. Record text never becomes HTML.
- Drafts stay in the existing input. Mutations call public `collection.add`, `collection.remove`, and `collection.move` directly. There is no collection rerender, reset, custom reconciler, or draft synchronization back into the model.
- `dispose()` destroys the Region and its list/rows, then destroys the feature-created collection to release its model subscriptions. The supplied mount remains available. Collection destruction does not destroy its models, per the native package contract.

## Validation actually run

This directory is not a Git repository; the initial `git status --short` failed for that reason. The application defines no test script, so I added `validate.mjs`, a focused Node assertion check using the already-installed jsdom.

Command:

```sh
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node validate.mjs
```

Also ran `/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node --check solution.mjs` (exit 0).

Behavior check result: exit 0, with the PASS summary. Assertions verify:

- Native Collection and Marionette View/CollectionView instances; list placement and managed attachment state.
- Initial values, root ids, and native input-label association.
- A surviving row's exact View and input identity plus unsaved value while adding, moving, and removing other rows, and moving the edited row itself.
- Source label remains unchanged by the local draft; correct DOM order after each mutation.
- A markup-shaped label stays literal input text.
- Removal destroys its child; disposal destroys all remaining children and the list while retaining the mount; repeated disposal is harmless.
- Empty-list add/remove and numeric id `0`.

## Remaining browser-specific uncertainty

Validation used jsdom, not a real browser. It set a draft and dispatched an input event rather than driving real keyboard input. It does not establish browser focus/selection retention during DOM moves, keyboard or IME behavior, layout, or screen-reader announcements. The test checks label association, not an assistive-technology session. A real-browser interaction check remains necessary for those claims.

## Documentation usability

The DataApi page explicitly distinguished non-destructive reorder notifications from destructive reset/rerender behavior, and the data package guide named `move(modelOrId, index)`. Those passages were enough to select the implementation without inspecting framework internals. The forms guide supplied the local-draft and safe-value-assignment pattern, and lifecycle guidance justified mounting through a Region.

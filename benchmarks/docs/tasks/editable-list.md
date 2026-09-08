# Update a list without losing an unrelated edit

Use the installed Marionette skill and documentation to implement `solution.mjs`.
The application uses `@marionette/data` for observable records and collections,
with the default renderer and DOM behavior. It does not need a router or observed
local selection state.

Export `createList({ el, records })` where `records` is an array of objects with
unique `id` and `label` values. Return:

- `view`: the Marionette CollectionView owning the rows, mounted inside `el`;
- `collection`: the native Collection whose records back the rows;
- `add(record)`: add one record;
- `remove(id)`: remove one record;
- `move(id, index)`: move an existing record;
- `dispose()`: destroy the list and its children, retaining the supplied mount.

Each row is a Marionette View. Its root has `data-id` equal to the record id and
contains an input with an accessible name and an initial value equal to `label`.
Typing creates an unsaved local draft. Adding, removing, or moving another row
must preserve the input element and its unsaved value for surviving records.
Use the native collection's public operations and Marionette's child management.
Do not implement a second child reconciler or install unrelated integrations.

In `REPORT.md`, record your reading path, choices, validation, and any remaining
browser-specific uncertainty. Do not read acceptance tests or modify dependencies.

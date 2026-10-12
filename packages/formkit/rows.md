# Row ownership acceptance supplement

`RowView<Values>` and `RowOptions<Values>` are public exports of `@mnjs/formkit`.
The values type is inferred from the supplied `FormView`; an explicitly typed
subclass uses `RowView<ContactValues>` and `RowOptions<ContactValues>`. Runnable
public declaration consumers live in `test/types/formkit-rows.mts` and `.cts`.

A row accepts ordinary Marionette View options plus:

| Option | Contract |
| --- | --- |
| `form` | The FormView owning the root. |
| `parent` | A live FormKit list node owned by that form. |
| `rowKey` | The existing item's nonempty string business key. |
| `removal` | `preserve` for temporary placement lifetime, or `clear` for terminal array deletion. |

The list is an owned FieldView with `input.type: 'list'`, `dynamic: true` and a
string `itemKey` property name. Every item is an object with a unique immutable
string key, unique within its own list. A RowView exposes
its genuine group `node` after first render; descendant FieldViews use that node,
or a nested group node, as their explicit parent. DOM nesting does not select a
data parent. One live placement may borrow a row group at a time.

To compose two levels, render an outer RowView, show a list FieldView with
`parent: outerRow.node`, then show inner RowViews with `parent: innerList.node`.
Use the same FormView and the existing `itemKey`, `rowKey` and removal APIs at
each level; key property names and removal policies may differ. Each ancestor
array must be crossed through its owned RowView group; an unowned Core group inside an
intervening array is rejected. Keys are local to each list: inner key `x` under
outer key `a` is independent of inner key `x` under outer key `b`. Nested groups
between the owned row and its list are allowed. `/nested.html` demonstrates this
composition with native labelled fields and ordinary CollectionViews.

The form array controls business membership and order. Use `form.setValues` or
`listField.setValue` for authoritative writes, including key replacement as
remove/add. An ordinary CollectionView and its optional observable collection
control presentation separately. Display sorting or filtering does not rewrite
the business array. A delayed first mount resolves the key's current index.

Use preserve RowViews in a CollectionView that can rerender, filter, or remove
rows from the display. The list retains their genuine groups and committed data;
row descendant fields release their validation, delayed work and listeners when
the row View is destroyed. The retained group's own validation/messages remain.
An initially filtered row has not rendered its leaf fields and therefore has no
leaf validation. Filtering a rendered row detaches it and retains validation.

Clear RowView destruction deletes that business item, including under a preserved
list. It is terminal data removal: a full CollectionView render cannot recreate
clear rows from an unchanged collection after destroying them. Keep rebuildable
display rows preserved and make business deletion an explicit authoritative write.

Construction values define reset membership and defaults. Values are copied;
editing one row or another same-named form does not mutate shared initial data.
First-mounted defaults for newly added rows do not append those rows to reset
membership. Cleared descendant defaults and exclusions follow business keys
through reordering and list remount. Authoritative row deletion retires those
logical exclusions even while the list placement is absent. Nested defaults and
exclusions follow the complete ancestor-key chain, including through outer and
inner reordering. Removing an ancestor retires descendant defaults/exclusions;
reusing the same keys creates a fresh lifetime.

A same-membership reset retains keyed row controls. A membership-changing reset
ends row placements/groups before official reset, then the ordinary owner
rebuilds its CollectionView from the final reset values, such as in `form:reset`.
It does not promise surviving-widget identity across that reset. Root destruction
also releases detached row placements and retained groups. Outer deletion ends
inner placements, nodes, listeners and pending work, including detached Views.
Nested edits/removal use the same submission settlement and cancellation contract
as other fields. Two owned array levels are tested. Broader depth certification,
mutable row keys and arbitrary direct Core writes are outside this slice.

`test/unit/formkit-rows.spec.js` exercises public construction and ownership:
three keyed nested-object rows, addition/insertion/reordering, native edits,
validation, terminal removal, remount/reset, independent same-named forms,
delayed/detached work, duplicate ownership and unrelated host survival. The
independent 34-case suite remains preserved outside this checkout and is replayed
through the public entry, with original assertions unchanged.

`test/unit/formkit-nested-rows.spec.js` adds eight independently authored cases
for repeated local keys, two-level reorder/focus/errors, defaults and exclusions,
ancestor deletion/recreation, detached cleanup, both reset paths and asynchronous
validation/submission cancellation. They fail against the prior array-ancestor
restriction and pass against the nested implementation. The repository acceptance record is
`packages/formkit/acceptance/NESTED-ROWS.md`.

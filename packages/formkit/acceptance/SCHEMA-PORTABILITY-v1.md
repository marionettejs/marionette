# Schema portability contract proposal v1

Status: prospective review; no package alias implementation yet. Paul explicitly
requests same schema meaning across adapters. G6 is new and is not covered by the
frozen v8 BUILD/CHANGE comparison. That comparison and its source artifacts remain
unchanged. This contract concerns FormKit schema data, not Vue API parity.

## Evidence and candidate binding

Official schema references resolve explicit data-object properties; `$values` is
not intrinsically Vue-specific or a global node registry. Pinned Vue2.1.2 resolves
scoped slot/iteration properties first and its supplied data object as fallback.
An explicit `data: { values: rootModel }` therefore stays root-bound within native
groups and row iterations unless a nearer supplied scope intentionally shadows
it. Verify this in an isolated installed-runtime proof before production changes.

Candidate default: application schema `$values` reads the owning FormView's
current committed root node.value through a live read-only binding. It does not
silently become a borrowed group/row value. `$node` retains its current local
meaning. Row-local expressions use declared loop variables; explicit data bindings
may deliberately provide other values, with documented precedence matching the
supported shared data contract. Preserve explicit schemaData.values (including
null/undefined) rather than silently overwrite a caller's existing data name.
Replacing schemaData without values restores the default root binding. Scope keys
and name-collision behavior need independent review and executable probes.

Form-owned changes use existing Core commits/context refresh/composition resources;
no second state store, additional lifetime or Marionette core/template changes.
Arbitrary external data is updated through existing FormView.setSchemaData and
SchemaView.setSchemaData; raw object mutation alone promises no notification.
Standalone createSchemaRenderer remains an explicit caller-owned data boundary.
Functions, constructors and custom validation/component registrations remain outside
the plain JSON schema. No invented `$root`/`$parent` convenience aliases.

## Shared integration boundary to review

- FormView application schema: root native schema slot data/mountFormSchema.
- SchemaView application schema: data provider plus borrowed local node.
- Native input/group/list child slots and FieldView slots: inputFactory/scopedSlots
  and explicit supplied schema scope, including ignored actions with no parent.
- Named component factories: evaluated schema props/data passed through the existing
  registry; ordinary custom View template context is consumer-owned and unchanged.
- Renderer context override/collision rules must stay consistent at these paths.
  Caller-provided slot `{schema,data}` replaces a scope and requires an explicit
  documented binding; do not imply arbitrary external data is automatically watched.

## Concrete acceptance cases

| ID | Observable case |
| --- | --- |
| P01 | Same external JSON root invoice condition responds to native edits without whole-form render; unrelated control/focus stays stable. |
| P02 | Root invoice and nested invoice disagree: `$values.invoice` remains root-bound in nested group; local node/explicit path is distinct. |
| P03 | Repeated row variables remain row-local while `$values` stays the declared root binding; edits and keyed reorder follow business identity. |
| P04 | Borrowed SchemaView group/RowView and native group routes receive the same explicit root values binding; one canonical graph/value per field. |
| P05 | Shared ordinary required/email/minimum rules produce genuine invalid/valid outcomes and associated native errors. |
| P06 | Programmatic public form/node input refreshes conditions and named-component props automatically. |
| P07 | Public reset restores construction values and conditions; membership-changing identity stays within existing documented bounds. |
| P08 | External flag updates through the supported schema-data setter refresh UI; raw JavaScript mutation alone has no promised notification. |
| P09 | Explicit schemaData.values collision/null/undefined wins per reviewed contract; data replacement without that key restores live root default. |
| P10 | FieldView native slots, recursive group slots and registered custom Views receive supported bindings without ordinary template context changes. |
| P11 | Same schema with different actual runtime registries drives equivalent props/visibility; constructors never enter JSON. |
| P12 | Repeated mount/destroy, detached placements, row replacement and stale callbacks release actual nodes/subscriptions/listeners, with runtime errors/unhandled rejections hard failures. |
| P13 | Installed ESM/CJS/types and dependency audit preserve public delivery and no Vue/React/Pro runtime dependency. |
| P14 | Required affected/full checks and all FormKit source line/branch coverage pass unchanged policy at the final checkpoint. |

These are framework-neutral semantic outcomes, not byte-identical DOM, generated
IDs, Vue component lifecycle parity, all third-party input/plugin compatibility or
an authoring-productivity claim. React's public FormKitSchema/data/library exports
must be verified before extending certification; no new React adapter is in scope.
The current schema/common API-reference pages are not proof that those packages
are published: fresh registry checks still returned404 for @formkit/schema/common,
while Vue and React2.1.2 are available MIT packages. Existing code already uses
Core's public compiler/sugar/registry and official native definitions.

Primary sources: https://formkit.com/essentials/schema and
https://formkit.com/api-reference/formkit-schema; pinned installed Vue2.1.2 source
readback and package availability proof are recorded under the separate local
schema-portability-evaluation evidence. No package/source implementation was changed
for this proposal, and no release/publication action is authorized.

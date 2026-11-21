# Input factory libraries

Installed Vue/React 2.5 both build an input schema library from their default
FormKit component, `node.props.definition.library`, then the input's `library`.
The experiment previously passed only its global `components` registry.

The independent `component-library.mjs` proposal resolves:

1. Adapter built-ins and user `components`.
2. The current input `definition.library`.
3. The current field spec `library`, or `formProps.library` for root sections.

A later entry overrides an earlier entry. Every entry must still be a portable
factory when used by the renderer; native Vue/React component objects require
explicit adaptation. No unrelated component implementations are added here.

The separate index hunks use this resolver for initial input sections,
redraws, input named-slot schemas and root form sections. Replacing/removing a
field's library redraws that input's presentation with the latest spec library
while retaining its Core node. The current local library is assigned before
slot updates so a simultaneous slot/library update cannot briefly resolve the
old factory. Removing field.library falls back to definition.library even if
other existing prop-removal behavior leaves node.props.library stale. This
patch handles schema factory resolution; it does not repair all general prop
removal semantics. In-place mutation without a notified replacement is not a
new reactive contract.

Run `node core/component-library-test.mjs`. It exercises actual custom input
schemas, global/definition/field precedence, replacement/removal, named slots,
root sections and matched factory creation/destruction. The resolver and these
index changes can be integrated independently of the helper module.

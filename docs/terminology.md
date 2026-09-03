# Marionette v5 terminology

Use these names consistently in public APIs, documentation, diagnostics, tests, and
new source. Historical migration material may quote an older name when the distinction
is necessary to explain a real migration.

| Canonical term | Permitted context | Rejected synonyms | Justified distinction |
| --- | --- | --- | --- |
| model, models, ordered model snapshot | Collection data and CollectionView change records | item, items | Added, removed, previous, current, identity, key, and same-key replacement all qualify model. |
| `DataApi`; Data API | Object identifier; document or conceptual area | DataAPI, data api | `models(collection)` returns the current ordered model snapshot. |
| `StateApi`; State API | Object identifier; document or conceptual area | StateAPI, state api | State sources are separate from model and collection data. |
| `DomApi`; DOM API | Object identifier; document or conceptual area | DOMApi in code, Dom API in prose | Use the exact exported identifier only when naming the object. |
| default runtime, isolated runtime, runtime classes, selected runtime | Default exports; `createMarionette()` result; classes owned by a runtime; consumer selection | root runtime, independent runtime, class family, factory result | An owner-local `createState()` result is an owned state source, not an isolated runtime. |
| lifecycle operation, readiness hook, readiness phase, before event, completion hook | Application start, stop, restart, and destroy | readiness method, readiness handler, stop-readiness hook, destroy-readiness handler | Only readiness hooks are awaited; completion hooks and `before:*` event listeners are synchronous notifications. |
| child View, host View, owning View | View ownership and lifecycle responsibility | item view | Name a concrete role such as row only when the example domain supplies it. |
| child Application, parent Application, root Application, hierarchy | Application ownership | topology, composition tree | Ownership is one-way: parents locate and control children; children receive collaborators explicitly. |
| adapter contract, default adapter, adapter override, adapter replacement, integration | Runtime customization | interchangeable API, adapter, integration, provider, mixin, or overlay labels | Selection, partial override, complete replacement, and installation are distinct operations. |
| idempotent cleanup function | Function returned by adapter registration | disposer, unsubscribe as a noun | Internal helpers such as `disposeAll` may retain implementation-oriented names. |
| `marionette` | Current package imports | `backbone.marionette` | The old package name is valid only in historical migration material. |

Public API names override prose preferences when documenting a retained contract.
The shared `models` vocabulary does not erase shape distinctions: `DataApi.models()`
returns the source's raw ordered model snapshot, while the default
`serializeCollection()` result contains each model's serialized value. An override
may return another shape; when no model is present, the template receives that result
as `models`.
Code that must prove a removed API may name it in a negative assertion.

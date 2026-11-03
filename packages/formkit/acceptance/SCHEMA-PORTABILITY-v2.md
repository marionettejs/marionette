# Shared schema contract v2: explicit root data

Status: independently reviewed boundary; final normal-installed16-case shared slice passes.
Stronger shared terminal-lifetime certificate remains blocked by a reproduced
official Vue post-unmount native input fault. See LOCAL-CHECKPOINT.md. This
reconciles v1 with the pinned Vue/React function audit. G1–G5 and frozen v8
BUILD/CHANGE artifacts retain their original scope and results.

## Binding and scope

Use byte-identical external JSON schema. `$values` is an explicitly supplied data
name, bound during mounting to the current committed root values. MN can supply a
schemaData getter returning form.node.value; Vue supplies its reactive root model.
This is permitted adapter mounting/context wiring. Neither schema nor expected
meaning changes inside a group or row. `$node` remains the local native/borrowed
node; row-local expressions use declared loop variables. No automatic default
`$values`, `$root` or `$parent` is added for this certificate.

Caller data may contain own or inherited getters/functions. Lookup preserves the
actual caller receiver; internally created loop/native scopes are distinguished
from real business-object prototypes. A nearer full-token result of undefined
falls back to its enclosing scope; a final null result remains null. An explicitly
supplied root values key with undefined or null has that meaning, without an
invented root fallback. Omitting values on data replacement removes the binding;
the mounting adapter must explicitly retain it when updating other flags.

A supplied slot `{schema,data}` replaces its scope. The caller explicitly includes
any root-values binding it needs. Direct FieldView slots and borrowed SchemaViews
follow this same explicit wiring boundary. Ordinary Marionette templates keep their
consumer-owned context. A getter-only binding does not deeply freeze its returned
value; writes use owned form/Core setters, not raw object mutation.

Native commits and supported public programmatic writes refresh form-owned
schemas without whole-form render. External data uses FormView.setSchemaData,
SchemaView.setSchemaData or standalone renderer.update. Vue uses reactive data;
the final observable schema outcome is shared, not framework event spelling.
Standalone createSchemaRenderer has no implicit form owner.

Named components use the same JSON names and prop expressions with separate real
trusted implementations. Functions/constructors remain outside JSON; a JSON
expression may resolve to a callback. Plain prop containers are snapshotted while
opaque/function/Core identities are retained. Immutable field identity requires
an explicit key replacement. No Vue/React/Pro dependency enters the MN package.

## Execution obligations

| Case | Shared observable outcome |
| --- | --- |
| P01 | Root invoice condition follows native edits; unrelated focused control is retained. |
| P02 | Nested local invoice disagrees with root; `$values.invoice` stays root-bound. |
| P03 | Keyed repeated rows retain local variables, root values, canonical nodes/errors and focus during reorder. |
| P04 | Borrowed group/row SchemaView and direct FieldView slots explicitly bind the same root values; no duplicate graph. |
| P05 | Real required/email/minimum validation blocks invalid submission and displays associated native errors. |
| P06 | Public programmatic values update conditions, native controls and actual named-component props. |
| P07 | Public reset restores construction values/conditions and clears state; no new server baseline is implied. |
| P08 | Supported external flag updates refresh UI while preserving explicitly supplied values binding. |
| P09 | Explicit root values object/null/undefined/omission and nearer lexical undefined/null are distinct; no hidden alias. |
| P10 | Native/group/FieldView slots and actual custom Views receive the explicitly declared scope. |
| P11 | Same serialized schema resolves genuine adapter registries/callbacks; callback updates retain DOM/focus. |
| P12 | Repeated mounting, detached placements, replacement and destroy release nodes/listeners/subscriptions; faults hard-fail. |
| P13 | Installed ESM/CJS/types/dependency checks remain valid, without runtime framework dependencies. |
| P14 | Required affected/full checks and100%FormKit source coverage use unchanged policy at the identified checkpoint. |
| P15 | Inherited caller methods bind the instance; lexical root-function and primitive positive controls stay correct. |
| P16 | String/array inputErrors mount/update; overlapping owners cannot erase one another's errors. |
| P17 | Withdrawn absent-target error messages cannot reappear on a later mount. |
| P18 | Decimal DOM representation remains when numerically equivalent; authoritative writes supersede pending drafts. |

## Open requirements and limits

Automatic owning-root values defaults remain a prospective convenience, not a
missing upstream global. Reset/server rebasing and full error-clearing policy
remain open product requirements; the nine provisional adapter differences do
not accept permanent exclusions for them. Nested custom RowViews are now a
separately authorized two-level extension, recorded in NESTED-ROWS.md; the original
first-slice and shared-schema certificate retain their measured scope. The
inspected application's discard uses destruction/fresh mount.
No new reset or error policy was approved. Engine/UI and host source inspection
is now available and reconciled; actual runtime transport and paid controls remain
unverified. See [GOAL-STATUS.md](GOAL-STATUS.md) for the current distinction between
supported contracts, broader open requirements and precise external blockers.

The strict same-metadata File replacement probe still fails in Core, MN and Vue.
It is preserved as an unresolved dependency limit; it is not accepted or counted
as repaired. Ordinary JSON-value portability and opaque reference-copy preservation
do not guarantee that replacement. See KNOWN-CORE-FILE-EQUALITY.md.

React is function-by-function source-reviewed, not runtime-certified by this
Vue/MN certificate. SSR/StrictMode, every plugin/paid input, all engine/AT behavior,
changed-membership surviving-control identity and arbitrary Core graph mutation
are not asserted. No frozen author trial is repaired or rerun for a better result.

Independent source/contract review: pinned FormKit2.1.2 commit
411222eefaef67fb75abc1216108b2c8a6216033;47 capability rows and298 function/
responsibility entries. Review and unchanged correction evidence are preserved
under the local handoff independent-review directory. The original v1 remains
recoverable; this v2 implements no new public alias/API.

Final source checkpoint262945b5: all repository checks, nine production modules
plus the experiment at100%all4 coverage, installed formats/types and Chromium10/10
pass. Independent paired slot/control/graph/receiver assertions pass before the
strict Vue retained-native-control post-unmount hard failure; the minimal baseline
red and stronger P12 outcome remain preserved, not waived.

# Native single select independent review

Index SHA256 `992bf948b39263dc7e55b655cb53a0329fa96e8db58efc8e0a309078c33b13ce`; renderer `df349fb68769137a6a6e8beaa17de8ad315c88203480f11041149fc5f10295fc`.

Scoped acceptance for the ordinary flat native-select fixture and browser validation, not full upstream/original parity.

Independently reran `core/select-test.mjs`, `core/select-parity.mjs vue|react|experiment`, `review/composed-native-form.mjs`: pass. The composed case covers nested text/checkbox/select, invalid and valid submission, conditional required field through application-managed setFields, retained edited control, server-error presentation, payload, removal, reset and teardown. It is NOT full FormKitSchema.

Added `review/select-adverse.mjs`: external values7/false/distinct string, live selected property, typed false input, reordered options retaining value/node/select, disabled property, help IDREF, placeholder/multiple/optgroup rejection before mutation, reset and inactive removed control listeners pass. Native keyboard/disabled user activation remains browser-owned.

Stable function token change reviewed: any function-valued token prevents identity-only skip on owning context notification; this correctly covers upstream isSelected reading closed-over state. It is conservative local reevaluation, not proof of fine-grained dependency tracking or whole-path performance. Silent external state still requires explicit refresh; no new callback recovery requirement.

## Boundary discovered

Do not claim every scalar maps uniquely. `review/select-scalar-parity.mjs` uses0,false,'0': Vue and alternative select index3 for each; React returns0/0/1. This is an observed upstream semantic divergence/collision, not evidence to invent alternative coercion. Initial adverse test expected Object.is selection uniqueness and failed; that expectation was withdrawn after direct upstream reproduction. Ordinary distinct7/false/string fixture passes. Preserve this limitation and avoid describing it as exhaustive typed-value parity.

No source edits or push. Theme icons, native keyboard, scroll and broader schema/components remain separate gates. README's earlier checkbox paragraph still says select unsupported; new select section supersedes it, but remove stale wording for clarity.

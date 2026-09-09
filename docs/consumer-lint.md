# Consumer ESLint rule

Starting with beta.2, Marionette provides an ESLint flat-config plugin at
`marionette/eslint`. Beta.1 does not export this subpath. Use the documentation
matching the package artifact you installed.

```javascript
// eslint.config.mjs
import marionette from 'marionette/eslint';

export default [marionette.configs.recommended];
```

The plugin requires ESLint 10. It has no runtime effect on a Marionette
application and does not load any Marionette runtime module.

## `no-private-framework-members` (`MN0040`)

The recommended config reports dot-property access to a known private framework
member when the receiver is proven to be a Marionette instance. The rule follows
aliased named and namespace imports, local native subclasses, `.extend()`
hierarchies, and constant variables initialized with `new`.

The private-member inventory is derived from the authored framework source and
checked for stale names. It is a lint implementation detail, not a promise that
private names will remain stable. An application's own `_field` is not assumed
to be private framework state.

Computed properties, shadowed imports, mutable receiver or constructor bindings,
and receivers whose identity cannot be proven are not classified. The rule has
no autofix because choosing a public replacement requires application knowledge.

## Deferred checks

Literal UI-reference and named-handler checks are deferred. Marionette permits a
subclass or constructor options to replace an inherited `ui` or event map, and
`initialize` or `preinitialize` may install a named handler before delegation.
A rule that inspects an extensible base definition alone would reject these valid
patterns. These checks should ship only with a bounded construction model that
can prove the effective configuration and handler surface.

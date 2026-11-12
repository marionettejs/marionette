# Narrow schema controller, separate from form integration

`createSchemaController({node,schema,onFields})` projects genuine FormKit-schema objects to the core's flat field specs. `node` is the Core form; `onFields` normally calls `instance.setFields`. Return value exposes `destroy()`; Core destruction also ends observation. Initial projection is synchronous; later notified updates coalesce in a microtask.

Supported: arrays of `{$formkit:'text',name,label,validation,disabled,if?}` and `{if,then,else?}` conditionals, with array or object branches. Literal props only. Expressions use actual `@formkit/core.compile(...).provide(...)`; e.g. `$values.f0 === 'show'`. Here `values` is supplied data bound to the observed Core form value, NOT a special upstream built-in. A reference FormKitSchema must receive the same supplied values data and notified updates.

Conditions can read only `$values.<name>` for fields declared unconditionally at top level. This deliberately excludes registry `$get`, arbitrary functions, nested paths and self-removing condition dependencies. All field names must be unique even across mutually exclusive branches. `$el`, `$cmp`, loops, slots, nested groups, dynamic labels/props, unknown keys and other input types throw instead of being silently ignored. `$formkit` objects' `if` conditions and explicit then/else branches are actual upstream schema vocabulary; these restrictions are this prototype's limits.

Expression/provider organization follows published FormKit React2.5.0 FormKitSchema patterns; see LICENSE.formkit. Core compile and observer own expression syntax and subscription discovery. This module is not the upstream renderer or a complete schema evaluator.

Run `node core/schema-test.mjs`. Tests verify then/else changes, retained stable input identity, removed Core child/value, explicit destroy and owner destruction cleanup, and rejection of unsupported schema. These are JSDOM behavior checks, not browser/performance evidence.

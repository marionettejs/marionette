# Verification and ownership

`FormView` owns its form node and schema-created children. FieldView, RowView and
SchemaView participate in the owner's lifecycle; borrowed Models, providers and
parent groups stay under application ownership. See the [form guide](readme.md),
[rows](rows.md) and [schema Views](schema-views.md) for the supported composition
and removal contracts.

From the framework checkout, use the repository's Node/npm toolchain:

```sh
npm run build
npm run test:formkit
npm run check:types
npm run check:public-tests
npm run check:api-contracts
npm run test:formkit-package
npm run coverage
npm run lint
npm run docs:check
```

The packed-consumer check exercises ESM/CommonJS, declarations, installed guides,
dependency boundaries and actual Core registry sharing. It also records whether
mixed entrypoints share a registry; use matching formats regardless of version
strings. Separate helper-consumer checks exercise the package against published
Marionette. They do not substitute for browser or licensed Pro checks.

Keep relevant source regressions and consumer fixtures with code changes. Record
the source, installed versions, commands and unsuccessful results in the review.
Do not infer performance or parity from a build, unit count or compressed size.
The [compatibility boundary](compatibility.md) lists current limitations.

## Historical records

Old logs, coverage dumps, screenshots and exploratory receipts are preserved in
[immutable commit 9b031550](https://github.com/marionettejs/marionette/tree/9b031550bb2737f052896ee0a0bfe032a54d5b55/packages/formkit/acceptance).
Their source/version attribution remains historical; they are not current release
acceptance. Removing duplicated working-tree evidence changes no runtime test,
fixture, coverage threshold, license or publication authority. The live composition
prototype and strict File-equality diagnostic remain in `acceptance/`.

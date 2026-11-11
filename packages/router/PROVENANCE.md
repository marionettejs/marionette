# Source and license

`@mnjs/router` is maintained with Marionette in the
[Marionette repository](https://github.com/marionettejs/marionette/tree/master/packages/router).
Its authored TypeScript produces the shipped ESM/CommonJS runtime and declarations.
The package uses Marionette's default Application family; it does not embed a
second Marionette runtime or an application-specific routing framework.

The package is distributed under Marionette's [MIT license](license.txt), with
its existing notice preserved exactly: `Copyright (c) 2020 Paul Falgout`.

[DESIGN.md](DESIGN.md) documents routing, readiness, cancellation and ownership
contracts. The [README](readme.md) states the tested browser boundary and runtime
requirements. Historical development and recovery receipts are not consumer API
contracts or certification of a released archive.

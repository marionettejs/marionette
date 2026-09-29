# Errors and diagnostics

Marionette reports invalid framework configuration with `MarionetteError`. Inspect the error's `code` to identify the contract, then read the matching diagnostic from the installed version. Application failures, such as a rejected API request, can remain ordinary errors handled by the application that owns that work.

## MarionetteError

Import `MarionetteError` from `marionette` or `@mnjs/utils`; within the same module format they export the same constructor. Use `new MarionetteError(options)`. Each call creates a native `Error` instance with a stack; `instanceof Error` and `instanceof MarionetteError` both work. Calling it as a plain function is unsupported.

```js
import { MarionetteError } from 'marionette';

const error = new MarionetteError({
  code: 'MN0019',
  message: 'The configured handler must resolve to a function.'
});
const diagnosticCode = error.code;
const description = error.toString();
```

The example constructs an error for inspection. Framework operations create their own errors; do not use Marionette's `MN` codes for unrelated application failures.

| Field or method | Contract |
| --- | --- |
| `message`, `name` | Supplied values override native Error values. With no supplied name, the inherited name is `Error`. |
| `code` | A string code selects `https://marionettejs.com/errors/<encoded-code>/`, overriding an explicitly supplied `url`. |
| `url` | Without a string code, the supplied suffix (default `''`) is appended to `urlRoot`, whose default is `https://marionettejs.com/docs/`. |
| `description`, `fileName`, `lineNumber`, `number` | Optional metadata copied from the options object. |
| `toString()` | Returns `name: message See: url`. |
| `captureStackTrace(fallbackError)` | Captures a native stack when supported; otherwise copies `fallbackError.stack`. Construction already calls it. |

Only the listed metadata fields (`code`, `description`, `fileName`, `lineNumber`, `name`, `message`, `number`, `url`) are copied from options. They become ordinary own fields; other option fields are ignored. Values are preserved rather than validated or coerced. Construction and formatting are synchronous, with no ownership or cleanup lifecycle. Extend the constructor with native `class extends` when a distinct application error type is useful.

## Find a diagnostic

Use the package's [local documentation helper](../agents.md#local-contract-lookup) from the application's directory. Replace `<skill>` with the installed or copied `skills/marionette` directory:

```sh
node <skill>/scripts/docs.mjs --diagnostic MN0019
```

The result includes the installed version, code status, affected objects, remediation, and diagnostic URL. Retired codes remain discoverable, but are no longer emitted by that release. Follow the installed contract before changing code: the website can describe a different release. Unknown codes are not evidence of a framework bug; first check which package/version produced the error.

Diagnostics identify invalid inputs and configuration. They do not replace application error handling, and they do not catch every possible misuse. Synchronous callback exceptions propagate through dispatch. An Application's asynchronous preparation rejection is part of its [start lifecycle](application.md); handle failure at the owning workflow boundary.

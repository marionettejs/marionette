# Pro 0.130.2 development bootstrap — 2026-11-03

**Development is free; no paid production license is required.** The supported
setup found in the package, installation guide, and CLI passes a free development
project key to `createProPlugin(projectKey, inputs)`. The earlier undefined-key
failure was a negative bootstrap observation, not evidence of a payment requirement.

The starting checkout was clean at
`a1f8fce9847fb8fbb23f366e0de51de62d162965` on
`codex/formkit-adapter-repair-20261026`. This assessment changes documentation and
adds a probe receipt only. All prior versioned receipts remain intact.

## Exact setup and source evidence

```js
import { createProPlugin, inputs } from '@formkit/pro'

// projectKey comes from the application's approved free development project.
const pro = createProPlugin(projectKey, inputs)
// Include pro in the FormView plugins option, as in the existing fixture.
```

- The published 0.130.2 README directs developers to create a project, pass its
  project key, and use Pro freely throughout development. Its declaration accepts
  `apiKey: string`; no keyless overload or development-specific package export
  is declared.
- The [official installation guide](https://github.com/formkit/docs-content/blob/aa15a7613f5d55f4cb82d725bd8807384777098d/_install/pro.md)
  documents the same plugin setup. Its all-zero example is a placeholder, not a
  functioning development key.
- The [official CLI](https://github.com/formkit/formkit/blob/006f75d8544b231d91f24668536625e35653fd07/packages/cli/src/createApp.ts)
  authenticates, selects or creates a project, sets `license: 'development'` when
  creating it, and uses the resulting project key. These paths were read only;
  no login, account access, or project creation was attempted.
- The [theme-development guide](https://github.com/formkit/docs-content/blob/aa15a7613f5d55f4cb82d725bd8807384777098d/5.guides/create-a-tailwind-theme.md)
  also specifies a free development key for its local Vite kitchen sink.

The [Pro marketing page](https://formkit.com/pro) separately advertises localhost
without a key. That conflicts with the executable setup above. No corresponding
documented invocation, CLI path, or package condition was found for 0.130.2.
This assessment does not resolve that upstream documentation discrepancy.

## Public API checks and their limits

The [probe receipt](pro-development/bootstrap-api.json) records Node 24.19.0 with
`NODE_ENV=development` and `--conditions=development`, using the previously verified
0.130.2 installed consumer packed from
`50f3519e786d8988dd2a32e7abb4c54c9c014df7`. The receipt distinguishes that packed
source from the current documentation-only checkout baseline.

| Supplied argument | Public factory outcome |
| --- | --- |
| `undefined` | Known missing-project-key error |
| Literal all-zero installation-guide placeholder | `InvalidFormKitKey` |

These checks do not use a valid development project key and do not render Pro
controls. The historical [0.130.2 browser receipt](pro-01302/native-comparison.json)
separately records the undefined-key invocation on actual localhost. Neither result
tests the working development configuration. No runtime license logic was modified,
keys synthesized, or third-party example project key reused.

An independent Astra reviewer checked the official package declarations, README,
installation documentation and CLI and reached the same bounded conclusion: a
free development project key is the documented setup, while the website's keyless
claim remains unexplained for 0.130.2. This was read-only source review, not an
independent successful Pro render.

## Current operation and blocker

The exact pending action is rendering and interacting with real Pro 0.130.2 controls
in the isolated cloud consumer using an approved free development configuration.
The selected cloud environment currently reports no configured secret/runtime
binding, and no usable existing development-bootstrap entry point has been
identified. The historical Upperline TCM consumer is not accessible evidence of a
current binding. Successful development rendering therefore remains **unverified**.

Status: **pending approved existing bootstrap**, not a requirement to purchase Pro
and not an automatic-approval denial of development testing. Continuing requires
the non-secret entry-point path or binding name for the approved development setup.
No new key was requested, account accessed, credential retrieved, or customer source
copied. No adapter production change was justified by this investigation.

PR creation remains separately denied and was not retried. This assessment stays
local; there was no branch publication, merge, release, deployment, Mac testing,
or security-setting change.

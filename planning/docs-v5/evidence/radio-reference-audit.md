# Radio reference audit

Date: 2026-09-30 (local run). Scope: Radio documentation and example checks only;
no runtime or declaration changes. Canonical page: `docs/packages/radio.md`.

## Scope and objectives

The reference covers the companion package and identifies its relationship to
core. Radio is a core dependency with standalone use, so the page does not call
it an optional data provider. Ordinary default-instance use comes first;
registry isolation is explained as an explicit choice. Examples demonstrate
messaging independently of a particular application architecture.

The existing Events page owns event semantics, and Shared class utilities owns
Application/MnObject declarative channel bindings. The package README remains a
short entry point and links the canonical installed-package reference rather
than maintaining a second full contract.

## Source and member disposition

| Surface | Implementation/declaration source | Documentation |
| --- | --- | --- |
| Package entrypoints, ESM/CJS, `Radio`, `createRadio`, `Channel`, `Requests` values | `packages/radio/package.json`, `packages/radio/src/index.ts` | Imports and registry scope; Types and entrypoints |
| `RadioApi`, `ChannelConstructor`, Channel/Requests type-and-value exports | `packages/radio/src/{index,radio,requests}.ts` | Types and entrypoints; narrowed unknown request example |
| Core Radio value and Channel/RadioApi/Requests types | `src/index.ts` | Imports and registry scope; Types and entrypoints; executable identity check |
| Default vs isolated/runtime registries | `packages/radio/src/radio.ts`, `src/create-marionette.ts` | Imports and registry scope |
| `channel`, `Channel`, named/all `reset`, validation, registry identity | `packages/radio/src/radio.ts` | Imports and registry scope |
| Channel `channelName`, `reset`, standalone construction | `packages/radio/src/radio.ts` | Channel events; Lifetime and cleanup; Standalone channels and Requests |
| `on`, `once`, `off`, `listenTo`, `listenToOnce`, `stopListening`, `trigger`, `triggerMethod` | Events composition from `@mnjs/utils` | Channel events names every member and links canonical Events contracts |
| Top-level Events/Requests forwarding and return values | `packages/radio/src/radio.ts` | Channel events; Types and entrypoints |
| `reply`, `replyOnce`, `request`, `stopReplying`, maps and context | `packages/radio/src/requests.ts` | Requests and replies |
| Default reply, Promise return, thrown exceptions, once removal | `packages/radio/src/requests.ts` | Requests and replies |
| Manual reply vs event ownership and cleanup | `packages/radio/src/{radio,requests}.ts`, `src/mixins/radio.ts` | Lifetime and cleanup; links canonical bindings |
| `tuneIn`, `tuneOut`, `setDebug`, `log`, `debugLog` | `packages/radio/src/{radio,debug}.ts` | Logging |
| Requests composition and default warning configuration | `packages/radio/src/{requests,debug}.ts` | Standalone channels and Requests |
| Private registries, debug internals, underscored fields | implementation only | Excluded as private; observable reset/tuning behavior documented |

## Verification performed

- `npx vitest run test/unit/radio.spec.js test/unit/radio-parity.spec.js test/unit/radio-public.spec.js test/unit/radio-composition.spec.js test/unit/requests.spec.js test/unit/mixins/radio.spec.js test/unit/common/bind-request.spec.js`: **135 tests passed across 7 suites**.
- Extracted the five actual JavaScript/TypeScript fences to a disposable consumer
  resolving the built public package exports. All **5 fences executed** with the
  outcome assertions in `test/docs/radio-reference-checks.mjs`.
- Compiled the TypeScript fence and **4 declaration fixtures** (`radio.mts`,
  `radio.cts`, `requests.mts`, `requests.cts`) under strict NodeNext resolution.
- `npx eslint test/docs/radio-reference-checks.mjs`: passed.

These checks verify contracts and examples, not independent reader effectiveness.
The parent integration run owns full site links, installed-package execution,
navigation, and contract-manifest migration.

## Follow-up boundaries

- No public type/runtime mismatch was found requiring a change in this slice.
- Reset removes event logging subscriptions but leaves the request tuning flag;
  the reference explains pairing tuneOut with reset. This existing behavior was
  not changed as part of documentation work.
- No benchmark, paid model call, browser run, or live publication was performed.

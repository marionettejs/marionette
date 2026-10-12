# Declared composition — isolated prototype

This entry is experimental and **not exported by `@mnjs/formkit`**. It does not
replace the public API. The historical c0789ced `showField` helper has known defects;
its earlier green suite is not acceptance. That API and runtime are removed from
this candidate. The historical branch and exact failures remain quarantined.

Use official schema mode when a form's inputs, conditions and layout fit a schema.
Use ordinary FieldViews/Regions for existing feature and actor ownership. This
prototype explores a form-owned definition for custom template layouts:

```ts
import { Region } from 'marionette';
import { CompositionForm } from './acceptance/experimental/composition-prototype.ts';

const form = new CompositionForm({
  template: () => '<div data-mode></div><div data-detail></div><button type="submit">Save</button>',
  regions: { mode: '[data-mode]', detail: '[data-detail]' },
  values: { mode: 'HIDE' },
  composition: [
    { key: 'mode', path: ['mode'], region: 'mode', retention: 'preserve',
      input: { type: 'text', label: 'Mode' } },
    { key: 'detail', path: ['detail'], region: 'detail', retention: 'clear',
      input: { type: 'text', label: 'Detail', value: '', validation: 'required' },
      when: { dependencies: { mode: ['mode'] }, test: values => values.mode === 'SHOW' } }
  ]
});
// The host document contains <div id="form"></div>.
const owner = new Region({ el: document.querySelector('#form')! });
owner.show(form);
// Programmatic calls retain FormView semantics:
form.setValues({ mode: 'SHOW', detail: 'Supplied' }, { notify: false });
await form.settledComposition();
// The feature owner calls owner.destroy() when the feature ends.
```

The key identifies a definition, path identifies form-root-relative value segments,
and Region identifies existing placement owned by this form. Dependencies are
explicit paths aliased into the predicate's restricted read-only input. An
undeclared alias throws; the callback must be synchronous, Boolean and pure.
External closures are not observed and are outside this contract.

Conditions use actual committed participating nodes after settlement, including
input and commit normalization. A preflighted dependency DAG orders producers
before dependents regardless of declaration order; self-dependencies and cycles
are rejected. Ordinary nested group parents must already be live/owned. No
membership fixed-point loop or whole copied-root visibility write is used.
Core commit/structural observation coalesces work; direct synchronous getters may
precede that work. Await `settledComposition()` after programmatic changes when
membership is needed. Submission participates in this settlement inside the
validation loop, including edits during an async rule.

Unchanged presence retains the existing field/control, focus and selection. Clear
removal excludes its value and validation; preserve removal keeps committed data.
An initially inactive clear definition knows its path and prunes a seeded value.
Original construction/first-mount baselines survive clear/remount/reset. Values
supplied in the current activating operation take precedence; values supplied in
a completed inactive clear operation do not leak into a later activation.
Silent owner writes suppress topology-generated value notifications. Native
intent remains user-originated through the completed dependency chain.

Each placement Region is dedicated. External takeover/destruction is diagnosed
before the prototype replaces unrelated content. Owner teardown removes observers,
Region receipts, pending settlement subscriptions and owned nodes. Ordinary
explicit composition remains available for all other feature layout.

## Deliberate limits and coupling

- Direct form-owned Regions and form values only. Ordinary child-owned Regions,
  external actor/permission conditions and dynamic list placement remain explicit
  composition. Do not hoist Regions or copy flags into submitted data to fit this
  prototype. Existing keyed schema lists remain supported by the base package.
- Clear retention beneath a preserved ancestor is explicitly deferred in this
  manifest. The base FieldView's existing explicit retention contract is tested
  independently; this restriction is not a generalized nested-form guarantee.
- No new context API, selector scanning, dependency expression DSL, Vue/React/Pro
  runtime dependency, callback rollback or arbitrary failure recovery.
- The adapter uses FormKit **2.1.2** exported `valueRemoved` with typed
  `disturb`/`calm(childValue)` to commit partial removal without replaying siblings.
  The declarations mark this low-level mechanism internal. It is a consciously
  pinned prototype dependency, not a high-level stable application API promise.
- Protected FormView settlement/notification/removal seams and this entry still
  need public API selection. No installed npm export or performance certification
  is implied by successful source tests.

## Evidence and runnable example

The saved environment has a runnable standalone browser example at
`/workspace/formkit-handoff/manifest-prototype/demo`. Run:

```sh
node /workspace/marionette-develop/node_modules/vite/bin/vite.js \
  --config /workspace/formkit-handoff/manifest-prototype/demo/vite.config.mjs
```

Open `http://127.0.0.1:4187/`. It uses explicit private source aliases, ordinary
groups, a normalized controller, reversed three-stage graph, required validation,
keyboard submit, async submission, reset and terminal owner cleanup. Relocating
the saved workspace requires updating those fixture paths.

Verification records live in `manifest-prototype`: eight retained failure-outcome
assertions pass; 29 unchanged independent Node cases and two fresh Chromium cases pass; 47 ordinary
Vitest manifest cases pass. After retirement, all 2354 repository unit cases and unchanged configured
coverage pass, including 100% all metrics for every FormKit source. Earlier red
source snapshots/logs remain. These checks establish their tested scope, not
complete TCM/host/agent effectiveness. Consumer and equivalent agent baseline
work have separate ledgers. Nothing is published.

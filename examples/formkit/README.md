# Native Marionette FormKit example

From the library root, using the configured release toolchain:

```sh
npm ci
npm --prefix examples/formkit install --ignore-scripts
npm --prefix examples/formkit run dev
```

Open Vite's printed URL. Submit the empty form, correct the email, change grouped
fields, and save. Use display name `taken` to exercise server errors; correct it
and retry. Reset returns to the construction-time values. Submission is delayed
600 ms and simulated locally; no external service receives the values.

Open `/composition.html` for a handwritten template with fields in Regions.
Toggle invoice to mount/remove its required Company field through the owner's
`FieldView` change listener and ordinary Region operations; removal clears the
company value. Reset reconciles the same explicit ownership. No provisional
`showField` helper or unexported manifest is used. Close Access needs to retain its draft and live node. Grouped
attendee values, invalid submit, simulated server errors, async state and reset
use the same runtime as the other examples. No external actor or service is used.

Open `/schema.html` for official MIT schema inputs and the multi-step addon.
Complete the Contact step, toggle the conditional Company field and continue to
Team. Try a file, multiple sessions, participant additions/removal/reordering,
and the team name `taken`. Reset and cancel aborts pending submission. Files stay
local. The optional auto-height textarea addon adjusts Notes when enabled.

After a build of the library, `npm --prefix examples/formkit run build` builds the
example. `npm run test:formkit-browser` runs Chromium, Firefox and WebKit scenarios
with their pinned Playwright browsers and host dependencies installed. Use
`npm run test:formkit-browser -- --project=chromium` to select one engine.
These examples exercise native forms and MIT
plugins; they do not certify FormKit Pro or full FormKit support.

Open `/composed.html` for an invented follow-up planning flow. One FormView owns
the root and app-authored action bar. Ordinary Views and CollectionView place
FieldViews, keyed RowViews and reusable SchemaViews that borrow real group nodes.
A named schema registry creates a custom Priority FieldView and a node-free
summary View through real Regions. No actor flag or presentation wrapper is
serialized into collected values.

Use the arrow keys on the Overview/Follow-ups tabs. Sections retain controls and
validation; temporarily hiding a previously mounted row retains its draft.
Add, insert, reverse, edit and remove keyed follow-ups with nested contacts. Email
uniqueness spans rows and due dates depend on the plan start. Removing partner
details clears their value. Set the title to `taken` to see the local simulated
service's root/field errors, then correct it and retry. Reset and cancel stops
pending submission. Membership-changing reset ends row placements and explicitly
rebuilds them from construction values, without claiming surviving DOM identity.

This example submits its own invented DTO and makes no clinical-payload mapping,
licensed Pro or genuine host-service claim. Each mount creates fresh defaults.
Browser tests exercise keyboard labels/error associations, focus through reorder,
stale callback cancellation, same-named simultaneous forms, detach/reattach,
field replacement, repeated destruction and unrelated host survival.

Open `/nested.html` for two levels of custom RowViews. Each outer group owns an
inner list FieldView; each inner RowView owns a required, labelled native name
field. The keys `x` and `y` intentionally repeat under different outer keys. Edit,
reverse either level, add/remove inner items, save locally and reset. The ordinary
CollectionViews reconcile the collected business order and rebuild placements
after membership-changing reset. No persistence or server-baseline policy is
implied. `FLOW-NESTED` checks the native journey and terminal node cleanup.

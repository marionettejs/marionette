# Repair a restartable review session

A colleague handed you a review-session controller. Normal startup, editing, and
refresh work, but switching sessions during validation can overwrite newer data,
and declining a stop request can leave the session disconnected. Repair
`solution.mjs` without regressing the working behavior below. You may add local
files; do not alter dependencies or test tooling.

Export `createReviewSession({ state, load, validate, beforeStop, subscribe,
schedule, onPulse })`, returning `{ app, refresh(id), edit(draft) }`:

- `app` is a Marionette Application. `app.start({ id })` loads and validates that
  record before successful startup. `load(id, { signal })` resolves a string;
  `validate(value, { signal })` resolves on success or rejects. Commit successful
  values to `state.set('label', value)`. Both providers can ignore abort.
- Each newer request replaces the previous request. Check cancellation across
  both asynchronous steps. Canceled work cannot validate a late load or commit a
  late validation, including after a newer successful start. Stale errors must not
  replace current state or become current errors. Current failures reject and
  preserve the previous label; startup failure acquires no active resources.
- `refresh(id)` uses the same load/validate behavior without restarting. Resolve
  true for a committed value, false for obsolete requests. An obsolete request
  need only settle when its provider settles. While stopped, starting, or destroyed,
  refresh returns false without loading. During pending stop permission the active
  run is still usable, including refresh and editing.
- `edit(draft)` updates only `state`'s draft. Startup, refresh, errors, stop and
  restart preserve that draft. This is a headless controller task: browser focus
  and DOM behavior are outside its contract.
- After successful startup, `subscribe(callback)` provides status strings; write
  them to `state.set('status', status)`. `schedule(onPulse)` registers a recurring
  heartbeat. Each returns a working synchronous disposer. Use only these supplied
  resources; do not create real timers, network calls, or global singletons.
- `prepareStop` awaits `beforeStop(options, context)`. While permission is pending,
  status and heartbeat remain active. Rejection preserves them and pending refresh
  work. Successful stop releases both registrations exactly once and invalidates
  pending refresh work. Restart acquires one fresh pair. Destruction releases all
  owned resources and prevents later commits. A destroy adopting pending stop
  permission must not ask twice. No synchronous disposer-error recovery is required.
- `state` is a borrowed source exposing `get`, `set`, and `dispose`. `app.getState()`
  must return that exact source. Never dispose it: another consumer continues using
  it after this session is destroyed.

Use only public package APIs and preserve Application's documented lifecycle
results and rejection behavior. The implementation structure is up to you;
acceptance judges effects, results, source identity and resource ownership.
Hidden tests are supplied only after the attempt. Do not use private framework
members. Consult the declared public docs supplied by your runner.

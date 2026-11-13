# Explicit application submission controller: scoped experimental compatibility

Import `createSubmissionController` and `SubmissionError` from `submission-controller.mjs`. Select it deliberately:

```js
const controller = createSubmissionController(form, {
  submit: (values, { node, signal }) => save(values, { signal })
});
const result = await controller.submit();
```

Results: success, invalid, error, busy, cancelled. One attempt owns an AbortSignal. Reset/destroy cancels promptly, suppresses later success/error effects, and a later attempt can proceed after reset. Submitted/loading state, root error clearing, structured field error mapping and submit:success/error/invalid events are provided. Value settlement and validating-ledger settlement are checked before invoking the application callback. Supported native input focus uses blocking Core input IDs, since official input schemas do not universally expose aria-invalid.

This is **programmatic opt-in compatibility**, not a drop-in replacement for every original FormView contract. It does not register or replace a DOM submit handler. Existing native `form.submit()`, DOM submission and `onSubmit` retain upstream behavior. An application selecting this controller must route its own submission action to `controller.submit(event)`; do not invoke both paths for the same action. `controller.destroy()` removes its ownership subscriptions and cancels its active attempt. Automatic form destruction also disposes it.

No callback introspection, rendering proof system or rollback is added. Mutation/destruction inside raw-submit callbacks, custom widgets/roving-radio focus, focus restoration to earlier controls, unrelated arbitrary thenables and exhaustive original-adapter parity are not promised. Cancellation cooperates through the signal: it cannot undo external side effects a callback already performed. Native loading/validation controls remain governed by upstream Core.

`submission-controller-test.mjs` compares original303, opt-in controller and unchanged native behavior for outcomes, signal, errors, duplicate attempts, cancellation and late effects. `submission-phases-test.mjs` compares validation-phase busy/reset/destroy cancellation, delayed-input values, added invalid fields during validation, invalid native focus and subsequent attempts. Existing native submit suites remain unchanged. These are JSDOM contracts, not browser or performance evidence.

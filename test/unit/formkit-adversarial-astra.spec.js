import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  vi.useRealTimers();
  document.body.replaceChildren();
});

it.each(['schema', 'composed'].flatMap(mode => [false, true].map(actorUpdate => ({ mode, actorUpdate }))))(
  'waits for a delayed $mode edit during remote submission validation (unrelated actor snapshot: $actorUpdate)', async({ mode, actorUpdate }) => {
    vi.useFakeTimers();
    const checks = [];
    const submitted = [];
    let acceptInitial;
    const initialResult = new Promise(resolve => { acceptInitial = resolve; });
    const definition = { type: 'text', name: 'name', validation: 'remote', config: { delay: 50 } };
    const form = new FormView({
      values: { name: 'Initial', revision: 0 },
      formProps: { submitBehavior: 'live' },
      validationRules: {
        remote: node => {
          // A sibling update may recheck the same accepted value. Reuse that
          // result so a second unresolved request cannot hide premature submit.
          if (node.value === 'Initial') {
            checks.push({ value: node.value, resolve: acceptInitial });
            return initialResult;
          }
          return new Promise(resolve => { checks.push({ value: node.value, resolve }); });
        },
      },
      submit: values => { submitted.push(values); },
      ...(mode === 'schema' ? { schema: [{ $formkit: 'text', ...definition }] } : {
        template: () => '<div class="field"></div>', regions: { field: '.field' },
      }),
    });
    const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
    owners.push(region);
    region.show(form);
    if (mode === 'composed') {
      form.showChildView('field', new FieldView({ form, name: 'name', removal: 'preserve', input: {
        type: definition.type, validation: definition.validation, config: definition.config,
      } }));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(checks.map(check => check.value)).toEqual(['Initial']);
    const pending = form.submit();
    await vi.advanceTimersByTimeAsync(0);
    const input = form.el.querySelector('input');
    expect(input.disabled).toBe(false);
    input.value = 'Latest';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.node.isSettled).toBe(false);
    if (actorUpdate) {
      form.setValues({ revision: 1 }, { notify: false, source: 'actor' });
      expect(input.value).toBe('Latest');
    }

    // The older validation finishes before the new value's configured delay.
    checks[0].resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(submitted).toEqual([]);
    expect(form.getFormState().submitting).toBe(true);

    await vi.advanceTimersByTimeAsync(50);
    expect(form.getValues()).toEqual({ name: 'Latest', revision: actorUpdate ? 1 : 0 });
    await vi.waitFor(() => expect(checks.at(-1).value).toBe('Latest'));
    checks.at(-1).resolve(false);
    expect(await pending).toBe('invalid');
    expect(submitted).toEqual([]);
  });

import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  document.body.replaceChildren();
});

it.each(['text', 'select'].flatMap(type => ['inside', 'external'].map(placement => [type, placement])))(
  'ignores native input on an initially disabled %s in an %s placement without browser errors', async(type, placement) => {
    const form = new FormView({
      template: () => '<div class="field"></div>', regions: { field: '.field' },
      values: { choice: 'Initial' },
    });
    const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
    owners.push(region);
    region.show(form);
    const field = new FieldView({ form, name: 'choice', removal: 'preserve', input: {
      type, disabled: true, ...(type === 'select' ? { options: ['Initial', 'Attempted', 'Owner'] } : {}),
    } });
    if (placement === 'inside') { form.showChildView('field', field); } else {
      const external = new Region({ el: document.body.appendChild(document.createElement('div')) });
      owners.push(external); external.show(field);
    }
    await form.node.settled;
    const input = field.el.querySelector(type === 'select' ? 'select' : 'input');
    const changes = [];
    form.on('form:change', values => { changes.push(values); });
    field.on('field:change', value => { changes.push(value); });
    const browserErrors = [];
    const onError = event => {
      browserErrors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      expect(input.disabled).toBe(true);
      input.value = 'Attempted';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await form.node.settled;
      expect(browserErrors).toEqual([]);
      expect(form.getValues()).toEqual({ choice: 'Initial' });
      expect(field.getValue()).toBe('Initial');
      expect(changes).toEqual([]);

      // Disabled UI still accepts an authoritative owner snapshot.
      field.setValue('Owner', { source: 'actor', notify: false });
      await vi.waitFor(() => expect(input.value).toBe('Owner'));
      expect(input.disabled).toBe(true);
      expect(form.getValues()).toEqual({ choice: 'Owner' });
      expect(changes).toEqual([]);
    } finally {
      window.removeEventListener('error', onError);
    }
  }
);

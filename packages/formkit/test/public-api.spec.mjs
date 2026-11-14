import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region, View, Application } from 'marionette';
import { FormKitView, FormKitApplication, bindings, defaultConfig, mount } from '@mnjs/formkit';
import { createFormKitHelpers } from '@mnjs/formkit/components';

const owners = [];
function host() { const element = document.createElement('main'); document.body.append(element); return element; }
function own(owner) { owners.push(owner); return owner; }
afterEach(() => {
  for (const owner of owners.splice(0).reverse()) {owner.destroy();}
  document.body.replaceChildren();
});

describe('public forms and Marionette ownership', () => {
  it('mounts typed-value forms and follows actual DOM input, errors, reset and destruction', async() => {
    const target = host();
    const form = own(mount({ host: target, instrument: true,
      fields: [{ name: 'email', type: 'email', label: 'Email', validation: 'required|email', validationVisibility: 'live' }],
      values: { email: '' }, formProps: { actions: false }
    }));
    expect(form.form).toBeInstanceOf(View);
    expect(form.node.at('email')).toBeDefined();
    const control = target.querySelector('input');
    control.value = 'paul@example.test'; control.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(form.getValues()).toEqual({ email: 'paul@example.test' }));
    expect(form.getFormState().valid).toBe(true);
    form.setErrors([], { email: ['Already registered'] });
    await vi.waitFor(() => expect(target.textContent).toContain('Already registered'));
    form.clearErrors();
    form.setValues({ email: 'next@example.test' });
    expect(form.getValues().email).toBe('next@example.test');
    expect(target.querySelector('input')).toBe(control);
    form.reset();
    expect(form.getValues()).toEqual({ email: '' });
    form.destroy();
    expect(target.children).toHaveLength(0);
    expect(form.metrics.coreNodesCreated).toBe(form.metrics.coreNodesDestroyed);
  });

  it('works as an ordinary Region-owned View and retains named Core fields', async() => {
    const region = own(new Region({ el: host() }));
    const view = new FormKitView({ fields: [{ name: 'title', label: 'Title' }], values: { title: 'First' }, formProps: { actions: false } });
    region.show(view);
    const field = view.node.at('title'); const element = view.el.querySelector('input');
    view.setFields([{ name: 'title', label: 'Renamed' }, { name: 'extra', type: 'checkbox' }]);
    await vi.waitFor(() => expect(view.el.textContent).toContain('Renamed'));
    expect(view.node.at('title')).toBe(field); expect(view.el.querySelector('input')).toBe(element);
    expect(view.getValues().title).toBe('First');
    region.empty();
    expect(view.isDestroyed()).toBe(true);
    expect(region.el.children).toHaveLength(0);
  });

  it('runs schema component factories with live props and exactly one owner cleanup', async() => {
    let created = 0, destroyed = 0;
    const target = host();
    const form = own(mount({ host: target, schema: [
      { $el: 'h2', children: '$heading' },
      { $formkit: 'text', name: 'title', label: 'Title' },
      { $cmp: 'Badge', props: { text: '$heading' } }
    ], data: { heading: 'Before' }, components: {
      Badge({ host: container, props }) {
        created++; const badge = document.createElement('b'); container.append(badge); badge.textContent = props.text;
        return { update(next) { badge.textContent = next.text; }, destroy() { destroyed++; badge.remove(); } };
      }
    } }));
    form.updateData({ heading: 'After' });
    expect(target.querySelector('h2').textContent).toBe('After');
    expect(target.querySelector('b').textContent).toBe('After');
    expect(created).toBe(1);
    form.destroy(); expect(destroyed).toBe(1);
  });

  it('composes direct fields and schema under one form with independently updated sources', async() => {
    const target = host();
    const form = own(mount({ host: target, instrument: true,
      fields: [{ name: 'direct', label: 'Direct' }],
      schema: [{ $formkit: 'text', name: 'schemaField', label: 'Schema field' }],
      values: { direct: 'Direct value', schemaField: 'Schema value' },
      formProps: { actions: false, id: 'mixed-package-form' }
    }));
    const direct = form.node.at('direct');
    const schemaField = form.node.at('schemaField');
    expect(form.node.props.id).toBe('mixed-package-form');
    expect(target.querySelectorAll('form')).toHaveLength(1);
    expect(target.querySelectorAll('input')).toHaveLength(2);
    expect(form.getValues()).toEqual({ direct: 'Direct value', schemaField: 'Schema value' });
    form.setFields([{ name: 'direct', label: 'Updated direct' }, { name: 'added' }]);
    await vi.waitFor(() => expect(target.querySelectorAll('input')).toHaveLength(3));
    expect(form.node.at('schemaField')).toBe(schemaField);
    form.setSchema([{ $formkit: 'text', name: 'schemaField', label: 'Updated schema' }]);
    expect(form.node.at('direct')).toBe(direct);
    form.destroy();
    expect(form.metrics.coreNodesCreated).toBe(form.metrics.coreNodesDestroyed);
  });

  it('prepares configuration before showing an Application-owned FormKit View', async() => {
    const target = host();
    const app = own(new FormKitApplication({ region: { el: target }, config: { config: { locale: 'en' } }, form: {
      fields: [{ name: 'name', label: 'Name' }], values: { name: 'Ready' }, formProps: { actions: false }
    } }));
    expect(app).toBeInstanceOf(Application); expect(app.getView()).toBeUndefined();
    await expect(app.start()).resolves.toBe(true);
    expect(app.getView()).toBeInstanceOf(FormKitView);
    expect(app.getView().getValues()).toEqual({ name: 'Ready' });
    expect(app.getFormKitScope().rootConfig).toBeDefined();
    app.stop(); expect(target.children).toHaveLength(0);
  });

  it('exports an actual raw binding plugin and portable helper factory library', () => {
    expect(typeof bindings).toBe('function');
    expect(defaultConfig().plugins).toContain(bindings);
    expect(Object.keys(createFormKitHelpers()).sort()).toEqual(['FormKitIcon', 'FormKitMessages', 'FormKitSummary']);
  });
});

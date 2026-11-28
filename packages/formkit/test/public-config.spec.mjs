import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { inputs } from '@formkit/inputs';
import { FormKitApplication, FormKitView, defaultConfig, mount } from '@mnjs/formkit';

const owners = [];
const requiredField = { name: 'answer', label: 'Answer', validation: 'required', validationVisibility: 'live' };
function own(owner) {
  owners.push(owner);
  return owner;
}
function host() {
  const target = document.createElement('main');
  document.body.append(target);
  return target;
}
const roots = {
  mount(options, form) {
    const target = host();
    own(mount({ ...options, ...form, host: target }));
    return target;
  },
  view(options, form) {
    const target = host();
    own(new Region({ el: target })).show(new FormKitView({ ...options, ...form }));
    return target;
  },
  async application(options, form) {
    const target = host();
    const app = own(new FormKitApplication({ region: { el: target }, config: options, form }));
    await expect(app.start()).resolves.toBe(true);
    return target;
  },
};
afterEach(() => {
  for (const owner of owners.splice(0).reverse()) {owner.destroy();}
  document.body.replaceChildren();
});

it.each(Object.keys(roots))('%s uses the supplied locale and honors explicit config.locale', async(root) => {
  const locales = {
    fr: { validation: { required: 'French required sentinel' } },
    es: { validation: { required: 'Spanish required sentinel' } },
  };
  const form = { fields: [requiredField], formProps: { actions: false } };
  const french = await roots[root]({ locale: 'fr', locales }, form);
  await vi.waitFor(() => expect(french.textContent).toContain('French required sentinel'), { timeout: 300 });
  const spanish = await roots[root]({ locale: 'fr', config: { locale: 'es' }, locales }, form);
  await vi.waitFor(() => expect(spanish.textContent).toContain('Spanish required sentinel'), { timeout: 300 });
});

it.each(Object.keys(roots))('%s runs prepared defaultConfig validation once', async(root) => {
  const checked = vi.fn(() => false);
  const target = await roots[root](defaultConfig({
    rules: { checked },
    messages: { en: { validation: { checked: 'Checked once sentinel' } } },
  }), { fields: [{ ...requiredField, validation: 'checked', value: 'ready' }], formProps: { actions: false } });
  await vi.waitFor(() => expect(target.textContent).toContain('Checked once sentinel'), { timeout: 300 });
  expect(checked).toHaveBeenCalledTimes(1);
});


it.each(Object.keys(roots))('%s keeps field and rule overrides made after preparing defaults', async(root) => {
  const checked = vi.fn(() => false);
  const plugin = vi.fn();
  const prepared = defaultConfig({
    rules: { checked: () => {throw new Error('Stale prepared rule ran');} },
    plugins: [plugin],
    messages: { en: { validation: { checked: 'Override sentinel' } } },
  });
  const overrides = { rules: { checked }, inputs: { customInput: inputs.text } };
  const form = {
    fields: [{ ...requiredField, type: 'custom-input', validation: 'checked', value: 'ready' }],
    formProps: { actions: false },
  };
  const target = root === 'application' ? await roots[root](prepared, { ...form, ...overrides }) :
    await roots[root]({ ...prepared, ...overrides }, form);

  await vi.waitFor(() => expect(target.textContent).toContain('Override sentinel'), { timeout: 300 });
  expect(target.querySelector('input')?.value).toBe('ready');
  expect(checked).toHaveBeenCalledTimes(1);
  expect(plugin.mock.calls.filter(([node]) => node.name === 'answer')).toHaveLength(1);
});

it('uses prepared plugins verbatim in an explicitly raw pipeline', async() => {
  const checked = vi.fn(() => false);
  const target = roots.mount({ ...defaultConfig({
    rules: { checked },
    messages: { en: { validation: { checked: 'Raw sentinel' } } },
  }), defaultConfig: false }, {
    fields: [{ ...requiredField, validation: 'checked', value: 'ready' }],
    formProps: { actions: false },
  });
  await vi.waitFor(() => expect(target.textContent).toContain('Raw sentinel'), { timeout: 300 });
  expect(checked).toHaveBeenCalledTimes(1);
});

it.each(['mount', 'application'])('%s preserves explicitly contributed plugin lists and blocks invalid Save', async(root) => {
  const checked = vi.fn(() => false), submitted = vi.fn(), invalid = vi.fn();
  const prepared = defaultConfig({
    rules: { checked },
    messages: { en: { validation: { checked: 'Plugin list sentinel' } } },
  });
  const field = { ...requiredField, validation: 'checked', value: 'ready' };
  const form = { fields: [field], formProps: { actions: false }, onSubmit: submitted, onSubmitInvalid: invalid };
  const plugins = [...prepared.plugins];
  const target = root === 'application' ? await roots.application(defaultConfig(), { ...form, plugins }) : roots.mount({ plugins }, form);
  await vi.waitFor(() => expect(target.textContent).toContain('Plugin list sentinel'), { timeout: 300 });
  expect(checked).toHaveBeenCalledTimes(1);
  target.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalledTimes(1), { timeout: 300 });
  expect(submitted).not.toHaveBeenCalled();
});

it.each(Object.keys(roots))('%s preserves distinct inherited and local rules and inputs', async(root) => {
  const enrolled = vi.fn(() => false), checked = vi.fn(() => true);
  const submitted = vi.fn(), invalid = vi.fn();
  const prepared = defaultConfig({
    rules: { enrolled },
    inputs: { inheritedInput: inputs.text },
    messages: { en: { validation: { enrolled: 'Enrollment sentinel' } } },
  });
  const overrides = { rules: { checked }, inputs: { localInput: inputs.text } };
  const form = {
    fields: [{ ...requiredField, type: 'inherited-input', validation: 'enrolled', value: 'ready' },
      { ...requiredField, name: 'local', type: 'local-input', validation: 'checked', value: 'ready' }],
    formProps: { actions: false }, onSubmit: submitted, onSubmitInvalid: invalid,
  };
  const target = root === 'application' ? await roots.application(prepared, { ...form, ...overrides }) :
    await roots[root]({ ...prepared, ...overrides }, form);
  await vi.waitFor(() => expect(target.textContent).toContain('Enrollment sentinel'), { timeout: 300 });
  expect(target.querySelectorAll('input')).toHaveLength(2);
  expect(enrolled).toHaveBeenCalledTimes(1);
  expect(checked).toHaveBeenCalledTimes(1);
  target.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalledTimes(1), { timeout: 300 });
  expect(submitted).not.toHaveBeenCalled();
});

it('preserves plain Application rules and inputs when a prepared child adds its own', async() => {
  const enrolled = vi.fn(() => false), local = vi.fn(() => true);
  const submitted = vi.fn(), invalid = vi.fn();
  const target = await roots.application({
    rules: { enrolled },
    inputs: { inheritedInput: inputs.text },
    messages: { en: { validation: { enrolled: 'Organization rule sentinel' } } },
  }, {
    ...defaultConfig({ rules: { local } }),
    fields: [
      { ...requiredField, type: 'inherited-input', value: 'ready', validation: 'enrolled' },
      { ...requiredField, name: 'other', value: 'ready', validation: 'local' },
    ],
    formProps: { actions: false }, onSubmit: submitted, onSubmitInvalid: invalid,
  });
  await vi.waitFor(() => expect(target.textContent).toContain('Organization rule sentinel'), { timeout: 300 });
  expect(enrolled).toHaveBeenCalledTimes(1);
  expect(local).toHaveBeenCalledTimes(1);
  target.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(invalid).toHaveBeenCalledTimes(1), { timeout: 300 });
  expect(submitted).not.toHaveBeenCalled();
});

it('does not let implicit prepared English override an Application locale', async() => {
  const inherited = { locale: 'fr', locales: {
    fr: { validation: { required: 'French Application sentinel' } },
  } };
  const form = { fields: [requiredField], formProps: { actions: false } };
  const french = await roots.application(inherited, { ...defaultConfig(), ...form });
  await vi.waitFor(() => expect(french.textContent).toContain('French Application sentinel'), { timeout: 300 });
  const english = await roots.application(inherited, { ...defaultConfig({ locale: 'en' }), ...form });
  await vi.waitFor(() => expect(english.textContent).toContain('Answer is required'), { timeout: 300 });
});

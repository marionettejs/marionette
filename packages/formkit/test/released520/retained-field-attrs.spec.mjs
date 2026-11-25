import { expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

it('retains plugin-owned attributes while refreshing a native field declaration', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const onSubmit = vi.fn();
  const decorate = node => {
    if (node.props.type !== 'text') { return; }
    node.on('created', () => {
      node.props.attrs = { ...node.props.attrs, 'data-plugin': 'owned' };
    });
  };
  const api = mount({
    host,
    schema: [{ $formkit: 'text', name: 'message', label: '$label', bind: '$declared' }],
    data: { label: 'Before', declared: { 'data-declared': 'initial', 'data-shared': 'author' } },
    plugins: [decorate],
    config: { delay: 0 },
    formProps: { actions: false },
    onSubmit,
  });
  try {
    const core = api.node.at('message');
    const input = host.querySelector('input');
    expect(input.getAttribute('data-plugin')).toBe('owned');
    expect(input.getAttribute('data-declared')).toBe('initial');

    api.updateData({ label: 'Dropped', declared: { 'data-shared': 'author' } });
    expect(input.getAttribute('data-plugin')).toBe('owned');
    expect(input.hasAttribute('data-declared')).toBe(false);
    expect(host.querySelector('label').textContent).toBe('Dropped');

    const declared = { 'data-declared': 'later', 'data-shared': 'author' };
    api.updateData({ label: 'Restored', declared });
    expect(input.getAttribute('data-declared')).toBe('later');

    const writes = vi.fn();
    const receipt = core.on('prop:attrs', writes);
    api.updateData({ label: 'Label only', declared: { ...declared } });
    expect(host.querySelector('label').textContent).toBe('Label only');
    expect(writes).not.toHaveBeenCalled();
    core.off(receipt);

    core.props.attrs = { ...core.props.attrs, 'data-shared': 'plugin', 'data-late-plugin': 'owned' };
    await vi.waitFor(() => expect(input.getAttribute('data-shared')).toBe('plugin'));
    api.updateData({ label: 'Reapplied', declared: { ...declared } });
    expect(input.getAttribute('data-shared')).toBe('author');

    core.props.attrs = { ...core.props.attrs, 'data-shared': 'plugin again' };
    api.updateData({ label: 'Final', declared: { 'data-declared': 'later' } });
    expect(input.hasAttribute('data-shared')).toBe(false);
    expect(input.getAttribute('data-late-plugin')).toBe('owned');
    expect(api.node.at('message')).toBe(core);
    expect(host.querySelector('input')).toBe(input);

    api.updateData({ label: 'No declaration attrs', declared: {} });
    expect(input.hasAttribute('data-declared')).toBe(false);
    expect(input.hasAttribute('data-shared')).toBe(false);
    expect(input.getAttribute('data-plugin')).toBe('owned');
    expect(input.getAttribute('data-late-plugin')).toBe('owned');

    input.value = 'typed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await api.whenPendingEditsSettled();
    await api.submit();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toEqual({ message: 'typed' });
  } finally {
    api.destroy();
    host.remove();
  }
});


it('does not treat a promoted definition prop or validation visibility as a DOM attr', async() => {
  const host = document.createElement('main');
  document.body.append(host);
  const api = mount({
    host,
    schema: [{
      $formkit: 'select', name: 'choice', attrs: {
        options: '$options', validationVisibility: '$visibility',
      },
    }],
    data: { options: ['Alpha', 'Beta'], visibility: 'live' },
    formProps: { actions: false },
  });
  try {
    const core = api.node.at('choice');
    const input = host.querySelector('select');
    expect([...input.options].map(option => option.textContent)).toEqual(['Alpha', 'Beta']);
    expect(core.props.validationVisibility).toBe('live');
    expect(core.props.attrs).not.toHaveProperty('options');
    expect(input.hasAttribute('validationvisibility')).toBe(false);

    core.props.attrs = { ...core.props.attrs, 'data-plugin': 'independent' };
    api.updateData({ options: ['Gamma', 'Delta'], visibility: 'submit' });
    await vi.waitFor(() => expect([...input.options].map(option => option.textContent)).toEqual(['Gamma', 'Delta']));
    expect(core.props.validationVisibility).toBe('submit');
    expect(core.props.attrs).not.toHaveProperty('options');
    expect(input.hasAttribute('validationvisibility')).toBe(false);
    expect(input.getAttribute('data-plugin')).toBe('independent');

    api.updateData({ options: ['Gamma', 'Delta'] });
    expect(Object.hasOwn(core.props, 'validationVisibility')).toBe(false);
    expect(input.hasAttribute('validationvisibility')).toBe(false);
    expect(input.getAttribute('data-plugin')).toBe('independent');
    expect(api.node.at('choice')).toBe(core);
    expect(host.querySelector('select')).toBe(input);
  } finally {
    api.destroy();
    host.remove();
  }
});

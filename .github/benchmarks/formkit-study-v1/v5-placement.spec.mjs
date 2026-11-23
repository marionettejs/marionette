import { expect, it } from 'vitest';
import { mount } from '@mnjs/formkit';
const fields = Array.from({length: 3}, (_, i) => ({ name: 'input' + i, id: 'fixture-' + i, label: 'Field ' + i, type: 'text', value: '', validation: 'required|length:3' }));
for (const shape of ['one root list', 'three root inputs']) {
  it('preserves labeled leaves, validation and cleanup: ' + shape, async () => {
    const list = shape === 'one root list';
    const host = document.createElement('main');
    document.body.append(host);
    const declaration = list ? [{ type: 'list', name: 'rows', children: [{ type: 'group', key: 'r0', children: fields }] }] : fields;
    const mounted = mount({ host, fields: declaration, formProps: { actions: false } });
    try {
      const inputs = [...host.querySelectorAll('input')];
      expect(inputs.map(x => x.id)).toEqual(fields.map(x => x.id));
      expect(inputs.map(x => x.labels[0].textContent)).toEqual(fields.map(x => x.label));
      const target = inputs[2];
      target.value = 'changed';
      target.dispatchEvent(new Event('input', { bubbles: true }));
      await mounted.node.settled;
      const data = mounted.getValues();
      const values = list ? data.rows[0] : data;
      expect(values.input2).toBe('changed');
      expect(values.input1).toBe('');
      expect(host.querySelector('#fixture-2')).toBe(target);
    } finally {
      mounted.destroy();
      expect(host.querySelectorAll('input')).toHaveLength(0);
      host.remove();
    }
  });
}

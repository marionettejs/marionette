const textLabels = {
  text: 'Text', textarea: 'Textarea', color: 'Color', date: 'Date', datetimeLocal: 'Datetime', email: 'Email',
  month: 'Month', number: 'Number', password: 'Password', search: 'Search', tel: 'Telephone', time: 'Time',
  url: 'URL', week: 'Week', range: 'Range', hidden: 'Hidden', select: 'Select', checkbox: 'Checkbox',
  radio: 'Radio', file: 'File', meta: 'Meta', group: 'Group', list: 'List',
};
const options = [{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }];
const field = (type, props = {}) => ({
  $formkit: type, name: type, id: 'field-' + type, label: textLabels[type] ?? type, ...props,
});
export const edits = {
  text: 'A real edit', textarea: 'First line\nSecond line', color: '#336699', date: '2026-11-27',
  datetimeLocal: '2026-11-27T12:30', email: 'kitchen@example.test', month: '2026-11', number: '17',
  password: 'fixture-only-value', search: 'Find something', tel: '5550100', time: '12:30',
  url: 'https://example.test/kitchen', week: '2026-W48', range: '7',
};
export const stockCases = [
  ...Object.keys(edits).map(type=>field(type,type === 'range' ? { min: 0,max: 10,step: 1,value: '5' } : {})),
  field('select',{ options }), field('checkbox',{ options }), field('radio',{ options }),
  field('file',{ multiple: true }), field('hidden',{ value: 'fixture-only' }), field('meta',{ value: 'example-metadata' }),
  { ...field('group'), children: [field('text',{name: 'nested',id: 'field-nested',label: 'Nested'})] },
  { ...field('list'), children: [field('text',{name: '0',id: 'field-item',label: 'List item'})] },
  field('button',{name: 'auxiliary',id: 'field-auxiliary',label: 'Auxiliary'}),
  field('submit',{name: 'save',id: 'field-save',label: 'Save sample'}),
];
export async function openFixture(host, arm) {
  const submissions = [];
  const onSubmit = value=>submissions.push(structuredClone(value));
  const schema = structuredClone(stockCases);
  let destroy;
  if (arm === 'marionette') {
    const { mount } = await import('@mnjs/formkit');
    const form = mount({host,schema,formProps: {actions: false},onSubmit});
    destroy = ()=>form.destroy();
  } else if (arm === 'vue') {
    const { createApp, h } = await import('vue');
    const { defaultConfig, FormKit, FormKitSchema, plugin } = await import('@formkit/vue');
    const app = createApp({render: ()=>h(FormKit,{type: 'form',actions: false,onSubmit},{
      default: ()=>h(FormKitSchema,{schema}),
    })});
    app.use(plugin,defaultConfig);
    app.mount(host);
    destroy = ()=>app.unmount();
  } else {throw new Error('Unknown framework');}
  return {submissions,destroy};
}

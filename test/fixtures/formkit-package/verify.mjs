import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'DocumentFragment', 'Event', 'CustomEvent', 'MutationObserver', 'AbortController', 'AbortSignal', 'File']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const runtimeErrors = [];
window.addEventListener('error', event => runtimeErrors.push(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => runtimeErrors.push(event.reason));
const require = createRequire(import.meta.url);
const manifest = require('@mnjs/formkit/package.json');
assert.equal(manifest.name, '@mnjs/formkit');
const flush = async() => { for (let index = 0; index < 12; index++) { await Promise.resolve(); } };
const modes = [
  { name: 'ESM', formkit: await import('@mnjs/formkit'), marionette: await import('marionette'), core: await import('@formkit/core') },
  { name: 'CommonJS', formkit: require('@mnjs/formkit'), marionette: require('marionette'), core: require('@formkit/core') }
];
try {
  for (const { name, formkit, marionette: { Region, View, CollectionView }, core: { getNode } } of modes) {
    const { FieldView, FormView, RowView, SchemaView, SubmissionError, createSchemaRenderer, createViewComponents } = formkit;
    assert.deepEqual(Object.keys(formkit).sort(), ['FieldView', 'FormView', 'RowView', 'SchemaView', 'SubmissionError', 'createSchemaRenderer', 'createViewComponents']);
    for (const imported of [FieldView, FormView, RowView, SchemaView, SubmissionError, createSchemaRenderer, createViewComponents]) { assert.equal(typeof imported, 'function'); }
    assert.deepEqual(new SubmissionError('Failed', { email: ['Taken'] }).fieldErrors, { email: ['Taken'] });
    {
      const hostState = { saved: true };
      const host = new FormView({ fields: [], state: hostState, stateEvents: {} });
      assert.equal(host.getState(), hostState);
      host.render();
      assert.deepEqual(host.getFormState(), { submitted: false, submitting: false, valid: true, errors: [] });
      host.destroy();
      const composed = new FormView({ template: () => '', values: { title: 'Root', left: { title: 'Left' }, right: {} }, config: { delay: 0 } });
      const composedOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
      composedOwner.show(composed);
      const externalOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
      const external = new FieldView({ form: composed, name: 'title', removal: 'preserve', input: { type: 'text' } });
      externalOwner.show(external);
      const origins = [];
      composed.on('form:change', (_values, _state, metadata) => origins.push(metadata.source));
      composed.setErrors(['Server failure']);
      const externalInput = external.el.querySelector('input');
      externalInput.value = 'External'; externalInput.dispatchEvent(new Event('input', { bubbles: true }));
      await composed.node.settled; await flush();
      assert.deepEqual(origins, ['user']);
      assert.deepEqual(composed.getFormState().errors, []);
      const groups = ['left', 'right'].map(group => {
        const field = new FieldView({ form: composed, name: group, removal: 'preserve', input: { type: 'group' } });
        field.render(); return field;
      });
      const bridge = createViewComponents({ getForm: () => composed, registrations: { Text: { kind: 'field', create: options => new FieldView(options) } } });
      const bridgeProps = { name: 'title', input: { type: 'text' } };
      const mountedBridge = bridge.Text({ document, props: bridgeProps, data: { node: groups[0].node } });
      composed.el.append(mountedBridge.element); await flush();
      assert.throws(() => mountedBridge.update({ ...bridgeProps, input: { ...bridgeProps.input, value: 'Wrong' } }, { node: groups[1].node }), /Change the schema key/);
      assert.deepEqual(composed.getValues(), { title: 'External', left: { title: 'Left' }, right: {} });
      composedOwner.destroy(); externalOwner.destroy();
      assert.equal(external.isDestroyed(), true);
      document.body.replaceChildren();
      console.log(`${name}: inherited state, external native input and default-parent identity regressions passed.`);
    }
    const firstFile = new File(['old'], 'same.txt', { lastModified: 1 });
    const replacementFile = new File(['new'], 'same.txt', { lastModified: 1 });
    const processedFile = new File(['processed'], 'processed.txt', { lastModified: 1 });
    const proposals = [];
    const fileSubmissions = [];
    const normalizer = node => node.hook.input((value, next) => {
      proposals.push(value[0]?.file);
      return next(value[0]?.file === replacementFile ? [{ name: processedFile.name, file: processedFile }] : value);
    });
    const fileOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
    const fileForm = new FormView({ schemaData: { upload: [{ name: firstFile.name, file: firstFile }] },
      schema: { $formkit: 'file', name: 'upload', label: 'Attachment', value: '$upload', plugins: [normalizer] },
      submit: values => fileSubmissions.push(values) });
    fileOwner.show(fileForm); await flush();
    const fileControl = fileForm.el.querySelector('input'); fileControl.focus();
    const fileId = fileControl.id;
    fileForm.setSchemaData({ upload: [{ name: replacementFile.name, file: replacementFile }] }); await flush();
    assert.equal(proposals.filter(value => value === replacementFile).length, 1);
    assert.equal(fileForm.node.at('upload').value[0].file, processedFile);
    assert.equal(fileForm.getValues().upload[0].file, processedFile);
    assert.equal(fileForm.el.querySelector('input'), fileControl);
    assert.equal(document.activeElement, fileControl);
    assert.equal(await fileForm.submit(), 'success');
    assert.equal(fileSubmissions[0].upload[0].file, processedFile);
    fileOwner.destroy(); await flush(); assert.equal(getNode(fileId), undefined);
    document.body.replaceChildren();
    console.log(`${name}: distinct value props reach one real normalizer; accepted data, focus and cleanup passed.`);
    for (let cycle = 0; cycle < 5; cycle++) {
      let finish;
      const saved = [];
      const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
      const view = new FormView({ schema: [
        { $formkit: 'email', name: 'email', label: 'Email', validation: 'required|email' },
        { $formkit: 'group', name: 'profile', children: [{ $formkit: 'text', name: 'name', label: 'Name', value: 'Ada' }] }
      ], submit(values) { saved.push(values); return new Promise(resolve => { finish = resolve; }); } });
      region.show(view); await flush();
      const email = view.el.querySelector('input[type=email]');
      const ids = [view.node.props.id, ...Array.from(view.el.querySelectorAll('input')).map(element => element.id)];
      assert.equal(view.el.querySelector('label').htmlFor, email.id);
      assert.equal(await view.submit(), 'invalid');
      assert.equal(email.getAttribute('aria-invalid'), 'true');
      assert.equal(document.activeElement, email);
      email.value = 'ada@example.com'; email.dispatchEvent(new Event('input', { bubbles: true }));
      const node = getNode(email.id); await node.settled; await node.ledger.settled('validating'); await flush();
      view.render(); assert.equal(view.el.querySelector('input[type=email]'), email);
      const pending = view.submit(); await flush();
      assert.equal(view.getFormState().submitting, true);
      assert.equal(await view.submit(), 'busy');
      finish(); assert.equal(await pending, 'success');
      assert.equal(saved[0].email, 'ada@example.com'); assert.equal(saved[0].profile.name, 'Ada');
      view.resetForm(); await flush(); assert.equal(email.value, ''); assert.equal(view.getFormState().submitted, false);
      region.destroy(); await flush();
      for (const id of ids) { assert.equal(getNode(id), undefined); }
      email.value = 'retained@example.com'; email.dispatchEvent(new Event('input', { bubbles: true })); await flush();
      document.body.replaceChildren();
    }

    for (let cycle = 0; cycle < 5; cycle++) {
      const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
      const view = new FormView({ template: () => '<div class="email"></div><button type="submit">Save</button>',
        regions: { email: '.email' }, values: { email: '' }, submit: () => 'saved' });
      region.show(view);
      const field = new FieldView({ form: view, name: 'email', removal: 'clear',
        input: { type: 'email', label: 'Email', validation: 'required|email' } });
      view.showChildView('email', field); await flush();
      const id = field.node.props.id;
      assert.equal(await view.submit(), 'invalid');
      const changes = [];
      field.on('field:change', (value, metadata) => changes.push({ value, metadata }));
      field.setValue('ada@example.com', { source: 'owner' }); await flush();
      assert.deepEqual(changes, [{ value: 'ada@example.com', metadata: { source: 'owner' } }]);
      assert.equal(await view.submit(), 'success');
      view.resetForm(); await flush(); assert.equal(field.getValue(), '');
      const detached = view.getRegion('email').detachView();
      region.destroy(); await flush();
      assert.equal(detached.isDestroyed(), true);
      assert.equal(getNode(id), undefined);
      document.body.replaceChildren();
    }
    const conditionalOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
    const conditional = new FormView({ template: () => '<div class="billing"></div>', regions: { billing: '.billing' },
      values: { invoice: false }, submit: values => values });
    conditionalOwner.show(conditional);
    const created = [];
    const notifications = [];
    conditional.on('form:change', values => notifications.push(values));
    function showCompany() {
      const field = new FieldView({ form: conditional, name: 'company', removal: 'clear',
        input: { type: 'text', label: 'Company', validation: 'required', value: 'Baseline' } });
      created.push(field);
      conditional.showChildView('billing', field);
    }
    function project(values) {
      const billing = conditional.getRegion('billing');
      if (values.invoice && !billing.hasView()) { showCompany(); } else if (!values.invoice && billing.hasView()) { billing.empty(); }
      conditional.setValues(values, { notify: false });
    }
    assert.equal(created.length, 0);
    project({ invoice: true, company: 'Acme' });
    await flush();
    assert.equal(created[0].getValue(), 'Acme');
    assert.equal(await conditional.submit(), 'success');
    project({ invoice: false });
    assert.equal(created[0].isDestroyed(), true);
    assert.equal(conditional.node.at('company'), undefined);
    project({ invoice: true });
    assert.equal(created[1].getValue(), 'Baseline');
    const currentInput = created[1].el.querySelector('input');
    conditional.render();
    assert.equal(created.length, 2);
    assert.equal(created[1].el.querySelector('input'), currentInput);
    conditional.getRegion('billing').empty();
    conditional.resetForm();
    assert.equal(created[1].isDestroyed(), true);
    assert.deepEqual(conditional.getValues(), { invoice: false });
    assert.deepEqual(notifications, [{ invoice: false }]);
    conditionalOwner.destroy();
    conditional.setValues({ invoice: true });
    assert.equal(created.length, 2);
    document.body.replaceChildren();
    // Exercise only the installed public entry, including JSON named registrations.
    const composedOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
    const savedRows = []; const customFields = []; const notices = [];
    const composed = new FormView({
      template: () => '<div data-rows></div>', regions: { rows: '[data-rows]' },
      values: { contacts: [
        { id: 'a', profile: { email: '', note: 'A note' } },
        { id: 'b', profile: { email: 'b@example.com', note: 'B note' } }
      ] }, submit: values => savedRows.push(values)
    });
    composedOwner.show(composed);
    const list = new FieldView({ form: composed, name: 'contacts', removal: 'preserve',
      input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-list-rows': '' } }) } },
      regions: { rows: '[data-list-rows]' } });
    composed.showChildView('rows', list);
    const display = new CollectionView(); list.showChildView('rows', display);
    class EmailField extends FieldView {}
    class Notice extends View {
      constructor(title) { super({ template: () => '<output></output>' }); this.title = title; }
      onRender() { this.el.querySelector('output').textContent = this.title; }
      setTitle(title) { this.title = title; this.el.querySelector('output').textContent = title; }
    }
    const rowSchema = JSON.parse(JSON.stringify({ $formkit: 'group', name: 'profile', children: [
      { $cmp: 'Email', props: { name: 'email', removal: 'preserve', input: { type: 'email', label: '$emailLabel', validation: 'required|email' } } },
      { $formkit: 'text', name: 'note', label: 'Note' },
      { $cmp: 'Notice', props: { title: '$notice' } }
    ] }));
    class ContactRow extends RowView {
      constructor(options) { super({ ...options, template: () => '<div data-schema></div>', regions: { schema: '[data-schema]' } }); }
      onRender() {
        const components = createViewComponents({ getForm: () => composed, getOwner: () => this,
          registrations: {
            Email: { kind: 'field', create: options => { const field = new EmailField(options); customFields.push(field); return field; } },
            Notice: { kind: 'view', create: ({ props }) => { const notice = new Notice(props.title); notices.push(notice); return notice; },
              update: (view, props) => view.setTitle(props.title) }
          } });
        this.showChildView('schema', new SchemaView({ form: composed, parent: this.node, schema: rowSchema,
          schemaData: { emailLabel: 'Contact email', notice: 'Contact guidance' }, components }));
      }
    }
    const a = new ContactRow({ form: composed, parent: list.node, rowKey: 'a', removal: 'preserve' });
    const b = new ContactRow({ form: composed, parent: list.node, rowKey: 'b', removal: 'preserve' });
    display.addChildView(a); display.addChildView(b); await flush();
    const aSchema = a.getChildView('schema'); const email = a.el.querySelector('input[type=email]');
    const note = a.el.querySelector('input[type=text]');
    const composedIds = [composed.node.props.id, list.node.props.id, a.node.props.id, b.node.props.id,
      ...Array.from(composed.el.querySelectorAll('input')).map(element => element.id)];
    assert.equal(document.querySelectorAll('form').length, 1);
    assert.equal(composed.el.querySelectorAll('input').length, 4);
    assert.equal(new Set(composedIds).size, composedIds.length);
    assert.equal(customFields.length, 2); assert.equal(notices.length, 2);
    assert.equal(customFields[0].node.parent.name, 'profile'); assert.equal(customFields[0].node.parent.parent, a.node);
    assert.equal(aSchema.node, a.node); assert.equal(notices[0].isAttached(), true);
    assert.equal(await composed.submit(), 'invalid'); assert.equal(document.activeElement, email);
    assert.equal(email.getAttribute('aria-invalid'), 'true'); assert.equal(savedRows.length, 0);
    email.value = 'a@example.com'; email.dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(email.id).settled; await getNode(email.id).ledger.settled('validating'); await flush();
    email.focus();
    list.setValue([...composed.getValues().contacts].reverse(), { notify: false }); await flush();
    aSchema.setSchemaData({ emailLabel: 'Updated email', notice: 'Updated guidance' }); await flush();
    assert.equal(a.el.querySelector('input[type=email]'), email); assert.equal(a.el.querySelector('input[type=text]'), note);
    assert.equal(document.activeElement, email); assert.equal(notices[0].el.textContent, 'Updated guidance');
    assert.equal(customFields[0].node.props.label, 'Updated email');
    assert.equal(await composed.submit(), 'success');
    assert.deepEqual(savedRows, [{ contacts: [
      { id: 'b', profile: { email: 'b@example.com', note: 'B note' } },
      { id: 'a', profile: { email: 'a@example.com', note: 'A note' } }
    ] }]);
    composed.resetForm(); await flush();
    assert.equal(a.el.querySelector('input[type=email]'), email); assert.equal(email.value, '');
    assert.deepEqual(composed.getValues().contacts.map(contact => contact.id), ['a', 'b']);
    const changes = []; composed.on('form:change', values => changes.push(values));
    display.detachChildView(a); composedOwner.destroy(); await flush();
    assert.equal(a.isDestroyed(), true); assert.equal(b.isDestroyed(), true); assert.equal(aSchema.isDestroyed(), true);
    for (const view of [...customFields, ...notices]) { assert.equal(view.isDestroyed(), true); }
    for (const id of composedIds) { assert.equal(getNode(id), undefined); }
    email.value = 'late@example.com'; email.dispatchEvent(new Event('input', { bubbles: true })); await flush();
    assert.deepEqual(changes, []);
    document.body.replaceChildren();
    for (let cycle = 0; cycle < 3; cycle++) {
      const nestedOwner = new Region({ el: document.body.appendChild(document.createElement('div')) });
      const nestedValues = { groups: [
        { id: 'a', items: [{ id: 'x', name: '' }, { id: 'y', name: 'AY' }] },
        { id: 'b', items: [{ id: 'x', name: 'BX' }, { id: 'y', name: 'BY' }] }
      ] };
      let finishNested; let nestedSignal;
      const nestedSaved = [];
      const nested = new FormView({ values: nestedValues,
        template: () => '<div data-groups></div>', regions: { groups: '[data-groups]' },
        submit(values, { signal }) {
          nestedSaved.push(values); nestedSignal = signal;
          return new Promise(resolve => { finishNested = resolve; });
        } });
      nestedOwner.show(nested);
      const outerList = new FieldView({ form: nested, name: 'groups', removal: 'preserve',
        input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-rows': '' } }) } },
        regions: { rows: '[data-rows]' } });
      nested.showChildView('groups', outerList);
      const outerDisplay = new CollectionView(); outerList.showChildView('rows', outerDisplay);
      class ItemRow extends RowView {
        constructor(options) { super({ ...options, template: () => '<div data-name></div>', regions: { name: '[data-name]' } }); }
        onRender() {
          this.showChildView('name', new FieldView({ form: nested, parent: this.node, name: 'name', removal: 'preserve',
            input: { type: 'text', label: 'Nested item name', validation: 'required' } }));
        }
      }
      class GroupRow extends RowView {
        constructor(options) { super({ ...options, template: () => '<div data-items></div>', regions: { items: '[data-items]' } }); }
        onRender() {
          const innerList = new FieldView({ form: nested, parent: this.node, name: 'items', removal: 'preserve',
            input: { type: 'list', dynamic: true, itemKey: 'id', slots: { default: () => ({ $el: 'div', attrs: { 'data-rows': '' } }) } },
            regions: { rows: '[data-rows]' } });
          this.showChildView('items', innerList);
          const innerDisplay = new CollectionView(); innerList.showChildView('rows', innerDisplay);
          for (const rowKey of ['x', 'y']) {
            innerDisplay.addChildView(new ItemRow({ form: nested, parent: innerList.node, rowKey, removal: 'preserve' }));
          }
        }
      }
      const outerRows = ['a', 'b'].map(rowKey => new GroupRow({ form: nested, parent: outerList.node, rowKey, removal: 'preserve' }));
      outerRows.forEach(row => outerDisplay.addChildView(row)); await flush();
      const innerDisplay = outerRows[0].getChildView('items').getChildView('rows');
      const ax = innerDisplay.children.find(row => row.options.rowKey === 'x');
      const nestedInput = ax.el.querySelector('input');
      const nestedIds = [nested.node.props.id]; nested.node.walk(node => nestedIds.push(node.props.id));
      assert.equal(document.querySelectorAll('form').length, 1);
      assert.equal(new Set(nestedIds).size, nestedIds.length);
      nested.node.walk(node => assert.equal(node.root, nested.node));
      assert.equal(await nested.submit(), 'invalid'); assert.equal(document.activeElement, nestedInput);
      assert.equal(nestedInput.getAttribute('aria-invalid'), 'true');
      nestedInput.value = 'Latest AX'; nestedInput.dispatchEvent(new Event('input', { bubbles: true }));
      await getNode(nestedInput.id).settled; await getNode(nestedInput.id).ledger.settled('validating'); await flush();
      nestedInput.focus();
      nested.setValues({ groups: nested.getValues().groups.map(group => ({ ...group, items: [...group.items].reverse() })).reverse() }); await flush();
      assert.equal(ax.el.querySelector('input'), nestedInput); assert.equal(document.activeElement, nestedInput);
      assert.equal(nested.getValues().groups[1].items[1].name, 'Latest AX');
      assert.equal(nested.getValues().groups[0].items[1].name, 'BX');
      nested.resetForm(); await flush();
      assert.equal(ax.el.querySelector('input'), nestedInput); assert.equal(nestedInput.value, '');
      const nestedName = ax.getChildView('name');
      nestedName.setValue('Ready AX');
      await nestedName.node.settled; await nested.node.ledger.settled('validating'); await flush();
      const pendingNested = nested.submit(); await flush();
      assert.equal(nestedSaved.length, 1); assert.equal(nestedSaved[0].groups[0].items[0].name, 'Ready AX');
      innerDisplay.detachChildView(ax);
      nested.setValues({ groups: nested.getValues().groups.filter(group => group.id !== 'a') }); await flush();
      assert.equal(ax.isDestroyed(), true); assert.equal(nestedSignal.aborted, true);
      finishNested(); assert.equal(await pendingNested, 'cancelled');
      nestedOwner.destroy(); await flush();
      nestedIds.forEach(id => assert.equal(getNode(id), undefined));
      nestedInput.dispatchEvent(new Event('input', { bubbles: true })); await flush();
      document.body.replaceChildren();
    }
    console.log(`${name}: three installed nested-row edit/reorder/reset/cancel/detached-cleanup cycles passed.`);
    console.log(`${name}: installed keyed rows, borrowed SchemaView and named field/view registrations passed.`);
    console.log(`${name}: five schema and five composed installed-package edit/submit/reset/destroy cycles passed.`);
  }
  assert.deepEqual(runtimeErrors, []);
  console.log(`Node ${process.version}: native installed ESM/CommonJS consumer floor check passed.`);
} finally { dom.window.close(); }

import { CollectionView, Region, View } from 'marionette';
import { FieldView, FormView, RowView, SchemaView, SubmissionError, createViewComponents } from '@mnjs/formkit';

// This invented planning DTO is its own example contract. A real application
// may keep an actor and a domain submission builder authoritative instead.
const constructionValues = () => ({
  overview: { title: 'Neighbourhood follow-up plan', email: '', startDate: '2026-12-01', priority: 'normal' },
  followUps: [
    { id: 'one', contact: { name: 'Ada', email: 'ada@example.test' }, due: '2026-12-03', notes: 'Confirm the meeting place.' },
    { id: 'two', contact: { name: 'Bryn', email: 'bryn@example.test' }, due: '2026-12-04', notes: '' },
    { id: 'three', contact: { name: 'Cleo', email: 'cleo@example.test' }, due: '2026-12-05', notes: '' }
  ]
});

class DraftSummary extends View {
  constructor(options) {
    super({ ...options, template: () => '<p data-summary role="status" aria-live="polite"></p>' });
    this.summary = options.summary;
  }
  onRender() { this.setSummary(this.summary); }
  setSummary(summary) {
    this.summary = summary;
    if (this.isRendered()) { this.el.querySelector('[data-summary]').textContent = `${summary} follow-ups in this draft.`; }
  }
}
class PriorityField extends FieldView {
  onRender() { this.markPriority(this.getValue()); }
  onFieldChange(value) { this.markPriority(value); }
  markPriority(value) { this.el.dataset.priority = String(value); }
}

class PartnerSection extends View {
  constructor(options) {
    super({ ...options, template: () => '<div data-partner-group></div><div data-partner-fields></div>',
      regions: { group: '[data-partner-group]', fields: '[data-partner-fields]' } });
  }
  onRender() {
    const { form, instance } = this.options;
    const partner = new FieldView({ form, name: 'partner', removal: 'clear', input: { type: 'group' } });
    this.showChildView('group', partner);
    this.showChildView('fields', new SchemaView({ form, parent: partner.node, schema: [
      { $formkit: 'text', name: 'organisation', id: `${instance}-partner`, label: 'Partner organisation', validation: 'required', preserve: true }
    ] }));
  }
}

function components(form, owner, views) {
  const observe = view => {
    views.add(view); view.once('destroy', () => views.delete(view)); return view;
  };
  return createViewComponents({
    getForm: () => form, getOwner: () => owner(),
    registrations: {
      DraftSummary: {
        kind: 'view', create: ({ props }) => observe(new DraftSummary({ summary: props.count })),
        update: (view, props) => view.setSummary(props.count)
      },
      Priority: { kind: 'field', create: options => observe(new PriorityField(options)) }
    }
  });
}

class FollowUpRow extends RowView {
  constructor(options) {
    super({ ...options,
      template: () => '<article><h3 data-row-heading></h3><div data-contact-group></div><div data-contact-fields></div><div data-details></div><button type="button" data-remove>Remove follow-up</button></article>',
      regions: { contact: '[data-contact-group]', fields: '[data-contact-fields]', details: '[data-details]' },
      events: { 'click [data-remove]': 'removeRow' }
    });
  }
  onRender() {
    const { form, rowKey, instance } = this.options;
    this.el.dataset.row = rowKey;
    this.el.querySelector('[data-row-heading]').textContent = `Follow-up ${rowKey}`;
    this.el.querySelector('[data-remove]').setAttribute('aria-label', `Remove follow-up ${rowKey}`);
    const contact = new FieldView({ form, parent: this.node, name: 'contact', removal: 'preserve', input: { type: 'group' } });
    this.showChildView('contact', contact);
    this.contact = contact;
    this.showContactFields();
    this.showChildView('details', new SchemaView({ form, parent: this.node, schema: [
      { $formkit: 'date', name: 'due', id: `${instance}-${rowKey}-due`, label: `${rowKey} due date`, preserve: true,
        validation: 'required|afterStart', validationMessages: { afterStart: 'Choose a date on or after the plan start.' } },
      { $formkit: 'textarea', name: 'notes', id: `${instance}-${rowKey}-notes`, label: `${rowKey} notes`, preserve: true,
        help: 'Draft edits settle before submission.', delay: 80, attrs: { rows: 2 } }
    ] }));
  }
  showContactFields() {
    const { form, rowKey, instance } = this.options;
    this.showChildView('fields', new SchemaView({ form, parent: this.contact.node, schema: [
      { $formkit: 'text', name: 'name', id: `${instance}-${rowKey}-name`, label: `${rowKey} contact name`, preserve: true, validation: 'required' },
      { $formkit: 'email', name: 'email', id: `${instance}-${rowKey}-email`, label: `${rowKey} contact email`, preserve: true,
        validation: 'required|email|distinctContact', validationMessages: { distinctContact: 'Use a different email for each follow-up.' } }
    ] }));
  }
  replaceFields() {
    // Identity replacement has an explicit disposal boundary. It keeps values,
    // but does not claim focus or DOM identity across this intentional replacement.
    this.getRegion('fields').empty();
    this.showContactFields();
  }
  removeRow() { this.options.layout.removeRow(this.options.rowKey); }
}

class FollowUpList extends CollectionView {
  constructor(options) { super({ ...options, collection: [], childView: FollowUpRow, sortWithCollection: false }); }
}

class PlanLayout extends View {
  constructor(options) {
    super({ ...options,
      template: () => '<div class="tabs" role="tablist" aria-label="Plan sections"><button type="button" role="tab" data-tab="overview" aria-selected="true">Overview</button><button type="button" role="tab" data-tab="follow-ups" aria-selected="false" tabindex="-1">Follow-ups</button></div><section data-panel="overview" role="tabpanel"><h2>Overview</h2><div data-overview-group></div><div data-overview-fields></div><button type="button" data-partner aria-expanded="false">Add partner details</button><div data-partner-section></div></section><section data-panel="follow-ups" role="tabpanel" hidden><h2>Follow-ups</h2><p>Tab sections retain their controls and validation.</p><button type="button" data-add>Add follow-up</button><button type="button" data-insert>Insert follow-up first</button><button type="button" data-reverse>Reverse follow-ups</button><button type="button" data-hide>Temporarily hide first follow-up</button><div data-list-field></div><div data-rows></div></section>',
      regions: { overview: '[data-overview-group]', overviewFields: '[data-overview-fields]', partner: '[data-partner-section]', list: '[data-list-field]', rows: '[data-rows]' },
      events: { 'click [role="tab"]': 'selectTab', 'keydown [role="tab"]': 'tabKey',
        'click [data-partner]': 'togglePartner', 'click [data-add]': 'addRow', 'click [data-insert]': 'insertRow',
        'click [data-reverse]': 'reverseRows', 'click [data-hide]': 'toggleFirstRow' }
    });
    this.actor = { partnerNeeded: false };
    this.rowViews = new Map();
    this.componentViews = new Set();
    this.hiddenKeys = new Set();
    this.nextKey = 4;
  }
  onRender() {
    const { form, instance } = this.options;
    this.el.querySelectorAll('[role="tab"]').forEach(tab => {
      const key = tab.dataset.tab;
      tab.id = `${instance}-tab-${key}`;
      tab.setAttribute('aria-controls', `${instance}-panel-${key}`);
      const panel = this.el.querySelector(`[data-panel="${key}"]`);
      panel.id = `${instance}-panel-${key}`;
      panel.setAttribute('aria-labelledby', tab.id);
    });
    const overview = new FieldView({ form, name: 'overview', removal: 'preserve', input: { type: 'group' } });
    this.showChildView('overview', overview);
    let section;
    this.componentRegistry = components(form, () => section, this.componentViews);
    section = new SchemaView({ form, parent: overview.node, schemaData: { rowCount: 3 }, components: this.componentRegistry, schema: [
      { $formkit: 'text', name: 'title', id: `${instance}-title`, label: 'Plan title', validation: 'required', preserve: true },
      { $formkit: 'email', name: 'email', id: `${instance}-owner-email`, label: 'Plan owner email', validation: 'required|email', preserve: true },
      { $formkit: 'date', name: 'startDate', id: `${instance}-start`, label: 'Plan start date', validation: 'required', preserve: true },
      { $cmp: 'Priority', key: 'priority', props: { name: 'priority', removal: 'preserve', input: {
        type: 'select', id: `${instance}-priority`, label: 'Plan priority', options: ['normal', 'urgent']
      } } },
      { $cmp: 'DraftSummary', key: 'summary', props: { count: '$rowCount' } }
    ] });
    this.overviewSchema = section;
    this.showChildView('overviewFields', section);
    this.list = new FieldView({ form, name: 'followUps', removal: 'preserve', input: { type: 'list', dynamic: true, itemKey: 'id' } });
    this.showChildView('list', this.list);
    this.rows = new FollowUpList();
    this.showChildView('rows', this.rows);
    this.reconcileRows();
  }
  selectTab(event) { this.activate(event.delegateTarget.dataset.tab); }
  activate(key, focus = false) {
    this.el.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab.dataset.tab === key;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) { tab.focus(); }
    });
    this.el.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== key; });
  }
  tabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { return; }
    event.preventDefault();
    const current = event.delegateTarget.dataset.tab;
    this.activate(event.key === 'Home' ? 'overview' : event.key === 'End' ? 'follow-ups' : current === 'overview' ? 'follow-ups' : 'overview', true);
  }
  togglePartner() {
    this.actor.partnerNeeded = !this.actor.partnerNeeded;
    this.syncPartner();
  }
  syncPartner() {
    const { form, instance } = this.options;
    const button = this.el.querySelector('[data-partner]');
    button.setAttribute('aria-expanded', String(this.actor.partnerNeeded));
    button.textContent = this.actor.partnerNeeded ? 'Remove partner details' : 'Add partner details';
    if (this.actor.partnerNeeded && !this.getRegion('partner').hasView()) {
      this.showChildView('partner', new PartnerSection({ form, instance }));
    } else if (!this.actor.partnerNeeded) { this.getRegion('partner').empty(); }
  }
  values() { return this.options.form.getValues().followUps; }
  writeRows(rows) { this.options.form.setValues({ followUps: rows }); this.reconcileRows(); }
  addRow() { this.newRow(false); }
  insertRow() { this.newRow(true); }
  newRow(first) {
    const id = `new-${this.nextKey++}`;
    const row = { id, contact: { name: `Contact ${id}`, email: `${id}@example.test` }, due: '2026-12-06', notes: '' };
    this.writeRows(first ? [row, ...this.values()] : [...this.values(), row]);
  }
  reverseRows() { this.writeRows([...this.values()].reverse()); }
  removeRow(key) { this.hiddenKeys.delete(key); this.writeRows(this.values().filter(row => row.id !== key)); }
  toggleFirstRow() {
    const key = this.values()[0]?.id;
    if (!key) { return; }
    this.hiddenKeys.has(key) ? this.hiddenKeys.delete(key) : this.hiddenKeys.add(key);
    this.rows.setFilter(row => !this.hiddenKeys.has(row.options.rowKey));
    this.el.querySelector('[data-hide]').textContent = this.hiddenKeys.size ? 'Show temporarily hidden follow-up' : 'Temporarily hide first follow-up';
  }
  reconcileRows() {
    if (!this.rows || this.isDestroyed()) { return; }
    const values = this.values(), keys = values.map(row => row.id);
    for (const [key, view] of this.rowViews) {
      if (!keys.includes(key) || view.isDestroyed()) {
        if (!view.isDestroyed()) { this.rows.removeChildView(view); }
        this.rowViews.delete(key);
      }
    }
    for (const row of values) {
      if (!this.rowViews.has(row.id)) {
        const view = new FollowUpRow({ form: this.options.form, parent: this.list.node, rowKey: row.id, removal: 'preserve', instance: this.options.instance, layout: this });
        this.rowViews.set(row.id, view); this.rows.addChildView(view);
      }
    }
    this.rows.setComparator(row => keys.indexOf(row.options.rowKey));
    this.overviewSchema.setSchemaData({ rowCount: keys.length });
  }
  afterReset() {
    this.hiddenKeys.clear(); this.rows.removeFilter(); this.actor.partnerNeeded = false; this.syncPartner(); this.reconcileRows();
    this.el.querySelector('[data-hide]').textContent = 'Temporarily hide first follow-up';
  }
  revealInvalid() {
    const invalid = this.el.querySelector('[aria-invalid="true"]');
    const panel = invalid?.closest('[data-panel]');
    if (panel) { this.activate(panel.dataset.panel); }
    // A retained hidden row can block submission. Reveal it before focusing.
    if (!invalid && this.hiddenKeys.size) { this.hiddenKeys.clear(); this.rows.removeFilter(); this.activate('follow-ups'); }
  }
}

function simulatedServer() {
  const requests = [];
  let mode = 'normal';
  return { requests, setMode(next) { mode = next; },
    save(values, { signal }) {
      return new Promise((resolve, reject) => {
        const held = mode === 'hold';
        const request = { values: structuredClone(values), signal, resolve, reject, completed: false };
        requests.push(request);
        const complete = () => {
          if (request.completed) { return; } request.completed = true;
          signal.removeEventListener('abort', aborted);
          if (values.overview.title === 'taken') {
            reject(new SubmissionError('The simulated service rejected this draft.', { 'overview.title': ['Choose another plan title.'] }));
          } else { resolve({ saved: values.followUps.length }); }
        };
        const timer = held ? undefined : setTimeout(complete, 350);
        // The controlled browser fixture can deliver a late held response even
        // after cancellation, like a service that ignores AbortSignal. FormView
        // owns whether that result is still allowed to commit.
        const aborted = () => {
          clearTimeout(timer);
          if (!held) { request.completed = true; reject(new DOMException('Cancelled', 'AbortError')); }
        };
        signal.addEventListener('abort', aborted, { once: true });
        request.complete = complete;
      });
    }
  };
}

class PlanForm extends FormView {
  onRender() {
    this.layout = new PlanLayout({ form: this, instance: this.example.instance });
    this.showChildView('layout', this.layout);
  }
  onFormChange(values) {
    if (this.example) { this.example.output.textContent = JSON.stringify(values, null, 2); }
    this.layout?.reconcileRows();
  }
  onFormState(state) {
    if (!this.example) { return; }
    this.el.querySelector('[data-root-errors]').textContent = state.errors.join(' ');
    this.el.querySelector('[data-progress]').textContent = state.submitting ? 'Checking and saving…' : '';
  }
  onSubmitInvalid() { this.layout.revealInvalid(); }
  onSubmitSuccess(values, response) { this.example.status.textContent = `Saved ${response.saved} follow-ups for ${values.overview.title}.`; }
  onSubmitError() { this.layout.revealInvalid(); }
  onFormReset() { this.example.status.textContent = ''; this.layout.afterReset(); }
  events() { return { 'click [data-cancel]': 'cancel' }; }
  cancel() { this.resetForm(); }
}

export function mountComposedPlan(host, { instance = 'plan', output, status } = {}) {
  output ??= document.createElement('pre'); status ??= document.createElement('p');
  const server = simulatedServer();
  const form = new PlanForm({
    template: () => '<div data-layout></div><div class="actions"><button type="submit">Save plan</button><button type="reset">Reset</button><button type="button" data-cancel>Reset and cancel</button></div><p data-progress role="status" aria-live="polite"></p><p data-root-errors role="alert" aria-live="assertive"></p>',
    regions: { layout: '[data-layout]' }, values: constructionValues(),
    validationRules: {
      afterStart: node => String(node.value) >= String(node.root.value.overview.startDate),
      distinctContact: node => node.root.value.followUps.filter(row => row.contact?.email === node.value).length <= 1
    },
    submit: (values, context) => server.save(values, context)
  });
  form.example = { instance, output, status };
  const owner = new Region({ el: host }); owner.show(form);
  output.textContent = JSON.stringify(form.getValues(), null, 2);
  return { form, server, owner, get layout() { return form.layout; },
    destroy() { owner.destroy(); },
    reset() { form.resetForm(); }
  };
}

if (document.querySelector('#composed-form')) {
  window.composedPlan = mountComposedPlan(document.querySelector('#composed-form'), {
    output: document.querySelector('#values'), status: document.querySelector('#result')
  });
  window.addEventListener('pagehide', () => window.composedPlan.destroy(), { once: true });
}

import { Region } from 'marionette';
import { FieldView, FormView, SubmissionError } from '@mnjs/formkit';

const status = document.querySelector('#result');
const values = document.querySelector('#values');
class Registration extends FormView {
  events() { return { 'click .toggle-notes': 'toggleNotes' }; }
  onRender() {
    const profile = this.field('profile', 'profile', { type: 'group' });
    this.field('name', 'name', { type: 'text', label: 'Name', validation: 'required', autocomplete: 'name' }, profile.node);
    this.field('email', 'email', { type: 'email', label: 'Email', validation: 'required|email', autocomplete: 'email' }, profile.node);
    this.field('notes', 'notes', { type: 'textarea', label: 'Access needs', help: 'Optional. Closing this section keeps your draft.', attrs: { rows: 3 } }, profile.node);
    this.invoiceField = this.field('invoice', 'invoice', { type: 'checkbox', label: 'Request a company invoice' });
    this.listenTo(this.invoiceField, 'field:change', this.syncCompany);
    this.syncCompany();
  }
  field(region, name, input, parent, removal = 'preserve') {
    const field = new FieldView({ form: this, name, parent, input, removal });
    this.showChildView(region, field);
    return field;
  }
  syncCompany() {
    const region = this.getRegion('company');
    if (this.invoiceField.getValue()) {
      if (!region.hasView()) {
        this.field('company', 'company', { type: 'text', label: 'Company', validation: 'required' }, undefined, 'clear');
      }
    } else {region.empty();}
  }
  onFormChange(snapshot) {
    values.textContent = JSON.stringify(snapshot, null, 2);
  }
  toggleNotes(event) {
    const section = this.el.querySelector('.notes');
    section.hidden = !section.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!section.hidden));
  }
  onFormReset() { status.textContent = ''; this.syncCompany(); }
}
const form = new Registration({
  template: () => '<fieldset><legend>Attendee</legend><div class="profile"></div><div class="name"></div><div class="email"></div><button type="button" class="toggle-notes" aria-expanded="true" aria-controls="access-notes">Access needs</button><div class="notes" id="access-notes"></div></fieldset><fieldset><legend>Billing</legend><div class="invoice"></div><div class="company"></div></fieldset><button type="submit">Register</button><button type="reset">Reset</button>',
  regions: { profile: '.profile', name: '.name', email: '.email', notes: '.notes', invoice: '.invoice', company: '.company' },
  values: { profile: { name: 'Paul', email: '', notes: '' }, invoice: false },
  async submit(snapshot, { signal }) {
    status.textContent = '';
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 400);
      signal.addEventListener('abort', abort, { once: true });
    });
    if (snapshot.profile.name === 'taken') {throw new SubmissionError('Choose another name.', { 'profile.name': ['Already registered.'] });}
    status.textContent = `Registered ${snapshot.profile.name}.`;
  }
});
const region = new Region({ el: '#form' });
region.show(form);
window.addEventListener('pagehide', () => region.destroy(), { once: true });

import { Region } from 'marionette';
import { FormView, SubmissionError } from '@mnjs/formkit';
import { createMultiStepPlugin, createAutoHeightTextareaPlugin } from '@formkit/addons';

const result = document.querySelector('#result');
const valuesOutput = document.querySelector('#values');
const region = new Region({ el: '#form' });
let nextId = 3;
const form = new FormView({
  values: { registration: { team: { name: 'Marionette', participants: [{ id: '1', name: 'Paul' }, { id: '2', name: 'Ada' }] } } },
  plugins: [createMultiStepPlugin({ allowIncomplete: false }), createAutoHeightTextareaPlugin()],
  submitLabel: 'Register team',
  schema: [{ $formkit: 'multi-step', name: 'registration', id: 'registration-steps', children: [
    { $formkit: 'step', name: 'account', label: 'Contact', children: [
      { $formkit: 'email', name: 'email', label: 'Contact email', validation: 'required|email', autocomplete: 'email' },
      { $formkit: 'checkbox', id: 'invoice-choice', name: 'invoice', label: 'Request an invoice' },
      { $formkit: 'text', name: 'company', label: 'Company', if: '$get("invoice-choice").value', validation: 'required' },
      { $formkit: 'checkbox', name: 'agreement', label: 'Accept registration terms', validation: 'accepted' }
    ] },
    { $formkit: 'step', name: 'team', label: 'Team', children: [
      { $formkit: 'text', name: 'name', label: 'Team name', validation: 'required|length:2,40' },
      { $formkit: 'radio', name: 'role', label: 'Team role', options: ['Developer', 'Designer'], value: 'Developer' },
      { $formkit: 'select', name: 'sessions', label: 'Sessions', multiple: true, options: ['Architecture', 'Forms', 'Testing'] },
      { $formkit: 'textarea', name: 'notes', label: 'Notes', rows: 2, autoHeight: true },
      { $formkit: 'file', name: 'attachment', label: 'Optional attachment', multiple: false },
      { $formkit: 'list', name: 'participants', dynamic: true, itemKey: 'id', children: [
        { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
          { $formkit: 'hidden', name: 'id' },
          { $formkit: 'text', name: 'name', label: 'Participant name', validation: 'required' }
        ] }
      ] }
    ] }
  ] }],
  async submit(values, { signal }) {
    result.textContent = '';
    await new Promise((resolve, reject) => {
      const aborted = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, 600);
      signal.addEventListener('abort', aborted, { once: true });
    });
    if (values.registration.team.name === 'taken') {
      throw new SubmissionError('Choose another team name.', { 'registration.team.name': ['This team name is already taken.'] });
    }
    result.textContent = `Registered ${values.registration.team.name}.`;
  }
});
form.on('form:change', values => { valuesOutput.textContent = JSON.stringify(values, (_key, value) => value instanceof File ? { name: value.name, size: value.size } : value, 2); });
form.on('form:reset', () => { result.textContent = ''; });
region.show(form);
function participants() { return form.getValues().registration.team.participants; }
function update(rows) { form.setValues({ registration: { team: { participants: rows } } }, { source: 'user' }); }
document.querySelector('#add').addEventListener('click', () => update([...participants(), { id: String(nextId++), name: '' }]));
document.querySelector('#reorder').addEventListener('click', () => update([...participants()].reverse()));
document.querySelector('#remove').addEventListener('click', () => update(participants().slice(0, -1)));
document.querySelector('#cancel').addEventListener('click', () => form.resetForm());
window.addEventListener('pagehide', () => region.destroy(), { once: true });
// Exposes the same public API used by browser lifecycle checks.
window.formkitExample = { form, region };

import { Region } from 'marionette';
import { FormView, SubmissionError } from '@mnjs/formkit';

const result = document.querySelector('#result');
const output = document.querySelector('#values');
const region = new Region({ el: '#form' });
const form = new FormView({
  fields: [
    { name: 'email', type: 'email', label: 'Email', validation: 'required|email',
      help: 'We will use this to contact you.', attrs: { autocomplete: 'email' } },
    { name: 'profile', type: 'group', label: 'Public profile', children: [
      { name: 'name', type: 'text', label: 'Display name', value: 'Paul', validation: 'required|length:2,40',
        attrs: { autocomplete: 'nickname' } },
      { name: 'bio', type: 'textarea', label: 'Biography', attrs: { rows: 3 } },
      { name: 'role', type: 'select', label: 'Role', value: 'developer', options: [
        { value: 'developer', label: 'Developer' }, { value: 'designer', label: 'Designer' }
      ] },
      { name: 'newsletter', type: 'checkbox', label: 'Send me updates' }
    ] }
  ],
  submitLabel: 'Save profile',
  async submit(values, { signal }) {
    result.textContent = '';
    await new Promise((resolve, reject) => {
      const aborted = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, 600);
      signal.addEventListener('abort', aborted, { once: true });
    });
    if (values.profile.name === 'taken') {
      throw new SubmissionError('Please choose another display name.', { 'profile.name': ['This name is already taken.'] });
    }
    result.textContent = `Saved ${values.profile.name}.`;
  }
});
form.on('form:change', values => { output.textContent = JSON.stringify(values, null, 2); });
form.on('form:reset', () => { result.textContent = ''; });
region.show(form);
window.addEventListener('pagehide', () => region.destroy(), { once: true });

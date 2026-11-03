import { getNode } from '@formkit/core';
import { createProPlugin, autocomplete, dropdown, taglist, datepicker, toggle, slider, repeater } from '@formkit/pro';
import '@formkit/pro/genesis';

export const mode = new URLSearchParams(location.search).get('mode') ?? 'pro';
export const observations = { mode, hostname: location.hostname, bootstrap: 'pending', mounted: [], submissions: [], errors: [] };
export const show = () => { document.querySelector('#observations').textContent = JSON.stringify(observations, null, 2); };
export const plugins = [];
window.addEventListener('error', event => { observations.errors.push(String(event.error ?? event.message)); show(); });
window.addEventListener('unhandledrejection', event => { observations.errors.push(String(event.reason)); show(); });
try {
  if (mode === 'pro') { plugins.push(createProPlugin(undefined, { autocomplete, dropdown, taglist, datepicker, toggle, slider, repeater })); }
  observations.bootstrap = 'ready';
} catch (error) {
  observations.bootstrap = error.message === 'A FormKit API key is required, please visit https://formkit.com/pro' ? 'blocked' : 'error';
  observations.bootstrapError = error.message;
  if (observations.bootstrap === 'error') { observations.errors.push(error.message); }
}
plugins.push(node => {
  if (node.type === 'input') {
    node.on('mounted', () => {
      const control = document.getElementById(node.props.id);
      observations.mounted.push({ type: node.props.type, id: node.props.id, found: !!control, connected: !!control?.isConnected }); show();
    });
  }
});
document.querySelector('#mode').textContent = `Mode: ${mode}; FormKit core 2.1.2; Pro 0.130.3`;
document.querySelector('#bootstrap').textContent = observations.bootstrap === 'blocked' ? `Pro bootstrap blocked: ${observations.bootstrapError}` : 'Ready';
show();
export const initial = () => ({ contact: { name: '', email: '' }, ...(mode === 'pro' ? { guests: [{ name: '' }], priority: 20, updates: false, topics: [] } : {}) });
export const replacement = () => ({ contact: { name: 'Ada', email: 'ada@example.test' }, ...(mode === 'pro' ? { team: 'Beta', city: 'Alpha', topics: ['Gamma'], updates: true, priority: 70, guests: [{ name: 'Grace' }] } : {}) });
const choices = ['Alpha', 'Beta', 'Gamma'];
export const schema = [
  { $formkit: 'group', name: 'contact', children: [
    { $formkit: 'text', id: 'contact-name', name: 'name', label: 'Name', help: 'Use the name on your registration.', validation: 'required', classes: '$localClasses', config: '$fieldConfig' },
    { $formkit: 'email', id: 'contact-email', name: 'email', label: 'Email', help: 'We send the receipt here.', validation: 'required|email' }
  ] },
  ...(mode === 'pro' ? [
    { $formkit: 'dropdown', id: 'team', name: 'team', label: 'Team', options: choices, validation: 'required' },
    { $formkit: 'autocomplete', id: 'city', name: 'city', label: 'City', options: choices },
    { $formkit: 'taglist', id: 'topics', name: 'topics', label: 'Topics', options: choices },
    { $formkit: 'datepicker', id: 'date', name: 'date', label: 'Appointment date' },
    { $formkit: 'toggle', id: 'updates', name: 'updates', label: 'Receive updates' },
    { $formkit: 'slider', id: 'priority', name: 'priority', label: 'Priority', min: 0, max: 100, step: 10 },
    { $formkit: 'repeater', id: 'guests', name: 'guests', label: 'Guests', min: 1, max: 3, children: [
      { $formkit: 'text', name: 'name', label: 'Guest name', validation: 'required' }
    ] }
  ] : [])
];
let rejection = false;
const pending = new Set();
const finish = () => { const callbacks = [...pending]; pending.clear(); callbacks.forEach(done => done()); };
export async function submit(values) {
  const entry = { values: structuredClone(values), state: 'pending' };
  observations.submissions.push(entry); show();
  await new Promise(resolve => { pending.add(resolve); });
  // Use each adapter's supported server-error channel rather than assume that
  // throwing from a consumer callback has identical framework semantics.
  if (rejection) { entry.state = 'rejected'; window.proof.setErrors(['Server rejected this registration.'], { 'contact.email': ['Email is unavailable.'] }); } else { entry.state = 'resolved'; }
  show();
}
export function install(bridge) {
  let disabled = false;
  window.proof = { observations, ...bridge, finish };
  const showValues = () => { document.querySelector('#values').textContent = JSON.stringify(bridge.getValues(), null, 2); };
  bridge.observe(showValues); showValues();
  document.querySelector('#replace').onclick = () => bridge.setValues(replacement());
  document.querySelector('#disable').onclick = () => { disabled = !disabled; bridge.disable(disabled); };
  document.querySelector('#reject').onclick = () => { rejection = !rejection; document.querySelector('#reject').textContent = `Server rejection: ${rejection}`; };
  document.querySelector('#reset').onclick = () => bridge.reset();
  document.querySelector('#finish').onclick = finish;
  document.querySelector('#destroy').onclick = () => bridge.destroy();
  window.addEventListener('pagehide', () => bridge.destroy(), { once: true });
}
window.proof = { observations, hasNode: id => !!getNode(id) };

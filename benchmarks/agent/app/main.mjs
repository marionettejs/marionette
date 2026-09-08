import { View, Region } from 'marionette';
import { createProjects } from '../tasks/filter-projects/reference/solution.mjs';
import { createEditor } from '../tasks/save-shortcut/reference/solution.mjs';
import { createOverlayHost } from '../tasks/overlay-switch/reference/solution.mjs';
import { createConnectionStatus } from '../tasks/connection-status/reference/solution.mjs';
const mount = new Region({
  el: '#app'
});
const Shell = View.extend({
  template: () => '<header><span class="mark">F</span><div><h1>Fieldnotes</h1><p>A small workspace with explicit owners.</p></div><span class="tag">Public reference application</span></header><main><section class="projects"><h2>Projects</h2><label>Find a project<input type="search" placeholder="Filter projects"></label><div class="list"></div></section><section class="editor"><div class="section-heading"><h2>Working notes</h2><button class="help">How this works</button></div><p>Write a note. Save with Ctrl+Enter or ⌘+Enter.</p><div class="draft"></div><div class="status"></div><h3>Saved locally in this session</h3><ul class="saved"></ul></section></main><footer>13 draft tasks · reference solutions verified independently · no agent score claimed</footer>',
  regions: {
    projects: '.list',
    editor: '.draft',
    status: '.status'
  }
});
const shell = new Shell();
mount.show(shell);
const source = {
  listeners: new Set(),
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },
  emit(value) {
    this.listeners.forEach(callback => callback(value));
  }
};
const projects = createProjects(document.createElement('div'), [{
  id: 1,
  label: 'Community garden'
}, {
  id: 2,
  label: 'Reading room'
}, {
  id: 3,
  label: 'Weekend workshop'
}, {
  id: 4,
  label: 'Trail maintenance'
}]);
shell.showChildView('projects', projects.view);
const editor = createEditor(document.createElement('div'), text => {
  if (!text.trim()) {
    source.emit('Write a note before saving.');
    return;
  }
  const item = document.createElement('li');
  item.textContent = text;
  shell.el.querySelector('.saved').prepend(item);
  source.emit('Note saved in this session.');
});
shell.showChildView('editor', editor);
const status = createConnectionStatus(document.createElement('div'), source);
shell.showChildView('status', status);
source.emit('Ready. Nothing is sent to a server.');
const overlays = createOverlayHost(document.querySelector('#overlay'), element => {
  element.classList.add('dialog');
});
const filter = shell.el.querySelector('input[type=search]');
filter.addEventListener('input', () => projects.filter(filter.value));
const help = shell.el.querySelector('.help');
help.addEventListener('click', () => {
  const Help = View.extend({
    attributes: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'How Fieldnotes works'
    },
    template: () => '<h2>Small pieces, clear owners.</h2><p>A shell View owns three Regions. CollectionView owns project rows. Editor and status concerns live in Behaviors. A separate service coordinates overlays through one Region.</p><p>These are the same public reference modules exercised by the benchmark acceptance cases. The app is an example, not evidence of agent productivity.</p><button>Close</button>',
    events: {
      'click button'() {
        overlays.close();
        help.focus();
      }
    }
  });
  overlays.open(new Help(), help);
  overlays.region.currentView.el.querySelector('button').focus();
});
window.addEventListener('pagehide', () => {
  overlays.destroy();
  mount.destroy();
}, {
  once: true
});

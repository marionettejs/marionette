import { Application, View } from 'marionette';

// Editing and saving have their own lifetime. Application readiness is separate.
export const ProfileForm = View.extend({
  tagName: 'form',
  template: () => `
    <h1>Profile</h1>
    <label>Name <input name="name" autocomplete="name"></label>
    <label>Email <input name="email" type="email" autocomplete="email"></label>
    <button type="submit">Save profile</button>
    <p role="alert"></p><p role="status"></p>`,
  events: { submit: 'saveProfile' },
  onRender() {
    this.el.noValidate = true;
    this.el.elements.name.value = this.options.profile?.name ?? '';
    this.el.elements.email.value = this.options.profile?.email ?? '';
  },
  setTitle(title = 'Profile') { this.el.querySelector('h1').textContent = title; },
  async saveProfile(event) {
    event.preventDefault();
    if (this.saving) { return; }
    const name = this.el.elements.name.value.trim();
    const email = this.el.elements.email.value.trim();
    const alert = this.el.querySelector('[role=alert]');
    const status = this.el.querySelector('[role=status]');
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      alert.textContent = 'Enter a name and valid email.';
      (!name ? this.el.elements.name : this.el.elements.email).focus();
      return;
    }
    alert.textContent = '';
    this.saving = true;
    this.saveController = new AbortController();
    this.el.querySelector('button').disabled = true;
    status.textContent = 'Saving…';
    try {
      const save = this.options.save ?? (async profile => profile);
      const saved = await save({ name, email }, { signal: this.saveController.signal });
      if (this.isDestroyed() || this.saveController.signal.aborted) { return; }
      this.savedProfile = saved;
      status.textContent = 'Profile saved.';
      this.trigger('saved', saved);
    } catch (error) {
      if (this.isDestroyed() || this.saveController.signal.aborted) { return; }
      alert.textContent = error.message;
      status.textContent = '';
    } finally {
      if (!this.isDestroyed() && !this.saveController.signal.aborted) {
        this.saving = false;
        this.el.querySelector('button').disabled = false;
      }
    }
  },
  onBeforeDestroy() { this.saveController?.abort(); }
});

export const ProfileFeature = Application.extend({
  prepareStart(options, { signal }) {
    return this.options.loadProfile({ signal });
  },
  onStart(app, options, profile) {
    this.showView(new ProfileForm({ profile, save: this.options.save }));
  }
});

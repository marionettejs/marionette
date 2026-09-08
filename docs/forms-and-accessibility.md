# Forms and accessible interactions

Use native form controls and keep an unfinished draft in the existing input DOM.
A Marionette View owns the form and its pending save; the application supplies the
persistence operation. A DataApi or StateApi is not required for this local draft.
Choose a shared observable source only when other owners need to observe it.

## Save without replacing the user's input

This complete module uses the default DOM and event implementations. The template
contains only trusted, fixed markup. User data is assigned through `value` or
`textContent`. Each instance gets its own label and message IDs.

<!-- executable-example: accessible-form-save -->
```javascript
import { View } from 'marionette';

export const ProfileForm = View.extend({
  tagName: 'form',
  attributes: { 'aria-label': 'Profile' },
  templateContext() { return { id: this.cid }; },
  template({ id }) {
    return `<label for="${id}-name">Display name</label>
      <input id="${id}-name" name="displayName" required
        autocomplete="nickname" maxlength="80"
        aria-describedby="${id}-status">
      <button type="submit">Save</button>
      <p id="${id}-status" role="status" aria-live="polite"></p>`;
  },
  events: { submit: 'onSubmit' },
  initialize({ displayName, save }) {
    this.initialName = displayName;
    this.save = save;
    this.pendingSave = null;
  },
  onRender() {
    this.el.elements.namedItem('displayName').value = this.initialName;
  },
  onBeforeRender() {
    this.cancelSave();
  },
  onSubmit(event) {
    event.preventDefault();
    return this.submit();
  },
  async submit() {
    if (this.isDestroyed() || this.pendingSave) return false;
    if (!this.el.reportValidity()) return false;
    const input = this.el.elements.namedItem('displayName');
    const button = this.el.querySelector('button');
    const status = this.el.querySelector('[role="status"]');
    const request = new AbortController();
    this.pendingSave = request;
    input.readOnly = true;
    button.disabled = true;
    this.el.setAttribute('aria-busy', 'true');
    status.textContent = 'Saving…';
    const displayName = input.value;
    try {
      await this.save({ displayName }, { signal: request.signal });
      if (request.signal.aborted || this.isDestroyed()) return false;
      this.initialName = displayName;
      status.textContent = 'Saved.';
      return true;
    } catch {
      if (request.signal.aborted || this.isDestroyed()) return false;
      status.textContent = 'Could not save. Your changes are still here. Try again.';
      return false;
    } finally {
      if (this.pendingSave === request) {
        this.pendingSave = null;
        input.readOnly = false;
        button.disabled = false;
        this.el.removeAttribute('aria-busy');
      }
    }
  },
  cancelSave() {
    this.pendingSave?.abort();
    this.pendingSave = null;
    this.el.removeAttribute('aria-busy');
  },
  onBeforeDestroy() {
    this.cancelSave();
  }
});
```

Mount it through a Region. This example's persistence is deliberately in memory;
replace `save` with the application's API client for durable storage.

```javascript
import { Region } from 'marionette';
import { ProfileForm } from './profile-form.js';

const mount = document.createElement('main');
document.body.append(mount);
const region = new Region({ el: mount });
let savedProfile = { displayName: 'Taylor' };
region.show(new ProfileForm({
  ...savedProfile,
  async save(profile, { signal }) {
    signal.throwIfAborted();
    savedProfile = profile;
  }
}));
// When the feature is removed: region.destroy(); mount.remove();
```

The submit event handles the button and keyboard submission. Native `required`
validation prevents an empty save. While saving, the input is read-only and the
button is disabled; duplicate programmatic submissions return `false`. A failure
keeps the same input, its value, and its selection. The live status announces the
outcome without replacing the form or forcing focus elsewhere.

Do not call `render()` for a status change. An explicit rerender is a reset to the
last saved value: it cancels a pending request before replacing the controls.
Destruction also aborts the request. The signal check matters even if a client
ignores cancellation. Aborting does **not** prove a server rolled back a write;
reconcile ambiguous writes through the application's API contract.

For server field validation, map known field errors to visible messages, set
`aria-invalid="true"`, and connect each message with `aria-describedby`. Clear
those errors when corrected. Keep an error summary focusable when the user needs
to move among several invalid fields. Avoid displaying raw server errors.
[WAI's form guidance](https://www.w3.org/WAI/tutorials/forms/) explains labels and
structure; its [notification guidance](https://www.w3.org/WAI/tutorials/forms/notifications/)
explains associating errors and communicating results.

## Focus when a screen changes

A Region owns destruction and insertion; it does not decide the application's
navigation focus policy. After a user-initiated route change has successfully
shown the new screen, update `document.title` and focus a meaningful heading with
`tabindex="-1"`. Keep that operation after the current-navigation check in the
[routing guide](./routing.md). A stale response must neither replace the page nor
move focus. Background refreshes should normally leave focus where the user put it.

Prefer `<button>` for actions and `<a href>` for navigation. A delegated click on a
`<div>` does not supply native keyboard semantics. In delegated handlers,
`event.delegateTarget` identifies the matched control; `event.target` may be its
nested icon. See [DOM interactions](./dom.interactions.md).

## Verify the experience

The [executable form fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/validate.mjs)
checks unique labels, literal untrusted text, duplicate saves, retained input and
focus, errors, cancellation, and late results. It uses a simulated DOM; it does
not establish screen-reader announcements or native browser validation UI.

In the real application, tab through the form, submit with Enter, cause an API
failure, navigate away during a save, and confirm there is no unexpected focus
jump. Check labels and notifications with the assistive technology your users
rely on. Automated accessibility checks supplement that interaction review.

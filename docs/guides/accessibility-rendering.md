# Accessibility and rendering

Marionette manages View lifetimes and placement. Your templates and interaction design determine accessible names, keyboard behavior, and where focus goes when content changes.

## Start with semantic controls

Use a native `button` for an action and a link with `href` for navigation. Label form fields visibly, keep document order meaningful, and preserve a visible focus indicator. A native button supplies keyboard activation, so a delegated `click` handler can serve pointer and keyboard users without duplicating Enter and Space handlers.

For a toggle button, keep its label stable and update `aria-pressed`. The [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) describes keyboard activation and focus behavior.

This View owns only local display state. Its class-scoped Lit adapter updates the same template's elements when the user toggles the setting.

```js
import { Region, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const NotificationSettings = View.extend({
  tagName: 'section',
  createState() { return { title: 'Notifications', muted: false }; },
  templateContext() { return this.getState(); },
  template: ({ title, muted }) => html`
    <h2 class="heading" tabindex="-1">${title}</h2>
    <button type="button" class="mute" aria-pressed=${String(muted)}>
      Mute notifications
    </button>
    <p>${muted ? 'Notifications are muted.' : 'Notifications are enabled.'}</p>
  `,
  ui: { heading: '.heading', mute: '.mute' },
  events: { 'click @ui.mute': 'toggleMuted' },
  toggleMuted() {
    const state = this.getState();
    state.muted = !state.muted;
    this.render();
  },
  focusHeading() { this.getUI('heading')[0].focus(); }
});
NotificationSettings.setDomApi(LitDomApi);

const mount = document.createElement('main');
document.body.append(mount);
const region = new Region({ el: mount });
const settings = new NotificationSettings();
region.show(settings);
```

This is local state, with no persistence claim. When a server-backed setting belongs to a wider feature, give the save and failure workflow to its appropriate owner. The toggle's pressed state conveys the immediate local change; do not add announcements that repeat the control's own feedback without a reason.

## Retain focus during updates; choose it during replacement

The toggle does not dismiss its context, so focus should remain on the button. Lit can retain the existing nodes when this View renders the same template again. Changing template branches, removing an element, or choosing an insertion provider that replaces descendants can still remove the focused node. Test the actual rendering behavior you use.

Showing a different View in a [Region](../api/region.md#showing-a-view) destroys the current View and removes its content. Marionette does not choose a focus destination. For a user-requested screen transition, show the new View, then focus its heading or an appropriate first control. For example, another `NotificationSettings` instance named `nextSettings` can use `region.show(nextSettings); nextSettings.focusHeading();` after the transition is accepted. The heading's `tabindex="-1"` permits programmatic focus without adding an extra Tab stop.

Keep this focus decision with the owner performing the transition. An unrelated background update should not move focus to a new heading. If a dialog closes, returning to its opener may be the appropriate policy instead. Follow the [WAI guidance on predictable focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_discernable_predictable) and test the resulting keyboard sequence.

## Keep text and raw HTML boundaries explicit

Marionette's native DOM provider inserts template strings with `innerHTML`. It treats a string as HTML, so interpolating untrusted text into that string is unsafe. Use `textContent` for direct text updates or a template system that handles text interpolation.

Ordinary string values in Lit child expressions, such as this example's title, become text. See [Lit expressions](https://lit.dev/docs/templates/expressions/#primitive-values). Raw HTML insertion, including Lit's [`unsafeHTML`](https://lit.dev/docs/templates/directives/#unsafehtml), requires trusted or sanitized HTML at the application's boundary. URL attributes also need the application's allowed-URL policy; text interpolation is not a complete security policy.

Choose an integration whose output matches the [renderer and DOM provider](../api/providers/dom.md) contract. Keep renderer-owned nodes under that renderer's control rather than overwriting their contents independently.

## Verify the user-visible behavior

Use browser interaction tests to Tab to the button, activate it with Enter and Space, and check both `aria-pressed` and visible feedback. Confirm the same button remains focused through the local update. Then replace the View through its Region, verify the old View is destroyed, and check that the transition owner moves focus to the intended new destination.

Include a text value containing HTML-like characters and verify it stays text. Test with keyboard navigation and assistive technology for your complete application; these focused checks do not establish accessibility conformance. See [consumer testing](testing.md) for test setup and [retained refresh](retained-refresh.md) for updates that preserve a larger page.

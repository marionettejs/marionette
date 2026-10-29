import { Application, View } from 'marionette';
import { test } from '@mnjs/test/vitest';
import { createGallery } from '@mnjs/test/playwright';
const Card = View.extend({ template: () => '<p>Card</p>', label() { return 'Card'; } });
test('typed fixture', async ({ mounts }) => {
  const mounted = mounts.mountView(new Card(), { replaceElement: false });
  const label: string = mounted.view.label();
  const app = mounts.mountApplication(region => new Application({ region }), { start: false });
  mounts.scope.defer(async () => {});
  // @ts-expect-error Concrete View methods remain checked.
  mounted.view.missingMethod();
  void [label, app];
});
const gallery = createGallery({
  card(props, mounts) {
    const mounted = mounts.mountView(new Card());
    return { update(next) { mounted.el!.textContent = String(next.label); } };
  }
}, { container: document.body });
const mounting: Promise<void> = gallery.mount({ story: 'card', props: { label: 'Card' } });
const cleanup: Promise<void> = gallery.unmount();
// @ts-expect-error Browser factories cannot be passed as a story id.
gallery.mount({ story: () => new Card() });
void [mounting, cleanup];

import type { Story } from '@mnjs/test/playwright';
const requiredTitle: Story<{ title: string }> = props => ({ update(next) { void [props.title, next.title]; } });
const typedGallery = createGallery({ requiredTitle }, { container: document.body });
typedGallery.mount({ story: 'requiredTitle', props: { title: 'Editor' } });
// @ts-expect-error The selected story requires a title prop.
typedGallery.mount({ story: 'requiredTitle' });
// @ts-expect-error Required prop types are preserved.
typedGallery.mount({ story: 'requiredTitle', props: { title: 7 } });
// @ts-expect-error Known story names are preserved.
typedGallery.mount({ story: 'missing', props: { title: 'Editor' } });
const optionalGallery = createGallery({
  empty() {},
  optional(props?: { title: string }) { void props; },
  defaulted(props: { title?: string } = {}) { void props; }
}, { container: document.body });
optionalGallery.mount({ story: 'empty' });
optionalGallery.mount({ story: 'optional' });
optionalGallery.mount({ story: 'optional', props: { title: 'Editor' } });
optionalGallery.mount({ story: 'defaulted' });
// @ts-expect-error Optional props still validate their fields when provided.
optionalGallery.mount({ story: 'optional', props: { title: 7 } });
const requiredObject: Story<{ title?: string }> = props => { void props.title; };
const objectGallery = createGallery({ requiredObject }, { container: document.body });
objectGallery.mount({ story: 'requiredObject', props: {} });
// @ts-expect-error The parameter itself is required, even when its object fields are optional.
objectGallery.mount({ story: 'requiredObject' });

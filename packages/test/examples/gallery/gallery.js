import { mountApplication, mountView } from '@mnjs/test';
import { ProfileFeature, ProfileForm } from '../fixtures.js';

const root = document.querySelector('#root');
let mounted;
let currentStory;
window.unmount = async() => {
  await mounted?.cleanup();
  mounted = undefined;
  currentStory = undefined;
};
window.mount = async({ story, props = {} }) => {
  if (!['profile/Editable', 'profile/Prepared'].includes(story)) { throw new Error(`Unknown story: ${story}`); }
  if (mounted && currentStory === story) {
    (mounted.view ?? mounted.app.getView()).setTitle(props.title);
    return;
  }
  await window.unmount();
  const profile = { name: 'Ada', email: 'ada@example.test' };
  mounted = story === 'profile/Editable' ? mountView(new ProfileForm({ profile }), { container: root }) :
    mountApplication(() => new ProfileFeature({ async loadProfile() { return profile; } }), { container: root });
  if (mounted.ready && !await mounted.ready) { throw new Error('Story startup cancelled'); }
  (mounted.view ?? mounted.app.getView()).setTitle(props.title);
  currentStory = story;
};

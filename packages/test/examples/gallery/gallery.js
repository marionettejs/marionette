import { createGallery } from '@mnjs/test/playwright';
import { ProfileFeature, ProfileForm } from '../fixtures.js';

const gallery = createGallery({
  'profile/Editable'(props = {}, mounts) {
    const mounted = mounts.mountView(new ProfileForm({ profile: { name: 'Ada', email: 'ada@example.test' } }));
    mounted.view.setTitle(props.title);
    return { update(next = {}) { mounted.view.setTitle(next.title); } };
  },
  async 'profile/Prepared'(props = {}, mounts) {
    const mounted = mounts.mountApplication(region => new ProfileFeature({
      region, async loadProfile() { return { name: 'Ada', email: 'ada@example.test' }; }
    }));
    if (!await mounted.ready) { throw new Error('Story startup cancelled'); }
    mounted.app.getView().setTitle(props.title);
    return { update(next = {}) { mounted.app.getView().setTitle(next.title); } };
  }
}, { container: document.querySelector('#root') });

Object.assign(window, gallery);

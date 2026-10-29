import { expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { createGallery } from '@mnjs/test/playwright';
import { View } from 'marionette';

function ownedGallery(mounts, stories) {
  const container = document.body.appendChild(document.createElement('section'));
  mounts.scope.defer(() => container.remove());
  const gallery = createGallery(stories, { container });
  mounts.scope.defer(() => gallery.unmount());
  return { gallery, container };
}

test('replaces the previous story while project disposal is pending', async({ mounts }) => {
  const disposal = Promise.withResolvers();
  const disposing = Promise.withResolvers();
  let setups = 0;
  let updates = 0;
  let nextSetups = 0;
  const { gallery, container } = ownedGallery(mounts, {
    initial(props, context) {
      const number = ++setups;
      context.mountView(new View({ template: () => `<p>Mount ${number}</p>` }));
      if (number === 1) { context.scope.defer(() => { disposing.resolve(); return disposal.promise; }); }
      return { update() { updates++; } };
    },
    next() { nextSetups++; }
  });
  await gallery.mount({ story: 'initial' });
  const replacing = gallery.mount({ story: 'next' }).catch(error => error);
  await disposing.promise;
  const remounting = gallery.mount({ story: 'initial' });
  try { expect(container.textContent).toBe(''); } finally { disposal.resolve(); }
  await expect(replacing).resolves.toMatchObject({ message: 'Mount was replaced or cleaned up before setup completed.' });
  await remounting;
  expect(container.textContent).toBe('Mount 2');
  expect(updates).toBe(0);
  expect(nextSetups).toBe(0);
});

test('keeps a project cleanup error and permits a fresh story without retrying its disposer', async({ mounts }) => {
  const failure = new Error('project disposal failed');
  let setups = 0;
  let disposals = 0;
  const { gallery, container } = ownedGallery(mounts, {
    initial(props, context) {
      const number = ++setups;
      context.mountView(new View({ template: () => `<p>Mount ${number}</p>` }));
      if (number === 1) { context.scope.defer(() => { disposals++; throw failure; }); }
      return { update() { throw new Error('Disposed story must not update'); } };
    },
    next() { throw new Error('Replacement must not start after failed disposal'); }
  });
  await gallery.mount({ story: 'initial' });
  const error = await gallery.mount({ story: 'next' }).catch(value => value);
  expect(error.errors[0].errors[0]).toBe(failure);
  expect(container.textContent).toBe('');
  await gallery.mount({ story: 'initial' });
  expect(container.textContent).toBe('Mount 2');
  expect(disposals).toBe(1);
});

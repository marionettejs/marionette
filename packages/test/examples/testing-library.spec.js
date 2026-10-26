import { afterAll, expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { withQueries } from '@mnjs/test/testing-library';
import { Application, View } from 'marionette';

const handles = [];
const Card = View.extend({ template: () => '<h1>Editor</h1><label>Name <input></label>' });

test.for([false, true])('queries the current Region output with replaceElement %s', (replaceElement, { mounts }) => {
  const original = mounts.mountView(new Card(), { replaceElement });
  const mounted = withQueries(original);
  handles.push(mounted);
  expect(mounted).toBe(original);
  expect(mounted.getByLabelText('Name')).toBe(mounted.el.querySelector('input'));
  const replacement = new View({ template: () => '<h1>Published</h1>' });
  mounted.region.show(replacement);
  expect(mounted.el).toBe(replacement.el);
  expect(mounted.queryByRole('heading', { name: 'Editor' })).toBeNull();
  expect(mounted.getByRole('heading', { name: 'Published' })).toBe(replacement.el.firstElementChild);
});

test('finds prepared Application output and keeps startup errors observable', async({ mounts }) => {
  const Feature = Application.extend({
    async prepareStart() { await Promise.resolve(); },
    onStart() { this.showView(new Card()); }
  });
  const original = mounts.mountApplication(region => new Feature({ region }));
  const mounted = withQueries(original);
  handles.push(mounted);
  expect(mounted.ready).toBe(original.ready);
  const heading = mounted.findByRole('heading', { name: 'Editor' });
  await expect(mounted.ready).resolves.toBe(true);
  expect(await heading).toBe(mounted.el.querySelector('h1'));
  const error = new Error('Preparation failed');
  const Failed = Application.extend({ prepareStart() { throw error; } });
  const failed = withQueries(mounts.mountApplication(region => new Failed({ region })));
  await expect(failed.ready).rejects.toBe(error);
  expect(failed.queryByRole('heading')).toBeNull();
});

test('queries a detached foreign-document mount and a borrowed portal root', async({ mounts }) => {
  const frame = document.body.appendChild(document.createElement('iframe'));
  mounts.scope.defer(() => frame.remove());
  const otherDocument = frame.contentDocument;
  const mounted = withQueries(mounts.mountView(new View({ template: () => '<input aria-label="Name">' }),
    { document: otherDocument, attachTo: null }));
  expect(mounted.container.isConnected).toBe(false);
  expect(mounted.getByLabelText('Name').ownerDocument).toBe(otherDocument);
  const portal = otherDocument.body.appendChild(otherDocument.createElement('div'));
  portal.innerHTML = '<button>Confirm</button>';
  expect(withQueries(mounted, { baseElement: portal })).toBe(mounted);
  expect(mounted.getByRole('button', { name: 'Confirm' })).toBe(portal.firstElementChild);
  await mounted.cleanup();
  expect(portal.isConnected).toBe(true);
  expect(mounted.getByRole('button', { name: 'Confirm' })).toBe(portal.firstElementChild);
  withQueries(mounted);
  expect(mounted.queryByRole('button', { name: 'Confirm' })).toBeNull();
});

afterAll(() => {
  for (const mounted of handles) {
    expect(mounted.container.isConnected).toBe(false);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(mounted.queryByRole('heading')).toBeNull();
  }
});

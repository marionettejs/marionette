import { afterAll, expect } from 'vitest';
import { test } from '@mnjs/test/vitest';
import { withQueries } from '@mnjs/test/testing-library';
import { Application, View } from 'marionette';

const handles = [];
const Card = View.extend({ template: () => '<h1>Editor</h1><label>Name <input></label><button>Save</button>' });

test('decorates the owned handle with scoped role, name and label queries', ({ mounts }) => {
  const original = mounts.mountView(new Card());
  const cleanup = original.cleanup;
  const mounted = withQueries(original);
  handles.push(mounted);
  const second = withQueries(mounts.mountView(new Card()));
  expect(mounted).toBe(original);
  expect(mounted.cleanup).toBe(cleanup);
  expect(mounted.getByRole('heading', { name: 'Editor' })).toBe(mounted.el.querySelector('h1'));
  expect(mounted.getByLabelText('Name')).toBe(mounted.el.querySelector('input'));
  expect(mounted.getByRole('button', { name: 'Save' })).not.toBe(second.getByRole('button', { name: 'Save' }));
  expect(mounted.queryByText('Missing')).toBeNull();
  expect(() => mounted.getByText('Missing')).toThrow(/Unable to find/);
  mounted.el.appendChild(document.createElement('button')).textContent = 'Save';
  expect(mounted.getAllByRole('button', { name: 'Save' })).toHaveLength(2);
  expect(() => mounted.getByRole('button', { name: 'Save' })).toThrow(/Found multiple/);
});

test.for([false, true])('keeps queries and live el valid after Region replacement (replaceElement: %s)', (replaceElement, { mounts }) => {
  const original = mounts.mountView(new Card(), { replaceElement });
  const mounted = withQueries(original);
  const container = mounted.container;
  const previous = mounted.el;
  const replacement = new View({ template: () => '<button>Publish</button>' });
  mounted.region.show(replacement);
  expect(mounted.el).toBe(replacement.el);
  expect(mounted.el).not.toBe(previous);
  expect(mounted.container).toBe(container);
  expect(mounted.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(mounted.getByRole('button', { name: 'Publish' })).toBe(replacement.el.firstElementChild);
  expect(original.view.isDestroyed()).toBe(true);
});

test('queries detached mounts without attaching or owning another root', async({ mounts }) => {
  const mounted = withQueries(mounts.mountView(new View({ template: () => '<input aria-label="Name">' }), { attachTo: null }));
  expect(mounted.container.isConnected).toBe(false);
  expect(mounted.getByLabelText('Name')).toBe(mounted.el.querySelector('input'));
  await mounted.cleanup();
  expect(mounted.queryByLabelText('Name')).toBeNull();
});

test('supports another document and rebinds borrowed baseElement without changing ownership', async({ mounts }) => {
  const frame = document.body.appendChild(document.createElement('iframe'));
  mounts.scope.defer(() => frame.remove());
  const otherDocument = frame.contentDocument;
  const mounted = withQueries(mounts.mountView(new Card(), { document: otherDocument }));
  const portal = otherDocument.body.appendChild(otherDocument.createElement('aside'));
  portal.innerHTML = '<button>Confirm</button>';
  const container = mounted.container;
  const queryContainer = mounted.queryByRole;
  expect(mounted.getByRole('button', { name: 'Save' }).ownerDocument).toBe(otherDocument);
  expect(mounted.queryByRole('button', { name: 'Confirm' })).toBeNull();
  expect(withQueries(mounted, { baseElement: otherDocument.body })).toBe(mounted);
  expect(mounted.getByRole('button', { name: 'Confirm' })).toBe(portal.firstElementChild);
  expect(queryContainer('button', { name: 'Confirm' })).toBeNull();
  const queryBorrowed = mounted.getByRole;
  expect(withQueries(mounted, {})).toBe(mounted);
  expect(mounted.queryByRole('button', { name: 'Confirm' })).toBeNull();
  expect(queryBorrowed('button', { name: 'Confirm' })).toBe(portal.firstElementChild);
  withQueries(mounted, { baseElement: otherDocument.body });
  await mounted.cleanup();
  expect(container.isConnected).toBe(false);
  expect(portal.isConnected).toBe(true);
  expect(mounted.getByRole('button', { name: 'Confirm' })).toBe(portal.firstElementChild);
  expect(mounted.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('finds asynchronous Application output without replacing initial readiness', async({ mounts }) => {
  const load = Promise.withResolvers();
  const Feature = Application.extend({
    prepareStart() { return load.promise; },
    onStart() { this.showView(new Card()); }
  });
  const original = mounts.mountApplication(region => new Feature({ region }));
  const mounted = withQueries(original);
  handles.push(mounted);
  expect(mounted.ready).toBe(original.ready);
  expect(mounted.el).toBeUndefined();
  const heading = mounted.findByRole('heading', { name: 'Editor' });
  load.resolve();
  await expect(mounted.ready).resolves.toBe(true);
  expect(await heading).toBe(mounted.el.querySelector('h1'));
});

test('preserves cancellation and leaves no output after fixture cleanup', async({ mounts }) => {
  const load = Promise.withResolvers();
  const Feature = Application.extend({
    prepareStart() { return load.promise; },
    onStart() { this.showView(new Card()); }
  });
  const mounted = withQueries(mounts.mountApplication(region => new Feature({ region })));
  await mounts.cleanup();
  await expect(mounted.ready).resolves.toBe(false);
  load.resolve();
  await load.promise;
  expect(mounted.el).toBeUndefined();
  expect(mounted.queryByRole('heading')).toBeNull();
  expect(mounted.app.isDestroyed()).toBe(true);
});

test('preserves startup rejection and manual startup without adding a wait', async({ mounts }) => {
  const failure = new Error('Profile load failed');
  const Feature = Application.extend({ prepareStart() { throw failure; } });
  const mounted = withQueries(mounts.mountApplication(region => new Feature({ region })));
  await expect(mounted.ready).rejects.toBe(failure);
  expect(mounted.queryByRole('heading')).toBeNull();
  const manual = withQueries(mounts.mountApplication(region => new Application({ region }), { start: false }));
  await expect(manual.ready).resolves.toBe(false);
  expect(manual.app.isRunning()).toBe(false);
});

afterAll(() => {
  for (const mounted of handles) {
    expect(mounted.container.isConnected).toBe(false);
    expect(mounted.region.isDestroyed()).toBe(true);
    expect(mounted.queryByRole('heading')).toBeNull();
  }
});

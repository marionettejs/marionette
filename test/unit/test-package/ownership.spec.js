import { describe, expect, it } from 'vitest';
import { Application, Region, View } from 'marionette';
import { mountApplication, mountView } from '@mnjs/test';

const Card = View.extend({ template: () => '<p>Owned</p>' });
const Feature = Application.extend({ onStart() { this.showView(new Card()); } });
const mounts = [
  ['View', options => mountView(new Card(), options)],
  ['Application', options => mountApplication(() => new Feature(), options)]
];

describe.each(mounts)('%s mount ownership', (name, mount) => {
  it.each([false, true])('keeps initial container ownership when options change (borrowed: %s)', async borrowed => {
    const destination = document.body.appendChild(document.createElement('section'));
    const host = destination.appendChild(document.createElement('div'));
    const sibling = host.appendChild(document.createElement('p'));
    const options = borrowed ? { container: host } : { attachTo: destination };
    const mounted = mount(options);
    try {
      await mounted.ready;
      options.container = borrowed ? undefined : host;
      await mounted.cleanup();
      expect(host.parentNode).toBe(destination);
      expect([...host.children]).toEqual([sibling]);
      expect([...destination.children]).toEqual([host]);
    } finally {
      await mounted.cleanup();
      destination.remove();
    }
  });

  it('cleans the original Region when JavaScript overwrites the handle property', async() => {
    const mounted = mount();
    const original = mounted.region;
    const other = new Region({ el: document.createElement('div') });
    try {
      await mounted.ready;
      const view = original.currentView;
      mounted.region = other;
      await mounted.cleanup();
      expect(original.isDestroyed()).toBe(true);
      expect(view.isDestroyed()).toBe(true);
      expect(other.isDestroyed()).toBe(false);
      expect(mounted.el).toBeUndefined();
    } finally {
      original.destroy();
      other.destroy();
      await mounted.cleanup();
    }
  });
});

describe.each([false, true])('synchronous mount failure (borrowed host: %s)', borrowed => {
  it.each(['Region construction', 'View rendering', 'Application factory', 'Application start'])(
    'releases acquired resources after %s fails while preserving caller ownership', async stage => {
      const destination = document.body.appendChild(document.createElement('section'));
      const host = destination.appendChild(document.createElement('div'));
      const sibling = host.appendChild(document.createElement('p'));
      const options = borrowed ? { container: host } : { attachTo: destination };
      const failure = new Error(stage);
      const resources = [];
      const destroys = [];
      let caught;
      try {
        if (stage === 'Region construction') {
          const BrokenRegion = Region.extend({
            initialize() { resources.push(this); throw failure; },
            onBeforeDestroy() { destroys.push('region'); }
          });
          const view = new Card();
          resources.push(view);
          mountView(view, { ...options, regionClass: BrokenRegion });
        } else if (stage === 'View rendering') {
          const BrokenView = Card.extend({
            onBeforeRender() { throw failure; },
            onBeforeDestroy() { destroys.push('view'); }
          });
          const view = new BrokenView();
          resources.push(view);
          mountView(view, options);
        } else if (stage === 'Application factory') {
          mountApplication(() => { throw failure; }, options);
        } else {
          const BrokenApplication = Application.extend({
            start() { throw failure; },
            onBeforeDestroy() { destroys.push('application'); }
          });
          mountApplication(() => {
            const app = new BrokenApplication();
            resources.push(app);
            return app;
          }, options);
        }
      } catch (error) { caught = error; }
      try {
        expect(caught.cause ?? caught).toBe(failure);
        await caught.cleanup;
        expect(host.parentNode).toBe(destination);
        expect([...host.children]).toEqual([sibling]);
        expect([...destination.children]).toEqual([host]);
        expect(destroys).toEqual(stage === 'Application start' ? ['application'] : []);
      } finally {
        for (const resource of resources.reverse()) { resource.destroy(); }
        destination.remove();
      }
    }
  );
});

it('detaches a caller View without destroying it after a replacement attach callback fails', async() => {
  const host = document.body.appendChild(document.createElement('section'));
  const sibling = host.appendChild(document.createElement('p'));
  const failure = new Error('attach failed');
  const Broken = Card.extend({ onAttach() { throw failure; } });
  const view = new Broken();
  try {
    let reported;
    try { mountView(view, { container: host, showOptions: { replaceElement: true } }); } catch (error) { reported = error; }
    expect(reported.cause).toBe(failure);
    await reported.cleanup;
    expect([...host.children]).toEqual([sibling]);
    expect(host.isConnected).toBe(true);
    expect(view.isDestroyed()).toBe(false);
  } finally {
    view.destroy();
    host.remove();
  }
});

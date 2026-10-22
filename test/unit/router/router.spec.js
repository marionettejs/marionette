import { createRouter } from './helpers.js';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { Events } from '@mnjs/utils';

import { memoryDriver } from '@mnjs/router';

const MARKER = '@mnjs/router';

const isAppUrl = url => url.pathname !== '/logout';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function gate() {
  const result = {};
  result.promise = new Promise((resolve, reject) => {
    result.open = resolve;
    result.fail = reject;
  });
  result.promise.catch(() => {});
  return result;
}

function forwardWorkflow(suffix = '') {
  return ({ params, url }) => {
    const target = new URL(url);
    target.pathname = `/${ encodeURIComponent(params.workspace) }/patient/${ encodeURIComponent(params.patientId) }/workflow${ suffix }`;
    return target.href;
  };
}

function baseRoutes() {
  return [
    { name: 'root', path: '/' },
    {
      path: '/:workspace',
      meta: { scope: 'workspace' },
      children: [
        { name: 'worklist', path: 'worklist/:worklistId', meta: { isList: true } },
        { name: 'schedule', path: 'schedule', meta: { isList: true } },
        { name: 'legacy:patient:workflow', path: 'patient/dashboard/:patientId', redirect: forwardWorkflow() },
        { name: 'legacy:patient:workflow:closed', path: 'patient/archive/:patientId', redirect: forwardWorkflow('/closed') },
        { name: 'patient:flow', path: 'patient/:patientId/flow/:flowId' },
        {
          name: 'patient:workflow',
          path: 'patient/:patientId/workflow',
        },
        {
          name: 'patient:workflow:closed',
          path: 'patient/:patientId/workflow/closed',
        },
      ],
    },
  ];
}

function setup(options = {}) {
  const { url = 'http://localhost/w1/schedule', routes = baseRoutes(), handler, ...routerOptions } = options;
  const driver = memoryDriver({ url });
  const log = [];
  const matches = [];
  const context = { driver, log, matches, handler };
  const router = createRouter({
    routes,
    driver,
    intercept: isAppUrl,
    notFound: { name: 'notFound', within: isAppUrl },
    persistParams: ['workspace'],
    handler: async(match, handlerContext) => {
      log.push(`handler:${ match.name }`);
      await context.handler?.(match, handlerContext);
    },
    ...routerOptions,
  });
  router.on('route', match => {
    log.push(`route:${ match.name }`);
    matches.push(match);
  });
  router.on('route:ready', match => log.push(`ready:${ match.name }`));
  router.on('route:error', (error, match) => log.push(`error:${ match.name }:${ error.message }`));
  context.router = router;
  return context;
}

async function started({ handler, ...options } = {}) {
  const context = setup(options);
  await context.router.start();
  context.handler = handler;
  context.log.length = 0;
  context.matches.length = 0;
  return context;
}

function spyEvents(driver) {
  const spy = { events: [], intercepts: [] };
  const add = driver.addEventListener;
  driver.addEventListener = (type, listener, listenerOptions) => add(type, event => {
    spy.events.push(event);
    const proxy = Object.create(event, {
      intercept: {
        value: init => {
          spy.intercepts.push(init);
          event.intercept(init);
        },
      },
    });
    listener(proxy);
  }, listenerOptions);
  return spy;
}

const lastRoute = context => context.matches.at(-1);

describe('Router construction', () => {
  it('does not need a driver or browser globals for pure operations', () => {
    const router = createRouter({ routes: baseRoutes() });

    assert.equal(router.url('schedule', { workspace: 'w1' }), '/w1/schedule');
    assert.equal(router.match('https://example.test/w1/schedule').name, 'schedule');
    assert.deepEqual(router.getParamNames('patient:flow'), ['workspace', 'patientId', 'flowId']);
    assert.equal(router.getCurrent(), null);
  });

  it('reports whether a route name is mounted', () => {
    const router = createRouter({ routes: [] });

    assert.equal(router.hasRoute('extra'), false);

    const unmount = router.mount([{ name: 'extra', path: '/extra' }]);
    assert.equal(router.hasRoute('extra'), true);

    unmount();
    assert.equal(router.hasRoute('extra'), false);
  });

  it('throws on start without a driver when the Navigation API is missing', () => {
    const router = createRouter({ routes: baseRoutes() });

    assert.throws(() => router.start(), TypeError);
  });

  it('defaults the driver to the Navigation API when it exists', async() => {
    globalThis.navigation = memoryDriver({ url: 'http://localhost/w1/schedule' });
    try {
      const router = createRouter({ routes: baseRoutes() });
      const matches = [];
      router.on('route', match => matches.push(match));

      assert.equal(await router.start(), true);
      assert.equal(matches[0].name, 'schedule');
      router.stop();
    } finally {
      delete globalThis.navigation;
    }
  });

  it('is an Events emitter usable with listenTo', async() => {
    const context = await started();
    const listener = { ...Events };
    const seen = [];
    listener.listenTo(context.router, 'route', match => seen.push(match.name));

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    assert.deepEqual(seen, ['worklist']);
    listener.stopListening();
  });
});

describe('Router intercept rules', () => {
  const unowned = [
    ['canIntercept is false', 'http://localhost/w1/worklist/a', { canIntercept: false }],
    ['it is a hash change', 'http://localhost/w1/schedule#top', { hashChange: true }],
    ['it is a download with an empty filename', 'http://localhost/w1/worklist/a', { downloadRequest: '' }],
    ['it is a download', 'http://localhost/w1/worklist/a', { downloadRequest: 'file.pdf' }],
    ['it is a form submission', 'http://localhost/w1/worklist/a', { formData: new FormData() }],
    ['it is cross-origin', 'http://other.test/w1/worklist/a', {}],
    ['intercept() rejects the URL', 'http://localhost/logout', {}],
  ];

  for (const [label, url, flags] of unowned) {
    it(`leaves the navigation alone when ${ label }`, async() => {
      const context = await started();

      context.driver.simulate(url, flags);
      await tick();

      assert.deepEqual(context.log, []);
      assert.deepEqual(context.driver.documentNavigations, [url]);
    });
  }

  it('leaves URLs that match nothing outside the notFound scope alone', async() => {
    const context = await started({ notFound: { name: 'notFound', within: url => url.pathname.startsWith('/w1/') } });

    context.driver.simulate('http://localhost/elsewhere/page');
    await tick();

    assert.deepEqual(context.log, []);
    assert.deepEqual(context.driver.documentNavigations, ['http://localhost/elsewhere/page']);
  });

  it('leaves a reload navigation to the browser and keeps refresh() as the soft reload', async() => {
    const context = await started();
    const url = context.driver.currentEntry.url;
    const logged = context.log.length;

    context.driver.reload();
    await tick();

    assert.equal(context.log.length, logged);
    assert.deepEqual(context.driver.documentNavigations, [url]);

    assert.equal(await context.router.refresh(), true);
    assert.equal(context.log.length, logged + 3);
    assert.equal(lastRoute(context).navigationType, 'replace');
  });

  it('leaves unmatched URLs alone when no notFound is configured', async() => {
    const context = await started({ notFound: undefined });

    context.driver.simulate('http://localhost/w1/unknown');
    await tick();

    assert.deepEqual(context.log, []);
    assert.equal(context.driver.documentNavigations.length, 1);
  });

  it('intercepts owned navigations with manual focus and scroll', async() => {
    const context = setup();
    const spy = spyEvents(context.driver);
    await context.router.start();

    context.driver.simulate('http://localhost/w1/worklist/a', { downloadRequest: null, formData: null });
    await tick();

    assert.deepEqual(context.driver.documentNavigations, []);
    assert.equal(spy.intercepts.length, 1);
    assert.equal(spy.intercepts[0].focusReset, 'manual');
    assert.equal(spy.intercepts[0].scroll, 'manual');
    assert.equal(typeof spy.intercepts[0].handler, 'function');
  });

  it('intercepts pushState-style navigations by URL like any other', async() => {
    const context = await started();

    context.driver.simulate('/w1/worklist/pushed', { userInitiated: false });
    await tick();

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
  });
});

describe('Router dispatch and events', () => {
  it('builds the Match for a committed navigation', async() => {
    const context = await started();
    const infoToken = { entryTarget: 'form' };

    context.driver.simulate('http://localhost/w1/patient/5/flow/9?tab=a#frag', { info: infoToken });
    await tick();

    const match = lastRoute(context);
    assert.equal(match.name, 'patient:flow');
    assert.deepEqual(match.params, { workspace: 'w1', patientId: '5', flowId: '9' });
    assert.equal(match.query.get('tab'), 'a');
    assert.ok(match.query instanceof URLSearchParams);
    assert.ok(match.url instanceof URL);
    assert.equal(match.url.href, 'http://localhost/w1/patient/5/flow/9?tab=a#frag');
    assert.deepEqual(match.meta, { scope: 'workspace' });
    assert.deepEqual(match.branch.map(entry => entry.name), [undefined, 'patient:flow']);
    assert.deepEqual(match.branch[0].params, { workspace: 'w1' });
    assert.equal(match.branch[1].path, '/:workspace/patient/:patientId/flow/:flowId');
    assert.equal(match.navigationType, 'push');
    assert.equal(match.initial, false);
    assert.equal(match.info, infoToken);
    assert.deepEqual(match.state, {});
    assert.notEqual(match.key, '');
    assert.equal(match.key, context.driver.currentEntry.key);
    assert.equal(match.signal.aborted, false);
    assert.equal(match.userInitiated, true);
    assert.equal(context.router.getCurrent(), match);
  });

  it('emits route before the handler and route:ready after it resolves', async() => {
    const wait = gate();
    const context = await started({ handler: () => wait.promise });

    const navigation = context.router.navigate('worklist', { worklistId: 'a' });
    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist']);

    wait.open();
    assert.equal(await navigation.finished, true);
    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
  });

  it('settles finished only after the handler resolves (D4) while committed settles earlier', async() => {
    const wait = gate();
    const context = await started({ handler: () => wait.promise });
    const { committed, finished } = context.router.navigate('worklist', { worklistId: 'a' });
    let finishedSettled = false;
    finished.then(() => {
      finishedSettled = true;
    });

    assert.equal(await committed, true);
    await tick();
    assert.equal(finishedSettled, false);

    wait.open();
    assert.equal(await finished, true);
  });

  it('passes the navigation signal to the handler', async() => {
    let received;
    const context = await started({ handler: (match, { signal }) => {
      received = { match, signal };
    } });

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;

    assert.equal(received.signal, received.match.signal);
  });

  it('emits route:error with the handler failure and rejects finished', async() => {
    const context = await started({ handler: () => {
      throw new Error('boom');
    } });

    await assert.rejects(context.router.navigate('worklist', { worklistId: 'a' }).finished, /boom/);

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'error:worklist:boom']);
  });

  it('does not surface an unhandled rejection when finished is ignored', async() => {
    const context = await started({ handler: async() => {
      throw new Error('ignored');
    } });

    context.router.navigate('worklist', { worklistId: 'a' });
    await tick();

    assert.deepEqual(context.log.at(-1), 'error:worklist:ignored');
  });

  it('emits nothing after route for a superseded navigation', async() => {
    const first = gate();
    const context = await started({ handler: match => (match.params.worklistId === 'a' ? first.promise : undefined) });

    const slow = context.router.navigate('worklist', { worklistId: 'a' });
    const slowMatch = lastRoute(context);
    const fast = context.router.navigate('worklist', { worklistId: 'b' });

    assert.equal(slowMatch.signal.aborted, true);
    assert.equal(await fast.finished, true);
    assert.equal(await slow.finished, false);
    assert.equal(await slow.committed, true);

    first.fail(new Error('late failure'));
    await tick();

    assert.deepEqual(context.log, [
      'route:worklist', 'handler:worklist',
      'route:worklist', 'handler:worklist', 'ready:worklist',
    ]);
    assert.equal(context.router.getCurrent().params.worklistId, 'b');
  });

  it('absorbs driver AbortErrors into false for both promises', async() => {
    const context = await started();
    const abort = () => new DOMException('Navigation aborted', 'AbortError');
    context.driver.navigate = () => ({ committed: Promise.reject(abort()), finished: Promise.reject(abort()) });

    const { committed, finished } = context.router.navigate('worklist', { worklistId: 'a' });

    assert.equal(await committed, false);
    assert.equal(await finished, false);
  });

  it('rejects for driver failures that are not aborts', async() => {
    const context = await started();

    const { committed, finished } = context.router.navigate('worklist', { worklistId: 'a' }, { state: { fn() {} } });

    await assert.rejects(committed, { name: 'DataCloneError' });
    await assert.rejects(finished, { name: 'DataCloneError' });
  });

  it('dispatches same-URL navigations again as replace without adding an entry', async() => {
    const context = await started();
    const before = context.driver.entries().length;

    context.driver.simulate('http://localhost/w1/schedule', { navigationType: 'replace' });
    await context.router.navigate('schedule').finished;

    assert.deepEqual(context.matches.map(match => match.navigationType), ['replace', 'replace']);
    assert.equal(context.driver.entries().length, before);
  });

  it('dispatches traversals with the traversed entry key', async() => {
    const context = await started();
    const firstKey = context.driver.currentEntry.key;
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    context.matches.length = 0;

    await context.driver.traverseTo(firstKey).finished;

    const match = lastRoute(context);
    assert.equal(match.name, 'schedule');
    assert.equal(match.navigationType, 'traverse');
    assert.equal(match.key, firstKey);
    assert.equal(match.userInitiated, false);
  });

  it('matches within the notFound scope in place with the configured name (D3)', async() => {
    const context = await started();

    const { finished } = context.router.navigate('/w1/does-not-exist?x=1');
    assert.equal(await finished, true);

    const match = lastRoute(context);
    assert.equal(match.name, 'notFound');
    assert.deepEqual(match.params, { workspace: 'w1' });
    assert.equal(match.query.get('x'), '1');
    assert.deepEqual(match.meta, {});
    assert.deepEqual(match.branch, []);
    assert.equal(context.router.match('/w1/does-not-exist?x=1'), null);
    assert.equal(context.router.hasRoute('notFound'), false);
    assert.throws(() => context.router.url('notFound'), /Unknown route/);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/does-not-exist?x=1');
    assert.deepEqual(context.log, ['route:notFound', 'handler:notFound', 'ready:notFound']);
  });

  it('matches a trailing slash without rewriting the incoming URL', async() => {
    const url = 'http://localhost/w1/worklist/list-id/?q=one';
    const context = await started({ url });
    assert.equal(context.router.getCurrent().name, 'worklist');
    assert.deepEqual(context.router.getCurrent().params, { workspace: 'w1', worklistId: 'list-id' });
    assert.equal(context.driver.currentEntry.url, url);
    assert.equal(context.router.url('worklist', { workspace: 'w1', worklistId: 'list-id' }), '/w1/worklist/list-id');
    assert.equal(context.router.url('root'), '/');
  });

  it('gives notFound the params of the deepest unnamed prefix so persistParams still apply', async() => {
    const context = await started({ url: 'http://localhost/w1/does-not-exist/deeper' });

    assert.equal(context.router.getCurrent().name, 'notFound');
    assert.deepEqual(context.router.getCurrent().params, { workspace: 'w1' });
    assert.equal(context.router.url('schedule'), '/w1/schedule');

    await context.router.navigate('schedule').finished;
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule');
  });

  it('gives notFound no params outside every prefix node', async() => {
    const context = await started({ url: 'http://localhost/', routes: [{ name: 'root', path: '/' }] });

    assert.equal(await context.router.navigate('/nowhere/x').finished, true);

    assert.equal(context.router.getCurrent().name, 'notFound');
    assert.deepEqual(context.router.getCurrent().params, {});
  });

  it('returns from a notFound entry with back() without looping', async() => {
    const context = await started();
    await context.router.navigate('/w1/does-not-exist').finished;

    assert.equal(await context.router.back(), true);

    assert.equal(context.router.getCurrent().name, 'schedule');
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule');
  });
});

describe('Router reentrancy', () => {
  it('lets a navigation started from the previous match abort listener win', async() => {
    const context = await started();
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    context.log.length = 0;

    lastRoute(context).signal.addEventListener('abort', () => {
      context.router.navigate('worklist', { worklistId: 'c' });
    }, { once: true });

    const second = context.router.navigate('worklist', { worklistId: 'b' });

    assert.equal(await second.finished, false);
    await tick();

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
    assert.equal(context.router.getCurrent().params.worklistId, 'c');
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/worklist/c');
  });

  it('lets a navigation started from a route listener win', async() => {
    const context = await started();
    const handled = [];
    context.handler = match => {
      handled.push(match.params.worklistId);
    };
    context.router.on('route', match => {
      if (match.params.worklistId === 'b') {context.router.navigate('worklist', { worklistId: 'c' });}
    });

    const second = context.router.navigate('worklist', { worklistId: 'b' });

    assert.equal(await second.finished, false);
    await tick();

    assert.deepEqual(handled, ['c']);
    assert.equal(context.router.getCurrent().params.worklistId, 'c');
    assert.equal(context.log.filter(entry => entry.startsWith('ready')).length, 1);
  });

  it('runs no handler when stop() is called from a route listener', async() => {
    const context = await started();
    const stopped = () => context.router.stop();
    context.router.once('route', stopped);

    const result = context.router.navigate('worklist', { worklistId: 'b' });

    assert.equal(await result.finished, false);
    await tick();

    assert.deepEqual(context.log, ['route:worklist']);
  });

  it('runs no handler for a navigation superseded while its redirect was called', async() => {
    const context = await started();
    context.router.mount([{
      name: 'guarded',
      path: '/:workspace/guarded',
      redirect: () => {
        context.router.navigate('worklist', { worklistId: 'c' });
      },
    }]);

    const guarded = context.router.navigate('/w1/guarded');

    assert.equal(await guarded.finished, false);
    await tick();

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
    assert.equal(context.router.getCurrent().params.worklistId, 'c');
  });
});

describe('Router.navigate', () => {
  it('builds the URL from a route name, copying persistParams from the current match', async() => {
    const context = await started();

    const { committed, finished } = context.router.navigate('worklist', { worklistId: 'owned-by' }, {
      query: { clinicianId: '7' },
    });

    assert.equal(await committed, true);
    assert.equal(await finished, true);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/worklist/owned-by?clinicianId=7');
    assert.equal(lastRoute(context).query.get('clinicianId'), '7');
  });

  it('lets explicit params override persistParams', async() => {
    const context = await started();

    await context.router.navigate('worklist', { workspace: 'w2', worklistId: 'a' }).finished;

    assert.equal(context.driver.currentEntry.url, 'http://localhost/w2/worklist/a');
  });

  it('treats names containing colons as names and path or scheme-and-slashes strings as URLs', async() => {
    const context = await started();

    await context.router.navigate('patient:flow', { patientId: '5', flowId: '9' }).finished;
    assert.equal(lastRoute(context).name, 'patient:flow');

    await context.router.navigate('/w1/worklist/rel').finished;
    assert.equal(lastRoute(context).params.worklistId, 'rel');

    await context.router.navigate('http://localhost/w1/worklist/abs?z=1').finished;
    assert.equal(lastRoute(context).params.worklistId, 'abs');
    assert.equal(lastRoute(context).query.get('z'), '1');
  });

  it('replaces the query of a URL target when the query option is given', async() => {
    const context = await started();

    await context.router.navigate('/w1/worklist/a?old=1', { query: { fresh: '2' } }).finished;

    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/worklist/a?fresh=2');
  });

  it('honors history push and replace, and auto replaces the same URL', async() => {
    const context = await started();
    const initial = context.driver.entries().length;

    await context.router.navigate('worklist', { worklistId: 'a' }, { history: 'push' }).finished;
    assert.equal(context.driver.entries().length, initial + 1);

    await context.router.navigate('worklist', { worklistId: 'b' }, { history: 'replace' }).finished;
    assert.equal(context.driver.entries().length, initial + 1);
    assert.equal(lastRoute(context).navigationType, 'replace');

    await context.router.navigate('worklist', { worklistId: 'b' }).finished;
    assert.equal(context.driver.entries().length, initial + 1);

    await context.router.navigate('worklist', { worklistId: 'c' }).finished;
    assert.equal(context.driver.entries().length, initial + 2);
    assert.equal(lastRoute(context).navigationType, 'push');
  });

  it('exposes info per navigation and persists state without leaking the router marker', async() => {
    const context = await started();
    const info = { entryTarget: 'form' };

    await context.router.navigate('worklist', { worklistId: 'a' }, { info, state: { scrollTop: 5 } }).finished;

    const match = lastRoute(context);
    assert.equal(match.info, info);
    assert.deepEqual(match.state, { scrollTop: 5 });
    assert.deepEqual(context.driver.currentEntry.getState(), { scrollTop: 5, [MARKER]: true });
  });

  it('rejects entry state that is not a plain object', async() => {
    const context = await started();

    assert.throws(() => context.router.navigate('schedule', {}, { state: 'text', history: 'push' }), TypeError);
    assert.throws(() => context.router.navigate('schedule', {}, { state: [1], history: 'push' }), TypeError);
  });

  it('throws for unknown names and missing params', async() => {
    const context = await started();

    assert.throws(() => context.router.navigate('nope'), /Unknown route/);
    assert.throws(() => context.router.url('patient:flow', { workspace: 'w1' }), /missing param/);
  });
});

describe('Router.url and params', () => {
  it('copies only missing persistParams that the target route declares', async() => {
    const context = await started();

    assert.equal(context.router.url('worklist', { worklistId: 'a' }), '/w1/worklist/a');
    assert.equal(context.router.url('worklist', { worklistId: 'a', workspace: 'w9' }), '/w9/worklist/a');
    assert.equal(context.router.url('root'), '/');
    assert.equal(context.router.url('schedule', {}, { query: { a: '1' } }), '/w1/schedule?a=1');
  });

  it('needs explicit params before any match exists', () => {
    const router = createRouter({ routes: baseRoutes(), persistParams: ['workspace'] });

    assert.throws(() => router.url('schedule'), /missing param/);
    assert.equal(router.url('schedule', { workspace: 'w1' }), '/w1/schedule');
  });


  it('matches purely, without redirect side effects or navigation fields', () => {
    let called = false;
    const router = createRouter({
      routes: [{ name: 'moved', path: '/moved', redirect: () => {
        called = true;
      } }],
    });

    const match = router.match('https://example.test/moved?q=1');

    assert.equal(match.name, 'moved');
    assert.equal(match.query.get('q'), '1');
    assert.equal(match.signal, null);
    assert.equal(called, false);
    assert.equal(router.match('https://example.test/missing'), null);
  });
});

describe('Router legacy redirect routes', () => {
  it('replaces an old bookmark and dispatches only the current route', async() => {
    const context = await started();
    const entries = context.driver.entries().length;

    const { finished } = context.router.navigate('/w1/patient/dashboard/9?x=1#frag');
    assert.equal(await finished, true);

    assert.deepEqual(context.log, ['route:patient:workflow', 'handler:patient:workflow', 'ready:patient:workflow']);
    const match = lastRoute(context);
    assert.deepEqual(match.params, { workspace: 'w1', patientId: '9' });
    assert.equal(match.url.href, 'http://localhost/w1/patient/9/workflow?x=1#frag');
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/9/workflow?x=1#frag');
    assert.equal(context.driver.entries().length, entries + 1);
  });

  it('redirects link clicks as well', async() => {
    const context = await started();

    context.driver.simulate('http://localhost/w1/patient/dashboard/9');
    await tick();

    assert.equal(context.matches.length, 1);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/9/workflow');
    assert.equal(context.matches[0].navigationType, 'replace');
  });

  it('redirects an archive bookmark to the renamed feature', async() => {
    const context = await started();

    await context.router.navigate('/w1/patient/archive/9').finished;

    const match = lastRoute(context);
    assert.equal(match.name, 'patient:workflow:closed');
    assert.deepEqual(match.params, { workspace: 'w1', patientId: '9' });
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/9/workflow/closed');
    assert.equal(context.matches.length, 1);
  });

  it('builds the current route URL when requested by its current name', async() => {
    const context = await started();

    assert.equal(context.router.url('patient:workflow', { patientId: '9' }), '/w1/patient/9/workflow');
  });
});

describe('Router synchronous redirects', () => {
  it('replaces the URL and dispatches only the target', async() => {
    const context = await started();
    context.router.mount([{ name: 'old:schedule', path: '/:workspace/old-schedule', redirect: () => ({ name: 'schedule' }) }]);
    const entries = context.driver.entries().length;

    const { finished } = context.router.navigate('/w1/old-schedule');

    assert.equal(await finished, true);
    assert.deepEqual(context.log, ['route:schedule', 'handler:schedule', 'ready:schedule']);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule');
    assert.equal(context.driver.entries().length, entries + 1);
  });

  it('follows chains and accepts same-origin URL string targets with query', async() => {
    const context = await started();
    context.router.mount([
      { name: 'first', path: '/first', redirect: () => ({ name: 'worklist', params: { worklistId: 'x' }, query: { a: '1' } }) },
      { name: 'second', path: '/second', redirect: () => '/first' },
      { name: 'third', path: '/third', redirect: () => 'http://localhost/second#frag' },
    ]);

    await context.router.navigate('/third').finished;

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/worklist/x?a=1');
  });

  it('dispatches normally when the redirect returns undefined and passes the match and signal', async() => {
    const context = await started();
    let seen;
    context.router.mount([{ name: 'maybe', path: '/maybe/:id', redirect: (match, { signal }) => {
      seen = { match, signal };
    } }]);

    await context.router.navigate('/maybe/5').finished;

    assert.equal(lastRoute(context).name, 'maybe');
    assert.equal(seen.match.params.id, '5');
    assert.equal(seen.match.name, 'maybe');
    assert.equal(seen.signal, lastRoute(context).signal);
  });

  it('allows maxRedirects hops and fails beyond that', async() => {
    const limit = 5;
    const route = { name: 'hop', path: '/hop/:n', redirect: ({ params }) => (Number(params.n) < limit ? `/hop/${ Number(params.n) + 1 }` : undefined) };
    const context = await started({ routes: [route] });

    assert.equal(await context.router.navigate('/hop/0').finished, true);
    assert.equal(lastRoute(context).params.n, '5');

    context.log.length = 0;
    await assert.rejects(context.router.navigate('/hop/-1').finished, /Redirect limit of 5 exceeded/);
    assert.equal(context.log.at(-1), 'error:hop:Redirect limit of 5 exceeded');
  });

  it('honors a configured maxRedirects and catches loops', async() => {
    const routes = [
      { name: 'ping', path: '/ping', redirect: () => '/pong' },
      { name: 'pong', path: '/pong', redirect: () => '/ping' },
    ];
    const context = await started({ routes, maxRedirects: 2 });

    await assert.rejects(context.router.navigate('/ping').finished, /Redirect limit of 2 exceeded/);

    assert.equal(context.log.filter(entry => entry.startsWith('error:')).length, 1);
  });

  it('reports a throwing redirect as route:error', async() => {
    const context = await started();
    context.router.mount([{ name: 'bad', path: '/bad', redirect: () => {
      throw new Error('redirect failed');
    } }]);

    await assert.rejects(context.router.navigate('/bad').finished, /redirect failed/);

    assert.deepEqual(context.log, ['route:bad', 'error:bad:redirect failed']);
  });

  it('rejects cross-origin redirect targets', async() => {
    const context = await started();
    context.router.mount([{ name: 'away', path: '/away', redirect: () => 'http://other.test/x' }]);

    await assert.rejects(context.router.navigate('/away').finished, /same-origin/);
  });
});

describe('Router asynchronous redirects', () => {
  function mountLegacy(context, wait, seen = {}) {
    context.router.mount([{
      name: 'legacy:flow',
      path: '/:workspace/flow/:flowId',
      redirect: async(match, { signal }) => {
        seen.signal = signal;
        const patientId = await wait.promise;
        return { name: 'patient:flow', params: { patientId, flowId: match.params.flowId } };
      },
    }]);
    return seen;
  }

  it('commits the source, then replaces to the target and settles finished with its outcome', async() => {
    const wait = gate();
    const context = await started();
    mountLegacy(context, wait);
    const entries = context.driver.entries().length;

    const { committed, finished } = context.router.navigate('/w1/flow/f1');
    assert.equal(await committed, true);
    assert.deepEqual(context.log, ['route:legacy:flow']);

    wait.open('p1');

    assert.equal(await finished, true);
    assert.deepEqual(context.log, ['route:legacy:flow', 'route:patient:flow', 'handler:patient:flow', 'ready:patient:flow']);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/p1/flow/f1');
    assert.equal(context.driver.entries().length, entries + 1);
  });

  it('gives the redirect the navigation signal', async() => {
    const wait = gate();
    const context = await started();
    const seen = mountLegacy(context, wait);

    context.router.navigate('/w1/flow/f1');
    assert.equal(seen.signal, lastRoute(context).signal);
    assert.equal(seen.signal.aborted, false);

    context.router.navigate('schedule', {}, { history: 'push' });
    assert.equal(seen.signal.aborted, true);
  });

  it('discards the result when the navigation was superseded', async() => {
    const wait = gate();
    const context = await started();
    mountLegacy(context, wait);

    const legacy = context.router.navigate('/w1/flow/f1');
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    wait.open('p1');

    assert.equal(await legacy.finished, false);
    await tick();
    assert.deepEqual(context.log, ['route:legacy:flow', 'route:worklist', 'handler:worklist', 'ready:worklist']);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/worklist/a');
  });

  it('reports a rejection as route:error for the source match', async() => {
    const wait = gate();
    const context = await started();
    mountLegacy(context, wait);

    const { finished } = context.router.navigate('/w1/flow/f1');
    wait.fail(new Error('lookup failed'));

    await assert.rejects(finished, /lookup failed/);
    assert.deepEqual(context.log, ['route:legacy:flow', 'error:legacy:flow:lookup failed']);
  });

  it('ignores a rejection that arrives after supersession', async() => {
    const wait = gate();
    const context = await started();
    mountLegacy(context, wait);

    context.router.navigate('/w1/flow/f1');
    await context.router.navigate('schedule', {}, { history: 'push' }).finished;
    wait.fail(new Error('too late'));
    await tick();

    assert.equal(context.log.some(entry => entry.startsWith('error:')), false);
  });

  it('dispatches the source normally when the async redirect resolves to nothing', async() => {
    const context = await started();
    context.router.mount([{ name: 'later', path: '/later', redirect: async() => undefined }]);

    assert.equal(await context.router.navigate('/later').finished, true);
    assert.deepEqual(context.log, ['route:later', 'handler:later', 'ready:later']);
  });
});

describe('Router.start', () => {
  it('dispatches the current URL with initial true and no navigate event (D5 query survives reload)', async() => {
    const context = setup({ url: 'http://localhost/w1/worklist/owned-by?clinicianId=7' });
    const spy = spyEvents(context.driver);

    assert.equal(await context.router.start(), true);

    assert.deepEqual(context.log, ['route:worklist', 'handler:worklist', 'ready:worklist']);
    assert.equal(spy.events.length, 0);
    const match = context.matches[0];
    assert.equal(match.initial, true);
    assert.equal(match.query.get('clinicianId'), '7');
    assert.equal(match.key, context.driver.currentEntry.key);
    assert.equal(match.userInitiated, false);
  });

  it('reports initial false for later navigations', async() => {
    const context = setup();
    await context.router.start();

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;

    assert.deepEqual(context.matches.map(match => match.initial), [true, false]);
  });

  it('is idempotent while started', async() => {
    const context = setup();

    const first = context.router.start();
    assert.equal(context.router.start(), first);
    await first;
    assert.equal(context.matches.length, 1);
  });

  it('redirects an initial legacy URL to its current route', async() => {
    const context = setup({ url: 'http://localhost/w1/patient/dashboard/9' });

    assert.equal(await context.router.start(), true);

    assert.deepEqual(context.log, ['route:patient:workflow', 'handler:patient:workflow', 'ready:patient:workflow']);
    assert.equal(context.matches[0].initial, true);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/9/workflow');
    assert.equal(context.driver.entries().length, 1);
  });

  it('applies synchronous redirects to the initial URL', async() => {
    const context = setup({ url: 'http://localhost/old-home' });
    context.router.mount([{ name: 'home', path: '/old-home', redirect: () => ({ name: 'schedule', params: { workspace: 'w1' } }) }]);

    assert.equal(await context.router.start(), true);

    assert.deepEqual(context.log, ['route:schedule', 'handler:schedule', 'ready:schedule']);
    assert.equal(context.matches[0].initial, true);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule');
  });

  it('applies asynchronous redirects to the initial URL', async() => {
    const context = setup({ url: 'http://localhost/w1/flow/f1' });
    context.router.mount([{
      name: 'legacy:flow',
      path: '/:workspace/flow/:flowId',
      redirect: async({ params }) => ({ name: 'patient:flow', params: { patientId: 'p1', flowId: params.flowId } }),
    }]);

    assert.equal(await context.router.start(), true);

    assert.deepEqual(context.log, ['route:legacy:flow', 'route:patient:flow', 'handler:patient:flow', 'ready:patient:flow']);
    assert.equal(context.matches[1].initial, true);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/patient/p1/flow/f1');
  });

  it('matches an unknown URL inside the notFound scope', async() => {
    const context = setup({ url: 'http://localhost/w1/unknown' });

    assert.equal(await context.router.start(), true);

    assert.equal(context.matches[0].name, 'notFound');
    assert.equal(context.matches[0].initial, true);
  });

  it('resolves false without dispatching for a URL the router does not own', async() => {
    const context = setup({ url: 'http://localhost/logout' });

    assert.equal(await context.router.start(), false);

    assert.deepEqual(context.log, []);
    assert.equal(context.router.getCurrent(), null);
  });

  it('rejects with the handler failure after emitting route:error', async() => {
    const context = setup({ handler: () => {
      throw new Error('boom');
    } });

    await assert.rejects(context.router.start(), /boom/);

    assert.deepEqual(context.log, ['route:schedule', 'handler:schedule', 'error:schedule:boom']);
  });

  it('resolves false when superseded by a navigation', async() => {
    const wait = gate();
    const context = setup({ handler: match => (match.initial ? wait.promise : undefined) });
    const initial = context.router.start();

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    wait.open();

    assert.equal(await initial, false);
    assert.deepEqual(context.log, [
      'route:schedule', 'handler:schedule',
      'route:worklist', 'handler:worklist', 'ready:worklist',
    ]);
  });
});

describe('Router.stop', () => {
  it('stops intercepting and is idempotent', async() => {
    const context = await started();

    context.router.stop();
    context.router.stop();
    context.driver.simulate('http://localhost/w1/worklist/a');
    await tick();

    assert.deepEqual(context.log, []);
    assert.deepEqual(context.driver.documentNavigations, ['http://localhost/w1/worklist/a']);
  });

  it('aborts a finished match signal when the next match commits', async() => {
    const context = await started();
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    const first = lastRoute(context);
    assert.equal(first.signal.aborted, false);

    await context.router.navigate('worklist', { worklistId: 'b' }).finished;

    assert.equal(first.signal.aborted, true);
    assert.equal(lastRoute(context).signal.aborted, false);
  });

  it('aborts a finished match signal when the router stops', async() => {
    const context = await started();
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    const { signal } = lastRoute(context);
    assert.equal(signal.aborted, false);

    context.router.stop();

    assert.equal(signal.aborted, true);
  });

  it('aborts the in-flight signal and suppresses later events', async() => {
    const wait = gate();
    const context = await started({ handler: () => wait.promise });
    const { finished } = context.router.navigate('worklist', { worklistId: 'a' });
    const { signal } = lastRoute(context);

    context.router.stop();
    assert.equal(signal.aborted, true);
    wait.open();
    await finished;
    await tick();

    assert.equal(context.log.includes('ready:worklist'), false);
  });

  it('resolves a pending start with false', async() => {
    const wait = gate();
    const context = setup({ handler: () => wait.promise });
    const initial = context.router.start();

    context.router.stop();
    wait.open();

    assert.equal(await initial, false);
  });

  it('can start again after stopping', async() => {
    const context = await started();
    context.router.stop();

    assert.equal(await context.router.start(), true);

    assert.equal(lastRoute(context).initial, true);
    context.driver.simulate('http://localhost/w1/worklist/a');
    await tick();
    assert.equal(lastRoute(context).name, 'worklist');
  });
});

describe('Router.refresh and mount', () => {
  it('re-dispatches the current URL as replace without adding an entry', async() => {
    const context = await started();
    const entries = context.driver.entries().length;

    assert.equal(await context.router.refresh(), true);

    assert.deepEqual(context.log, ['route:schedule', 'handler:schedule', 'ready:schedule']);
    assert.equal(lastRoute(context).navigationType, 'replace');
    assert.equal(lastRoute(context).initial, false);
    assert.equal(context.driver.entries().length, entries);
  });

  it('picks up mounted routes and drops unmounted ones', async() => {
    const context = await started({ url: 'http://localhost/w1/later' });
    assert.equal(context.router.getCurrent().name, 'notFound');

    const unmount = context.router.mount([{ name: 'later', path: '/:workspace/later' }]);
    assert.equal(context.router.getCurrent().name, 'notFound');

    assert.equal(await context.router.refresh(), true);
    assert.equal(context.router.getCurrent().name, 'later');

    unmount();
    assert.equal(await context.router.refresh(), true);
    assert.equal(context.router.getCurrent().name, 'notFound');
  });

  it('mounts under a named parent', async() => {
    const context = await started();
    context.router.mount([{ name: 'schedule:day', path: ':day' }], { parent: 'schedule' });

    await context.router.navigate('schedule:day', { day: 'monday' }).finished;

    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule/monday');
    assert.equal(lastRoute(context).name, 'schedule:day');
  });

  it('preserves entry state across a refresh', async() => {
    const context = await started();
    context.router.updateState({ scrollTop: 3 });

    await context.router.refresh();

    assert.deepEqual(lastRoute(context).state, { scrollTop: 3 });
  });

  it('resolves false before start, after stop, and for URLs the router does not own', async() => {
    const context = setup();
    assert.equal(await context.router.refresh(), false);

    await context.router.start();
    context.router.stop();
    assert.equal(await context.router.refresh(), false);

    const unowned = setup({ url: 'http://localhost/logout' });
    await unowned.router.start();
    assert.equal(await unowned.router.refresh(), false);
  });
});

describe('Router history ownership', () => {
  it('does not count entries that existed before the application', async() => {
    const context = setup();
    context.driver.navigate('http://localhost/auth/redirect');
    context.driver.navigate('http://localhost/w1/schedule');
    await context.router.start();

    assert.equal(context.router.canGoBack, false);
    assert.equal(await context.router.back(), false);
    assert.equal(context.driver.currentEntry.url, 'http://localhost/w1/schedule');
  });

  it('counts entries the router created or dispatched', async() => {
    const context = setup();
    context.driver.navigate('http://localhost/auth/redirect');
    context.driver.navigate('http://localhost/w1/schedule');
    await context.router.start();

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;
    assert.equal(context.router.canGoBack, true);

    context.driver.simulate('http://localhost/w1/worklist/b');
    await tick();
    assert.equal(context.router.canGoBack, true);

    assert.equal(await context.router.back(), true);
    assert.equal(context.router.getCurrent().params.worklistId, 'a');
    assert.equal(lastRoute(context).navigationType, 'traverse');

    assert.equal(await context.router.back(), true);
    assert.equal(context.router.getCurrent().name, 'schedule');
    assert.equal(context.router.canGoBack, false);
    assert.equal(await context.router.back(), false);
  });

  it('marks dispatched entries without clobbering existing state', async() => {
    const context = setup();
    context.driver.navigate('http://localhost/w1/schedule', { state: { kept: true } });
    await context.router.start();

    assert.deepEqual(context.driver.currentEntry.getState(), { kept: true, [MARKER]: true });
    assert.deepEqual(context.matches[0].state, { kept: true });
  });
});

describe('Router entry state on navigate', () => {
  async function withEntryState(entryState) {
    const context = setup();
    context.driver.navigate('http://localhost/w1/schedule', { state: entryState });
    await context.router.start();
    return context;
  }

  it('keeps the existing state when the same URL is navigated again', async() => {
    const context = await withEntryState({ kept: true });

    assert.equal(await context.router.navigate('/w1/schedule').finished, true);

    assert.deepEqual(context.driver.currentEntry.getState(), { kept: true, [MARKER]: true });
    assert.deepEqual(lastRoute(context).state, { kept: true });
  });

  it('keeps the existing state when a replace changes only the query', async() => {
    const context = await withEntryState({ kept: true });

    await context.router.navigate('schedule', {}, { history: 'replace', query: { day: '1' } }).finished;

    assert.deepEqual(context.driver.currentEntry.getState(), { kept: true, [MARKER]: true });
  });

  it('gives a replace to another path only the marker', async() => {
    const context = await withEntryState({ kept: true });

    await context.router.navigate('worklist', { worklistId: 'a' }, { history: 'replace' }).finished;

    assert.deepEqual(context.driver.currentEntry.getState(), { [MARKER]: true });
  });

  it('gives a pushed entry only the marker', async() => {
    const context = await withEntryState({ kept: true });

    await context.router.navigate('worklist', { worklistId: 'a' }).finished;

    assert.deepEqual(context.driver.currentEntry.getState(), { [MARKER]: true });
  });

  it('replaces the existing state with an explicit state', async() => {
    const context = await withEntryState({ kept: true });

    await context.router.navigate('/w1/schedule', { state: { only: 1 } }).finished;

    assert.deepEqual(context.driver.currentEntry.getState(), { only: 1, [MARKER]: true });
  });

  it('drops existing state that is not a plain object when state is omitted', async() => {
    const context = await withEntryState('foreign');

    assert.equal(await context.router.navigate('/w1/schedule').finished, true);

    assert.deepEqual(context.driver.currentEntry.getState(), { [MARKER]: true });
  });
});

describe('Router.updateState', () => {
  it('merges into the current entry state and the current match', async() => {
    const context = await started();
    await context.router.navigate('worklist', { worklistId: 'a' }, { state: { first: 1 } }).finished;

    context.router.updateState({ second: 2 });

    assert.deepEqual(context.driver.currentEntry.getState(), { first: 1, second: 2, [MARKER]: true });
    assert.deepEqual(context.router.getCurrent().state, { first: 1, second: 2 });

    context.router.updateState({ first: 9 });
    assert.deepEqual(context.router.getCurrent().state, { first: 9, second: 2 });
  });

  it('keeps ownership of the entry so back() still works', async() => {
    const context = await started();
    context.router.updateState({ note: 'x' });
    await context.router.navigate('worklist', { worklistId: 'a' }).finished;

    assert.equal(context.router.canGoBack, true);
    await context.router.back();
    assert.deepEqual(context.router.getCurrent().state, { note: 'x' });
  });

  it('rejects state that is not a plain object', async() => {
    const context = await started();

    assert.throws(() => context.router.updateState('text'), TypeError);
  });
});

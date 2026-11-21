import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Router, memoryDriver } from '@mnjs/router';

for (const [label, target, expected] of [
  ['omitted', {
    name: 'destination',
  }, '/destination?old=1#old'],
  ['cleared', {
    name: 'destination',
    query: {},
    hash: '',
  }, '/destination'],
  ['bare fragment', {
    name: 'destination',
    hash: '#',
  }, '/destination?old=1#'],
  ['text', {
    name: 'destination',
    hash: 'section',
  }, '/destination?old=1#section'],
  ['leading hash', {
    name: 'destination',
    hash: '#section',
  }, '/destination?old=1#section'],
  ['encoding', {
    name: 'destination',
    query: {
      tab: 'closed',
    },
    hash: 'café %2F',
  }, '/destination?tab=closed#caf%C3%A9%20%2F'],
]) {
  test(`a named redirect with ${ label } query and hash forwards only what it does not set`, async t => {
    const router = new Router({
      driver: memoryDriver({
        url: 'https://router.test/outside',
      }),
      routes: {
        '/source': {
          name: 'source',
          redirect: () => target,
        },
        '/destination': {
          name: 'destination',
        },
      },
    });
    t.onTestFinished(() => router.destroy());
    await router.start();
    await router.getInitialDispatch();
    assert.equal(await router.navigate('/source?old=1#old').finished, true);
    assert.equal(router.getCurrent().url.href, `https://router.test${ expected }`);
  });
}

test('a named fragment redirect waits for destination presentation', async t => {
  const presentation = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const router = new Router({
    driver: memoryDriver({
      url: 'https://router.test/outside',
    }),
    routes: {
      '/source': {
        name: 'source',
        redirect: () => ({
          name: 'destination',
          hash: 'heading',
        }),
      },
      '/destination': {
        name: 'destination',
        handler() {
          entered.resolve();
          return presentation.promise;
        },
      },
    },
  });
  t.onTestFinished(() => {
    presentation.resolve();
    router.destroy();
  });
  await router.start();
  await router.getInitialDispatch();
  let settled = false;
  const navigation = router.navigate('source');
  navigation.finished.then(() => {
    settled = true;
  });
  await entered.promise;
  assert.equal(settled, false);
  presentation.resolve();
  assert.equal(await navigation.finished, true);
  assert.equal(router.getCurrent().url.hash, '#heading');
});

test('a bare string redirect target is rejected instead of resolving as a relative URL', async t => {
  const errors = [];
  const router = new Router({
    driver: memoryDriver({
      url: 'https://router.test/outside',
    }),
    routes: {
      '/source': {
        name: 'source',
        redirect: () => 'destination',
      },
      '/destination': {
        name: 'destination',
      },
    },
  });
  router.on('route:error', error => errors.push(error));
  t.onTestFinished(() => router.destroy());
  await router.start();
  await router.getInitialDispatch();
  await assert.rejects(router.navigate('source').finished, TypeError);
  assert.match(errors[0].message, /use \{ name: "destination" \}/);
});

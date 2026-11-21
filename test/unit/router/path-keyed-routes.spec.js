import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Router } from '@mnjs/router';

const routers = [];
afterEach(() => { for (const router of routers.splice(0)) { router.destroy(); } });

it('rejects legacy own-path hash values instead of silently changing their URL', () => {
  const router = new Router();
  routers.push(router);
  assert.throws(() => router.mount({ home: { path: '/', name: 'home' } }), /hash entry "home" cannot contain "path"/);
  assert.equal(router.hasRoute('home'), false);
});

it('takes route names from values and pathname parameters from hash keys', () => {
  const router = new Router({
    routes: {
      '/items/:id': { name: 'item' },
      '/search{/:term}?': { name: 'search' },
    },
  });
  routers.push(router);
  assert.equal(router.url('item', { id: 'one' }), '/items/one');
  assert.equal(router.url('search'), '/search');
  assert.equal(router.match('https://routes.example/items/two').name, 'item');
  assert.deepEqual(router.match('https://routes.example/items/two').params, { id: 'two' });
  assert.equal(router.hasRoute('/items/:id'), false);
});

it('resolves a method on an unnamed prefix without making the prefix a named route', () => {
  const PrefixRouter = Router.extend({ show() {} });
  const router = new PrefixRouter({ routes: { '/prefix': { handler: 'show', children: { 'child': { name: 'child' } } } } });
  routers.push(router);
  assert.equal(router.match('https://routes.example/prefix'), null);
  assert.equal(router.match('https://routes.example/prefix/child').name, 'child');
});

it('retains opaque node data without merging it across mixed hash and array children', () => {
  const parentData = new Map([['parent', true]]);
  const leafData = { handler: 'application-owned' };
  const router = new Router({
    routes: {
      '/teams/:team': {
        data: parentData,
        meta: { scope: 'team' },
        children: [{ path: 'items/:id', name: 'item', data: leafData, meta: { page: 'item' } }],
      },
    },
  });
  routers.push(router);
  const match = router.match('https://routes.example/teams/blue/items/one');
  assert.deepEqual(match.params, { team: 'blue', id: 'one' });
  assert.deepEqual(match.meta, { scope: 'team', page: 'item' });
  assert.equal(match.branch[0].data, parentData);
  assert.equal(match.branch[1].data, leafData);
  assert.deepEqual(match.branch.map(entry => entry.params), [{ team: 'blue' }, { id: 'one' }]);
  assert.deepEqual(match.branch.map(entry => entry.meta), [{ scope: 'team' }, { page: 'item' }]);
});

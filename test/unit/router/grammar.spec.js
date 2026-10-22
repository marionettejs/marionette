import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { createRouter } from './helpers.js';

describe('Router pathname grammar', () => {
  for (const path of [
    '/item/:id(\\d+)', '/item/(\\d+)', '/files/*', '/files/*rest',
    '/item/:id?', '/item/:id*', '/item/:id+',
    '/item{/:id}*', '/item{/:id}+', '/item{/:id(\\d+)}?',
    '/item)', '/item?tail', '/item+tail', '/item{/:id}??', '/item{/:id}?*',
  ]) {
    it(`rejects unsupported syntax in ${ path } during compilation`, () => {
      assert.throws(() => createRouter({ routes: [{ name: 'item', path }] }), /Unsupported syntax/);
    });
  }

  it('validates child and alias patterns with the same grammar', () => {
    assert.throws(() => createRouter({ routes: [
      { path: '/parent', children: [{ name: 'child', path: ':id+' }] },
    ] }), /Unsupported syntax/);
    assert.throws(() => createRouter({ routes: [
      { name: 'item', path: '/item/:id', aliases: [{ path: '/old/:id?' }] },
    ] }), /Unsupported syntax/);
  });

  it('rejects unsupported mounted routes without changing the route table', () => {
    const router = createRouter({ routes: [{ name: 'home', path: '/' }] });
    assert.throws(() => router.mount([
      { name: 'temporary', path: '/temporary' }, { name: 'bad', path: '/:id+' },
    ]), /Unsupported syntax/);
    assert.equal(router.hasRoute('temporary'), false);
    assert.equal(router.hasRoute('bad'), false);
    assert.equal(router.match('/').name, 'home');
    assert.equal(router.match('/temporary'), null);
  });

  it('rejects unsupported parameter names rather than partially tokenizing them', () => {
    for (const path of ['/:café', '/:é', '/:id\u200c', '/:id\u200d', '/:a\u0301', '/:"id"', '/:9id']) {
      assert.throws(() => createRouter({ routes: [{ name: 'item', path }] }), /Expected a parameter name/);
    }
  });

  for (const [path, url] of [
    ['/literal/\\*', '/literal/*'], ['/literal/\\+\\(\\)', '/literal/+()'],
    ['/literal/\\{\\}', '/literal/{}'], ['/a\\:b', '/a:b'],
  ]) {
    it(`keeps escaped syntax literal in ${ path }`, () => {
      const router = createRouter({ routes: [{ name: 'literal', path }] });
      assert.equal(router.url('literal'), url);
      assert.equal(router.match(url).name, 'literal');
      assert.equal(router.match('/literal/anything'), null);
    });
  }

  it('keeps optional groups and embedded parameters', () => {
    const router = createRouter({ routes: [
      { name: 'item', path: '/items{/:id}?{/:tab}?' },
      { name: 'file', path: '/file-:id.:ext' },
    ] });
    for (const [params, url] of [
      [{}, '/items'], [{ id: '7' }, '/items/7'], [{ id: '7', tab: 'details' }, '/items/7/details'],
    ]) {
      assert.equal(router.url('item', params), url);
      assert.deepEqual(router.match(url).params, params);
    }
    assert.throws(() => router.url('item', { tab: 'details' }), /do not round trip/);
    assert.equal(router.url('file', { id: '7', ext: 'txt' }), '/file-7.txt');
    assert.deepEqual(router.match('/file-7.txt').params, { id: '7', ext: 'txt' });
  });

  it('keeps zero and false as supplied optional parameter values', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/items{/:id}?' }] });
    for (const id of [0, false]) {
      const url = router.url('item', { id });
      assert.equal(url, `/items/${ id }`);
      assert.deepEqual(router.match(url).params, { id: String(id) });
    }
  });

  it('leaves nested and multiple-parameter group validity to URLPattern', () => {
    for (const path of ['/items{/:id{/:tab}?}?', '/items{/:id/:tab}?', '/items{/:id-:tab}?']) {
      assert.throws(() => createRouter({ routes: [{ name: 'item', path }] }), /Invalid path/);
    }
  });

  it('keeps required grouping and canonical omission of optional static groups', () => {
    const router = createRouter({ routes: [
      { name: 'required', path: '/required{/part/:id}' },
      { name: 'static', path: '/static{/edit}?' },
    ] });
    assert.equal(router.url('required', { id: '7' }), '/required/part/7');
    assert.equal(router.match('/required'), null);
    assert.equal(router.url('static'), '/static');
    assert.equal(router.match('/static/edit').name, 'static');
  });

  it('keeps Unicode static text and ASCII identifier names', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/café/:a_$id2' }] });
    const url = router.url('item', { a_$id2: 'one/two' });
    assert.deepEqual(router.match(url).params, { a_$id2: 'one/two' });
  });
});

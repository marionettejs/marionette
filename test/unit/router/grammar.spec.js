import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';

import { memoryDriver } from '@mnjs/router';
import { createRouter as createBaseRouter } from './helpers.js';

const createRouter = options => createBaseRouter({ driver: memoryDriver({ url: 'http://localhost/' }), ...options });

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

  it('validates child and redirect-route patterns with the same grammar', () => {
    assert.throws(() => createRouter({ routes: [
      { path: '/parent', children: [{ name: 'child', path: ':id+' }] },
    ] }), /Unsupported syntax/);
    assert.throws(() => createRouter({ routes: [
      { name: 'old', path: '/old/:id?', redirect: () => ({ name: 'item' }) },
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
      assert.throws(() => createRouter({ routes: [{ name: 'item', path }] }), /Expected an ASCII parameter name/);
    }
  });

  for (const [literal, encoded] of [['#', '%23'], ['\\#', '%23'], ['\\?', '%3F']]) {
    for (const suffix of ['', '/:id']) {
      const path = `/literal/${ literal }${ suffix }`;
      it(`rejects the URL delimiter in ${ path } with an encoded alternative`, () => {
        assert.throws(() => createRouter({ routes: [{ name: 'literal', path }] }), error => {
          assert.match(error.message, /Literal URL delimiter/);
          assert.ok(error.message.includes(encoded));
          return true;
        });
      });
    }
  }

  it('validates delimiters inside groups and redirect routes before generation', () => {
    assert.throws(() => createRouter({ routes: [{ name: 'item', path: '/items{/\\?}?' }] }), /%3F/);
    assert.throws(() => createRouter({ routes: [
      { name: 'old', path: '/old#/:id', redirect: () => ({ name: 'item' }) },
    ] }), /%23/);
  });

  for (const encoded of ['%23', '%3F']) {
    it(`round-trips the encoded delimiter ${ encoded }`, () => {
      const path = `/literal/${ encoded }`;
      const router = createRouter({ routes: [
        { name: 'literal', path }, { name: 'item', path: `${ path }/:id` },
      ] });
      assert.equal(router.url('literal'), path);
      assert.equal(router.match(path).name, 'literal');
      const url = router.url('item', { id: 'one?#two' }, { query: { q: 'query' } });
      const match = router.match(url);
      assert.equal(url, `${ path }/one%3F%23two?q=query`);
      assert.equal(match.name, 'item');
      assert.deepEqual(match.params, { id: 'one?#two' });
      assert.equal(match.query.get('q'), 'query');
      assert.equal(match.url.hash, '');
    });
  }

  for (const [path, url] of [
    ['/literal/\\*', '/literal/*'], ['/literal/\\+\\(\\)', '/literal/+()'],
    ['/literal/\\{\\}', '/literal/%7B%7D'], ['/a\\:b', '/a:b'],
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

  it('keeps numeric zero as a supplied optional parameter value', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/items{/:id}?' }] });
    const url = router.url('item', { id: 0 });
    assert.equal(url, '/items/0');
    assert.deepEqual(router.match(url).params, { id: '0' });
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
    const url = router.url('item', { 'a_$id2': 'one/two' });
    assert.deepEqual(router.match(url).params, { 'a_$id2': 'one/two' });
  });

  for (const name of ['__proto__', 'constructor', 'toString']) {
    it(`treats ${ name } as an ordinary own parameter name`, () => {
      const router = createRouter({ routes: [{ name: 'item', path: `/items{/:${ name }}?` }] });
      const params = Object.fromEntries([[name, 'one/two']]);
      const result = router.match('/items/one%2Ftwo');
      assert.deepEqual(result.params, params);
      assert.deepEqual(result.branch[0].params, params);
      assert.equal(Object.getPrototypeOf(result.params), Object.prototype);
      assert.equal(router.url('item', params), '/items/one%2Ftwo');
      assert.equal(router.url('item'), '/items');
      assert.deepEqual(router.match('/items').params, {});
      assert.deepEqual(router.match('/items').branch[0].params, {});
    });
  }

  it('does not use inherited parameter values for generation', () => {
    const router = createRouter({ routes: [
      { name: 'required', path: '/required/:id' }, { name: 'optional', path: '/optional{/:id}?' },
    ] });
    const params = Object.create({ id: 'inherited' });
    assert.throws(() => router.url('required', params), /missing param "id"/);
    assert.equal(router.url('optional', params), '/optional');
  });

  for (const id of ['.', '..']) {
    it(`allows embedded ${ id } while rejecting an actual dot segment`, () => {
      const router = createRouter({ routes: [
        { name: 'embedded', path: '/file-:id' }, { name: 'segment', path: '/items/:id' },
      ] });
      const url = router.url('embedded', { id });
      assert.equal(url, `/file-${ id }`);
      assert.deepEqual(router.match(url).params, { id });
      assert.throws(() => router.url('segment', { id }), /do not round trip/);
    });
  }

  for (const reverse of [false, true]) {
    it(`ranks required literals with dynamic suffixes above bare parameters (reverse: ${ reverse })`, () => {
      const routes = [
        { name: 'slug', path: '/:slug' },
        { name: 'extension', path: '/file{.:ext}?' },
        { name: 'version', path: '/x{-v2}?' },
        { name: 'embedded', path: '/item-:id' },
        { name: 'suffix', path: '/:id.json' },
      ];
      const router = createRouter({ routes: reverse ? routes.reverse() : routes });
      for (const path of ['/file', '/file.txt']) {assert.equal(router.match(path).name, 'extension');}
      for (const path of ['/x', '/x-v2']) {assert.equal(router.match(path).name, 'version');}
      assert.equal(router.match('/item-7').name, 'embedded');
      assert.equal(router.match('/7.json').name, 'suffix');
      assert.equal(router.url('extension'), '/file');
      assert.equal(router.url('extension', { ext: 'txt' }), '/file.txt');
    });

    it(`ranks exact static paths above optional literal or parameter suffixes (reverse: ${ reverse })`, () => {
      const routes = [
        { name: 'extension', path: '/file{.:ext}?' },
        { name: 'version', path: '/x{-v2}?' },
        ...['file', 'file.txt', 'x', 'x-v2'].map(path => ({ name: path, path: `/${ path }` })),
      ];
      const router = createRouter({ routes: reverse ? routes.reverse() : routes });
      for (const path of ['file', 'file.txt', 'x', 'x-v2']) {assert.equal(router.match(`/${ path }`).name, path);}
    });
  }

  it('keeps a required parameter more specific than an optional new segment', () => {
    const router = createRouter({ routes: [
      { name: 'optional', path: '/x{/:optional}?' },
      { name: 'required', path: '/x/:id{.txt}?' },
    ] });
    assert.equal(router.match('/x/value').name, 'required');
    assert.equal(router.match('/x').name, 'optional');
  });

  it('reports the declared unnamed path when native prefix compilation fails', () => {
    const path = '/bad\\';
    assert.throws(() => createRouter({ routes: [{ path }] }), error => {
      assert.ok(error.message.startsWith(`Invalid path "${ path }" for route "${ path }":`));
      assert.ok(error.cause instanceof TypeError);
      return true;
    });
  });

  it('can be imported before URLPattern is available', async() => {
    const nativePattern = globalThis.URLPattern;
    vi.resetModules();
    vi.stubGlobal('URLPattern', undefined);
    try {
      const api = await import('@mnjs/router');
      assert.equal(typeof api.Router, 'function');
      assert.equal(typeof api.memoryDriver, 'function');
    } finally {
      vi.stubGlobal('URLPattern', nativePattern);
      vi.resetModules();
    }
  });
});

import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';

import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const routerFor = (routes = []) => createRouter({ routes, driver: memoryDriver({ url: 'http://localhost/' }) });

const redirectToFlow = () => ({ name: 'patient:flow' });

function inventory() {
  return [
    { name: 'root', path: '/', redirect: () => ({ name: 'worklist' }) },
    { name: 'notFoundStatic', path: '/404' },
    {
      path: '/:workspace',
      meta: { scope: 'workspace' },
      children: [
        { name: 'workspace', path: '' },
        { name: 'worklist', path: 'worklist/:worklistId', meta: { area: 'patients', isList: true } },
        { name: 'schedule', path: 'schedule', meta: { area: 'patients', isList: true } },
        {
          name: 'patient',
          path: 'patient/:patientId',
          meta: { area: 'patients', page: 'patient' },
          children: [
            {
              name: 'patient:workflow',
              path: 'workflow',
              meta: { page: 'workflow' },
            },
            {
              name: 'patient:workflow:closed',
              path: 'workflow/closed',
            },
            { name: 'patient:flow', path: 'flow/:flowId' },
            { name: 'patient:flow:action', path: 'flow/:flowId/action/:actionId' },
            { name: 'patient:form', path: 'form/:formId{/:responseId}?' },
          ],
        },
        { name: 'legacy:patient:workflow', path: 'patient/dashboard/:patientId',
          redirect: ({ params, query }) => ({ name: 'patient:workflow', params, query }) },
        { name: 'legacy:patient:workflow:closed', path: 'patient/archive/:patientId',
          redirect: ({ params, query }) => ({ name: 'patient:workflow:closed', params, query }) },
        { name: 'legacy:patient:flow', path: 'flow/:flowId', redirect: redirectToFlow },
        { name: 'legacy:patient:flow:details', path: 'flow/:flowId/details' },
        { name: 'program:action', path: 'program/:programId/action/:actionId' },
        { name: 'programs:all', path: 'programs', meta: { area: 'programs', isList: true } },
      ],
    },
  ];
}

function names(matcher, path) {
  return matcher.match(path)?.name;
}

describe('Router matching: compile and match', () => {
  it('matches named nodes on their own full path and prefixes only through children', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, '/'), 'root');
    assert.equal(names(matcher, '/clinic-a'), 'workspace');
    assert.equal(names(matcher, '/clinic-a/worklist/owned-by'), 'worklist');
    assert.equal(names(matcher, '/clinic-a/patient/p1'), 'patient');
    assert.equal(names(matcher, '/clinic-a/patient/p1/workflow'), 'patient:workflow');
  });

  it('never matches unnamed nodes', () => {
    const matcher = routerFor([{ path: '/prefix', children: [{ name: 'leaf', path: 'leaf' }] }]);
    assert.equal(matcher.match('/prefix'), null);
    assert.equal(names(matcher, '/prefix/leaf'), 'leaf');
    assert.equal(matcher.hasRoute('prefix'), false);
  });

  it('resolves relative paths against the parent and absolute paths from the root', () => {
    const matcher = routerFor([{
      path: '/:workspace',
      children: [
        { name: 'relative', path: 'a/b' },
        { name: 'absolute', path: '/standalone/:id' },
      ],
    }]);
    assert.equal(names(matcher, '/w/a/b'), 'relative');
    assert.equal(names(matcher, '/standalone/7'), 'absolute');
    assert.equal(matcher.url('absolute', { id: 7 }), '/standalone/7');
    assert.deepEqual(matcher.getParamNames('absolute'), ['id']);
  });

  it('accepts a relative top-level path as rooted at "/"', () => {
    const matcher = routerFor([{ name: 'top', path: 'top' }]);
    assert.equal(names(matcher, '/top'), 'top');
  });

  it('returns null when nothing matches', () => {
    const matcher = routerFor([{ name: 'a', path: '/a' }]);
    assert.equal(matcher.match('/b'), null);
    assert.equal(matcher.match('/a/b'), null);
    assert.equal(routerFor().match('/'), null);
  });

  it('decodes params on match', () => {
    const matcher = routerFor(inventory());
    const result = matcher.match('/clinic%20a/worklist/owned%2Fby%20me');
    assert.deepEqual(result.params, { workspace: 'clinic a', worklistId: 'owned/by me' });
  });

  it('treats a malformed percent-escape as no match', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.match('/clinic/worklist/%E0%A4%A'), null);
  });

  it('does not fall through to a lower-ranked route after parameter decoding fails', () => {
    const matcher = routerFor([
      { name: 'file', path: '/files/:id' },
      { name: 'fallback', path: '/:section/%FF' },
    ]);
    assert.equal(matcher.match('/files/%FF'), null);
  });

  it('omits unmatched optional params and decodes matched ones', () => {
    const matcher = routerFor(inventory());
    assert.deepEqual(matcher.match('/w/patient/p1/form/f1').params, { workspace: 'w', patientId: 'p1', formId: 'f1' });
    assert.deepEqual(matcher.match('/w/patient/p1/form/f1/r%201').params, {
      workspace: 'w',
      patientId: 'p1',
      formId: 'f1',
      responseId: 'r 1',
    });
  });

  it('normalizes trailing slashes except for "/"', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, '/w/schedule/'), 'schedule');
    assert.equal(names(matcher, '/w/schedule//'), 'schedule');
    assert.equal(names(matcher, '/'), 'root');
  });

  it('exposes the query as URLSearchParams and the input URL', () => {
    const matcher = routerFor(inventory());
    const input = new URL('http://example.test/w/worklist/owned-by?clinicianId=c1&x=1#hash');
    const result = matcher.match(input);
    assert.ok(result.query instanceof URLSearchParams);
    assert.equal(result.query.get('clinicianId'), 'c1');
    assert.equal(result.url, input);
    assert.equal(matcher.match('/w/schedule?a=b').query.get('a'), 'b');
    assert.equal(matcher.match('/w/schedule').url.href, 'http://localhost/w/schedule');
  });

  it('ignores the host and only matches the pathname', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, 'https://elsewhere.test/w/schedule'), 'schedule');
  });
});

describe('Router matching: meta and branch', () => {
  it('shallow-merges meta root to leaf with child keys winning', () => {
    const matcher = routerFor(inventory());
    assert.deepEqual(matcher.match('/w/patient/p1/workflow').meta, {
      scope: 'workspace',
      area: 'patients',
      page: 'workflow',
    });
    assert.deepEqual(matcher.match('/w/worklist/x').meta, { scope: 'workspace', area: 'patients', isList: true });
    assert.deepEqual(matcher.match('/').meta, {});
  });

  it('returns branch entries root to leaf with own params and own meta', () => {
    const matcher = routerFor(inventory());
    const { branch } = matcher.match('/w/patient/p1/workflow');
    assert.deepEqual(branch, [
      { name: undefined, path: '/:workspace', params: { workspace: 'w' }, meta: { scope: 'workspace' } },
      { name: 'patient', path: '/:workspace/patient/:patientId', params: { patientId: 'p1' }, meta: { area: 'patients', page: 'patient' } },
      { name: 'patient:workflow', path: '/:workspace/patient/:patientId/workflow', params: {}, meta: { page: 'workflow' } },
    ]);
  });

  it('does not let callers mutate compiled meta', () => {
    const matcher = routerFor(inventory());
    matcher.match('/w/schedule').meta.isList = false;
    matcher.match('/w/schedule').branch[0].meta.scope = 'changed';
    assert.equal(matcher.match('/w/schedule').meta.isList, true);
    assert.equal(matcher.match('/w/schedule').branch[0].meta.scope, 'workspace');
  });

  it('does not run redirect callbacks during pure matching', () => {
    const redirect = vi.fn();
    const router = routerFor([{ name: 'source', path: '/source', redirect }]);
    assert.equal(router.match('/source').name, 'source');
    assert.equal(redirect.mock.calls.length, 0);
  });
});

describe('Router matching: ranking', () => {
  it('prefers a static segment over a named parameter regardless of definition order', () => {
    const paramFirst = routerFor([
      { name: 'param', path: '/x/:id' },
      { name: 'static', path: '/x/new' },
    ]);
    const staticFirst = routerFor([
      { name: 'static', path: '/x/new' },
      { name: 'param', path: '/x/:id' },
    ]);
    for (const matcher of [paramFirst, staticFirst]) {
      assert.equal(names(matcher, '/x/new'), 'static');
      assert.equal(names(matcher, '/x/other'), 'param');
    }
  });

  it('prefers a static top-level route over the workspace parameter', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, '/404'), 'notFoundStatic');
    assert.equal(names(matcher, '/other'), 'workspace');
  });

  it('prefers a named parameter over an optional group', () => {
    const matcher = routerFor([
      { name: 'optional', path: '/x{/:id}?' },
      { name: 'param', path: '/x/:id' },
    ]);
    assert.equal(names(matcher, '/x/1'), 'param');
    assert.equal(names(matcher, '/x'), 'optional');
    assert.equal(matcher.match('/x/1/2'), null);
  });

  it('prefers the route without the optional group when both match', () => {
    const matcher = routerFor([
      { name: 'withOptional', path: '/f/:id{/:rid}?' },
      { name: 'plain', path: '/f/:id' },
    ]);
    assert.equal(names(matcher, '/f/1'), 'plain');
    assert.equal(names(matcher, '/f/1/2'), 'withOptional');
  });

  it('compares segment by segment so an earlier static beats a later one', () => {
    const matcher = routerFor([
      { name: 'laterStatic', path: '/:a/b/:c' },
      { name: 'earlierStatic', path: '/a/:b/:c' },
    ]);
    assert.equal(names(matcher, '/a/b/c'), 'earlierStatic');
  });

  it('leaves unknown paths unmatched without a catchall', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.match('/w/something/else'), null);
    assert.equal(names(matcher, '/w/programs'), 'programs:all');
  });

  it('falls back to definition order for identical shapes', () => {
    const matcher = routerFor([
      { name: 'first', path: '/same/:a' },
      { name: 'second', path: '/same/:b' },
    ]);
    assert.equal(names(matcher, '/same/1'), 'first');
  });

  it('never lets mount order override specificity', () => {
    const matcher = routerFor([{ name: 'param', path: '/x/:id' }]);
    matcher.mount([{ name: 'static', path: '/x/new' }]);
    assert.equal(names(matcher, '/x/new'), 'static');

    const reversed = routerFor([{ name: 'static', path: '/x/new' }]);
    reversed.mount([{ name: 'param', path: '/x/:id' }]);
    assert.equal(names(reversed, '/x/new'), 'static');
  });

  it('uses mount order only as the final tie-break', () => {
    const matcher = routerFor();
    matcher.mount([{ name: 'early', path: '/t/:a' }]);
    matcher.mount([{ name: 'late', path: '/t/:b' }]);
    assert.equal(names(matcher, '/t/1'), 'early');
  });

  it('ranks the legacy flow routes by static suffix', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, '/w/flow/f1'), 'legacy:patient:flow');
    assert.equal(names(matcher, '/w/flow/f1/details'), 'legacy:patient:flow:details');
  });

  it('ranks closed workflow above a parameterized sibling', () => {
    const matcher = routerFor(inventory());
    assert.equal(names(matcher, '/w/patient/p1/workflow/closed'), 'patient:workflow:closed');
  });
});

describe('Router matching: named redirect routes', () => {
  it('matches the old route by its own name without following its redirect', () => {
    const redirect = vi.fn(() => ({ name: 'current' }));
    const matcher = routerFor([
      { name: 'current', path: '/current/:id' },
      { name: 'old', path: '/old/:key', redirect },
    ]);
    const match = matcher.match('/old/value');
    assert.equal(match.name, 'old');
    assert.deepEqual(match.params, { key: 'value' });
    assert.equal(redirect.mock.calls.length, 0);
  });

  it('builds the declared URL for both current and legacy names', () => {
    const matcher = routerFor(inventory());
    const params = { workspace: 'w', patientId: 'p' };
    assert.equal(matcher.url('patient:workflow', params), '/w/patient/p/workflow');
    assert.equal(matcher.url('legacy:patient:workflow', params), '/w/patient/dashboard/p');
  });

  it('ranks a named legacy route like any other route', () => {
    const matcher = routerFor([
      { name: 'old', path: '/old/:id', redirect: () => ({ name: 'current' }) },
      { name: 'help', path: '/old/help' },
    ]);
    assert.equal(matcher.match('/old/help').name, 'help');
  });
});

describe('Router matching: url()', () => {
  it('builds paths and encodes params with encodeURIComponent', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.url('worklist', { workspace: 'clinic a', worklistId: 'a/b' }), '/clinic%20a/worklist/a%2Fb');
    assert.equal(matcher.url('patient:flow', { workspace: 'w', patientId: 1, flowId: 2 }), '/w/patient/1/flow/2');
    assert.equal(matcher.url('root'), '/');
  });

  it('round-trips through match', () => {
    const matcher = routerFor(inventory());
    const params = { workspace: 'wé 1', worklistId: 'x/y?z' };
    assert.deepEqual(matcher.match(matcher.url('worklist', params)).params, params);
  });

  it('omits optional groups and includes them when supplied', () => {
    const matcher = routerFor(inventory());
    const params = { workspace: 'w', patientId: 'p', formId: 'f' };
    assert.equal(matcher.url('patient:form', params), '/w/patient/p/form/f');
    assert.equal(matcher.url('patient:form', { ...params, responseId: 'r 1' }), '/w/patient/p/form/f/r%201');
  });

  it('encodes slashes inside a single named parameter', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.url('worklist', { workspace: 'w', worklistId: 'a b/c' }), '/w/worklist/a%20b%2Fc');
  });

  it('ignores params that are not part of the path', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.url('schedule', { workspace: 'w', unused: 'x' }), '/w/schedule');
  });

  it('accepts query as URLSearchParams, an object or a string', () => {
    const matcher = routerFor(inventory());
    const params = { workspace: 'w', worklistId: 'owned-by' };
    const expected = '/w/worklist/owned-by?clinicianId=c1&q=a+b';
    assert.equal(matcher.url('worklist', params, { query: new URLSearchParams({ clinicianId: 'c1', q: 'a b' }) }), expected);
    assert.equal(matcher.url('worklist', params, { query: { clinicianId: 'c1', q: 'a b', skip: undefined, none: null } }), expected);
    assert.equal(matcher.url('worklist', params, { query: '?clinicianId=c1&q=a+b' }), expected);
    assert.equal(matcher.url('worklist', params, { query: '' }), '/w/worklist/owned-by');
    assert.equal(matcher.url('worklist', params, {}), '/w/worklist/owned-by');
  });

  it('throws for unknown names', () => {
    const matcher = routerFor(inventory());
    assert.throws(() => matcher.url('nope'), /Unknown route "nope"/);
  });

  it('throws for missing required params, including empty values', () => {
    const matcher = routerFor(inventory());
    assert.throws(() => matcher.url('worklist', { workspace: 'w' }), /missing param "worklistId"/);
    assert.throws(() => matcher.url('worklist', { workspace: 'w', worklistId: '' }), /missing param "worklistId"/);
    assert.throws(() => matcher.url('worklist', { workspace: 'w', worklistId: null }), /missing param "worklistId"/);
    assert.throws(() => matcher.url('worklist'), /missing param "workspace"/);
  });
});

describe('Router matching: url() then match() round trips', () => {
  function roundTripRoutes() {
    return [
      ...inventory(),
      { name: 'item', path: '/:workspace/item/:id' },
      { name: 'files', path: '/:workspace/files/:path' },
    ];
  }

  const cases = [
    ['nested params', 'patient:flow:action', { workspace: 'w', patientId: 'p1', flowId: 'f1', actionId: 'a1' }],
    ['optional segment omitted', 'patient:form', { workspace: 'w', patientId: 'p1', formId: 'f1' }],
    ['optional segment supplied', 'patient:form', { workspace: 'w', patientId: 'p1', formId: 'f1', responseId: 'r 1' }],
    ['current workflow URL', 'patient:workflow', { workspace: 'w', patientId: 'p1' }],
    ['current closed workflow URL', 'patient:workflow:closed', { workspace: 'w', patientId: 'p1' }],
    ['value equal to a static segment', 'worklist', { workspace: 'w', worklistId: 'programs' }],
    ['value that looks like another route', 'patient:flow', { workspace: 'w', patientId: 'worklist', flowId: 'flow' }],
    ['encoded reserved characters', 'worklist', { workspace: 'a b', worklistId: 'x/y?z#q%1&=+' }],
    ['unicode and percent signs', 'worklist', { workspace: 'wé 1', worklistId: '100%' }],
    ['slash-containing scalar', 'files', { workspace: 'w', path: 'a b/c/é?' }],
    ['numeric param value', 'item', { workspace: 'w', id: '42' }],
    ['encoded separators', 'files', { workspace: 'w', path: 'a/b c/d' }],
  ];

  for (const [label, name, params] of cases) {
    it(`gives the same route and params: ${ label }`, () => {
      const matcher = routerFor(roundTripRoutes());

      const result = matcher.match(matcher.url(name, params));

      assert.equal(result.name, name);
      assert.deepEqual(result.params, params);
    });
  }

  it('keeps the query out of the match', () => {
    const matcher = routerFor(roundTripRoutes());
    const params = { workspace: 'w', worklistId: 'owned-by' };

    const result = matcher.match(matcher.url('worklist', params, { query: { clinicianId: 'c1' } }));

    assert.deepEqual(result.params, params);
    assert.equal(result.query.get('clinicianId'), 'c1');
  });

  it('matches an old bookmark as its own named redirect route', () => {
    const matcher = routerFor(roundTripRoutes());
    const result = matcher.match('/w/patient/dashboard/p%201');
    assert.equal(result.name, 'legacy:patient:workflow');
    assert.deepEqual(result.params, { workspace: 'w', patientId: 'p 1' });
    assert.equal(matcher.url(result.name, result.params), '/w/patient/dashboard/p%201');
  });

  it('round-trips every named route with generated params', () => {
    const matcher = routerFor(roundTripRoutes());
    for (const name of ['worklist', 'schedule', 'patient:flow', 'program:action', 'programs:all', 'legacy:patient:flow', 'item', 'files']) {
      const params = Object.fromEntries(matcher.getParamNames(name).map(param => [param, param === 'id' ? '7' : `${ param } v`]));
      const result = matcher.match(matcher.url(name, params));

      assert.equal(result.name, name, name);
      assert.deepEqual(result.params, params, name);
    }
  });
});

describe('Router matching: url() rejects values that would not round trip', () => {
  function rejectRoutes() {
    return [
      { name: 'files', path: '/:workspace/files/:path' },
      { name: 'any', path: '/:workspace/any/:value' },
    ];
  }

  it('rejects dot segments', () => {
    const matcher = routerFor(rejectRoutes());

    assert.throws(() => matcher.url('any', { workspace: 'w', value: '.' }), /do not round trip/);
    assert.throws(() => matcher.url('any', { workspace: 'w', value: '..' }), /do not round trip/);
    assert.throws(() => matcher.url('any', { workspace: '..', value: 'x' }), /do not round trip/);
    assert.throws(() => matcher.url('files', { workspace: 'w', path: '..' }), /do not round trip/);
    assert.throws(() => matcher.url('files', { workspace: 'w', path: '.' }), /do not round trip/);
  });

  it('accepts values that only contain dots', () => {
    const matcher = routerFor(rejectRoutes());

    assert.equal(matcher.url('any', { workspace: 'w', value: '...' }), '/w/any/...');
    assert.equal(matcher.url('any', { workspace: 'w', value: 'a.b' }), '/w/any/a.b');
    assert.equal(matcher.url('any', { workspace: 'w', value: '%2E' }), '/w/any/%252E');
  });

  it('keeps dot components inside an encoded scalar value', () => {
    const matcher = routerFor(rejectRoutes());
    for (const path of ['a/../b', './a']) {
      const url = matcher.url('files', { workspace: 'w', path });
      assert.deepEqual(matcher.match(url).params, { workspace: 'w', path });
    }
  });
});

describe('Router matching: getParamNames, has', () => {
  it('lists canonical param names in path order', () => {
    const matcher = routerFor(inventory());
    assert.deepEqual(matcher.getParamNames('patient:flow:action'), ['workspace', 'patientId', 'flowId', 'actionId']);
    assert.deepEqual(matcher.getParamNames('patient:form'), ['workspace', 'patientId', 'formId', 'responseId']);
    assert.deepEqual(matcher.getParamNames('root'), []);
  });

  it('returns a copy', () => {
    const matcher = routerFor(inventory());
    matcher.getParamNames('schedule').push('x');
    assert.deepEqual(matcher.getParamNames('schedule'), ['workspace']);
  });

  it('throws for unknown names', () => {
    assert.throws(() => routerFor().getParamNames('nope'), /Unknown route "nope"/);
  });

  it('reports named routes only', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.hasRoute('patient'), true);
    assert.equal(matcher.hasRoute('patient:flow'), true);
    assert.equal(matcher.hasRoute('missing'), false);
  });
});

describe('Router matching: compile errors', () => {
  it('throws on duplicate param names within a branch', () => {
    assert.throws(
      () => routerFor([{ name: 'program:action', path: '/program/:id/action/:id' }]),
      /"program:action" repeats param "id"/,
    );
    assert.throws(
      () => routerFor([{ path: '/:id', children: [{ name: 'child', path: 'x/:id' }] }]),
      /"child" repeats param "id"/,
    );
  });

  it('allows the same param name in sibling branches', () => {
    assert.doesNotThrow(() => routerFor([
      { name: 'a', path: '/a/:id' },
      { name: 'b', path: '/b/:id' },
    ]));
  });

  it('throws on duplicate route names across the tree', () => {
    assert.throws(
      () => routerFor([{ name: 'dup', path: '/a' }, { path: '/p', children: [{ name: 'dup', path: 'b' }] }]),
      /Duplicate route name "dup"/,
    );
  });

  it('throws on invalid definitions and paths', () => {
    assert.throws(() => routerFor([{ name: 'a' }]), /requires a string "path"/);
    assert.throws(() => routerFor([{ name: '', path: '/a' }]), /non-empty string/);
    assert.throws(() => routerFor([{ name: 'a', path: '/a/:' }]), /Expected an ASCII parameter name/);
    assert.throws(() => routerFor([{ name: 'a', path: '/a{/:b' }]), /Unterminated "\{"/);
    assert.throws(() => routerFor([{ name: 'a', path: '/a}' }]), /Unexpected "\}"/);
    assert.throws(() => routerFor([{ name: 'a', path: '/a/(\\d+' }]), /Unsupported syntax/);
    assert.throws(() => routerFor('nope'), /array of route definitions/);
  });

  it('wraps URLPattern failures with the route name and cause', () => {
    assert.throws(() => routerFor([{ name: 'bad', path: '/bad\\' }]), error => {
      assert.match(error.message, /Invalid path .* for route "bad"/);
      assert.ok(error.cause instanceof TypeError);
      return true;
    });
  });
});

describe('Router matching: escapes', () => {
  it('treats an escaped character as literal text', () => {
    const matcher = routerFor([{ name: 'literal', path: '/a\\:b' }]);
    assert.equal(names(matcher, '/a:b'), 'literal');
    assert.equal(matcher.url('literal'), '/a:b');
  });
});

describe('Router matching: leading brace groups', () => {
  it('joins slash-owning groups at the root and under relative parents', () => {
    const matcher = routerFor([
      { name: 'root', path: '{/root/:id}' },
      { path: '/section', children: [
        { name: 'child', path: '{/:id}?' },
        { name: 'absolute', path: '/absolute{/:id}?' },
        { name: 'escaped', path: '\\{/literal' },
      ] },
    ]);
    for (const [name, params, path] of [
      ['root', { id: 'one' }, '/root/one'],
      ['child', { id: 'one' }, '/section/one'],
      ['child', {}, '/section'],
      ['absolute', { id: 'one' }, '/absolute/one'],
      ['escaped', {}, '/section/%7B/literal'],
    ]) {
      assert.equal(matcher.url(name, params), path);
      assert.equal(names(matcher, path), name);
    }
    assert.equal(matcher.match('/section//one'), null);
  });

  it('treats omitted root-only groups as root without rewriting groups before suffixes', () => {
    for (const [name, params, path] of [
      ['optionalRoot', {}, '/'], ['optionalRoot', { lang: 'en' }, '/en'],
      ['about', {}, '/about'], ['about', { lang: 'en' }, '/en/about'],
    ]) {
      const matcher = routerFor([{ name, path: name === 'about' ? '{/:lang}?/about' : '{/:lang}?' }]);
      assert.equal(matcher.url(name, params), path);
      assert.equal(names(matcher, path), name);
    }
    const exactRoot = routerFor([{ name: 'optional', path: '{/:lang}?' }, { name: 'root', path: '/' }]);
    assert.equal(names(exactRoot, '/'), 'root');
    assert.equal(exactRoot.url('root'), '/');
    assert.throws(() => exactRoot.url('optional'), /do not round trip/);
    const adjacent = routerFor([{ name: 'adjacent', path: '{/:first}?{/:second}?' }]);
    assert.equal(adjacent.url('adjacent'), '/');
    assert.equal(names(adjacent, '/'), 'adjacent');
    const underRoot = routerFor([{ path: '/', children: [{ name: 'child', path: '{/:id}?' }] }]);
    assert.equal(underRoot.url('child'), '/');
    assert.equal(underRoot.url('child', { id: 'one' }), '/one');
    assert.equal(names(underRoot, '/one'), 'child');
  });
});

describe('Router matching: not-found prefixes', () => {
  function fallback(routes, url = 'http://localhost/fixed/value/missing') {
    return createRouter({ routes, driver: memoryDriver({ url }), notFound: { name: 'missing', within: () => true } });
  }

  it('breaks equal-depth ties by specificity before definition or mount order', async() => {
    const matcher = fallback([{ path: '/:area/:value' }]);
    matcher.mount([{ path: '/fixed/:id' }]);
    await matcher.start();
    assert.deepEqual(matcher.getCurrent().params, { id: 'value' });
    const mixed = fallback([{ path: '/:area/:value' }, { path: '/fixed-:suffix/:id' }], 'http://localhost/fixed-part/value/missing');
    await mixed.start();
    assert.deepEqual(mixed.getCurrent().params, { suffix: 'part', id: 'value' });
  });

  it('retains mount priority after dependent prefixes reactivate', async() => {
    const matcher = fallback([], 'http://localhost/outer/value/missing');
    const removeParent = matcher.mount([{ name: 'parent', path: '/outer' }]);
    matcher.mount([{ path: ':first' }], { parent: 'parent' });
    matcher.mount([{ path: '/outer', children: [{ path: ':second' }] }]);
    removeParent();
    matcher.mount([{ name: 'parent', path: '/outer' }]);
    await matcher.start();
    assert.deepEqual(matcher.getCurrent().params, { first: 'value' });
  });

  it('stops at malformed captures of the deepest prefix without falling back', async() => {
    const matcher = fallback([{ path: '/:workspace', children: [{ path: 'patient/:patientId' }] }], 'http://localhost/clinic/patient/%FF/missing');
    await matcher.start();
    assert.deepEqual(matcher.getCurrent().params, {});
  });
});

describe('Router matching: mount', () => {
  it('snapshots registration arrays, definitions, children and top-level metadata', () => {
    const nested = { shared: true };
    const redirect = () => ({ name: 'leaf' });
    const child = { name: 'leaf', path: 'leaf', meta: { label: 'original', nested }, redirect };
    const children = [child];
    const definition = { path: '/scope', children };
    const routes = [definition];
    const matcher = routerFor(routes);
    routes.push({ name: 'injected', path: '/injected' });
    definition.path = '/changed';
    children.push({ name: 'extra', path: 'extra' });
    child.path = 'changed';
    child.redirect = undefined;
    child.meta.label = 'changed';
    nested.shared = false;
    matcher.mount([{ name: 'unrelated', path: '/unrelated' }]);
    const result = matcher.match('/scope/leaf');
    assert.equal(result.name, 'leaf');
    assert.equal(result.meta.label, 'original');
    assert.equal(result.meta.nested, nested);
    assert.equal(result.meta.nested.shared, false);
    assert.equal(matcher.hasRoute('injected'), false);
    assert.equal(matcher.hasRoute('extra'), false);
    assert.equal(matcher.match('/changed/changed'), null);
    // Pure matching retains the registered callback without invoking it.
    assert.equal(matcher.match('/scope/leaf').name, 'leaf');
  });

  it('snapshots later mounts independently and preserves registered redirect callbacks', async() => {
    const matcher = routerFor([{ name: 'target', path: '/target' }]);
    const redirect = vi.fn(() => ({ name: 'target' }));
    const routes = [{ name: 'old', path: '/old', redirect }];
    const unmount = matcher.mount(routes);
    routes[0].redirect = undefined;
    routes[0].path = '/changed';
    routes.push({ name: 'extra', path: '/extra' });
    matcher.mount([{ name: 'unrelated', path: '/unrelated' }]);
    await matcher.start();
    await matcher.navigate('/old').finished;
    assert.equal(matcher.getCurrent().name, 'target');
    assert.equal(redirect.mock.calls.length, 1);
    assert.equal(matcher.hasRoute('extra'), false);
    unmount();
    assert.equal(matcher.hasRoute('old'), false);
  });

  it('rejects parameter reuse anywhere in logical ancestry after absolute path resets', () => {
    for (const children of [
      [{ name: 'leaf', path: '/x/:id' }],
      [{ path: '/x/:other', children: [{ name: 'leaf', path: 'leaf/:id' }] }],
    ]) {
      assert.throws(() => routerFor([{ path: '/:id', children }]), /repeats param "id"/);
    }
    const matcher = routerFor([{ path: '/:ancestor', children: [{ name: 'leaf', path: '/x/:id' }] }]);
    assert.deepEqual(matcher.match('/x/value').branch.map(item => item.params), [{}, { id: 'value' }]);
  });

  it('preserves mount precedence when a dependent mount is compiled after a replacement parent', () => {
    const matcher = routerFor();
    const removeParent = matcher.mount([{ name: 'parent', path: '/outer' }]);
    matcher.mount([{ name: 'early', path: 'same/:first' }], { parent: 'parent' });
    matcher.mount([{ name: 'later', path: '/outer/same/:second' }]);
    removeParent();
    assert.equal(names(matcher, '/outer/same/value'), 'later');
    matcher.mount([{ name: 'parent', path: '/outer' }]);
    assert.equal(names(matcher, '/outer/same/value'), 'early');
  });

  it('adds routes at the root and returns an unmount', () => {
    const matcher = routerFor();
    const unmount = matcher.mount([{ name: 'a', path: '/a' }]);
    assert.equal(names(matcher, '/a'), 'a');
    unmount();
    assert.equal(matcher.match('/a'), null);
    assert.equal(matcher.hasRoute('a'), false);
    assert.throws(() => matcher.url('a'), /Unknown route/);
  });

  it('mounts under a named parent', () => {
    const matcher = routerFor(inventory());
    matcher.mount([{ name: 'patient:extra', path: 'extra/:extraId', meta: { extra: true } }], { parent: 'patient' });
    const result = matcher.match('/w/patient/p1/extra/e1');
    assert.equal(result.name, 'patient:extra');
    assert.deepEqual(result.params, { workspace: 'w', patientId: 'p1', extraId: 'e1' });
    assert.deepEqual(result.meta, { scope: 'workspace', area: 'patients', page: 'patient', extra: true });
    assert.deepEqual(result.branch.map(item => item.name), [undefined, 'patient', 'patient:extra']);
    assert.deepEqual(matcher.getParamNames('patient:extra'), ['workspace', 'patientId', 'extraId']);
  });

  it('makes mounted routes visible to a later mount parent', () => {
    const matcher = routerFor();
    matcher.mount([{ name: 'outer', path: '/outer' }]);
    matcher.mount([{ name: 'inner', path: 'inner' }], { parent: 'outer' });
    assert.equal(names(matcher, '/outer/inner'), 'inner');
  });

  it('throws for an unknown parent and leaves the matcher unchanged', () => {
    const matcher = routerFor([{ name: 'a', path: '/a' }]);
    assert.throws(() => matcher.mount([{ name: 'b', path: '/b' }], { parent: 'missing' }), /Unknown parent route "missing"/);
    assert.equal(matcher.hasRoute('b'), false);
    assert.equal(names(matcher, '/a'), 'a');
  });

  it('throws on duplicate names against existing routes and rolls the mount back', () => {
    const matcher = routerFor([{ name: 'a', path: '/a' }]);
    assert.throws(() => matcher.mount([{ name: 'a', path: '/other' }]), /Duplicate route name "a"/);
    assert.equal(matcher.match('/other'), null);
    assert.equal(names(matcher, '/a'), 'a');
    assert.doesNotThrow(() => matcher.mount([{ name: 'b', path: '/b' }]));
  });

  it('rolls back a mount whose param names clash with the parent', () => {
    const matcher = routerFor(inventory());
    assert.throws(() => matcher.mount([{ name: 'clash', path: 'x/:patientId' }], { parent: 'patient' }), /repeats param "patientId"/);
    assert.equal(matcher.hasRoute('clash'), false);
  });

  it('unmount is idempotent and removes only what that mount added', () => {
    const matcher = routerFor([{ name: 'base', path: '/base' }]);
    const unmountA = matcher.mount([{ name: 'a', path: '/a' }]);
    matcher.mount([{ name: 'b', path: '/b' }]);
    unmountA();
    unmountA();
    assert.equal(matcher.hasRoute('a'), false);
    assert.equal(names(matcher, '/b'), 'b');
    assert.equal(names(matcher, '/base'), 'base');
  });

  it('allows the same names after unmounting', () => {
    const matcher = routerFor();
    const unmount = matcher.mount([{ name: 'a', path: '/a' }]);
    unmount();
    const remount = matcher.mount([{ name: 'a', path: '/a2' }]);
    assert.equal(names(matcher, '/a2'), 'a');
    remount();
    unmount();
    assert.equal(matcher.hasRoute('a'), false);
  });

  it('a stale unmount cannot remove a later mount of the same routes', () => {
    const matcher = routerFor();
    const routes = [{ name: 'a', path: '/a' }];
    const first = matcher.mount(routes);
    first();
    matcher.mount(routes);
    first();
    assert.equal(names(matcher, '/a'), 'a');
  });

  it('invalidates mounted redirect routes and their parameter names', () => {
    const matcher = routerFor();
    const unmount = matcher.mount([{ name: 'old', path: '/old/:id', redirect: () => ({ name: 'current' }) }]);
    assert.deepEqual(matcher.getParamNames('old'), ['id']);
    assert.equal(names(matcher, '/old/1'), 'old');
    unmount();
    assert.equal(matcher.hasRoute('old'), false);
    assert.equal(matcher.match('/old/1'), null);
    assert.throws(() => matcher.getParamNames('old'), /Unknown route/);
  });

  it('deactivates mounts under a parent that was unmounted and restores them with it', () => {
    const matcher = routerFor();
    const unmountParent = matcher.mount([{ name: 'outer', path: '/outer' }]);
    matcher.mount([{ name: 'inner', path: 'inner' }], { parent: 'outer' });
    unmountParent();
    assert.equal(matcher.hasRoute('inner'), false);
    assert.equal(matcher.match('/outer/inner'), null);
    matcher.mount([{ name: 'outer', path: '/outer' }]);
    assert.equal(names(matcher, '/outer/inner'), 'inner');
  });
});

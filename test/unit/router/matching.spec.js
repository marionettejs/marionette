import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';

import { createRouter } from './helpers.js';

const routerFor = (routes = []) => createRouter({ routes });

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
              aliases: [{ path: '/:workspace/patient/dashboard/:patientId', until: '2027-09-02' }],
            },
            {
              name: 'patient:workflow:closed',
              path: 'workflow/closed',
              aliases: [{ path: '/:workspace/patient/archive/:patientId', until: '2027-09-02', policy: 'preserve' }],
            },
            { name: 'patient:flow', path: 'flow/:flowId' },
            { name: 'patient:flow:action', path: 'flow/:flowId/action/:actionId' },
            { name: 'patient:form', path: 'form/:formId{/:responseId}?' },
          ],
        },
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

describe('Router matching: aliases', () => {
  it('returns the canonical name and params with the alias path and policy', () => {
    const matcher = routerFor(inventory());
    const result = matcher.match('/w/patient/dashboard/p1');
    assert.equal(result.name, 'patient:workflow');
    assert.deepEqual(result.params, { workspace: 'w', patientId: 'p1' });
    assert.equal(result.alias, '/:workspace/patient/dashboard/:patientId');
    assert.equal(matcher.getAliases().find(alias => alias.path === result.alias).policy, 'canonicalize');
    assert.deepEqual(result.meta, { scope: 'workspace', area: 'patients', page: 'workflow' });
    assert.equal(result.branch.at(-1).name, 'patient:workflow');
  });

  it('reports canonical matches with alias null', () => {
    const matcher = routerFor(inventory());
    const result = matcher.match('/w/patient/p1/workflow');
    assert.equal(result.alias, null);
  });

  it('honors a preserve policy', () => {
    const matcher = routerFor(inventory());
    const result = matcher.match('/w/patient/archive/p1');
    assert.equal(result.name, 'patient:workflow:closed');
    assert.equal(matcher.getAliases().find(alias => alias.path === result.alias).policy, 'preserve');
  });

  it('lists every alias with name, path, until and policy', () => {
    const matcher = routerFor(inventory());
    assert.deepEqual(matcher.getAliases(), [
      { name: 'patient:workflow', path: '/:workspace/patient/dashboard/:patientId', until: '2027-09-02', policy: 'canonicalize' },
      { name: 'patient:workflow:closed', path: '/:workspace/patient/archive/:patientId', until: '2027-09-02', policy: 'preserve' },
    ]);
  });

  it('builds canonical URLs, never alias URLs', () => {
    const matcher = routerFor(inventory());
    assert.equal(matcher.url('patient:workflow', { workspace: 'w', patientId: 'p1' }), '/w/patient/p1/workflow');
  });

  it('accepts alias params declared in any order', () => {
    const matcher = routerFor([{
      name: 'two',
      path: '/:a/:b',
      aliases: [{ path: '/old/:b/:a' }],
    }]);
    assert.deepEqual(matcher.match('/old/B/A').params, { a: 'A', b: 'B' });
    assert.deepEqual(Object.keys(matcher.match('/old/B/A').params), ['a', 'b']);
  });

  it('ranks alias patterns like any other route', () => {
    const matcher = routerFor([
      { name: 'canonical', path: '/:a/:b', aliases: [{ path: '/old/:a/:b' }] },
      { name: 'other', path: '/old/new/:c' },
    ]);
    assert.equal(names(matcher, '/old/new/z'), 'other');
    assert.equal(matcher.match('/old/a/b').alias, '/old/:a/:b');
  });

  it('rejects an alias with missing, extra or renamed params', () => {
    const base = { name: 'r', path: '/r/:id' };
    for (const path of ['/old', '/old/:id/:extra', '/old/:other']) {
      assert.throws(() => routerFor([{ ...base, aliases: [{ path }] }]), /must declare exactly the params: id/);
    }
  });

  it('rejects a relative alias path, an unknown policy and aliases on unnamed nodes', () => {
    assert.throws(() => routerFor([{ name: 'r', path: '/r', aliases: [{ path: 'old' }] }]), /absolute path/);
    assert.throws(() => routerFor([{ name: 'r', path: '/r', aliases: [{ path: '/o', policy: 'x' }] }]), /unknown policy "x"/);
    assert.throws(() => routerFor([{ path: '/r', aliases: [{ path: '/o' }] }]), /Aliases require a named route/);
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
    ['canonical URL of an aliased route', 'patient:workflow', { workspace: 'w', patientId: 'p1' }],
    ['canonical URL of a preserved alias route', 'patient:workflow:closed', { workspace: 'w', patientId: 'p1' }],
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
      assert.equal(result.alias, null);
    });
  }

  it('keeps the query out of the match', () => {
    const matcher = routerFor(roundTripRoutes());
    const params = { workspace: 'w', worklistId: 'owned-by' };

    const result = matcher.match(matcher.url('worklist', params, { query: { clinicianId: 'c1' } }));

    assert.deepEqual(result.params, params);
    assert.equal(result.query.get('clinicianId'), 'c1');
  });

  it('matches an alias URL to the canonical name and params', () => {
    const matcher = routerFor(roundTripRoutes());
    const params = { workspace: 'w', patientId: 'p 1' };

    const result = matcher.match('/w/patient/dashboard/p%201');

    assert.equal(result.name, 'patient:workflow');
    assert.deepEqual(result.params, params);
    assert.equal(result.alias, '/:workspace/patient/dashboard/:patientId');
    assert.equal(matcher.url(result.name, result.params), '/w/patient/p%201/workflow');
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

    assert.throws(() => matcher.url('any', { workspace: 'w', value: '.' }), /"\."/);
    assert.throws(() => matcher.url('any', { workspace: 'w', value: '..' }), /"\.\."/);
    assert.throws(() => matcher.url('any', { workspace: '..', value: 'x' }), /"\.\."/);
    assert.throws(() => matcher.url('files', { workspace: 'w', path: '..' }), /"\.\."/);
    assert.throws(() => matcher.url('files', { workspace: 'w', path: '.' }), /"\."/);
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
    assert.throws(() => routerFor([{ name: 'a', path: '/a/:' }]), /Expected a parameter name/);
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

describe('Router matching: mount', () => {
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

  it('invalidates compiled state, including aliases and param names', () => {
    const matcher = routerFor();
    assert.deepEqual(matcher.getAliases(), []);
    const unmount = matcher.mount([{ name: 'a', path: '/a/:id', aliases: [{ path: '/old/:id', until: '2030-01-01' }] }]);
    assert.equal(matcher.getAliases().length, 1);
    assert.equal(names(matcher, '/old/1'), 'a');
    unmount();
    assert.deepEqual(matcher.getAliases(), []);
    assert.equal(matcher.match('/old/1'), null);
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

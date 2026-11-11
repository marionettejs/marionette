import assert from 'node:assert/strict';

export function catalog(size) {
  return Object.fromEntries(Array.from({ length: size }, (_, index) => [`r${index}`, {
    path: index % 2 ? `/r${index}/:id` : `/r${index}/static`,
  }]));
}

export async function workloads({ Router, memoryDriver, ChildAppSwitcher, Application }) {
  const cases = [];
  for (const size of [10, 100, 1000]) {
    const targets = Array.from({ length: size }, (_, index) => ({ name: `r${index}`,
      params: index % 2 ? { id: '42' } : {}, path: index % 2 ? `/r${index}/42` : `/r${index}/static` }));
    for (const operation of ['match', 'url', 'memory-navigate']) {
      let handled = 0;
      const router = new Router({ driver: memoryDriver({ url: 'https://benchmark.example/r0/static' }),
        routes: catalog(size), handler() { handled++; } });
      await router.start();
      assert.equal((await router.getInitialDispatch()).status, 'matched');
      for (const target of targets) {
        assert.equal(router.url(target.name, target.params), target.path);
        assert.equal(router.match(target.path).name, target.name);
      }
      const iterations = operation === 'memory-navigate' ? { 10: 200, 100: 100, 1000: 40 }[size] :
        { 10: 3000, 100: 1000, 1000: 200 }[size];
      let cursor = 0;
      let correct = 0;
      let expected = handled;
      cases.push({ id: `${operation}/${size}`, iterations, unit: 'microseconds/operation',
        async run(count) {
          for (let index = 0; index < count; index++) {
            const target = targets[(cursor++ * 37) % size];
            if (operation === 'match') {
              correct += router.match(target.path)?.name === target.name;
            } else if (operation === 'url') {
              correct += router.url(target.name, target.params) === target.path;
            } else {
              correct += await router.navigate(target.name, target.params,
                { history: 'replace', focusReset: 'manual', scroll: 'manual' }).finished === true;
            }
          }
        },
        verify(count) {
          assert.equal(correct, count); correct = 0;
          if (operation === 'memory-navigate') {
            expected += count;
            assert.equal(handled, expected);
            assert.equal(router.getCurrent().name, targets[((cursor - 1) * 37) % size].name);
          }
        },
        close() { router.destroy(); },
      });
    }
  }
  const keys = {
    scalar: () => '42',
    'flat-fresh': () => ({ id: '42', mode: 'read' }),
    'nested-fresh': () => ({ resource: { type: 'item', id: '42' }, tab: ['details', 1] }),
    'stress-100-fields': (() => {
      const key = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`field${index}`, index]));
      return () => key;
    })(),
  };
  for (const [name, key] of Object.entries(keys)) {
    let starts = 0;
    const pages = new ChildAppSwitcher();
    const page = pages.addChildApp('page', new (Application.extend({ onStart() { starts++; } }))());
    await pages.start();
    assert.equal(await pages.switchTo('page', { key: key() }), page);
    let correct = 0;
    cases.push({ id: `selection-reuse/${name}`, iterations: name.startsWith('stress') ? 200 : 1000,
      unit: 'microseconds/selection',
      async run(count) {
        for (let index = 0; index < count; index++) { correct += await pages.switchTo('page', { key: key() }) === page; }
      },
      verify(count) { assert.equal(correct, count); correct = 0; assert.equal(starts, 1); assert.equal(page.isRunning(), true); },
      close() { pages.destroy(); },
    });
  }
  for (const pending of [false, true]) {
    let starts = 0;
    let preparations = 0;
    let received;
    const pages = new ChildAppSwitcher();
    const page = pages.addChildApp('page', new (Application.extend({
      prepareStart(options) { preparations++; received = options.id; return options.gate; },
      onStart() { starts++; },
    }))());
    await pages.start();
    let cursor = 0;
    let correct = 0;
    let expected = 0;
    cases.push({ id: pending ? 'selection-pending/same-key-pair' : 'selection-changed/flat-fresh',
      iterations: pending ? 100 : 1000, unit: pending ? 'microseconds/join-pair' : 'microseconds/selection',
      async run(count) {
        for (let index = 0; index < count; index++) {
          const id = String(cursor++ % 2);
          if (pending) {
            const gate = Promise.withResolvers();
            const first = pages.switchTo('page', { key: { id, mode: 'read' }, options: { id, gate: gate.promise } });
            const second = pages.switchTo('page', { key: { id, mode: 'read' }, options: { id: 'ignored' } });
            gate.resolve();
            const result = await Promise.all([first, second]);
            correct += result[0] === undefined && result[1] === page && received === id;
          } else {
            correct += await pages.switchTo('page', { key: { id, mode: 'read' }, options: { id } }) === page && received === id;
          }
        }
      },
      verify(count) {
        assert.equal(correct, count); correct = 0; expected += count;
        assert.equal(starts, expected); assert.equal(preparations, expected); assert.equal(pages.getCurrent(), page);
      },
      close() { pages.destroy(); },
    });
  }
  return cases;
}

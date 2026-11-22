import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@mnjs/formkit';

const owners = [];
function create(fields, values, options = {}) {
  const host = document.createElement('main'); document.body.append(host);
  const api = mount({ host, fields, values, formProps: { actions: false }, ...options });
  owners.push(api); return { api, host };
}
afterEach(() => {
  owners.splice(0).reverse().forEach(api => api.destroy());
  document.body.replaceChildren(); vi.useRealTimers();
});

describe('captured field commits and pending-edit fence', () => {
  it('captures same-leaf values before later writes and delivers in commit order', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' });
    const facts = [];
    const dispose = api.observeFieldCommits(fact => facts.push(fact));
    const node = api.node.at('answer');
    node.input('one', false); node.input('two', false);
    expect(facts).toEqual([]);
    await api.whenPendingEditsSettled();
    expect(facts.map(({ value, previous, path, source, changed }) => ({ value, previous, path, source, changed }))).toEqual([
      { value: 'one', previous: 'Start', path: ['answer'], source: 'unknown', changed: true },
      { value: 'two', previous: 'one', path: ['answer'], source: 'unknown', changed: true }
    ]);
    expect(facts[0].node).toBe(node); expect(facts[1].generation).toBe(facts[0].generation);
    expect(Object.isFrozen(facts[0])).toBe(true); expect(Object.isFrozen(facts[0].path)).toBe(true);
    dispose(); dispose();
    node.input('late', false); await api.whenPendingEditsSettled(); expect(facts).toHaveLength(2);
  });

  it('preserves nested delivered order without changing whole-form notifications', async() => {
    const { api } = create([{ name: 'box', type: 'group', children: [{ name: 'a' }, { name: 'b' }] }], { box: { a: '0', b: '0' } });
    const facts = [], whole = [];
    api.observeFieldCommits(fact => facts.push(fact));
    api.form.on('form:change', values => whole.push(structuredClone(values)));
    api.node.at('box.b').input('2'); api.node.at('box.a').input('1');
    await api.whenPendingEditsSettled();
    expect(facts.map(fact => [fact.path, fact.value])).toEqual([[['box', 'b'], '2'], [['box', 'a'], '1']]);
    expect(whole).toEqual([{ box: { a: '1', b: '2' } }]);
  });

  it.each(['group', 'list'])('waits for pending %s children before the caller applies an incoming patch', async type => {
    vi.useFakeTimers();
    const children = ['a', 'b'].map(name => ({ ...(type === 'group' ? { name } : {}), key: name, config: { delay: 20 } }));
    const local = type === 'group' ? { a: '0', b: '0' } : ['0', '0'];
    const remote = { box: type === 'group' ? { a: 'remote-a', b: 'remote-b' } : ['remote-a', 'remote-b'] };
    const { api } = create([{ name: 'box', type, children }], { box: local });
    const nodes = children.map((child, index) => api.node.at('box.' + (type === 'group' ? child.name : index)));
    nodes[1].input('local-b'); nodes[0].input('local-a');
    let done = false;
    const pending = api.whenPendingEditsSettled().then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(Math.max(...nodes.map(node => node.props.delay)));
    await pending;
    const changes = []; api.form.on('form:change', value => changes.push(value));
    api.setValues(remote, { notify: false }); const incomingFence = api.whenPendingEditsSettled();
    await vi.advanceTimersByTimeAsync(Math.max(...nodes.map(node => node.props.delay))); await incomingFence;
    expect(api.getValues()).toEqual(remote); expect(changes).toEqual([]);
    expect(nodes.every((node, index) => api.node.at('box.' + (type === 'group' ? children[index].name : index)) === node)).toBe(true);
  });

  it('waits for children even after a root patch reports settlement, without replaying that patch', async() => {
    vi.useFakeTimers();
    const { api } = create([{ name: 'box', type: 'group', children: [{ name: 'a', config: { delay: 20 } }, { name: 'b', config: { delay: 20 } }] }], { box: { a: '0', b: '0' } });
    api.node.at('box.a').input('local-a'); api.node.at('box.b').input('local-b');
    api.setValues({ box: { a: 'remote-a', b: 'remote-b' } }, { notify: false });
    expect(api.node.isSettled).toBe(true);
    let done = false; const pending = api.whenPendingEditsSettled().then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20); await pending;
    expect(api.getValues()).toEqual({ box: { a: 'local-a', b: 'local-b' } });
  });
});

describe('field commit ownership, data and conservative provenance', () => {
  it('has no synthetic initial fact and reports an actual no-op commit', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(function(fact) { expect(this).toBeUndefined(); facts.push(fact); });
    await api.whenPendingEditsSettled(); expect(facts).toEqual([]);
    api.node.at('answer').input('Start', false); await api.whenPendingEditsSettled();
    expect(facts.map(fact => [fact.previous, fact.value, fact.changed])).toEqual([['Start', 'Start', false]]);
  });

  it('captures an already pending commit after registration without replaying initial state', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' });
    api.node.at('answer').input('Pending'); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    expect(facts).toEqual([]); await api.whenPendingEditsSettled();
    expect(facts.map(fact => [fact.previous, fact.value])).toEqual([['Start', 'Pending']]);
  });

  it('separates facade/reset sources from unknown Core origins without changing notify:false', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact));
    api.node.at('answer').input('Core', false); await api.whenPendingEditsSettled();
    const whole = vi.fn(); api.form.on('form:change', whole);
    api.setValues({ answer: 'External' }, { source: 'user', notify: false }); await api.whenPendingEditsSettled();
    expect(whole).not.toHaveBeenCalled();
    const count = facts.length; api.setValues({ answer: 'External' }, { notify: false }); await api.whenPendingEditsSettled();
    expect(facts).toHaveLength(count);
    api.reset(); await api.whenPendingEditsSettled();
    expect(facts.filter(fact => fact.changed).map(fact => [fact.value, fact.source])).toEqual([['Core', 'unknown'], ['External', 'programmatic'], ['Start', 'reset']]);
    expect(whole.mock.calls[0][2]).toEqual({ source: 'reset' });
  });

  it('excludes aggregates, ignored inputs and unrelated Core nodes', async() => {
    let ignored;
    const { api } = create([{ name: 'answer' }, { name: 'ignored', ignore: true, onNode(node) { ignored = node; } }], { answer: 'Start' });
    const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    ignored.input('Ignored', false); api.node.at('answer').input('Kept', false); await api.whenPendingEditsSettled();
    expect(facts.map(fact => [fact.path, fact.value])).toEqual([[['answer'], 'Kept']]);
    expect(facts.every(fact => fact.node.type === 'input' && fact.node.parent === api.node)).toBe(true);
  });

  it('detaches nested data and isolates mutable built-ins between subscribers', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const received = [];
    api.observeFieldCommits(fact => {
      expect(() => { fact.value.nested.value = 99; }).toThrow();
      fact.value.date.setUTCFullYear(1999);
    });
    api.observeFieldCommits(fact => received.push(fact));
    const input = { nested: { value: 1 }, date: new Date('2024-01-01T00:00:00Z') };
    api.node.at('answer').input(input, false); input.nested.value = 2; input.date.setUTCFullYear(2025);
    await api.whenPendingEditsSettled();
    expect(received[0].value.nested.value).toBe(1); expect(received[0].value.date.getUTCFullYear()).toBe(2024);
    expect(api.node.at('answer').value.nested.value).toBe(2); expect(api.node.at('answer').value.date.getUTCFullYear()).toBe(2025);
  });

  it.each(['map', 'set', 'bytes'])('captures detached %s data', async kind => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    const value = kind === 'map' ? new Map([['a', { value: 1 }]]) : kind === 'set' ? new Set([{ value: 1 }]) : new Uint8Array([1]);
    api.node.at('answer').input(value, false);
    if (kind === 'map') { value.get('a').value = 2; } else if (kind === 'set') { [...value][0].value = 2; } else { value[0] = 2; }
    await api.whenPendingEditsSettled(); const captured = facts[0].value;
    expect(kind === 'map' ? captured.get('a').value : kind === 'set' ? [...captured][0].value : captured[0]).toBe(1);
  });

  it('keeps File data handles intact and rejects unsupported callable captures without changing Core', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = [];
    const stop = api.observeFieldCommits(fact => facts.push(fact)); const file = new File(['data'], 'answer.txt', { type: 'text/plain' });
    api.node.at('answer').input({ files: [file] }, false); await api.whenPendingEditsSettled();
    expect(facts[0].value.files[0]).toBe(file); expect(facts[0].value.files[0].name).toBe('answer.txt'); stop();
    const callable = () => 'opaque'; api.node.at('answer').input(callable, false);
    expect(() => api.observeFieldCommits(() => {})).toThrow(TypeError);
    expect(api.node.at('answer').value).toBe(callable); await api.whenPendingEditsSettled();
  });

  it('supports disposal of another observer during delivery', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const first = [], second = []; let stopSecond;
    api.observeFieldCommits(fact => { first.push(fact.value); stopSecond(); });
    stopSecond = api.observeFieldCommits(fact => second.push(fact.value));
    api.node.at('answer').input('one', false); api.node.at('answer').input('two', false); await api.whenPendingEditsSettled();
    expect(first).toEqual(['one', 'two']); expect(second).toEqual([]);
  });

  it('drains synchronous reentrant commits before fulfilling the fence', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(fact => { facts.push([fact.value, fact.source]); if (fact.value === 'one') { api.setValues({ answer: 'feedback' }, { notify: false }); } });
    api.node.at('answer').input('one', false); api.node.at('answer').input('two', false); await api.whenPendingEditsSettled();
    expect(facts).toEqual([['one', 'unknown'], ['two', 'unknown'], ['feedback', 'programmatic']]);
  });

  it('retires replaced generations and cancels their queued facts', async() => {
    const { api } = create([{ name: 'answer', key: 'old' }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact)); const old = api.node.at('answer'); old.input('first', false); await api.whenPendingEditsSettled();
    const generation = facts[0].generation; old.input('canceled', false); api.setFields([{ name: 'answer', key: 'new' }]); await api.whenPendingEditsSettled();
    const next = api.node.at('answer'); next.input('next', false); await api.whenPendingEditsSettled();
    expect(facts.some(fact => fact.value === 'canceled')).toBe(false);
    expect(facts.at(-1).node).toBe(next); expect(next).not.toBe(old); expect(facts.at(-1).generation).not.toBe(generation);
  });

  it('captures list paths at commit while retaining a moved Core owner and generation', async() => {
    const { api } = create([{ name: 'rows', type: 'list', children: [{ key: 'a' }, { key: 'b' }] }], { rows: ['A', 'B'] }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact)); const node = api.node.at('rows.0'); const other = api.node.at('rows.1');
    node.input('edited', false); node.index = 1; await api.whenPendingEditsSettled();
    expect(facts[0].path).toEqual(['rows', 0]); expect(facts[0].node).toBe(node);
    node.input('next', false); await api.whenPendingEditsSettled();
    expect(facts.at(-1).path).toEqual(['rows', 1]); expect(facts.at(-1).generation).toBe(facts[0].generation);
    expect(api.node.at('rows.0')).toBe(other); expect(api.getValues()).toEqual({ rows: ['B', 'next'] });
  });

  it('does not close a pending fence on an equal-value raw commit alone', async() => {
    vi.useFakeTimers(); const { api } = create([{ name: 'answer', config: { delay: 20 } }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact)); const node = api.node.at('answer'); node.input('pending'); node.input('Start', false);
    let done = false; const waiting = api.whenPendingEditsSettled().then(() => { done = true; });
    await Promise.resolve(); await Promise.resolve(); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20); await waiting;
    expect(facts).toHaveLength(2); expect(facts.every(fact => !fact.changed && fact.value === 'Start')).toBe(true);
  });

  it('cancels queued facts and rejects pending fences on form destruction', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact)); api.node.at('answer').input('Queued', false);
    const waiting = api.whenPendingEditsSettled(); const outcome = waiting.then(() => ({ resolved: true }), error => ({ resolved: false, error })); api.destroy();
    const result = await outcome; expect(result.resolved).toBe(false); expect(result.error.name).toBe('AbortError');
    await Promise.resolve(); expect(facts).toEqual([]);
    await expect(api.whenPendingEditsSettled()).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('supports AbortSignal reasons and releases fence-only receipts', async() => {
    vi.useFakeTimers(); const { api } = create([{ name: 'answer', config: { delay: 20 } }], { answer: 'Start' }, { instrument: true });
    api.node.at('answer').input('Pending'); const controller = new AbortController(); const reason = new Error('caller canceled');
    const pending = api.whenPendingEditsSettled({ signal: controller.signal }); const outcome = pending.then(() => ({ resolved: true }), error => ({ resolved: false, error })); controller.abort(reason);
    const result = await outcome; expect(result.resolved).toBe(false); expect(result.error).toBe(reason);
    expect(api.metrics.fieldCommitReceipts).toBe(0); expect(api.metrics.fieldCommitSnapshots).toBe(0);
    await vi.advanceTimersByTimeAsync(20);
  });

  it('does no opt-in observation work by default and no snapshots for a fence-only wait', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }, { instrument: true }); api.node.at('answer').input('Core', false); await api.node.settled;
    expect(Object.hasOwn(api.metrics, 'fieldCommitSnapshots')).toBe(false);
    await api.whenPendingEditsSettled(); expect(api.metrics.fieldCommitSnapshots).toBe(0); expect(api.metrics.fieldCommitReceipts).toBe(0);
    const stop = api.observeFieldCommits(() => {}); expect(api.metrics.fieldCommitSnapshots).toBeGreaterThan(0); stop();
    expect(api.metrics.fieldCommitReceipts).toBe(0);
  });

  it('does not wait for asynchronous validation', async() => {
    let began; const started = new Promise(resolve => { began = resolve; }); const resolvers = [];
    const { api } = create([{ name: 'answer', validation: 'eventual' }], { answer: 'Ready' }, { rules: { eventual: () => new Promise(resolve => { resolvers.push(resolve); began(); }) } });
    await started; await api.whenPendingEditsSettled(); expect(api.node.isSettled).toBe(true); expect(resolvers.length).toBeGreaterThan(0); expect(api.getFormState().valid).toBe(false);
    resolvers.forEach(resolve => resolve(true));
  });

  it('keeps synthetic DOM edits and direct Core writes from another DOM handler unknown', async() => {
    const { api, host } = create([{ name: 'answer' }], { answer: 'Start' }); const facts = []; api.observeFieldCommits(fact => facts.push(fact));
    const input = host.querySelector('input'); input.value = 'DOM'; input.dispatchEvent(new Event('input', { bubbles: true })); await api.whenPendingEditsSettled();
    const custom = document.createElement('input'); api.form.el.append(custom);
    custom.addEventListener('input', () => api.node.at('answer').input('Direct', false)); custom.dispatchEvent(new Event('input', { bubbles: true })); await api.whenPendingEditsSettled();
    expect(facts.map(fact => [fact.value, fact.source])).toEqual([['DOM', 'unknown'], ['Direct', 'unknown']]);
  });

  it.each(['checkbox', 'radio'])('keeps the untrusted SVG-label %s activation unknown without mocking event trust', async type => {
    const spec = { name: 'answer', type, label: 'Choice', ...(type === 'radio' ? { options: ['A', 'B'] } : {}) };
    const { api, host } = create([spec], { answer: type === 'radio' ? 'B' : false }); const facts = [];
    api.observeFieldCommits(fact => facts.push(fact)); const core = [];
    const node = api.node.at('answer'); const receipt = node.on('commitRaw', event => core.push(event.payload));
    const label = host.querySelector('.formkit-label'); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const nested = document.createElementNS('http://www.w3.org/2000/svg', 'label'); const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Activate'; nested.append(text); svg.append(nested); label.append(svg);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true }); expect(event.isTrusted).toBe(false); text.dispatchEvent(event);
    await api.whenPendingEditsSettled(); expect(facts.length).toBeGreaterThan(0); expect(facts).toHaveLength(core.length);
    expect(facts.every(fact => fact.source === 'unknown' && fact.node === node)).toBe(true); node.off(receipt);
  });
});

describe('reentrant topology preserves surviving observation', () => {
  it('retires one field inside delivery while continuing its surviving sibling', async() => {
    const { api } = create([{ name: 'a' }, { name: 'b' }], { a: '0', b: '0' }); const facts = []; const survivor = api.node.at('b');
    api.observeFieldCommits(fact => { facts.push([fact.path, fact.value]); if (fact.path[0] === 'a') { api.setFields([{ name: 'b' }]); } });
    api.node.at('a').input('A', false); survivor.input('B', false); await api.whenPendingEditsSettled();
    expect(facts).toEqual([[['a'], 'A'], [['b'], 'B']]); expect(api.node.at('b')).toBe(survivor);
    survivor.input('next', false); await api.whenPendingEditsSettled(); expect(facts.at(-1)).toEqual([['b'], 'next']);
  });

  it('does not retire a new attachment when an earlier removal listener reattaches the same Core node', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const node = api.node.at('answer'); const facts = [];
    const receipt = api.node.on('childRemoved', event => { if (event.payload === node) { api.node.add(node); } });
    api.observeFieldCommits(fact => facts.push(fact)); node.input('first', false); await api.whenPendingEditsSettled(); const old = facts[0].generation;
    node.input('canceled', false); api.node.remove(node); await api.whenPendingEditsSettled();
    expect(facts.some(fact => fact.value === 'canceled' && fact.generation === old)).toBe(false);
    node.input('live', false); await api.whenPendingEditsSettled();
    expect(facts.at(-1).node).toBe(node); expect(facts.at(-1).value).toBe('live'); expect(facts.at(-1).generation).not.toBe(old);
    api.node.off(receipt);
  });
});

describe('pending fence cancellation values', () => {
  it.each([null, 0, 'cancel'])('preserves an explicit AbortSignal reason %s', async reason => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const controller = new AbortController();
    const pending = api.whenPendingEditsSettled({ signal: controller.signal }); const outcome = pending.then(() => ({ resolved: true }), error => ({ resolved: false, error }));
    controller.abort(reason); const result = await outcome; expect(result.resolved).toBe(false); expect(result.error).toBe(reason);
  });

  it('preserves the original abort reason if signal-listener cleanup also throws', async() => {
    const { api } = create([{ name: 'answer' }], { answer: 'Start' }); const controller = new AbortController(); const reason = new Error('primary'); const secondary = new Error('cleanup');
    const original = controller.signal.removeEventListener; controller.signal.removeEventListener = () => { throw secondary; };
    const pending = api.whenPendingEditsSettled({ signal: controller.signal }); const outcome = pending.then(() => ({ resolved: true }), error => ({ resolved: false, error }));
    controller.abort(reason); const result = await outcome; controller.signal.removeEventListener = original;
    expect(result.resolved).toBe(false); expect(result.error).toBe(reason);
  });
});

describe('public group settlement and retirement boundaries', () => {
  it('waits for pending leaves after public group.input(snapshot, false)', async() => {
    vi.useFakeTimers(); const { api } = create([{ name: 'box', type: 'group', children: [{ name: 'a', config: { delay: 10 } }, { name: 'b', config: { delay: 20 } }] }], { box: { a: '0', b: '0' } });
    const group = api.node.at('box'); const a = api.node.at('box.a'); const b = api.node.at('box.b');
    a.input('local-a'); b.input('local-b'); const exactGroupPromise = group.settled;
    group.input({ a: 'remote-a', b: 'remote-b' }, false);
    let done = false; const fence = api.whenPendingEditsSettled().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(10); await exactGroupPromise; expect(group.isSettled).toBe(true); expect(b.isSettled).toBe(false); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(10); await fence; expect(api.getValues()).toEqual({ box: { a: 'local-a', b: 'local-b' } });
    group.input({ a: 'remote-a', b: 'remote-b' }, false); const incomingFence = api.whenPendingEditsSettled();
    await vi.advanceTimersByTimeAsync(20); await incomingFence;
    expect(api.getValues()).toEqual({ box: { a: 'remote-a', b: 'remote-b' } }); expect(api.node.at('box.a')).toBe(a); expect(api.node.at('box.b')).toBe(b);
  });

  it('releases a fence when pending leaves then their group are removed', async() => {
    vi.useFakeTimers(); const { api } = create([{ name: 'box', type: 'group', children: [{ name: 'a', config: { delay: 20 } }, { name: 'b', config: { delay: 20 } }] }], { box: { a: '0', b: '0' } });
    const facts = []; api.observeFieldCommits(fact => facts.push(fact)); const group = api.node.at('box');
    api.node.at('box.a').input('local-a'); api.node.at('box.b').input('local-b'); const exactGroupPromise = group.settled;
    const fence = api.whenPendingEditsSettled(); api.setFields([]); await vi.advanceTimersByTimeAsync(20); await fence;
    expect(api.getValues()).toEqual({}); expect(facts).toEqual([]);
    await vi.advanceTimersByTimeAsync(20); await exactGroupPromise;
    expect(facts).toEqual([]); expect(api.getValues()).toEqual({});
  });
});

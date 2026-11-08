import { tick, deferred } from './setup.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
const { html, render, nothing } = await import('@mnjs/html');
const { AsyncDirective, directive } = await import('@mnjs/html/async-directive');
const { until } = await import('@mnjs/html/directives/until.js');
const { asyncReplace } = await import('@mnjs/html/directives/async-replace.js');
const { asyncAppend } = await import('@mnjs/html/directives/async-append.js');
const { default: HtmlDomApi } = await import('@mnjs/html/marionette');
const { createMarionette } = await import('marionette');
const cleanup = [];
afterEach(() => { for (const fn of cleanup.splice(0).reverse())
    fn(); document.body.replaceChildren(); });
function fixture() { const el = document.createElement('div'); document.body.append(el); return el; }
function tracker() {
    const state = { active: 0, connected: 0, disconnected: 0, instances: 0 };
    class Subscription extends AsyncDirective {
        active = false;
        constructor(part) { super(part); state.instances++; }
        connect() { if (!this.active) {
            this.active = true;
            state.active++;
            state.connected++;
        } }
        render(value = 'sub') { if (this.isConnected)
            this.connect(); return value; }
        disconnected() { if (this.active) {
            this.active = false;
            state.active--;
            state.disconnected++;
        } }
        reconnected() { this.connect(); }
    }
    return { state, sub: directive(Subscription) };
}
function runtime() { const mn = createMarionette(); mn.setDomApi(HtmlDomApi); return mn; }
test('RootPart disconnect/reconnect is idempotent and removal releases subscriptions', () => {
    const el = fixture();
    const { state, sub } = tracker();
    const part = render(html `<p>${sub()}</p>`, el, { isConnected: false });
    assert.equal(state.active, 0);
    part.setConnected(true);
    part.setConnected(true);
    assert.equal(state.active, 1);
    part.setConnected(false);
    part.setConnected(false);
    assert.equal(state.active, 0);
    part.setConnected(true);
    assert.equal(state.active, 1);
    render(nothing, el);
    assert.equal(state.active, 0);
    assert.equal(state.connected, 2);
    assert.equal(state.disconnected, 2);
});
test('adapter first render replaces existing markup and retains stable elements', () => {
    const el = fixture();
    el.innerHTML = '<i>old</i>';
    const t = v => html `<p>${v}</p>`;
    HtmlDomApi.setContents(el, t(1));
    const p = el.querySelector('p');
    assert.equal(el.querySelector('i'), null);
    HtmlDomApi.setContents(el, t(2));
    assert.equal(el.querySelector('p'), p);
    assert.equal(el.textContent, '2');
});
test('unnotified connected DOM remains disconnected until adapter notification', () => {
    const el = fixture();
    const { state, sub } = tracker();
    HtmlDomApi.setContents(el, html `${sub()}`);
    assert.equal(state.active, 0);
    HtmlDomApi.notifyAttach(el);
    assert.equal(state.active, 1);
    HtmlDomApi.notifyDetach(el);
    assert.equal(state.active, 0);
});
test('attachment before first content render is remembered', () => {
    const el = fixture();
    const { state, sub } = tracker();
    HtmlDomApi.notifyAttach(el);
    HtmlDomApi.setContents(el, html `${sub()}`);
    assert.equal(state.active, 1);
    HtmlDomApi.notifyDetach(el);
    assert.equal(state.active, 0);
});
test('Marionette events and triggers work through repeated template updates', () => {
    const mn = runtime();
    const el = fixture();
    const region = new mn.Region({ el });
    cleanup.push(() => region.destroy());
    let clicks = 0, triggers = 0, label = 'first';
    const V = mn.View.extend({ template: () => html `<button class="go">${label}</button><button class="trigger">trigger</button>`, ui: { go: '.go' }, events: { 'click @ui.go'() { clicks++; } }, triggers: { 'click .trigger': 'chosen' } });
    const view = new V();
    view.on('chosen', () => triggers++);
    region.show(view);
    const button = view.el.querySelector('.go');
    button.click();
    label = 'second';
    view.render();
    assert.equal(view.el.querySelector('.go'), button);
    button.click();
    view.el.querySelector('.trigger').click();
    assert.equal(clicks, 2);
    assert.equal(triggers, 1);
    assert.equal(button.textContent, 'second');
});
test('managed View attach/detach/re-show/destroy releases exactly one subscription', () => {
    const mn = runtime();
    const { state, sub } = tracker();
    const region = new mn.Region({ el: fixture() });
    cleanup.push(() => region.destroy());
    const view = new mn.View({ template: () => html `${sub()}` });
    view.render();
    assert.equal(state.active, 0);
    region.show(view);
    assert.equal(state.active, 1);
    assert.equal(region.detachView(), view);
    assert.equal(state.active, 0);
    region.show(view);
    assert.equal(state.active, 1);
    view.destroy();
    view.destroy();
    assert.equal(state.active, 0);
    assert.equal(state.instances, 1);
    assert.equal(state.connected, 2);
    assert.equal(state.disconnected, 2);
});
for (const mode of ['open', 'closed'])
    test(`adopted attached ${mode} shadow-root element starts connected`, () => {
        const mn = runtime();
        const { state, sub } = tracker();
        const host = fixture();
        const shadow = host.attachShadow({ mode });
        const el = document.createElement('div');
        shadow.append(el);
        const view = new mn.View({ el, template: () => html `${sub()}` });
        cleanup.push(() => view.destroy());
        view.render();
        assert.equal(state.active, 1);
        view.destroy();
        assert.equal(state.active, 0);
    });
test('CollectionView-owned root children survive an asynchronous template replacement', async () => {
    const mn = runtime();
    const pending = deferred();
    const region = new mn.Region({ el: fixture() });
    cleanup.push(() => region.destroy());
    const list = new mn.CollectionView({ template: () => until(pending.promise, html `<header>loading</header>`) });
    region.show(list);
    const child = new mn.View({ template: () => html `<strong>child</strong>` });
    list.addChildView(child);
    const childEl = child.el;
    pending.resolve(html `<header>ready</header>`);
    await tick();
    assert.equal(list.el.querySelector('header').textContent, 'ready');
    assert.equal(childEl.parentNode, list.el);
    assert.equal(child.isDestroyed(), false);
    assert.equal(list.el.querySelector('strong').textContent, 'child');
});
test('until ignores stale promises and pauses resolution while detached', async () => {
    const el = fixture();
    const old = deferred(), latest = deferred();
    const t = p => html `${until(p, 'loading')}`;
    const part = render(t(old.promise), el);
    render(t(latest.promise), el);
    old.resolve('stale');
    await tick();
    assert.equal(el.textContent, 'loading');
    part.setConnected(false);
    latest.resolve('fresh');
    await tick();
    assert.equal(el.textContent, 'loading');
    part.setConnected(true);
    await tick();
    assert.equal(el.textContent, 'fresh');
    render(nothing, el);
    part.setConnected(false);
});
for (const [name, use] of [['asyncReplace', asyncReplace], ['asyncAppend', asyncAppend]])
    test(`${name} yields values and pauses while disconnected`, async () => {
        const el = fixture();
        const next = deferred(), last = deferred();
        async function* values() { yield 'one'; yield await next.promise; yield await last.promise; }
        const part = render(html `${use(values())}`, el);
        await tick();
        assert.equal(el.textContent, 'one');
        part.setConnected(false);
        next.resolve('two');
        await tick();
        assert.equal(el.textContent, 'one');
        part.setConnected(true);
        await tick();
        assert.equal(el.textContent, name === 'asyncAppend' ? 'onetwo' : 'two');
        render(nothing, el);
        last.resolve('late');
        await tick();
        assert.equal(el.textContent, '');
        part.setConnected(false);
    });
// The first-class DOM API must keep failure ordering identical to the adapter.
test('first-render failure leaves created subscriptions available for detach', () => {
    const el = fixture();
    const { state, sub } = tracker();
    class Failure extends AsyncDirective {
        render() { throw new Error('user directive failure'); }
    }
    HtmlDomApi.notifyAttach(el);
    assert.throws(() => HtmlDomApi.setContents(el, html `${sub()}${directive(Failure)()}`), /user directive failure/);
    assert.equal(state.active, 1);
    HtmlDomApi.notifyDetach(el);
    assert.equal(state.active, 0);
    assert.equal(state.disconnected, 1);
});
test('named DOM methods are the exact methods supplied by the default API', async () => {
    const { setContents, notifyAttach, notifyDetach } = await import('@mnjs/html/marionette');
    assert.equal(setContents, HtmlDomApi.setContents);
    assert.equal(notifyAttach, HtmlDomApi.notifyAttach);
    assert.equal(notifyDetach, HtmlDomApi.notifyDetach);
});

test('cached subtrees disconnect resources and reconnect the same DOM', async () => {
    const {cache} = await import('@mnjs/html/directives/cache.js');
    const el = fixture();
    const first = tracker(), second = tracker();
    const a = () => html`<input>${first.sub('a')}`;
    const b = () => html`<b>${second.sub('b')}</b>`;
    const view = value => html`${cache(value)}`;
    render(view(a()), el);
    const input = el.querySelector('input');
    input.value = 'edited';
    assert.equal(first.state.active, 1);
    render(view(b()), el);
    assert.equal(first.state.active, 0);
    assert.equal(second.state.active, 1);
    render(view(a()), el);
    assert.equal(el.querySelector('input'), input);
    assert.equal(input.value, 'edited');
    assert.equal(first.state.active, 1);
    assert.equal(first.state.instances, 1);
    assert.equal(second.state.active, 0);
    render(nothing, el);
    assert.equal(first.state.active, 0);
});

test('keyed reordering keeps subscriptions; deleting a key releases only that key', async () => {
    const {repeat} = await import('@mnjs/html/directives/repeat.js');
    const el = fixture();
    const trackers = new Map(['a','b','c'].map(key => [key, tracker()]));
    const view = keys => html`${repeat(keys, key => key, key => html`<p>${trackers.get(key).sub(key)}</p>`)}`;
    render(view(['a','b','c']), el);
    const nodes = [...el.querySelectorAll('p')];
    render(view(['c','a','b']), el);
    assert.deepEqual([...el.querySelectorAll('p')], [nodes[2],nodes[0],nodes[1]]);
    for (const {state} of trackers.values()) assert.deepEqual(state, {active:1,connected:1,disconnected:0,instances:1});
    render(view(['c','a']), el);
    assert.equal(trackers.get('b').state.active, 0);
    assert.equal(trackers.get('b').state.disconnected, 1);
    assert.equal(trackers.get('a').state.disconnected, 0);
    assert.equal(trackers.get('c').state.disconnected, 0);
    render(nothing, el);
    for (const {state} of trackers.values()) assert.equal(state.active, 0);
});

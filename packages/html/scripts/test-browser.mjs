import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
const root = resolve('.');
const packedRoot = process.env.HTML_PACKED_ROOT && resolve(process.env.HTML_PACKED_ROOT);
const development = process.env.HTML_CONDITION === 'development';
const packedManifest = packedRoot && JSON.parse(await readFile(resolve(packedRoot, 'package.json'), 'utf8'));
const distributionRoot = packedRoot ?? root;
const imports = {
    '@mnjs/html': '/dist/index.js', '@mnjs/html/': '/dist/',
    '@mnjs/html/directive': '/dist/directive.js',
    '@mnjs/html/async-directive': '/dist/async-directive.js',
    '@mnjs/html/directive-helpers': '/dist/directive-helpers.js',
    '@mnjs/html/static': '/dist/static.js',
    '@mnjs/html/marionette': '/dist/marionette.js',
    'marionette': '/node_modules/marionette/dist/marionette.js',
    'lit-html': '/node_modules/lit-html/lit-html.js',
    'lit-html/': '/node_modules/lit-html/',
    '@mnjs/utils': '/node_modules/@mnjs/utils/dist/index.js',
    '@mnjs/radio': '/node_modules/@mnjs/radio/dist/index.js',
};
if (packedManifest) {
    for (const key of Object.keys(imports)) if (key.startsWith('@mnjs/html')) delete imports[key];
    for (const [key, conditions] of Object.entries(packedManifest.exports)) {
        if (key === './package.json') continue;
        const specifier = key === '.' ? '@mnjs/html' : `@mnjs/html/${key.slice(2)}`;
        imports[specifier] = '/package/' + conditions[development ? 'development' : 'default'].slice(2);
    }
}
const server = createServer(async (req, res) => {
    try {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname.startsWith('/csp'))
            res.setHeader('Content-Security-Policy', `require-trusted-types-for 'script'; trusted-types ${pathname === '/csp-denied' ? 'none' : 'mnjs-html'}`);
        if (pathname === '/' || pathname.startsWith('/csp')) {
            res.setHeader('Content-Type', 'text/html');
            res.end(`<!doctype html><html><body><script type="importmap">${JSON.stringify({ imports })}</script></body></html>`);
            return;
        }
        const normalized = pathname.replace(/^\/copy\//, '/');
        const packageRequest = packedRoot && (normalized.startsWith('/package/') || normalized.startsWith('/dist/'));
        const base = packageRequest ? distributionRoot : root;
        const mapped = normalized.startsWith('/package/') ? normalized.slice('/package'.length)
            : packageRequest && development ? normalized.replace('/dist/', '/dist/development/') : normalized;
        const path = resolve(base, '.' + mapped);
        if (!path.startsWith(base + '/')) {
            res.writeHead(403);
            res.end();
            return;
        }
        res.setHeader('Content-Type', ['.js', '.mjs'].includes(extname(path)) ? 'text/javascript' : 'application/octet-stream');
        res.end(await readFile(path));
    }
    catch {
        res.writeHead(404);
        res.end();
    }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const results = [];
try {
    for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
        const browser = await type.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.goto(url);
            if (packedManifest) {
                const smoke = await page.evaluate(async ({manifest, development}) => {
                    const {smoke} = await import('/test/packed-runtime.mjs');
                    return smoke(manifest, development);
                }, {manifest: packedManifest, development});
                results.push({browser: name, packedSmoke: smoke});
            }
            const regressions = await page.evaluate(async development => {
                const {keyedRegressions, styleMapRegressions, syncAncestorRegressions, commentCloseRegressions, propertyBoundaryRegressions} = await import('/test/public-regressions.mjs');
                return {...styleMapRegressions(), ...await keyedRegressions(), ...await syncAncestorRegressions(), ...commentCloseRegressions(), ...await propertyBoundaryRegressions(development)};
            }, development);
            results.push({browser: name, upstreamRegressions: regressions});
            const result = await page.evaluate(async development => {
                const { html, svg, render, nothing } = await import('@mnjs/html');
                const { repeat } = await import('@mnjs/html/directives/repeat.js');
                const root = document.createElement('div');
                document.body.append(root);
                const assert = (ok, message) => { if (!ok)
                    throw new Error(message); };
                const template = ids => html `${repeat(ids, x => x, x => html `<input data-id=${x} .value=${x}>`)}`;
                render(template(['a', 'b', 'c']), root);
                const nodes = [...root.querySelectorAll('input')];
                nodes[0].value = 'edited';
                nodes[0].focus();
                nodes[0].setSelectionRange(1, 3);
                render(template(['c', 'a', 'b']), root);
                assert(root.querySelectorAll('input')[1] === nodes[0], 'keyed identity');
                assert(nodes[0].value === 'edited', 'edited value');
                const nativeMove = typeof root.moveBefore === 'function';
                if (nativeMove) {
                    assert(document.activeElement === nodes[0], 'native move lost focus');
                    assert(nodes[0].selectionStart === 1 && nodes[0].selectionEnd === 3, 'selection lost');
                }
                // Force the existing fallback on this concrete list parent, then restore it.
                Object.defineProperty(root, 'moveBefore', { value: undefined, configurable: true });
                render(template(['b', 'c', 'a']), root);
                assert(root.querySelectorAll('input')[2] === nodes[0], 'fallback identity');
                delete root.moveBefore;
                const editable = ids => html`${repeat(ids, id => id, id => html`<div contenteditable="true"><span>${id}</span></div>`)}`;
                render(editable(['a', 'b', 'c']), root);
                const editor = root.querySelector('[contenteditable]');
                const selectedText = editor.querySelector('span').lastChild;
                editor.focus();
                const selection = document.getSelection();
                const range = document.createRange();
                range.setStart(selectedText, 0);
                range.setEnd(selectedText, 1);
                selection.removeAllRanges();
                selection.addRange(range);
                render(editable(['c', 'a', 'b']), root);
                if (nativeMove) {
                    assert(document.activeElement === editor, 'contenteditable focus');
                    assert(selection.anchorNode === selectedText && selection.focusNode === selectedText
                        && selection.anchorOffset === 0 && selection.focusOffset === 1, 'contenteditable selection');
                }
                let connects = 0, disconnects = 0, moves = 0;
                class Probe extends HTMLElement {
                    connectedCallback() { connects++; }
                    disconnectedCallback() { disconnects++; }
                    connectedMoveCallback() { moves++; }
                }
                customElements.define('mn-move-probe', Probe);
                const probes = ids => html `${repeat(ids, x => x, x => html `<mn-move-probe data-id=${x}></mn-move-probe>`)}`;
                render(probes([1, 2, 3]), root);
                const before = { connects, disconnects };
                render(probes([3, 1, 2]), root);
                if (nativeMove) {
                    assert(connects === before.connects && disconnects === before.disconnects, 'move lifecycle reconnect');
                    assert(moves > 0, 'missing connectedMoveCallback');
                }
                // A custom element without the new callback still follows native legacy callbacks.
                let oldConnect = 0, oldDisconnect = 0;
                customElements.define('mn-legacy-probe', class extends HTMLElement {
                    connectedCallback() { oldConnect++; }
                    disconnectedCallback() { oldDisconnect++; }
                });
                const legacy = ids => html `${repeat(ids, x => x, x => html `<mn-legacy-probe data-id=${x}></mn-legacy-probe>`)}`;
                render(legacy([1, 2, 3]), root);
                render(legacy([3, 1, 2]), root);
                assert(oldConnect > 3 && oldDisconnect > 0, 'legacy custom-element callbacks');
                // Async render remains bounded while Marionette owns children after its marker.
                const { default: Dom } = await import('@mnjs/html/marionette');
                const { createMarionette } = await import('marionette');
                const { until } = await import('@mnjs/html/directives/until.js');
                const mn = createMarionette();
                mn.setDomApi(Dom);
                const mount = document.createElement('div');
                document.body.append(mount);
                const region = new mn.Region({ el: mount });
                let resolvePending;
                const pending = new Promise(r => resolvePending = r);
                const list = new mn.CollectionView({ template: () => until(pending, html `<header>waiting</header>`) });
                region.show(list);
                let clicks = 0;
                const Child = mn.View.extend({ template: () => html `<button>child</button>`, events: { 'click button'() { clicks++; } } });
                const child = new Child();
                list.addChildView(child);
                resolvePending(html `<header>ready</header>`);
                await new Promise(r => setTimeout(r, 0));
                assert(child.el.parentNode === list.el, 'owned child removed');
                child.el.querySelector('button').click();
                assert(clicks === 1, 'Marionette event failed');
                region.destroy();
                assert(child.isDestroyed(), 'child teardown');
                for (const t of [html `<button @click=${() => { }}></button>`, html `<button .onclick=${() => { }}></button>`, svg `<animate onbegin=${'alert(1)'}></animate>`, svg `<animate onend=${'alert(1)'}></animate>`, svg `<animate onrepeat=${'alert(1)'}></animate>`, html `<input onfocusin=${'alert(1)'}>`, html `<input onfocusout=${'alert(1)'}>`, html `<div onbeforeload=${'alert(1)'}></div>`]) {
                    let code = '';
                    try {
                        render(t, root);
                    }
                    catch (e) {
                        code = e.message;
                    }
                    assert(code.includes('MN_HTML_EVENT_BINDING'), 'event rejection');
                }
                // Foreign values never run as local directives or parse as local templates.
                const upstream = await import('lit-html');
                const foreignApi = await import('lit-html/directive.js');
                let foreignCalls = 0;
                class Foreign extends foreignApi.Directive {
                    render() { foreignCalls++; return 'executed'; }
                }
                const foreign = foreignApi.directive(Foreign);
                for (const template of [
                    html`<div>${foreign()}</div>`, html`<div title=${foreign()}></div>`,
                    html`<div .payload=${foreign()}></div>`, html`<div ?hidden=${foreign()}></div>`,
                    html`<div ${foreign()}></div>`, upstream.html`<img src="must-not-load">`,
                ]) {
                    let rejection;
                    try { render(template, root); } catch (error) { rejection = error; }
                    if (development) assert(rejection?.message.includes('MN_HTML_FOREIGN_VALUE'), 'development foreign-value diagnostic');
                    else if (rejection) throw rejection;
                    assert(foreignCalls === 0 && !root.querySelector('img'), 'foreign values are inert');
                }
                // Restored opt-in APIs exercise their observable browser behavior.
                const { ref, createRef } = await import('@mnjs/html/directives/ref.js');
                const { templateContent } = await import('@mnjs/html/directives/template-content.js');
                const { unsafeHTML } = await import('@mnjs/html/directives/unsafe-html.js');
                const { unsafeSVG } = await import('@mnjs/html/directives/unsafe-svg.js');
                const { unsafeMathML } = await import('@mnjs/html/directives/unsafe-mathml.js');
                const { html: staticHtml, literal } = await import('@mnjs/html/static');
                const reference = createRef();
                const part = render(html `<input ${ref(reference)}>`, root);
                const referred = root.firstElementChild;
                assert(reference.value === referred, 'ref initial value');
                part.setConnected(false);
                assert(reference.value === undefined, 'ref disconnect');
                part.setConnected(true);
                assert(reference.value === referred, 'ref reconnect');
                const authored = document.createElement('template');
                authored.innerHTML = '<strong>authored</strong>';
                render(templateContent(authored), root);
                assert(reference.value === undefined, 'ref removal');
                assert(root.querySelector('strong').textContent === 'authored', 'templateContent');
                render(unsafeHTML('<b>trusted</b>'), root);
                assert(root.querySelector('b').textContent === 'trusted', 'unsafeHTML');
                render(unsafeSVG('<circle cx="5"></circle>'), root);
                assert(root.querySelector('circle').namespaceURI === 'http://www.w3.org/2000/svg', 'unsafeSVG');
                render(unsafeMathML('<mn>3</mn>'), root);
                assert(root.querySelector('mn').namespaceURI === 'http://www.w3.org/1998/Math/MathML', 'unsafeMathML');
                const tag = literal `section`;
                render(staticHtml `<${tag}>${'<b>text</b>'}</${tag}>`, root);
                assert(root.firstElementChild.tagName === 'SECTION' && !root.querySelector('b'), 'static template escaping');
                const detachedMoves = [];
                for (const kind of ['element', 'document-fragment', 'shadow-root', 'after-detach']) {
                    const host = document.createElement('div');
                    const target = kind === 'document-fragment' ? document.createDocumentFragment()
                        : kind === 'shadow-root' ? host.attachShadow({ mode: 'closed' }) : host;
                    if (kind === 'after-detach')
                        document.body.append(host);
                    const hasNativeMove = typeof target.moveBefore === 'function';
                    for (const fallback of [false, true]) {
                        if (fallback)
                            Object.defineProperty(target, 'moveBefore', { value: undefined, configurable: true });
                        render(template(['a', 'b', 'c']), target, { isConnected: false });
                        const beforeNodes = [...target.querySelectorAll('input')];
                        beforeNodes[0].value = 'edited';
                        host.remove();
                        render(template(['c', 'a', 'b']), target);
                        const afterNodes = [...target.querySelectorAll('input')];
                        assert(afterNodes[0] === beforeNodes[2] && afterNodes[1] === beforeNodes[0]
                            && afterNodes[2] === beforeNodes[1], `${kind}: keyed identity`);
                        assert(beforeNodes[0].value === 'edited', `${kind}: edited state`);
                        render(nothing, target).setConnected(false);
                        if (fallback)
                            delete target.moveBefore;
                    }
                    detachedMoves.push({ kind, native: hasNativeMove, nativeAndForcedFallbackPassed: true });
                }
                // Unknown on-prefix names are ordinary data; native handler bindings stay blocked.
                render(html `<div .one=${1} ?online=${true} .onboarding=${'data'}></div>`, root);
                assert(root.firstElementChild.one === 1 && root.firstElementChild.hasAttribute('online')
                    && root.firstElementChild.onboarding === 'data', 'on-prefix data bindings');
                assert(development ? typeof render.setSanitizer === 'function'
                    : render.setSanitizer === undefined && render.createSanitizer === undefined, 'condition-specific hooks');
                render(nothing, root).setConnected(false);
                root.remove();
                mount.remove();
                return { nativeMove, focusPreserved: nativeMove, detachedMoves, restoredApis: 'ref, templateContent, unsafeHTML, unsafeSVG, unsafeMathML, static passed' };
            }, development);
            results.push({ browser: name, version: browser.version(), ...result });
            if (name === 'chromium') {
                await page.goto(url + '/csp');
                const csp = await page.evaluate(async () => {
                    const { html, render } = await import('@mnjs/html');
                        const el = document.createElement('div');
                    document.body.append(el);
                    render(html `<p>${'<b>safe text</b>'}</p>`, el);
                    if (el.querySelector('b'))
                        throw new Error('text parsed');
                    let rawDenied = false;
                    try {
                        el.innerHTML = '<b>unsafe</b>';
                    }
                    catch {
                        rawDenied = true;
                    }
                    let duplicateDenied = false;
                    try {
                        await import('/copy/dist/index.js');
                    }
                    catch {
                        duplicateDenied = true;
                    }
                    return { text: el.textContent, rawDenied, duplicateDenied };
                });
                assert.equal(csp.text, '<b>safe text</b>');
                assert.equal(csp.rawDenied, true);
                assert.equal(csp.duplicateDenied, true);
                await page.goto(url + '/csp-denied');
                const denied = await page.evaluate(async () => { try {
                    await import('@mnjs/html');
                    return false;
                }
                catch {
                    return true;
                } });
                assert.equal(denied, true);
                results.push({ browser: 'chromium', trustedTypes: { ...csp, policyDeniedFailsClosed: denied } });
            }
            await page.close();
        }
        finally {
            await browser.close();
        }
    }
    const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(`${evidenceDir}/browser-results.json`, JSON.stringify({ date: new Date().toISOString(), packedRoot: packedRoot ?? null, condition: development ? 'development' : 'default', results }, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
}
finally {
    await new Promise(r => server.close(r));
}

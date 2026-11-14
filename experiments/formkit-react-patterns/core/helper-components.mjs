// Portable DOM factories for the official FormKit 2.5 helper behaviors.
// Schema shapes follow @formkit/vue and @formkit/react (MIT: LICENSE.formkit).
import { createSection, localize } from '@formkit/inputs';
import { createIconHandler } from '@formkit/themes';
import { token, undefine } from '@formkit/utils';
import { renderSections } from './section-renderer.mjs';
import { subscribeReactiveStore } from './upstream-bindings.mjs';

const messages = createSection('messages', () => ({ $el: 'ul', if: '$fns.length($messages)' }));
const message = createSection('message', () => ({
  $el: 'li', for: ['message', '$messages'],
  attrs: { key: '$message.key', id: '$id + \'-\' + $message.key', 'data-message-type': '$message.type' }
}));
const messageSchema = messages(message('$message.value'));
const summary = createSection('summary', () => ({ $el: 'div', attrs: { 'aria-live': 'polite' } }));
const summaryInner = createSection('summaryInner', () => ({ $el: 'div', if: '$summaries.length && $showSummaries' }));
const summaryMessages = createSection('messages', () => ({ $el: 'ul', if: '$summaries.length && $showSummaries' }));
const summaryMessage = createSection('message', () => ({
  $el: 'li', for: ['summary', '$summaries'],
  attrs: { key: '$summary.key', 'data-message-type': '$summary.type' }
}));
const summaryHeader = createSection('summaryHeader', () => ({ $el: 'h2', attrs: { id: '$id' } }));
const messageLink = createSection('messageLink', () => ({
  $el: 'a', attrs: { id: '$id + \'-\' + $summary.key', href: '$: "#" + $summary.id', onClick: '$jumpLink' }
}));
const summarySchema = summary(summaryInner(summaryHeader('$summaryHeader'), summaryMessages(summaryMessage(messageLink('$summary.message')))));

// Several outlets can suppress the same node's original message placement.
const messagePlacements = new WeakMap();
function moveMessages(context) {
  let state = messagePlacements.get(context);
  if (!state) {
    state = { count: 0, previous: context.defaultMessagePlacement };
    messagePlacements.set(context, state);
  }
  state.count++;
  context.defaultMessagePlacement = false;
  return () => {
    if (--state.count) return;
    if (context.defaultMessagePlacement === false) context.defaultMessagePlacement = state.previous;
    messagePlacements.delete(context);
  };
}
function resolveNode(args, props, environment) {
  return props.node || args.parentNode || args.context?.node || environment.getNode?.();
}
function factoryLibrary(environment, props) {
  return { ...environment.getComponents?.(), ...props.library };
}
function findElement(host, id) {
  const root = host.getRootNode();
  return (typeof root.getElementById === 'function' ? root : host.ownerDocument).getElementById(id);
}

function createMessageHelper(args, environment, isSummary) {
  const { host } = args;
  const id = `summary-${token()}`;
  let props = {}, node, renderer, closed = false, queued = false, shown = false, submitPending = false;
  let disposers = [], contextSubscriptions = new Map(), summaries = [];
  const data = {
    get id() { return isSummary ? id : node?.context?.id; },
    get messages() { return node?.context?.messages || {}; },
    get fns() { return node?.context?.fns || {}; },
    get classes() { return node?.context?.classes || {}; },
    // Framework slots need explicit adapters at this factory boundary.
    slots: {},
    get summaries() { return summaries; },
    get showSummaries() { return !!props.forceShow || shown; },
    get summaryHeader() { return node?.context?.ui?.summaryHeader?.value || ''; },
    jumpLink(event) {
      const anchor = event.currentTarget;
      const targetId = anchor?.getAttribute('href')?.slice(1);
      if (!targetId) return;
      event.preventDefault();
      const target = findElement(host, targetId);
      target?.scrollIntoView?.({ behavior: 'smooth' });
      target?.focus?.();
    }
  };
  function refresh() {
    if (closed || !node?.context) return;
    if (isSummary) {
      const contexts = [];
      node.walk(child => { if (child.context) contexts.push(child.context); });
      const wanted = new Set(contexts);
      for (const [context, unsubscribe] of contextSubscriptions) {
        if (!wanted.has(context)) { unsubscribe(); contextSubscriptions.delete(context); }
      }
      for (const context of contexts) {
        if (!contextSubscriptions.has(context)) contextSubscriptions.set(context, subscribeReactiveStore(context, schedule));
      }
      summaries = contexts.flatMap(context => Object.values(context.messages || {})
        .filter(item => typeof item.value === 'string')
        .map(item => ({ message: item.value, id: context.id, key: `${context.id}-${item.key}`, type: item.type })));
    }
    renderer?.update();
    if (submitPending) {
      submitPending = false;
      if (summaries.length) {
        props.onShow?.(summaries.map(item => ({ ...item })));
        if (closed || !host.isConnected) return;
        findElement(host, id)?.scrollIntoView?.({ behavior: 'smooth' });
        findElement(host, `${id}-${summaries[0].key}`)?.focus?.();
      }
    }
  }
  function schedule() {
    if (queued || closed) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!closed) refresh(); });
  }
  function clear(remove = true) {
    for (const dispose of disposers.splice(0).reverse()) dispose();
    for (const unsubscribe of contextSubscriptions.values()) unsubscribe();
    contextSubscriptions.clear();
    renderer?.destroy(remove); renderer = undefined;
  }
  function update(next) {
    if (closed) return;
    const previous = props;
    const nextNode = resolveNode(args, next, environment);
    const rebind = nextNode !== node || !renderer || next.sectionsSchema !== previous.sectionsSchema || next.library !== previous.library || next.defaultPosition !== previous.defaultPosition;
    props = next;
    if (rebind) {
      const changedNode = node !== nextNode;
      clear(); node = nextNode;
      if (changedNode) { shown = false; submitPending = false; }
      if (!node) {
        if (isSummary) throw new Error('FormKitSummary must have a FormKit parent or use the node prop.');
        return;
      }
      if (!node.context) return;
      const boundNode = node;
      const on = (event, callback) => { const receipt = boundNode.on(event, callback); disposers.push(() => boundNode.off(receipt)); };
      on('destroying', () => { clear(environment.removeDom?.() ?? true); node = undefined; summaries = []; submitPending = false; });
      if (isSummary) {
        localize('summaryHeader', 'There were errors in your form.')(node);
        on('child.deep', schedule);
        on('childRemoved.deep', schedule);
        on('submit-raw', () => { shown = true; submitPending = true; schedule(); });
      } else if (!undefine(props.defaultPosition)) disposers.push(moveMessages(node.context));
      renderer = renderSections({ host, schema: (isSummary ? summarySchema : messageSchema)(props.sectionsSchema || {}), context: node.context, data, components: factoryLibrary(environment, props) });
    }
    refresh();
  }
  try { update(args.props || {}); } catch (error) { clear(); closed = true; throw error; }
  return { update, destroy(remove = true) { if (closed) return; closed = true; clear(remove); node = undefined; } };
}

export function FormKitMessages(args, environment = {}) { return createMessageHelper(args, environment, false); }
export function FormKitSummary(args, environment = {}) { return createMessageHelper(args, environment, true); }

// Icon handlers accept inline SVG and loader-provided SVG. Parse into an inert
// document and retain a conservative SVG vocabulary; never assign arbitrary HTML.
const svgElements = new Set('svg g path circle ellipse rect line polyline polygon defs symbol use title desc clipPath mask linearGradient radialGradient stop pattern'.split(' '));
const svgAttributes = new Set('xmlns viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity opacity transform id class role aria-hidden aria-label focusable preserveAspectRatio clip-path clip-rule mask offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod patternUnits patternContentUnits patternTransform'.split(' '));
function safeSvg(host, markup) {
  if (typeof markup !== 'string' || !markup.trimStart().startsWith('<svg')) return;
  const Parser = host.ownerDocument.defaultView.DOMParser;
  const parsed = new Parser().parseFromString(markup, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI && root.namespaceURI !== 'http://www.w3.org/2000/svg' || parsed.querySelector('parsererror')) return;
  function copy(source) {
    if (!svgElements.has(source.localName) || source.namespaceURI && source.namespaceURI !== 'http://www.w3.org/2000/svg') return;
    const element = host.ownerDocument.createElementNS('http://www.w3.org/2000/svg', source.localName);
    for (const attribute of source.attributes) {
      const name = attribute.name, value = attribute.value;
      const fragment = /^(?:#[-\w:.]+|url\(#[\w:.-]+\))$/;
      if (name === 'href' || name === 'xlink:href') {
        if (/^#[-\w:.]+$/.test(value)) element.setAttribute('href', value);
      } else if (svgAttributes.has(name) && !/javascript:|data:|https?:|\/\/|expression\s*\(/i.test(value) && (!/url\s*\(/i.test(value) || fragment.test(value))) {
        element.setAttribute(name, value);
      }
    }
    for (const child of source.childNodes) {
      if (child.nodeType === 1) { const clean = copy(child); if (clean) element.append(clean); } else if (child.nodeType === 3 && ['title', 'desc'].includes(source.localName)) element.append(host.ownerDocument.createTextNode(child.textContent));
    }
    return element;
  }
  return copy(root);
}

export function FormKitIcon(args, environment = {}) {
  const { host } = args;
  let props = {}, node, span, generation = 0, closed = false, unsubscribe = () => {}, offDestroy = () => {}, listeners = [];
  let previousIcon, previousLoader, previousUrl, previousHandler;
  function clearSpan(remove = true) {
    for (const [name, handler] of listeners.splice(0)) span?.removeEventListener(name, handler);
    if (remove) span?.remove();
    span = undefined;
  }
  function display(markup, request) {
    if (closed || request !== generation) return;
    const svg = safeSvg(host, markup);
    if (!props.icon || !svg) { clearSpan(); return; }
    for (const [name, handler] of listeners.splice(0)) span?.removeEventListener(name, handler);
    span ||= host.ownerDocument.createElement('span');
    for (const attribute of [...span.attributes]) span.removeAttribute(attribute.name);
    span.className = ['formkit-icon', props.className || props.class].filter(Boolean).join(' ');
    const clickable = typeof props.onClick === 'function';
    for (const [name, value] of Object.entries(props)) {
      if (['icon', 'iconLoader', 'iconLoaderUrl', 'class', 'className', 'node', 'role', 'tabIndex', 'tabindex'].includes(name)) continue;
      if (/^on[A-Z]/.test(name) && typeof value === 'function' && !/^onKey[Dd]own$/.test(name)) {
        const event = name.slice(2).toLowerCase(); span.addEventListener(event, value); listeners.push([event, value]);
      } else if ((name === 'id' || name === 'title' || name === 'dir' || name === 'lang' || /^(?:aria|data)-[\w-]+$/.test(name)) && value != null) span.setAttribute(name, String(value));
    }
    const role = props.role ?? (clickable ? 'button' : undefined);
    const tabIndex = props.tabIndex ?? props.tabindex ?? (clickable ? 0 : undefined);
    if (role != null) span.setAttribute('role', String(role));
    if (tabIndex != null) span.setAttribute('tabindex', String(tabIndex));
    const keydown = event => {
      (props.onKeyDown || props.onKeydown)?.(event);
      if (!event.defaultPrevented && clickable && ['Enter', ' ', 'Spacebar'].includes(event.key)) {
        event.preventDefault(); event.currentTarget.click();
      }
    };
    span.addEventListener('keydown', keydown); listeners.push(['keydown', keydown]);
    span.replaceChildren(svg); if (span.parentNode !== host) host.append(span);
  }
  let currentMarkup;
  function load(force = false, renderProps = false) {
    if (closed) return;
    const parentLoader = node?.props?.iconLoader;
    const handler = node?.props?.iconHandler || environment.getPlugins?.()?.find(plugin => typeof plugin.iconHandler === 'function')?.iconHandler;
    const loader = typeof props.iconLoader === 'function' ? props.iconLoader : parentLoader;
    const url = !loader && typeof props.iconLoaderUrl === 'function' ? props.iconLoaderUrl : undefined;
    if (!force && props.icon === previousIcon && loader === previousLoader && url === previousUrl && handler === previousHandler) { if (renderProps)display(currentMarkup, generation); return; }
    previousIcon = props.icon; previousLoader = loader; previousUrl = url; previousHandler = handler;
    const request = ++generation;
    currentMarkup = undefined; clearSpan();
    if (typeof props.icon !== 'string' || (!props.icon.startsWith('<svg') && !/^[A-Za-z0-9_:-]+$/.test(props.icon))) return;
    const resolve = loader || url ? createIconHandler(loader, url) : handler || createIconHandler();
    let result;
    try { result = resolve(props.icon); } catch { return; }
    if (result && typeof result.then === 'function') {
      Promise.resolve(result).then(markup => {
        if (closed || request !== generation) return;
        currentMarkup = markup; display(markup, request);
      }, () => { if (!closed && request === generation) clearSpan(); });
    } else { currentMarkup = result; display(result, request); }
  }
  function update(next) {
    if (closed) return;
    const nextNode = resolveNode(args, next, environment);
    props = next;
    if (nextNode !== node) {
      unsubscribe(); offDestroy(); node = nextNode;
      unsubscribe = subscribeReactiveStore(node?.context, () => load());
      if (node) {
        const boundNode = node;
        const receipt = node.on('destroying', () => { generation++; clearSpan(environment.removeDom?.() ?? true); unsubscribe(); offDestroy(); node = undefined; });
        offDestroy = () => boundNode.off(receipt);
      } else offDestroy = () => {};
      load(true);
    } else load(false,true);
  }
  update(args.props || {});
  return { update, destroy(remove = true) { if (closed) return; closed = true; generation++; unsubscribe(); offDestroy(); clearSpan(remove); } };
}

export function createFormKitHelpers(environment = {}) {
  return {
    FormKitSummary: args => FormKitSummary(args, environment),
    FormKitMessages: args => FormKitMessages(args, environment),
    FormKitIcon: args => FormKitIcon(args, environment)
  };
}

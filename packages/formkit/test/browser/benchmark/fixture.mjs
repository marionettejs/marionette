export const seeds = index => `original-${index}`;
const params = new URLSearchParams(location.search);
const host = document.querySelector('main');
const arm = params.get('arm');
const fields = Number(params.get('fields'));
const shape = params.get('shape');
const coreDelayMs = 20;
const target = params.get('position') === 'front' ? 1 : Math.floor(fields / 2);
const witness = params.get('witness') === '1';
const initial = index => witness && index === 0 ? '' : witness && index === target ? 'x' : seeds(index);

if (!['marionette', 'vue', 'react'].includes(arm) || ![450, 1500].includes(fields) ||
  !['flat', 'validated'].includes(shape)) {
  throw new Error('Unknown public benchmark lane');
}

const schema = Array.from({ length: fields }, (_, index) => ({
  $formkit: 'text', name: `field${index}`, id: `field-${index}`,
  label: `Synthetic field ${index + 1}`, key: `field-${index}`,
  value: initial(index), delay: coreDelayMs,
  ...(shape === 'validated' ? { validation: 'required|length:3,40' } : {}),
}));

async function setupArm() {
  if (arm === 'marionette') {
    const { mount } = await import('@mnjs/formkit');
    return (onNode, onSubmit, onSubmitInvalid) => {
      const handle = mount({ host, schema, formProps: { actions: true }, onSubmit, onSubmitInvalid });
      onNode(handle.node);
      return () => handle.destroy();
    };
  }
  if (arm === 'vue') {
    const { createApp, h } = await import('vue');
    const { defaultConfig, FormKit, FormKitSchema, plugin } = await import('@formkit/vue');
    return (onNode, onSubmit, onSubmitInvalid) => {
      const app = createApp({
        render: () => h(FormKit, { type: 'form', actions: true, onNode, onSubmit, onSubmitInvalid }, {
          default: () => h(FormKitSchema, { schema }),
        }),
      });
      app.use(plugin, defaultConfig);
      app.mount(host);
      return () => app.unmount();
    };
  }
  const { createElement: h } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { defaultConfig, FormKit, FormKitSchema, FormKitProvider } = await import('@formkit/react');
  return (onNode, onSubmit, onSubmitInvalid) => {
    const root = createRoot(host);
    root.render(h(FormKitProvider, { config: defaultConfig() },
      h(FormKit, { type: 'form', actions: true, onNode, onSubmit, onSubmitInvalid }, h(FormKitSchema, { schema }))));
    return () => root.unmount();
  };
}

const spawn = await setupArm();
const report = { arm, fields, shape, events: [], coreDelayMs };
let node, dispose, rootReceipt, pending, submitted;
let mark = 0, invalidSaves = 0;
function validationSnapshot() {
  const required = node.at('field0');
  const length = node.at(`field${target}`);
  return {
    ruleNames: [required, length].map(field => Object.values(field.store)
      .filter(message => message.type === 'validation')
      .map(message => message.key).sort()),
    blocking: node.ledger.value('blocking'), validating: node.ledger.value('validating'),
    coreInputs: node.children.length, invalidSaves, submitted: Boolean(submitted),
  };
}
const selector = id => host.querySelector(`#field-${id}`);
function requireOutcome(accepted, description) {
  if (!accepted) { throw new Error(description); }
}
function onKey(event) {
  if (!pending || event.target.id !== `field-${target}`) { return; }
  pending.key = { code: event.code, trusted: event.isTrusted, capture: performance.now() - mark };
}
function onInput(event) {
  if (!pending || event.target.id !== `field-${target}` || event.target.value !== pending.value) { return; }
  pending.capture = performance.now() - mark;
  pending.trusted = event.isTrusted;
}
function rootCommitted() {
  if (!pending || pending.capture == null || node.value[`field${target}`] !== pending.value) { return; }
  requireOutcome(node.value.field0 === seeds(0) &&
    node.value[`field${fields - 1}`] === seeds(fields - 1), 'Edited form lost a sibling');
  pending.commit = performance.now() - mark;
  report.events.push(pending);
  pending = undefined;
}

window.bench = {
  report,
  async mount() {
    requireOutcome(!dispose, 'Already mounted');
    const ready = Promise.withResolvers();
    const onReady = () => {
      if (node && selector(fields - 1)) { ready.resolve(); }
    };
    const observer = new MutationObserver(onReady);
    observer.observe(host, { childList: true, subtree: true });
    host.addEventListener('input', onInput, true);
    host.addEventListener('keydown', onKey, true);
    mark = performance.now();
    try {
      dispose = spawn(value => { node = value; onReady(); }, values => { submitted = structuredClone(values); }, () => { invalidSaves++; });
      await ready.promise;
      report.mountDomMs = performance.now() - mark;
      if (witness) { report.domReady = validationSnapshot(); }
    } finally {
      observer.disconnect();
    }
    await node.settled;
    await node.ledger.settled('validating');
    report.mountSettledMs = performance.now() - mark;
    requireOutcome(host.querySelectorAll('input[type=text]').length === fields, 'Wrong field count');
    requireOutcome(selector(target).value === initial(target), 'Incorrect initial field value');
    rootReceipt = node.on('commit', rootCommitted);
  },
  validationSnapshot,
  async observeDestroy() {
    const owned = [node, ...node.children];
    const outstanding = new Set(owned);
    const done = Promise.withResolvers();
    for (const child of owned) {
      child.on('destroyed', event => {
        requireOutcome(event.origin === child, 'Not the same Core node');
        requireOutcome(outstanding.delete(child), 'Duplicate Core destroy receipt');
        if (outstanding.size === 0) { queueMicrotask(done.resolve); }
      });
    }
    const start = performance.now();
    this.destroy();
    report.afterDisposeReceiptCount = owned.length - outstanding.size;
    await done.promise;
    report.fullDestroyMs = performance.now() - start;
    report.destroyedCount = owned.length;
  },
  armEdit(value) {
    requireOutcome(!pending && node, 'Cannot arm overlapping edits');
    pending = { value, armedAt: performance.now() - mark };
  },
  readSubmission() { return submitted; },
  verifySubmission(expected) {
    requireOutcome(submitted && Object.keys(submitted).length === fields, 'Save lost fields');
    requireOutcome(submitted[`field${target}`] === expected, 'Save lost the latest edit');
    return submitted.field0 === seeds(0) && submitted[`field${fields - 1}`] === seeds(fields - 1);
  },
  destroy() {
    node.off(rootReceipt);
    host.removeEventListener('input', onInput, true);
    host.removeEventListener('keydown', onKey, true);
    const start = performance.now();
    dispose();
    report.teardownMs = performance.now() - start;
    requireOutcome(host.childElementCount === 0, 'Host not empty after destroy');
    node = undefined;
    dispose = undefined;
  },
};

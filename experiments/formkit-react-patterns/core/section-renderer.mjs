// FormKit section-schema DOM interpreter.
// Expression/provider pattern follows FormKit React 2.5 (MIT: LICENSE.formkit).
import { formKitScope, formKitDomRoot, formKitParent } from './provider-scope.mjs';
import { compile } from '@formkit/core';
import { createSchemaDependencies } from './schema-registry.mjs';
import { subscribeReactiveStore } from './upstream-bindings.mjs';

// Schema producers (including Pro) can expose non-enumerable getters.
// Only project the schema node when removing control keys; spreading it loses
// those getters and can eagerly evaluate children before their row scope exists.
const sectionSource = Symbol('sectionSource');
function projectSchema(entry,omit = [],overrides = {}) {
  const descriptors = Object.getOwnPropertyDescriptors(entry);
  for (const key of omit) {delete descriptors[key];}
  for (const [key,value] of Object.entries(overrides)) {descriptors[key] = {value,enumerable: true,writable: true,configurable: true};}
  descriptors[sectionSource] = {value: entry[sectionSource] ?? entry,configurable: true};
  return Object.create(Object.getPrototypeOf(entry),descriptors);
}

export function renderSections({host,schema,context,metrics,slots = {},reuseRoot = false,data = {},components = {},configScope,domRoot,parentNode}) {
  let dead = false,rootUsed = false,removeDom = true;const effects = new Set(),elements = new Set(),schemaCells = new WeakMap();
  const cellFor = entry=>{const source = entry[sectionSource] ?? entry;let cell = schemaCells.get(source);if (!cell) {cell = {current: source};schemaCells.set(source,cell);} return cell;};
  const iterationScope = Symbol('iteration scope'),methodBindings = new WeakMap();
  const metric = key=>{if (metrics?.enabled) {metrics[key] = (metrics[key] ?? 0) + 1;}};
  function scope() {const disposers = [];return {add: fn=>disposers.push(fn),destroy() {for (const fn of disposers.splice(0).reverse()) {fn();}}};}
  const root = scope();
  function read(path,locals) {
    let object = locals,owner;const parts = path.split('.');
    if (!(parts[0] in locals)) {object = parts[0] in data ? data : context;}
    for (const part of parts) {if (object == null) {return undefined;}owner = object;object = object[part];}
    if (typeof object !== 'function') {return object;}
    // Keep method receivers and stable callback identity across refreshes.
    let receivers = methodBindings.get(object);if (!receivers) {receivers = new Map();methodBindings.set(object,receivers);}
    if (!receivers.has(owner)) {receivers.set(owner,object.bind(owner));}
    return receivers.get(owner);
  }
  function binding(value,locals,owner,apply,always = false,condition = false) {
    if (condition && typeof value === 'string' && !value.startsWith('$')) {value = '$: ' + value;}
    if (typeof value !== 'string' || value.length < 2 || !value.startsWith('$')) {apply(value);return;}
    let tokens = [],last = [],initialized = false;
    const dependencies = createSchemaDependencies();
    owner.add(() => dependencies.destroy());
    // Context bags mutate in place upstream; compare their enumerable entries,
    // not just bag identity. No cloning of aggregate form values occurs here.
    const snapshot = currentValue=>currentValue && typeof currentValue === 'object' ? Object.entries(currentValue) : currentValue;
    const equal = (a,b)=>Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every(([k,v],i)=>k === b[i][0] && Object.is(v,b[i][1])) : Object.is(a,b);
    const fn = compile(value).provide(required=>{tokens = required;return Object.fromEntries(required.map(token=>[token,()=>read(token,locals)]));});
    const effect = (force = false)=>{
      if (dead) {return;} const next = tokens.map(token=>{metric('tokenChecks');return snapshot(read(token,locals));});
      if (dead) {return;}
      if (!always && !force && initialized && next.every((v,i)=>typeof v !== 'function' && equal(v,last[i]))) {return;}last = next;initialized = true;metric('expressionEvaluations');apply(dependencies.run(fn));
    };
    effects.add(effect);owner.add(()=>effects.delete(effect));effect(true);
  }
  // Recursively resolve schema attributes, including conditional objects and
  // expression-bearing style/props bags. Keep subscriptions in the owning scope.
  function valueBinding(value,locals,owner,apply) {
    if (value && typeof value === 'object' && Object.hasOwn(value,'if')) {
      let branch = scope();owner.add(()=>branch.destroy());
      binding(value.if,locals,owner,test=>{branch.destroy();branch = scope();valueBinding(test ? value.then : value.else,locals,branch,apply);},false,true);
    } else if (value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)) {
      const result = Array.isArray(value) ? [] : {};let ready = false;
      const setProperty = key => next => {result[key] = next; if (ready) {apply(Array.isArray(result) ? [...result] : {...result});}};
      for (const key of Object.getOwnPropertyNames(value).filter(propertyName=>!Array.isArray(value) || propertyName !== 'length')) {const part = value[key];if (key.startsWith('__raw__')) {result[key.slice(7)] = part;continue;}valueBinding(part,locals,owner,setProperty(key));}
      ready = true;apply(result);
    } else {binding(value,locals,owner,apply);}
  }
  function range(parent,before,owner) {const start = document.createComment('section'),end = document.createComment('/section');parent.insertBefore(start,before);parent.insertBefore(end,before);owner.add(()=>{if (!removeDom) {return;} let n = start;while (n) {const next = n.nextSibling;n.remove();if (n === end) {break;}n = next;}});return {start,end};}
  function draw(entry,parent,before,locals,owner,childProps) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {const current = cellFor(entry).current;if (current !== (entry[sectionSource] ?? entry)) {entry = projectSchema(entry,[],{attrs: current.attrs,bind: current.bind});}}
    if (entry == null || entry === false) {return;}
    if (Array.isArray(entry)) {for (const child of entry) {draw(child,parent,before,locals,owner,childProps);} return;}
    if (typeof entry === 'string' && entry.startsWith('$slots.') && Object.hasOwn(slots,entry.slice(7))) {
      const args = {parent,before,context,locals,parentNode: locals[formKitParent] ?? parentNode ?? read('node',locals),configScope: locals[formKitScope] ?? configScope,domRoot: locals[formKitDomRoot] ?? domRoot},slot = slots[entry.slice(7)](args);
      if (typeof slot === 'function') {owner.add(()=>slot(removeDom));} else if (slot) {if (typeof slot.update === 'function') {const effect = ()=>slot.update(args);effects.add(effect);owner.add(()=>effects.delete(effect));}owner.add(()=>slot.destroy?.(removeDom));} return;
    }
    if (typeof entry !== 'object') {const text = document.createTextNode('');parent.insertBefore(text,before);owner.add(()=>{if (removeDom) {text.remove();}});binding(entry,locals,owner,value=>{const next = value == null ? '' : String(value);if (text.data !== next) {text.data = next;metric('domWrites');}});return;}
    if (Object.hasOwn(entry,'$formkit')) {
      // Match upstream sugar while preserving lazy/non-enumerable node fields.
      const props = projectSchema(entry,['$formkit','for','if','children','bind'],{type: entry.$formkit});
      entry = projectSchema(entry,Object.getOwnPropertyNames(entry).filter(key=>!['for','if','children','bind'].includes(key)),{$cmp: 'FormKit',props});
    }
    if (entry.for) {
      const [name,keyOrSource,third] = entry.for,source = entry.for.length === 3 ? third : keyOrSource,keyName = entry.for.length === 3 ? keyOrSource : null;
      const bounds = range(parent,before,owner),rows = new Map();
      owner.add(()=>{for (const row of rows.values()) {row.owner.destroy();}rows.clear();});
      const keySchema = entry.attrs?.key ?? entry.props?.key;
      const keyValue = typeof keySchema === 'string' && keySchema.startsWith('$') ?
        compile(keySchema).provide(tokens=>Object.fromEntries(tokens.map(token=>[token,()=>read(token,keyLocals)]))) :
        ()=>keySchema;
      let keyLocals;
      const keyDependencies = createSchemaDependencies();
      owner.add(() => keyDependencies.destroy());
      const move = (row,cursor)=>{
        if (row.end.nextSibling === cursor) {return;}
        let node = row.start;while (node) {const next = node.nextSibling;parent.insertBefore(node,cursor);if (node === row.end) {break;}node = next;}
        metric('structuralChanges');
      };
      binding(source,locals,owner,values=>{
        if (Number.isFinite(values)) {values = Array.from({length: values},(_,i)=>i);}
        const entries = values && typeof values === 'object' ? Object.entries(values) : [],next = [];const keys = new Set();
        keyDependencies.run(() => {
          for (const [key,value] of entries) {
            const inner = Object.assign(Object.create(locals),{[name]: value});Object.defineProperty(inner,iterationScope,{value: true});if (keyName !== null) {inner[keyName] = Array.isArray(values) ? Number(key) : key;}
            keyLocals = inner;const explicit = keyValue();const identity = explicit == null ? (Array.isArray(values) ? Number(key) : key) : String(explicit);
            if (keys.has(identity)) {throw new TypeError(`Duplicate schema iteration key: ${identity}`);}keys.add(identity);next.push({identity,inner});
          }
        });
        for (const [key,row] of rows) {if (!keys.has(key)) {row.owner.destroy();rows.delete(key);metric('structuralChanges');}}
        const ordered = [];
        for (const {identity,inner} of next) {
          let row = rows.get(identity);
          if (row) {Object.assign(row.locals,inner);} else {
            const rowOwner = scope(),rowBounds = range(parent,bounds.end,rowOwner);row = {...rowBounds,owner: rowOwner,locals: inner};rows.set(identity,row);
            try {draw(projectSchema(entry,['for']),parent,row.end,row.locals,rowOwner,childProps);} catch (error) {rowOwner.destroy();rows.delete(identity);throw error;}
            metric('structuralChanges');
          }
          ordered.push(row);
        }
        // Moving a focused ancestor via insertBefore blurs it in browsers.
        // Keep that row attached and reorder only the surrounding ranges.
        const active = parent.getRootNode().activeElement ?? parent.ownerDocument.activeElement;
        const pivot = ordered.findIndex(row=>{for (let n = row.start.nextSibling;n && n !== row.end;n = n.nextSibling) {if (n === active || n.contains?.(active)) {return true;}} return false;});
        const place = (first,last,cursor)=>{for (let i = last;i >= first;i--) {move(ordered[i],cursor);cursor = ordered[i].start;}};
        if (pivot < 0) {place(0,ordered.length - 1,bounds.end);} else {place(pivot + 1,ordered.length - 1,bounds.end);place(0,pivot - 1,ordered[pivot].start);}
      },true);return;
    }
    if (Object.hasOwn(entry,'if')) {const bounds = range(parent,before,owner);let child = scope(),previous;owner.add(()=>child.destroy());const yes = Object.hasOwn(entry,'then') ? entry.then : projectSchema(entry,['if']);binding(entry.if,locals,owner,value=>{const flag = !!value;if (flag === previous) {return;}previous = flag;child.destroy();child = scope();metric('structuralChanges');draw(flag ? yes : entry.else,parent,bounds.end,locals,child,childProps);},false,true);return;}
    if (Object.hasOwn(entry,'$cmp')) {
      const component = typeof entry.$cmp === 'string' ? components[entry.$cmp] : entry.$cmp;
      if (typeof component !== 'function') {throw new TypeError(`Unknown component factory: ${String(entry.$cmp)}`);}
      const container = document.createElement('span');container.style.display = 'contents';parent.insertBefore(container,before);
      let instance,mounted = false,componentKey;const childScopes = new Set();
      const renderChildren = (target = container,beforeChild = null,slotData = {},inheritedProps)=>{
        const child = scope();let closed = false;
        const destroy = (remove = removeDom)=>{if (closed) {return;}closed = true;childScopes.delete(destroy);const previous = removeDom;removeDom = remove;try {child.destroy();} finally {removeDom = previous;}};
        const childLocals = Object.assign(Object.create(locals),slotData);if (Object.hasOwn(slotData,'node')) {childLocals[formKitParent] = slotData.node;}
        childScopes.add(destroy);
        try {draw(entry.children,target,beforeChild,childLocals,child,inheritedProps);return destroy;} catch (error) {destroy();throw error;}
      };
      const dispose = ()=>{instance?.destroy?.(removeDom);for (const destroy of childScopes) {destroy(removeDom);} if (removeDom) {container.replaceChildren();}};
      owner.add(()=>{dispose();if (removeDom) {container.remove();}});
      // Framework-neutral boundary: factories adapt Marionette Views (or DOM)
      // explicitly. React/Vue component objects are not interchangeable here.
      let explicit = {},bound = {},ready = false;
      const applyProps = ()=>{
        if (!ready) {return;} const props = {...(childProps?.() ?? {}),...(bound ?? {}),...(explicit ?? {})};
        if (mounted && Object.is(componentKey,props.key) && typeof instance?.update === 'function') {instance.update(props);return;}
        if (mounted) {dispose();}
        instance = component({props,context,locals,schemaData: data,parentNode: locals[formKitParent] ?? parentNode ?? read('node',locals),domRoot: locals[formKitDomRoot] ?? domRoot,configScope: locals[formKitScope] ?? configScope,hasChildren: entry.children !== undefined,schemaChildren: entry.children,host: container,renderChildren});componentKey = props.key;mounted = true;
      };
      if (entry.bind) {binding(entry.bind,locals,owner,next=>{bound = next;applyProps();});}
      valueBinding(entry.props ?? {},locals,owner,next=>{explicit = next;applyProps();});
      ready = true;if (childProps) {effects.add(applyProps);owner.add(()=>effects.delete(applyProps));}applyProps();if (typeof instance?.refresh === 'function') {const refresh = ()=>instance?.refresh?.();effects.add(refresh);owner.add(()=>effects.delete(refresh));} return;
    }
    if (!Object.hasOwn(entry,'$el')) {throw new TypeError('Unsupported official section node');}
    if (entry.$el === null) {draw(entry.children,parent,before,locals,owner);return;}
    if (entry.$el === 'text') {draw(entry.children,parent,before,locals,owner);return;}
    if (typeof entry.$el === 'string' && entry.$el.startsWith('$')) {
      const bounds = range(parent,before,owner);let child = scope(),previous;owner.add(()=>child.destroy());
      binding(entry.$el,locals,owner,tag=>{if (tag === previous) {return;}previous = tag;child.destroy();child = scope();if (tag != null) {draw(projectSchema(entry,[],{$el: tag}),parent,bounds.end,locals,child,childProps);}});return;
    }
    if (typeof entry.$el !== 'string') {throw new TypeError('Section tag must resolve to a string');}
    const reuse = reuseRoot && !rootUsed && parent === host && host.tagName.toLowerCase() === entry.$el;
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const inSvg = entry.$el === 'svg' || (parent.namespaceURI === svgNamespace && parent.localName !== 'foreignObject');
    const element = reuse ? host : inSvg ? document.createElementNS(svgNamespace,entry.$el) : document.createElement(entry.$el);if (reuse) {rootUsed = true;} else {parent.insertBefore(element,before);owner.add(()=>{if (removeDom) {element.remove();}});}
    const section = entry.meta?.section,refs = read('__fkSectionRefs',locals);
    if (typeof section === 'string' && refs && typeof refs === 'object' && !locals[iterationScope] && !Object.hasOwn(entry.attrs ?? {},'ref')) {
      refs[section] = element;owner.add(()=>{if (refs[section] === element) {refs[section] = null;}});
    }
    let elementRef;owner.add(()=>{if (typeof elementRef === 'function') {elementRef(null);}});
    const listeners = new Map();owner.add(()=>{for (const {event,fn,options} of listeners.values()) {element.removeEventListener(event,fn,options);}});
    const ownedAttrs = new Set();let attrOwner = scope(),classValue,styleValue;owner.add(()=>attrOwner.destroy());
    function attr(name,value) {
      if (name === 'key') {return;}ownedAttrs.add(name);if (name === 'ref') {if (elementRef === value) {return;} if (typeof elementRef === 'function') {elementRef(null);}elementRef = value;if (typeof value === 'function') {value(element);} return;} if (/^on[A-Z]/.test(name)) {
        const passive = /Passive$/i.test(name),event = name.slice(2).replace(/Passive$/i,'').toLowerCase(),options = passive ? {passive: true} : undefined;
        const previous = listeners.get(name);if (previous?.fn === value) {return;}
        if (previous) {element.removeEventListener(previous.event,previous.fn,previous.options);}
        if (typeof value === 'function') {element.addEventListener(event,value,options);listeners.set(name,{event,fn: value,options});} else {listeners.delete(name);} return;
      }
      if (name === 'innerHTML') {const next = value == null ? '' : String(value);if (element.innerHTML !== next) {element.innerHTML = next;metric('domWrites');} return;}
      if (name === 'style' && (value == null || typeof value === 'object')) {
        const next = value ?? {},previous = styleValue && typeof styleValue === 'object' ? styleValue : {};
        if (typeof styleValue === 'string') {element.removeAttribute('style');}
        for (const key of Object.keys(previous)) {if (!(key in next)) {if (key.startsWith('--') || key.includes('-')) {element.style.removeProperty(key);} else {element.style[key] = '';}}}
        for (const [key,part] of Object.entries(next)) {if (previous[key] !== part) {if (key.startsWith('--') || key.includes('-')) {element.style.setProperty(key,part ?? '');} else {element.style[key] = part ?? '';}}}
        styleValue = {...next};return;
      }
      if (name === 'style') {if (styleValue === value) {return;}styleValue = value;}
      if (name === 'class') {if (value && typeof value === 'object') {value = Array.isArray(value) ? value.filter(Boolean).join(' ') : Object.keys(value).filter(key=>value[key]).join(' ');} if (classValue === value) {return;}classValue = value;}
      if (name === 'multiple' || name === 'readOnly' || name === 'required' || name === 'autofocus') {const next = !!value && value !== 'false';if (element[name] !== next) {element[name] = next;metric('domWrites');} return;}
      if (name === 'value') {
      // An option without a value attribute derives its value from label text.
      // Materialize explicit empty values before children are inserted, too.
        if (element.tagName === 'OPTION' && value == null) {if (element.hasAttribute('value')) {element.removeAttribute('value');metric('domWrites');} return;}
        const next = String(value ?? '');if (element.value !== next || (element.tagName === 'OPTION' && !element.hasAttribute('value'))) {element.value = next;metric('domWrites');} return;
      }
      if (name === 'selected') {const next = !!value;if (element.selected !== next) {element.selected = next;metric('domWrites');} return;}
      if (name === 'checked') {const next = !!value;if (element.checked !== next) {element.checked = next;metric('domWrites');} return;}
      if (name === 'disabled') {const next = !!value && value !== 'false';if (element.disabled !== next) {element.disabled = next;metric('domWrites');} return;}
      if ((name.startsWith('aria-') || name.startsWith('data-')) && typeof value === 'boolean') {value = String(value);}
      if (value === undefined || value === null || value === false) {if (element.hasAttribute(name)) {element.removeAttribute(name);metric('domWrites');}} else {const next = String(value);if (element.getAttribute(name) !== next) {element.setAttribute(name,next);metric('domWrites');}}
    }
    const applyAttrs = next=>{
      attrOwner.destroy();attrOwner = scope();const inherited = childProps?.() ?? {};const previous = new Set(ownedAttrs);ownedAttrs.clear();
      if (childProps) {
        let bound = {},explicit = {},ready = false,last = previous;
        const apply = ()=>{if (!ready) {return;} const values = {...inherited,...bound,...explicit};ownedAttrs.clear();for (const [key,value] of Object.entries(values)) {attr(key,value);} for (const key of last) {if (!ownedAttrs.has(key)) {attr(key,undefined);ownedAttrs.delete(key);}}last = new Set(ownedAttrs);};
        const setExplicit = name => value => {explicit[name] = value; apply();};
        if (next.bind) {binding(next.bind,locals,attrOwner,value=>{bound = value ?? {};apply();});}
        if (next.attrs && Object.hasOwn(next.attrs,'if')) {valueBinding(next.attrs,locals,attrOwner,value=>{explicit = value ?? {};apply();});} else {for (const name of Object.getOwnPropertyNames(next.attrs ?? {})) {if (name.startsWith('__raw__')) {explicit[name.slice(7)] = next.attrs[name];} else {valueBinding(next.attrs[name],locals,attrOwner,setExplicit(name));}}}
        ready = true;apply();return;
      }
      // Explicit schema attrs override `bind`, even when their dependencies did
      // not change on this notification. Never let the lower-priority bag write
      // those attributes (or remove them when the bag is cleared).
      const explicitAttrs = new Set(Object.getOwnPropertyNames(next.attrs ?? {}));
      let boundKeys = [];if (next.bind) {binding(next.bind,locals,attrOwner,values=>{for (const key of boundKeys) {if (!(key in (values ?? {}))) {attr(key,inherited[key]);}}boundKeys = Object.keys(values ?? {}).filter(key=>!explicitAttrs.has(key));for (const key of boundKeys) {attr(key,values[key]);}});}
      if (next.attrs && Object.hasOwn(next.attrs,'if')) {
        let previousKeys = [];
        valueBinding(next.attrs,locals,attrOwner,values=>{values = values ?? {};for (const key of previousKeys) {if (!(key in values)) {attr(key,inherited[key]);}}previousKeys = Object.keys(values);for (const [key,value] of Object.entries(values)) {attr(key,value);}});
      } else {
        for (const name of Object.getOwnPropertyNames(next.attrs ?? {})) {
          const value = next.attrs[name];
          if (name.startsWith('__raw__')) {attr(name.slice(7),value);} else {valueBinding(value,locals,attrOwner,attributeValue=>attr(name,attributeValue));}
        }
      }
      for (const name of previous) {if (!ownedAttrs.has(name)) {attr(name,undefined);ownedAttrs.delete(name);}}
    };
    const record = {cell: cellFor(entry),apply: applyAttrs};elements.add(record);owner.add(()=>elements.delete(record));applyAttrs(entry);
    if (childProps) {const update = ()=>applyAttrs(record.cell.current);effects.add(update);owner.add(()=>effects.delete(update));}
    if (!reuse && entry.children !== undefined) {
      const descendants = scope();
      // Remove this owned element as one subtree, as browser renderers do.
      // Descendant resources still dispose, retaining detached DOM ancestry.
      owner.add(()=>{const previous = removeDom;removeDom = false;try {descendants.destroy();} finally {removeDom = previous;}});
      draw(entry.children,element,null,locals,descendants);
    } else {draw(entry.children,element,null,locals,owner);}
  }
  try {draw(schema,host,null,{},root);} catch (error) {dead = true;root.destroy();effects.clear();throw error;}
  const unsubscribe = subscribeReactiveStore(context,()=>{if (dead) {return;}metric('contextNotifications');for (const effect of [...effects]) {if (effects.has(effect)) {effect();}}});
  // Attribute-only schema changes retain DOM and mount-owned plugin resources.
  // Structural changes continue through the caller's existing redraw path.
  const setSchema = next=>{
    if (dead) {return false;}
    const pairs = [],nextByOld = new WeakMap(),oldByNext = new WeakMap();
    const match = (before,after)=>{
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {return Object.is(before,after);}
      if (Array.isArray(before) !== Array.isArray(after) || Object.getPrototypeOf(before) !== Object.getPrototypeOf(after)) {return false;}
      if (nextByOld.has(before)) {return nextByOld.get(before) === after;}
      if (oldByNext.has(after)) {return false;}
      nextByOld.set(before,after);oldByNext.set(after,before);
      const a = Object.getOwnPropertyDescriptors(before),b = Object.getOwnPropertyDescriptors(after),dom = Object.hasOwn(a,'$el');
      const keys = object=>Object.keys(object).filter(key=>!dom || !['attrs','bind'].includes(key));
      const ak = keys(a),bk = keys(b);if (ak.length !== bk.length || ak.some(key=>!bk.includes(key))) {return false;}
      if (dom) {
        const attrsA = a.attrs,attrsB = b.attrs;if (attrsA?.get || attrsB?.get) {return false;}
        const keyA = Object.getOwnPropertyDescriptor(attrsA?.value ?? {},'key'),keyB = Object.getOwnPropertyDescriptor(attrsB?.value ?? {},'key');
        if (keyA?.get !== keyB?.get || !Object.is(keyA?.value,keyB?.value)) {return false;}
      }
      for (const key of ak) {const x = a[key],y = b[key];if (x.get || x.set || y.get || y.set) {if (x.get !== y.get || x.set !== y.set) {return false;}} else if (!match(x.value,y.value)) {return false;}}
      pairs.push([before,after]);return true;
    };
    if (!match(schema,next)) {return false;}
    for (const [before,after] of pairs) {const cell = cellFor(before);cell.current = after;schemaCells.set(after,cell);}
    schema = next;for (const record of elements) {record.apply(record.cell.current);} return true;
  };
  return {setSchema,update() {for (const effect of [...effects]) {if (effects.has(effect)) {effect();}}},refresh() {for (const effect of [...effects]) {if (effects.has(effect)) {effect(true);}}},destroy(remove = true) {if (dead) {return;}removeDom = remove;dead = true;unsubscribe();root.destroy();effects.clear();}};
}

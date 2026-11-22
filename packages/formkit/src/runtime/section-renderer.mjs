// FormKit section-schema DOM interpreter.
// Expression/provider pattern follows FormKit React 2.5 (MIT: LICENSE.formkit).
import { View } from 'marionette';
import { insertNode, removeNode, displayContents, applyStyle } from './dom-operations.mjs';
import { formKitScope, formKitDomRoot, formKitParent } from './provider-scope.mjs';
import { compile, isConditional } from '@formkit/core';
import { createSchemaDependencies } from './schema-registry.mjs';
import { isSchemaPojo,isClassReset,schemaValueKeys } from './schema-value.mjs';
import { subscribeReactiveStore } from './upstream-bindings.mjs';

// Schema producers (including Pro) can expose non-enumerable getters.
// Only project the schema node when removing control keys; spreading it loses
// those getters and can eagerly evaluate children before their row scope exists.
const sectionSource = Symbol('sectionSource');
export const authoredComponentSlots = Symbol('authored component slots');
const disposeNothing = ()=>{};
function projectSchema(entry,omit = [],overrides = {}) {
  const descriptors = Object.getOwnPropertyDescriptors(entry);
  for (const key of omit) {delete descriptors[key];}
  for (const [key,value] of Object.entries(overrides)) {descriptors[key] = {value,enumerable: true,writable: true,configurable: true};}
  descriptors[sectionSource] = {value: entry[sectionSource] ?? entry,configurable: true};
  return Object.create(Object.getPrototypeOf(entry),descriptors);
}

export function renderSections({host,Dom = View.prototype.Dom,schema,context,metrics,slots = {},reuseRoot = false,data = {},components = {},configScope,domRoot,parentNode}) {
  let dead = false,rootUsed = false,removeDom = true;const effects = new Set(),elements = new Set(),schemaCells = new WeakMap();
  const cellFor = entry=>{const source = entry[sectionSource] ?? entry;let cell = schemaCells.get(source);if (!cell) {cell = {current: source};schemaCells.set(source,cell);} return cell;};
  const iterationScope = Symbol('iteration scope'), scopedEffects = Symbol('outlet effects'),methodBindings = new WeakMap();
  function registerEffect(effect,locals,owner) {
    const outlets = locals[scopedEffects];
    effects.add(effect);for (let outlet = outlets;outlet;outlet = outlet.parent) {outlet.effects.add(effect);}
    owner.add(()=>{effects.delete(effect);for (let outlet = outlets;outlet;outlet = outlet.parent) {outlet.effects.delete(effect);}});
  }
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
    registerEffect(effect,locals,owner);effect(true);
  }
  // Recursively resolve schema attributes, including conditional objects and
  // expression-bearing style/props bags. Keep subscriptions in the owning scope.
  function valueBinding(value,locals,owner,apply,key = '',deep = false,arrayBag = false) {
    if (isSchemaPojo(value) && isConditional(value)) {
      let branch = scope();owner.add(()=>branch.destroy());
      binding(value.if,locals,owner,test=>{branch.destroy();branch = scope();valueBinding(test ? value.then : value.else,locals,branch,apply,key,false,true);},false,true);
    } else if (isSchemaPojo(value) || ((deep || arrayBag) && Array.isArray(value))) {
      const array = Array.isArray(value),result = Object.create(null);let ready = false;
      const snapshot = ()=>array ? Object.assign(new Array(value.length),result) : {...result};
      const setProperty = name => next => {result[name] = next;if (ready) {apply(snapshot());}};
      for (const {source,key: name,raw,deep: nested} of schemaValueKeys(value,deep)) {
        if (raw) {result[name] = value[source];continue;}valueBinding(value[source],locals,owner,setProperty(name),name,nested);
      }
      ready = true;apply(snapshot());
    } else if (isClassReset(value,key)) {apply(value);} else {binding(value,locals,owner,apply);}
  }
  function bindExplicitAttributes(bag,locals,owner,setProperty) {
    for (const {source,key,raw,deep} of schemaValueKeys(bag)) {
      const apply = setProperty(key);
      if (raw) {apply(bag[source]);} else {valueBinding(bag[source],locals,owner,apply,key,deep);}
    }
  }
  function range(parent,before,owner) {const start = parent.ownerDocument.createComment('section'),end = parent.ownerDocument.createComment('/section');insertNode(Dom,parent,start,before);insertNode(Dom,parent,end,before);owner.add(()=>{if (!removeDom) {return;} let n = start;while (n) {const next = n.nextSibling;removeNode(Dom,n);if (n === end) {break;}n = next;}});return {start,end};}
  function draw(entry,parent,before,locals,owner,childProps) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {const current = cellFor(entry).current;if (current !== (entry[sectionSource] ?? entry)) {entry = projectSchema(entry,[],{attrs: current.attrs,bind: current.bind});}}
    if (entry == null || entry === false) {return;}
    if (Array.isArray(entry)) {for (const child of entry) {draw(child,parent,before,locals,owner,childProps);} return;}
    if (typeof entry === 'string' && entry.startsWith('$slots.') && Object.hasOwn(slots,entry.slice(7))) {
      const args = {parent,before,context,locals,parentNode: locals[formKitParent] ?? parentNode ?? read('node',locals),configScope: locals[formKitScope] ?? configScope,domRoot: locals[formKitDomRoot] ?? domRoot},slot = slots[entry.slice(7)](args);
      if (typeof slot === 'function') {owner.add(()=>slot(removeDom));} else if (slot) {if (typeof slot.update === 'function') {const effect = ()=>slot.update(args);registerEffect(effect,locals,owner);}owner.add(()=>slot.destroy?.(removeDom));} return;
    }
    if (typeof entry !== 'object') {const text = parent.ownerDocument.createTextNode('');insertNode(Dom,parent,text,before);owner.add(()=>{if (removeDom) {removeNode(Dom,text);}});binding(entry,locals,owner,value=>{const next = value == null ? '' : String(value);if (text.data !== next) {text.data = next;metric('domWrites');}});return;}
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
        let node = row.start;while (node) {const next = node.nextSibling;insertNode(Dom,parent,node,cursor);if (node === row.end) {break;}node = next;}
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
      const container = Dom.createElement('span');displayContents(Dom,container);insertNode(Dom,parent,container,before);
      let instance,mounted = false,componentKey,generation = 0;const childScopes = new Set();
      const authored = entry.slots;
      const slotContent = name=>Object.hasOwn(authored ?? {},name) && authored[name] != null ? authored[name] : name === 'default' ? entry.children : undefined;
      const mountOutlet = (content,target,beforeChild,slotData,inheritedProps,tracked = false)=>{
        const child = scope();let closed = false;
        const destroy = (remove = removeDom)=>{if (closed) {return;}closed = true;childScopes.delete(destroy);const previous = removeDom;removeDom = remove;try {child.destroy();} finally {removeDom = previous;}};
        const setProps = next=>{
          Object.assign(childLocals,next);
          if (Object.hasOwn(next,'node')) {childLocals[formKitParent] = next.node;}
        };
        const childLocals = Object.create(locals);
        function put(next) {
          for (const key of Reflect.ownKeys(childLocals)) {if (key !== scopedEffects) {delete childLocals[key];}}
          setProps(next);
        }
        const outletEffects = tracked ? {effects: new Set(),parent: locals[scopedEffects]} : undefined;
        if (outletEffects) {Object.defineProperty(childLocals,scopedEffects,{value: outletEffects});}
        setProps(slotData);childScopes.add(destroy);
        try {draw(content,target,beforeChild,childLocals,child,inheritedProps);} catch (error) {destroy();throw error;}
        return tracked ? {
          update(next = {}) {if (closed) {return;}put(next);for (const effect of [...outletEffects.effects]) {if (outletEffects.effects.has(effect)) {effect();}}},
          destroy,
        } : destroy;
      };
      const dispose = ()=>{generation++;instance?.destroy?.(removeDom);for (const destroy of childScopes) {destroy(removeDom);} if (removeDom) {Dom.detachContents(container);}};
      owner.add(()=>{dispose();if (removeDom) {removeNode(Dom,container);}});
      // Framework-neutral boundary: factories adapt Marionette Views (or DOM)
      // explicitly. React/Vue component objects are not interchangeable here.
      let explicit = {},bound = {},ready = false,lastProps;
      const retainStaticFactory = childProps && (Object.values(authored ?? {}).some(content=>content != null) || locals[scopedEffects]);
      const applyProps = ()=>{
        if (!ready) {return;} const props = {...(childProps?.() ?? {}),...(bound ?? {}),...(explicit ?? {})};
        if (mounted && retainStaticFactory && typeof instance?.update !== 'function' && Object.keys(props).length === Object.keys(lastProps).length && Object.keys(props).every(key=>Object.hasOwn(lastProps,key) && Object.is(props[key],lastProps[key]))) {return;}
        if (mounted && Object.is(componentKey,props.key) && typeof instance?.update === 'function') {instance.update(props);return;}
        if (mounted) {dispose();}
        const current = generation;
        const renderChildren = (target = container,beforeChild = null,slotData = {},inheritedProps)=>current !== generation ? disposeNothing : mountOutlet(slotContent('default'),target,beforeChild,slotData,inheritedProps);
        const renderSlot = (name,target = container,beforeChild = null,slotData = {})=>{
          const content = slotContent(name);
          if (content == null || current !== generation) {return undefined;}
          return mountOutlet(content,target,beforeChild,slotData,undefined,true);
        };
        instance = component({props,context,locals,schemaData: data,parentNode: locals[formKitParent] ?? parentNode ?? read('node',locals),domRoot: locals[formKitDomRoot] ?? domRoot,configScope: locals[formKitScope] ?? configScope,hasChildren: slotContent('default') !== undefined,schemaChildren: entry.children,[authoredComponentSlots]: authored,host: container,renderChildren,renderSlot});componentKey = props.key;lastProps = props;mounted = true;
      };
      if (entry.bind) {binding(entry.bind,locals,owner,next=>{bound = next;applyProps();});}
      valueBinding(entry.props ?? {},locals,owner,next=>{explicit = next;applyProps();});
      ready = true;if (childProps) {registerEffect(applyProps,locals,owner);}applyProps();if (typeof instance?.refresh === 'function') {const refresh = ()=>instance?.refresh?.();registerEffect(refresh,locals,owner);} return;
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
    const element = reuse ? host : inSvg ? parent.ownerDocument.createElementNS(svgNamespace,entry.$el) : Dom.createElement(entry.$el);if (reuse) {rootUsed = true;} else {insertNode(Dom,parent,element,before);owner.add(()=>{if (removeDom) {removeNode(Dom,element);}});}
    const section = entry.meta?.section;
    const refs = typeof section === 'string' && !locals[iterationScope] ? read('__fkSectionRefs',locals) : undefined;
    let syncAutomaticRef;
    if (refs && typeof refs === 'object') {
      let captured = false;
      syncAutomaticRef = capture=>{
        if (capture === captured) {return;}captured = capture;
        if (capture) {refs[section] = element;} else if (refs[section] === element) {refs[section] = null;}
      };
      owner.add(()=>syncAutomaticRef(false));
    }
    let elementRef;owner.add(()=>{if (typeof elementRef === 'function') {elementRef(null);}});
    const listeners = new Map();owner.add(()=>{for (const {event,fn,options} of listeners.values()) {element.removeEventListener(event,fn,options);}});
    const ownedAttrs = new Set();let attrOwner = scope(),classValue,styleValue;owner.add(()=>attrOwner.destroy());
    function attr(name,value) {
      if (name === 'key') {return;}ownedAttrs.add(name);if (name === 'ref') {syncAutomaticRef?.(false);if (elementRef === value) {return;} if (typeof elementRef === 'function') {elementRef(null);}elementRef = value;if (typeof value === 'function') {value(element);} return;} if (/^on[A-Z]/.test(name)) {
        const passive = /Passive$/i.test(name),event = name.slice(2).replace(/Passive$/i,'').toLowerCase(),options = passive ? {passive: true} : undefined;
        const previous = listeners.get(name);if (previous?.fn === value) {return;}
        if (previous) {element.removeEventListener(previous.event,previous.fn,previous.options);}
        if (typeof value === 'function') {element.addEventListener(event,value,options);listeners.set(name,{event,fn: value,options});} else {listeners.delete(name);} return;
      }
      // Raw markup belongs to a dedicated section outlet, not managed contents.
      if (name === 'innerHTML') {
        if (reuse || entry.children != null) {throw new TypeError('Section raw HTML requires a dedicated element without managed children');}
        const next = value == null ? '' : String(value);
        if (element.innerHTML !== next) {Dom.setUnsafeHtml(element,next);metric('domWrites');}
        return;
      }
      if (name === 'style' && (value == null || typeof value === 'object')) {
        const next = value ?? {},previous = styleValue && typeof styleValue === 'object' ? styleValue : {};
        applyStyle(Dom,element,next,previous,typeof styleValue === 'string');
        styleValue = {...next};return;
      }
      if (name === 'style') {if (styleValue === value) {return;}styleValue = value;}
      if (name === 'class') {if (value && typeof value === 'object') {value = Array.isArray(value) ? value.filter(Boolean).join(' ') : Object.keys(value).filter(key=>value[key]).join(' ');} if (classValue === value) {return;}classValue = value;}
      if (name === 'multiple' || name === 'readOnly' || name === 'required' || name === 'autofocus') {const next = !!value && value !== 'false';if (element[name] !== next) {element[name] = next;metric('domWrites');} return;}
      if (name === 'value') {
      // An option without a value attribute derives its value from label text.
      // Materialize explicit empty values before children are inserted, too.
        if (element.tagName === 'OPTION' && value == null) {if (element.hasAttribute('value')) {Dom.setAttributes(element,{value: null});metric('domWrites');} return;}
        const next = String(value ?? '');if (element.value !== next || (element.tagName === 'OPTION' && !element.hasAttribute('value'))) {element.value = next;metric('domWrites');} return;
      }
      if (name === 'selected') {const next = !!value;if (element.selected !== next) {element.selected = next;metric('domWrites');} return;}
      if (name === 'checked') {const next = !!value;if (element.checked !== next) {element.checked = next;metric('domWrites');} return;}
      if (name === 'disabled') {const next = !!value && value !== 'false';if (element.disabled !== next) {element.disabled = next;metric('domWrites');} return;}
      if ((name.startsWith('aria-') || name.startsWith('data-')) && typeof value === 'boolean') {value = String(value);}
      if (value === undefined || value === null || value === false) {if (element.hasAttribute(name)) {Dom.setAttributes(element,{[name]: null});metric('domWrites');}} else {const next = String(value);if (element.getAttribute(name) !== next) {Dom.setAttributes(element,{[name]: next});metric('domWrites');}}
    }
    function removeAttr(name,value) {
      if (name !== 'ref') {attr(name,value);return;}
      // Clearing a key is different from supplying an explicit undefined ref.
      ownedAttrs.delete(name);
      if (typeof elementRef === 'function') {elementRef(null);}
      elementRef = undefined;syncAutomaticRef?.(true);
    }
    const applyAttrs = next=>{
      attrOwner.destroy();attrOwner = scope();const inherited = childProps?.() ?? {};const previous = new Set(ownedAttrs);ownedAttrs.clear();
      // A whole conditional attrs bag replaces the section's bind source.
      const conditionalAttrs = isConditional(next.attrs);
      const hasBind = !conditionalAttrs && next.bind;
      let boundNames;
      if (hasBind) {
        // FormKit excludes declared keys from bind, then assigns raw literals
        // under their normalized names. Protect both spellings on updates.
        const names = Object.getOwnPropertyNames(next.attrs ?? {}),explicit = new Set(names);
        for (const {key} of schemaValueKeys(next.attrs ?? {})) {explicit.add(key);}
        boundNames = values=>Object.keys(values ?? {}).filter(key=>!explicit.has(key));
      }
      if (childProps) {
        let bound = {},explicit = {},ready = false,last = previous;
        const apply = ()=>{if (!ready) {return;} const values = {...inherited,...bound,...explicit};ownedAttrs.clear();for (const [key,value] of Object.entries(values)) {attr(key,value);} for (const key of last) {if (!ownedAttrs.has(key)) {removeAttr(key,undefined);ownedAttrs.delete(key);}}last = new Set(ownedAttrs);};
        const setExplicit = name => value => {explicit[name] = value; apply();};
        if (hasBind) {binding(next.bind,locals,attrOwner,value=>{bound = Object.fromEntries(boundNames(value).map(key=>[key,value[key]]));apply();});}
        if (conditionalAttrs) {valueBinding(next.attrs,locals,attrOwner,value=>{explicit = value ?? {};apply();});} else {bindExplicitAttributes(next.attrs ?? {},locals,attrOwner,setExplicit);}
        ready = true;apply();return;
      }
      // Explicit schema attrs override `bind`, even when their dependencies did
      // not change on this notification. Never let the lower-priority bag write
      // those attributes (or remove them when the bag is cleared).
      let boundKeys = [];if (hasBind) {binding(next.bind,locals,attrOwner,values=>{const keys = boundNames(values);for (const key of boundKeys) {if (key === 'ref' ? !keys.includes(key) : !(key in (values ?? {}))) {removeAttr(key,inherited[key]);}}boundKeys = keys;for (const key of boundKeys) {attr(key,values[key]);}});}
      if (conditionalAttrs) {
        let previousKeys = [];
        valueBinding(next.attrs,locals,attrOwner,values=>{values = values ?? {};for (const key of previousKeys) {if (key === 'ref' ? !Object.prototype.propertyIsEnumerable.call(values,key) : !(key in values)) {removeAttr(key,inherited[key]);}}previousKeys = Object.keys(values);for (const [key,value] of Object.entries(values)) {attr(key,value);}});
      } else {
        bindExplicitAttributes(next.attrs ?? {},locals,attrOwner,name=>value=>attr(name,value));
      }
      for (const name of previous) {if (!ownedAttrs.has(name)) {removeAttr(name,undefined);ownedAttrs.delete(name);}}
    };
    const record = {cell: cellFor(entry),apply: applyAttrs};elements.add(record);owner.add(()=>elements.delete(record));applyAttrs(entry);if (syncAutomaticRef && !ownedAttrs.has('ref')) {syncAutomaticRef(true);}
    if (childProps) {const update = ()=>applyAttrs(record.cell.current);registerEffect(update,locals,owner);}
    if (!reuse && entry.children !== undefined) {
      const descendants = scope();
      // Remove this owned element as one subtree, as browser renderers do.
      // Descendant resources still dispose, retaining detached DOM ancestry.
      owner.add(()=>{const previous = removeDom;removeDom = false;try {descendants.destroy();} finally {removeDom = previous;}});
      draw(entry.children,element,null,locals,descendants);
    } else {draw(entry.children,element,null,locals,owner);}
  }
  try {draw(schema,host,null,{},root);} catch (error) {dead = true;try {root.destroy();} catch { /* Preserve the construction error. */ }effects.clear();throw error;}
  const unsubscribe = subscribeReactiveStore(context,()=>{if (dead) {return;}metric('contextNotifications');for (const effect of [...effects]) {if (effects.has(effect)) {effect();}}});
  // Attribute-only schema changes retain DOM and mount-owned plugin resources.
  // Structural changes continue through the caller's existing redraw path.
  const setSchema = next=>{
    if (dead) {return false;}
    const pairs = [],nextByOld = new WeakMap(),oldByNext = new WeakMap();
    const match = (before,after)=>{
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {return Object.is(before,after);}
      const array = Array.isArray(before),prototype = Object.getPrototypeOf(before);
      if (array !== Array.isArray(after) || prototype !== Object.getPrototypeOf(after)) {return false;}
      // Opaque values can carry state outside their own property descriptors.
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {return Object.is(before,after);}
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

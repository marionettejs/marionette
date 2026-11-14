// Adapted from @formkit/react 2.5.0 published reactiveStore.ts/bindings.ts.
// Copyright (c) 2021-2026 FormKit, Inc. MIT: LICENSE.formkit.
// Removed React hook; added observer ownership cleanup and explicit cache refresh.
import {createMessage,createClasses,generateClassList} from '@formkit/core';
import {cloneAny,camel,token,undefine,shallowClone,eq,has,empty} from '@formkit/utils';
import {createObserver} from '@formkit/observer';
const __getOwnPropNames=Object.getOwnPropertyNames;
const __esm=(fn,res)=>function(){return fn&&(res=(0,fn[__getOwnPropNames(fn)[0]])(fn=0)),res;};
function isObject2(value) {
  return typeof value === "object" && value !== null;
}
function getReactiveStore(target) {
  if (!isObject2(target)) return void 0;
  return target[formKitReactiveStoreSymbol];
}
function ensureReactiveStore(target) {
  if (!isObject2(target)) {
    throw new Error("FormKit reactive stores can only be attached to objects.");
  }
  const existing = getReactiveStore(target);
  if (existing) return existing;
  const store = {
    version: 0,
    dead: false,
    pending: false,
    subscribers: /* @__PURE__ */ new Set()
  };
  Object.defineProperty(target, formKitReactiveStoreSymbol, {
    value: store,
    enumerable: false,
    configurable: true,
    writable: false
  });
  return store;
}
function notifyReactiveStore(target) {
  const store = getReactiveStore(target);
  if (!store || store.dead) return;
  store.version++;
  if (store.pending) return;
  store.pending = true;
  queueMicrotask(() => {
    store.pending = false;
    const subscribers = Array.from(store.subscribers);
    subscribers.forEach((subscriber) => { if (store.subscribers.has(subscriber)) subscriber(); });
  });
}
function clearReactiveStore(target) {
  const store = getReactiveStore(target);
  if (!store) return;
  store.dead = true;
  store.subscribers.clear();
}
function subscribeReactiveStore(target, subscriber) {
  const store = getReactiveStore(target);
  if (!store || store.dead) return () => {
  };
  store.subscribers.add(subscriber);
  return () => {
    store.subscribers.delete(subscriber);
  };
}
var formKitReactiveStoreSymbol;
var init_reactiveStore = __esm({
  "packages/react/src/reactiveStore.ts"() {
    formKitReactiveStoreSymbol = /* @__PURE__ */ Symbol.for(
      "FormKitReactiveStore"
    );
  }
});
function computeValidationVisible(context, validationVisibility, hasShownErrors) {
  if (!context.state) return false;
  if (context.state.submitted) return true;
  if (!hasShownErrors && !context.state.settled) {
    return false;
  }
  return visibilityModes(validationVisibility).some((mode) => {
    switch (mode) {
      case "live":
        return true;
      case "blur":
        return context.state.blurred;
      case "dirty":
        return context.state.dirty;
      default:
        return false;
    }
  });
}
function visibilityModes(value) {
  return String(value ?? "").split(/[\s,|]+/).filter(Boolean);
}
function createReactiveContextBag(value, onMutate) {
  return new Proxy(value, {
    set(target, property, next, receiver) {
      const previous = Reflect.get(target, property, receiver);
      const didSet = Reflect.set(target, property, next, receiver);
      if (didSet && previous !== next) {
        onMutate();
      }
      return didSet;
    },
    deleteProperty(target, property) {
      const had = Reflect.has(target, property);
      const didDelete = Reflect.deleteProperty(target, property);
      if (didDelete && had) {
        onMutate();
      }
      return didDelete;
    }
  });
}
function isPlainObject2(value) {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
function shallowEqualObjects2(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
function hasContextValueChanged(current, next) {
  if (Object.is(current, next)) return false;
  if (Array.isArray(current) && Array.isArray(next)) {
    if (current.length !== next.length) return true;
    for (let i = 0; i < current.length; i++) {
      if (!Object.is(current[i], next[i])) return true;
    }
    return false;
  }
  if (isPlainObject2(current) && isPlainObject2(next)) {
    return !shallowEqualObjects2(current, next);
  }
  return true;
}
function getReactListItems(node) {
  return node.children.map((child) => {
    if (!listItemKeys.has(child.uid)) {
      listItemKeys.set(child.uid, `fk-item-${nextListItemKey++}`);
    }
    return listItemKeys.get(child.uid);
  });
}
var listItemKeys, nextListItemKey, reactBindings, bindings_default;
var init_bindings = __esm({
  "packages/react/src/bindings.ts"() {
    init_reactiveStore();
    listItemKeys = /* @__PURE__ */ new Map();
    nextListItemKey = 0;
    reactBindings = function reactBindings2(node) {
      node.ledger.count("blocking", (m) => m.blocking);
      node.ledger.count("errors", (m) => m.type === "error");
      let hasTicked = false;
      queueMicrotask(() => {
        hasTicked = true;
      });
      const availableMessages = node.store.reduce(
        (store, message3) => {
          if (message3.visible) {
            store[message3.key] = message3;
          }
          return store;
        },
        {}
      );
      let validationVisibility = node.props.validationVisibility || (node.props.type === "checkbox" ? "dirty" : "blur");
      let hasShownErrors = visibilityModes(validationVisibility).includes("live");
      let isRequired = false;
      const checkForRequired = (parsedRules) => {
        isRequired = (parsedRules ?? []).some((rule) => rule.name === "required");
      };
      checkForRequired(node.props.parsedRules);
      let hasValidation = Array.isArray(node.props.parsedRules) && node.props.parsedRules.length > 0;
      const ui = node.store.reduce((messages3, msg) => {
        if (msg.type === "ui" && msg.visible) {
          messages3[msg.key] = msg;
        }
        return messages3;
      }, {});
      let contextAlive = true;
      const cachedClasses = {};
      const classObservers = new Set();
      const classes = new Proxy(cachedClasses, {
        get(target, property, receiver) {
          if (!node || !contextAlive) return "";
          let className = Reflect.get(target, property, receiver);
          if (!className && typeof property === "string") {
            if (!has(target, property)) {
              const observedNode = createObserver(node);
              classObservers.add(observedNode);
              let initialized = false;
              observedNode.watch((observed) => {
                const rootClasses = typeof observed.config.rootClasses === "function" ? observed.config.rootClasses(property, observed) : {};
                const globalConfigClasses = observed.config.classes ? createClasses(
                  property,
                  observed,
                  observed.config.classes[property]
                ) : {};
                const classesPropClasses = createClasses(
                  property,
                  observed,
                  observed.props[`_${property}Class`]
                );
                const sectionPropClasses = createClasses(
                  property,
                  observed,
                  observed.props[`${property}Class`]
                );
                const generatedClassName = generateClassList(
                  observed,
                  property,
                  rootClasses,
                  globalConfigClasses,
                  classesPropClasses,
                  sectionPropClasses
                ) ?? "";
                className = generatedClassName;
                target[property] = generatedClassName;
                if (initialized) {
                  notifyReactiveStore(context);
                } else {
                  initialized = true;
                }
              });
            }
          }
          return className ?? "";
        }
      });
      let committedValue = node.value;
      let inputValue = node.value;
      let pendingDOMInputValue;
      const domInputValue = (payload) => {
        if (typeof pendingDOMInputValue === "string" && typeof node.props.number !== "undefined" && node.props.number !== "integer" && typeof payload === "number" && Number.isFinite(payload) && pendingDOMInputValue.includes(".") && pendingDOMInputValue !== String(payload)) {
          return pendingDOMInputValue;
        }
        return payload;
      };
      let contextRef;
      const notifyContextMutation = () => {
        if (contextRef) notifyReactiveStore(contextRef);
      };
      const fns = createReactiveContextBag(
        {
          length: (obj) => Object.keys(obj).length,
          number: (value) => Number(value),
          string: (value) => String(value),
          json: (value) => JSON.stringify(value),
          eq: eq
        },
        notifyContextMutation
      );
      const handlers = createReactiveContextBag(
        {
          blur: (e) => {
            if (!node) return;
            node.store.set(
              /* @__PURE__ */ createMessage({ key: "blurred", visible: false, value: true })
            );
            const onBlur = node.props.attrs?.onBlur;
            if (typeof onBlur === "function") {
              onBlur(e);
            }
          },
          touch: () => {
            const doCompare = context.dirtyBehavior === "compare";
            if (node.store.dirty?.value && !doCompare) return;
            const dirty = !eq(node.props._init, node._value);
            if (!dirty && !doCompare) return;
            node.store.set(
              /* @__PURE__ */ createMessage({ key: "dirty", visible: false, value: dirty })
            );
          },
          DOMInput: (e) => {
            pendingDOMInputValue = e.target.value;
            node.input(pendingDOMInputValue);
            node.emit("dom-input-event", e);
          }
        },
        notifyContextMutation
      );
      const sectionRefs = {};
      const context = {
        _value: inputValue,
        attrs: node.props.attrs,
        disabled: node.props.disabled,
        describedBy: void 0,
        fns,
        handlers,
        help: node.props.help,
        id: node.props.id,
        items: getReactListItems(node),
        label: node.props.label,
        messages: {},
        didMount: false,
        node,
        options: node.props.options,
        defaultMessagePlacement: true,
        slots: node.props.__slots,
        state: {
          blurred: false,
          complete: false,
          dirty: false,
          empty: empty(committedValue),
          submitted: false,
          settled: node.isSettled,
          valid: !node.ledger.value("blocking"),
          invalid: false,
          errors: !!node.ledger.value("errors"),
          rules: hasValidation,
          validationVisible: false,
          required: isRequired,
          failing: false,
          passing: true
        },
        type: node.props.type,
        family: node.props.family,
        ui,
        value: committedValue,
        classes,
        // Section DOM elements (#200). Plain object: writing a ref never
        // notifies the reactive store, so it can't cause re-renders.
        refs: sectionRefs
      };
      Object.defineProperty(context, "__fkSectionRefs", {
        value: sectionRefs,
        enumerable: false
      });
      let emptyDirty = false;
      let emptyCache = context.state.empty;
      if (node.type !== "input") {
        Object.defineProperty(context.state, "empty", {
          enumerable: true,
          configurable: true,
          get() {
            if (emptyDirty) {
              emptyCache = empty(context.value);
              emptyDirty = false;
            }
            return emptyCache;
          },
          set(value) {
            emptyCache = value;
            emptyDirty = false;
          }
        });
      }
      const markEmptyDirty = (payload) => {
        if (node.type !== "input") emptyDirty = true;
        else context.state.empty = empty(payload);
      };
      let valuePayload;
      let valueDirty = false;
      let valueCache = context.value;
      let _valuePayload;
      let _valueDirty = false;
      let _valueCache = context._value;
      let _valueLinked = false;
      if (node.type !== "input") {
        Object.defineProperty(context, "value", {
          enumerable: true,
          configurable: true,
          get() {
            if (valueDirty) {
              valueCache = shallowClone(valuePayload);
              valueDirty = false;
            }
            return valueCache;
          },
          set(value) {
            valueCache = value;
            valueDirty = false;
          }
        });
        Object.defineProperty(context, "_value", {
          enumerable: true,
          configurable: true,
          get() {
            if (_valueLinked) return context.value;
            if (_valueDirty) {
              _valueCache = shallowClone(_valuePayload);
              _valueDirty = false;
            }
            return _valueCache;
          },
          set(value) {
            _valueLinked = false;
            _valueCache = value;
            _valueDirty = false;
          }
        });
      }
      const markAggregateCommitted = (payload) => {
        valuePayload = payload;
        valueDirty = true;
        _valueLinked = true;
        _valueDirty = false;
      };
      const markAggregateInput = (payload) => {
        _valueLinked = false;
        _valuePayload = payload;
        _valueDirty = true;
      };
      contextRef = context;
      ensureReactiveStore(context);
      function recalculateContextState() {
        context.state.required = isRequired;
        context.state.rules = hasValidation;
        context.state.passing = !context.state.failing;
        context.state.validationVisible = computeValidationVisible(
          context,
          validationVisibility,
          hasShownErrors
        );
        if (context.state.validationVisible) {
          hasShownErrors = true;
        }
        const visibleMessages = {};
        for (const key in availableMessages) {
          const message3 = availableMessages[key];
          if (message3.type !== "validation" || context.state.validationVisible) {
            visibleMessages[key] = message3;
          }
        }
        context.messages = visibleMessages;
        context.state.invalid = context.state.failing && context.state.validationVisible;
        context.state.complete = hasValidation ? context.state.valid && !context.state.errors : context.state.dirty && !empty(context.value);
        const describers = [];
        if (context.help) {
          describers.push(`help-${node.props.id}`);
        }
        for (const key in context.messages) {
          describers.push(`${node.props.id}-${key}`);
        }
        context.describedBy = describers.length ? describers.join(" ") : void 0;
      }
      function flush() {
        recalculateContextState();
        notifyReactiveStore(context);
      }
      node.on("prop:validationVisibility", ({ payload }) => {
        validationVisibility = payload;
        flush();
      });
      node.on("prop:parsedRules", ({ payload }) => {
        checkForRequired(payload);
        hasValidation = Array.isArray(payload) && payload.length > 0;
        flush();
      });
      node.on("prop:rootClasses", () => {
        for (const key of Object.keys(cachedClasses)) {
          delete cachedClasses[key];
        }
        flush();
      });
      node.on("created", () => {
        if (!eq(context.value, node.value)) {
          inputValue = node.value;
          committedValue = node.value;
          context._value = inputValue;
          context.value = committedValue;
        }
        (async () => {
          await node.settled;
          if (node) node.props._init = cloneAny(node.value);
        })();
        flush();
      });
      node.on("mounted", () => {
        context.didMount = true;
        flush();
      });
      node.on("settled", ({ payload: isSettled }) => {
        context.state.settled = isSettled;
        flush();
      });
      const observedContextProps = /* @__PURE__ */ new Set();
      function observeProps(observe) {
        const propNames = Array.isArray(observe) ? observe : Object.keys(observe);
        propNames.forEach((prop) => {
          prop = camel(prop);
          if (observedContextProps.has(prop)) return;
          observedContextProps.add(prop);
          if (!has(context, prop)) {
            context[prop] = node.props[prop];
          }
          node.on(`prop:${prop}`, ({ payload }) => {
            const key = prop;
            if (!hasContextValueChanged(context[key], payload)) return;
            context[key] = payload;
            flush();
          });
        });
      }
      const rootProps = () => {
        const props = [
          "__root",
          "help",
          "label",
          "disabled",
          "options",
          "type",
          "attrs",
          "preserve",
          "preserveErrors",
          "id",
          "dirtyBehavior"
        ];
        const iconPattern = /^[a-zA-Z-]+(?:-icon|Icon)$/;
        const matchingProps = Object.keys(node.props).filter((prop) => {
          return iconPattern.test(prop);
        });
        return props.concat(matchingProps);
      };
      observeProps(rootProps());
      function definedAs(definition3) {
        if (definition3.props) observeProps(definition3.props);
      }
      node.props.definition && definedAs(node.props.definition);
      node.on("added-props", ({ payload }) => observeProps(payload));
      node.on("input", ({ payload }) => {
        if (node.type !== "input") {
          markAggregateInput(payload);
        } else {
          context._value = domInputValue(payload);
        }
        flush();
      });
      node.on("commitRaw", ({ payload }) => {
        if (node.type !== "input") {
          markAggregateCommitted(payload);
        } else {
          context.value = payload;
          context._value = domInputValue(payload);
        }
        pendingDOMInputValue = void 0;
        markEmptyDirty(payload);
        queueMicrotask(() => {
          if (node) node.emit("modelUpdated");
        });
        flush();
      });
      node.on("commit", ({ payload }) => {
        if ((!context.state.dirty || context.dirtyBehavior === "compare") && node.isCreated && hasTicked) {
          if (!node.store.validating?.value) {
            context.handlers.touch();
          } else {
            const receipt = node.on("message-removed", ({ payload: message3 }) => {
              if (message3.key === "validating") {
                context.handlers.touch();
                node.off(receipt);
              }
            });
          }
        }
        if (node.type === "input" && context.state.complete && context.state.errors && !undefine(node.props.preserveErrors)) {
          node.store.filter(
            (message3) => !(message3.type === "error" && message3.meta?.autoClear === true)
          );
        }
        if (node.type === "list" && node.sync) {
          context.items = getReactListItems(node);
        }
        markEmptyDirty(payload);
        flush();
      });
      const updateState = (message3) => {
        if (message3.type === "ui" && message3.visible && !message3.meta.showAsMessage) {
          ui[message3.key] = message3;
        } else if (message3.visible) {
          availableMessages[message3.key] = message3;
        } else if (message3.type === "state") {
          context.state[message3.key] = !!message3.value;
        }
        flush();
      };
      node.on("message-added", (e) => updateState(e.payload));
      node.on("message-updated", (e) => updateState(e.payload));
      node.on("message-removed", ({ payload: message3 }) => {
        delete ui[message3.key];
        delete availableMessages[message3.key];
        delete context.state[message3.key];
        flush();
      });
      node.on("settled:blocking", () => {
        context.state.valid = true;
        flush();
      });
      node.on("unsettled:blocking", () => {
        context.state.valid = false;
        flush();
      });
      node.on("settled:errors", () => {
        context.state.errors = false;
        flush();
      });
      node.on("unsettled:errors", () => {
        context.state.errors = true;
        flush();
      });
      context.refreshClasses = () => { if (!contextAlive) return; for(const observed of classObservers) observed.kill(); classObservers.clear(); for(const key of Object.keys(cachedClasses)) delete cachedClasses[key]; notifyReactiveStore(context); };
      for(const event of ["config:classes","config:rootClasses","prop:rootClasses"])node.on(event,context.refreshClasses);
      node.context = context;
      flush();
      node.emit("context", node, false);
      node.on("destroyed", () => {
        contextAlive = false;
        for (const observed of classObservers) observed.kill();
        classObservers.clear();
        clearReactiveStore(context);
        node.context = void 0;
      });
    };
    bindings_default = reactBindings;
  }
});

init_bindings();
export {bindings_default as bindings, subscribeReactiveStore, getReactiveStore};

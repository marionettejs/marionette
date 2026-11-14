# Single-checkbox upstream expectations

Read-only adapter comparison, @formkit/vue and @formkit/react 2.5.0; script `checkbox-upstream.mjs`. Both passed the same JSDOM component fixture with stable initial form-value identity. Initial probe setup lacked getComputedStyle and failed before mounting; supplying the normal JSDOM globals fixed the harness, not upstream code.

## Verified intended outcomes

- Omitted optional value is undefined, unchecked, with no validation rule. Reset returns to undefined, not false or empty string.
- Default onValue/offValue are true/false. Click sets true; external public Core input(false) clears the live checked property.
- Custom scalar YES/NO values are retained as those strings; click checks at YES, external NO unchecks, reset restores initial NO.
- An explicit required rule with false passes. Consent uses accepted; absent consent fails accepted. Do not invent default required/accepted validation.
- Help text produces `aria-describedby=help-ID`. The official single-checkbox schema does not add error IDs for an error-only case. Matching this behavior is not a claim that it exhausts accessibility needs.
- Unmount removes controls. No keyboard, browser layout or visual decorator claim follows from these tests.

## Exact upstream source basis

Installed @formkit/inputs/dist/index.mjs: checkbox definition (`family: box`, props options/onValue/offValue/optionsLoader), box section (checked uses fns.eq(_value,onValue), input uses handlers.toggleChecked), checkboxes feature (default true/false), and toggleChecked (uses live HTMLInputElement.checked). @formkit/rules/dist/index.mjs accepted explicitly accepts yes/on/1/true forms, with skipEmpty=false; required is a different rule.

Box aria-describedby contains nested conditional attribute objects. Resolve that schema expression rather than stringifying an inner object. DOM checked must be updated as a live boolean property after user interaction; the HTML checked attribute alone is insufficient.

## Theme boundary

Vue/React defaultConfig installs createThemePlugin; checkbox adds defaultIcon(decorator,checkboxDecorator). These probes had no raw decorator icon available. Native behavior is testable without claiming Genesis/themed checked visuals. Any themed fixture must verify its actual checkmark, label/keyboard states and icon provenance rather than silently hiding unsupported raw icon HTML.

## Candidate acceptance

Repeat this fixture in the candidate, then real-browser click and Space, external update, reset, disabled behavior, nested group/conditional use, live remove/readd and ordinary teardown. Retain node/input/value identities on presentation changes. Options arrays/radio/select/file inputs remain separate scope. Do not change the main adapter or broaden recovery semantics.

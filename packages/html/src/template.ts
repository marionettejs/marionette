/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
// Runtime template preparation, shared once by the public entrypoints.
import type {TrustedHTML} from 'trusted-types/lib/index.js';
import {
  _trustFromTemplateString as trustFromTemplateString,
  _createTemplateElement as createTemplateElement,
  _createMarker as createMarker, _isEventBinding as isEventBinding,
  _AttributePart as AttributePart, _PropertyPart as PropertyPart,
  _BooleanAttributePart as BooleanAttributePart,
  _debugLogEvent as debugLogEvent, _issueWarning as issueWarning,
  _trustedTypes as trustedTypes,
  _installTemplatePreparation,
  type Template, type TemplatePart, type TemplateResult, type RenderOptions,
} from './renderer.js';
const DEV_MODE = true;
const HTML_RESULT = 1;
const SVG_RESULT = 2;
const MATHML_RESULT = 3;
type ResultType = typeof HTML_RESULT | typeof SVG_RESULT | typeof MATHML_RESULT;
const ATTRIBUTE_PART = 1;
const CHILD_PART = 2;
const ELEMENT_PART = 6;
const COMMENT_PART = 7;
const d = document;
const walker = d.createTreeWalker(d, 129);

// Added to an attribute name to mark the attribute as bound so we can find
// it easily.
const boundAttributeSuffix = '$lit$';

// This marker is used in many syntactic positions in HTML, so it must be
// a valid element name and attribute name. We don't support dynamic names (yet)
// but this at least ensures that the parse tree is closer to the template
// intention.
const marker = `lit$${Math.random().toFixed(9).slice(2)}$`;

// String used to tell if a comment is a marker comment
const markerMatch = '?' + marker;

// Text used to insert a comment marker node. We use processing instruction
// syntax because it's slightly smaller, but parses as a comment node.
const nodeMarker = `<${markerMatch}>`;

const SPACE_CHAR = `[ \t\n\f\r]`;
const ATTR_VALUE_CHAR = `[^ \t\n\f\r"'\`<>=]`;
const NAME_CHAR = `[^\\s"'>=/]`;

// These regexes represent the five parsing states that we care about in the
// Template's HTML scanner. They match the *end* of the state they're named
// after.
// Depending on the match, we transition to a new state. If there's no match,
// we stay in the same state.
// Note that the regexes are stateful. We utilize lastIndex and sync it
// across the multiple regexes used. In addition to the five regexes below
// we also dynamically create a regex to find the matching end tags for raw
// text elements.

/**
 * End of text is: `<` followed by:
 *   (comment start) or (tag) or (dynamic tag binding)
 */
const textEndRegex = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
const COMMENT_START = 1;
const TAG_NAME = 2;
const DYNAMIC_TAG_NAME = 3;

const commentEndRegex = /--!?>/g;
/**
 * Comments not started with <!--, like </{, can be ended by a single `>`
 */
const comment2EndRegex = />/g;

/**
 * The tagEnd regex matches the end of the "inside an opening" tag syntax
 * position. It either matches a `>`, an attribute-like sequence, or the end
 * of the string after a space (attribute-name position ending).
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \t\n\f\r" are HTML space characters:
 * https://infra.spec.whatwg.org/#ascii-whitespace
 *
 * So an attribute is:
 *  * The name: any character except a whitespace character, ("), ('), ">",
 *    "=", or "/". Note: this is different from the HTML spec which also excludes control characters.
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const tagEndRegex = new RegExp(
  `>|${SPACE_CHAR}(?:(${NAME_CHAR}+)(${SPACE_CHAR}*=${SPACE_CHAR}*(?:${ATTR_VALUE_CHAR}|("|')|))|$)`,
  'g'
);
const ENTIRE_MATCH = 0;
const ATTRIBUTE_NAME = 1;
const SPACES_AND_EQUALS = 2;
const QUOTE_CHAR = 3;

const singleQuoteAttrEndRegex = /'/g;
const doubleQuoteAttrEndRegex = /"/g;
/**
 * Matches the raw text elements.
 *
 * Comments are not parsed within raw text elements, so we need to search their
 * text content for marker strings.
 */
const rawTextElement = /^(?:script|style|textarea|title)$/i;

/**
 * Returns an HTML string for the given TemplateStringsArray and result type
 * (HTML or SVG), along with the case-sensitive bound attribute names in
 * template order. The HTML contains comment markers denoting the `ChildPart`s
 * and suffixes on bound attributes denoting the `AttributeParts`.
 *
 * @param strings template strings array
 * @param type HTML or SVG
 * @return Array containing `[html, attrNames]` (array returned for terseness,
 *     to avoid object fields since this code is shared with non-minified SSR
 *     code)
 */
const getTemplateHtml = (
  strings: TemplateStringsArray,
  type: ResultType
): [TrustedHTML, Array<string>] => {
  // Insert makers into the template HTML to represent the position of
  // bindings. The following code scans the template strings to determine the
  // syntactic position of the bindings. They can be in text position, where
  // we insert an HTML comment, attribute value position, where we insert a
  // sentinel string and re-write the attribute name, or inside a tag where
  // we insert the sentinel string.
  const l = strings.length - 1;
  // Stores the case-sensitive bound attribute names in the order of their
  // parts. ElementParts are also reflected in this array as undefined
  // rather than a string, to disambiguate from attribute bindings.
  const attrNames: Array<string> = [];
  let html =
    type === SVG_RESULT ? '<svg>' : type === MATHML_RESULT ? '<math>' : '';

  // When we're inside a raw text tag (not it's text content), the regex
  // will still be tagRegex so we can find attributes, but will switch to
  // this regex when the tag ends.
  let rawTextEndRegex: RegExp | undefined;

  // The current parsing state, represented as a reference to one of the
  // regexes
  let regex = textEndRegex;

  for (let i = 0; i < l; i++) {
    const s = strings[i];
    // The index of the end of the last attribute name. When this is
    // positive at end of a string, it means we're in an attribute value
    // position and need to rewrite the attribute name.
    // We also use a special value of -2 to indicate that we encountered
    // the end of a string in attribute name position.
    let attrNameEndIndex = -1;
    let attrName: string | undefined;
    let lastIndex = 0;
    let match!: RegExpExecArray | null;

    // The conditions in this loop handle the current parse state, and the
    // assignments to the `regex` variable are the state transitions.
    while (lastIndex < s.length) {
      // Make sure we start searching from where we previously left off
      regex.lastIndex = lastIndex;
      match = regex.exec(s);
      if (match === null) {
        break;
      }
      lastIndex = regex.lastIndex;
      if (regex === textEndRegex) {
        if (match[COMMENT_START] === '!--') {
          regex = commentEndRegex;
        } else if (match[COMMENT_START] !== undefined) {
          // We started a weird comment, like </{
          regex = comment2EndRegex;
        } else if (match[TAG_NAME] !== undefined) {
          if (rawTextElement.test(match[TAG_NAME])) {
            // Record if we encounter a raw-text element. We'll switch to
            // this regex at the end of the tag.
            rawTextEndRegex = new RegExp(`</${match[TAG_NAME]}`, 'g');
          }
          regex = tagEndRegex;
        } else if (match[DYNAMIC_TAG_NAME] !== undefined) {
          if (DEV_MODE) {
            throw new Error(
              'Bindings in tag names are not supported. Please use static templates instead. ' +
                'See https://lit.dev/docs/templates/expressions/#static-expressions'
            );
          }
          regex = tagEndRegex;
        }
      } else if (regex === tagEndRegex) {
        if (match[ENTIRE_MATCH] === '>') {
          // End of a tag. If we had started a raw-text element, use that
          // regex
          regex = rawTextEndRegex ?? textEndRegex;
          // We may be ending an unquoted attribute value, so make sure we
          // clear any pending attrNameEndIndex
          attrNameEndIndex = -1;
        } else if (match[ATTRIBUTE_NAME] === undefined) {
          // Attribute name position
          attrNameEndIndex = -2;
        } else {
          attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS].length;
          attrName = match[ATTRIBUTE_NAME];
          regex =
            match[QUOTE_CHAR] === undefined
              ? tagEndRegex
              : match[QUOTE_CHAR] === '"'
                ? doubleQuoteAttrEndRegex
                : singleQuoteAttrEndRegex;
        }
      } else if (
        regex === doubleQuoteAttrEndRegex ||
        regex === singleQuoteAttrEndRegex
      ) {
        regex = tagEndRegex;
      } else if (regex === commentEndRegex || regex === comment2EndRegex) {
        regex = textEndRegex;
      } else {
        // Not one of the five state regexes, so it must be the dynamically
        // created raw text regex and we're at the close of that element.
        regex = tagEndRegex;
        rawTextEndRegex = undefined;
      }
    }

    if (DEV_MODE) {
      // If we have a attrNameEndIndex, which indicates that we should
      // rewrite the attribute name, assert that we're in a valid attribute
      // position - either in a tag, or a quoted attribute value.
      console.assert(
        attrNameEndIndex === -1 ||
          regex === tagEndRegex ||
          regex === singleQuoteAttrEndRegex ||
          regex === doubleQuoteAttrEndRegex,
        'unexpected parse state B'
      );
    }

    // We have four cases:
    //  1. We're in text position, and not in a raw text element
    //     (regex === textEndRegex): insert a comment marker.
    //  2. We have a non-negative attrNameEndIndex which means we need to
    //     rewrite the attribute name to add a bound attribute suffix.
    //  3. We're at the non-first binding in a multi-binding attribute, use a
    //     plain marker.
    //  4. We're somewhere else inside the tag. If we're in attribute name
    //     position (attrNameEndIndex === -2), add a sequential suffix to
    //     generate a unique attribute name.

    // Detect a binding next to self-closing tag end and insert a space to
    // separate the marker from the tag end:
    const end =
      regex === tagEndRegex && strings[i + 1].startsWith('/>') ? ' ' : '';
    html +=
      regex === textEndRegex
        ? s + nodeMarker
        : attrNameEndIndex >= 0
          ? (attrNames.push(attrName!),
            s.slice(0, attrNameEndIndex) +
              boundAttributeSuffix +
              s.slice(attrNameEndIndex)) +
            marker +
            end
          : s + marker + (attrNameEndIndex === -2 ? i : end);
  }

  const htmlResult: string | TrustedHTML =
    html +
    (strings[l] || '<?>') +
    (type === SVG_RESULT ? '</svg>' : type === MATHML_RESULT ? '</math>' : '');

  // Returned as an array for terseness
  return [trustFromTemplateString(strings, htmlResult), attrNames];
};

class PreparedTemplate implements Template {
  /** @internal */
  el!: HTMLTemplateElement;

  parts: Array<TemplatePart> = [];

  constructor(
    // This property needs to remain unminified.
    {strings, ['_$mnHtmlType$']: type}: TemplateResult,
    options?: RenderOptions
  ) {
    let node: Node | null;
    let nodeIndex = 0;
    let attrNameIndex = 0;
    const partCount = strings.length - 1;
    const parts = this.parts;

    // Create template element
    const [html, attrNames] = getTemplateHtml(strings, type);
    this.el = createTemplateElement(html, options);
    walker.currentNode = this.el.content;

    try {
      // Re-parent SVG or MathML nodes into template root
      if (type === SVG_RESULT || type === MATHML_RESULT) {
        const wrapper = this.el.content.firstChild!;
        wrapper.replaceWith(...wrapper.childNodes);
      }

      // Walk the template to find binding markers and create TemplateParts
      while ((node = walker.nextNode()) !== null && parts.length < partCount) {
        if (node.nodeType === 1) {
          if (DEV_MODE) {
            const tag = (node as Element).localName;
            // Warn if `textarea` includes an expression and throw if `template`
            // does since these are not supported. We do this by checking
            // innerHTML for anything that looks like a marker. This catches
            // cases like bindings in textarea there markers turn into text nodes.
            if (
              /^(?:textarea|template)$/i!.test(tag) &&
              (node as Element).innerHTML.includes(marker)
            ) {
              const m =
                `Expressions are not supported inside \`${tag}\` ` +
                `elements. See https://lit.dev/msg/expression-in-${tag} for more ` +
                `information.`;
              if (tag === 'template') {
                throw new Error(m);
              } else issueWarning('', m);
            }
          }
          // TODO (justinfagnani): for attempted dynamic tag names, we don't
          // increment the bindingIndex, and it'll be off by 1 in the element
          // and off by two after it.
          if ((node as Element).hasAttributes()) {
            for (const name of (node as Element).getAttributeNames()) {
              if (name.endsWith(boundAttributeSuffix)) {
                const realName = attrNames[attrNameIndex++];
                const value = (node as Element).getAttribute(name)!;
                const statics = value.split(marker);
                const m = /([.?@])?(.*)/.exec(realName)!;
                // Inline handler attributes can execute even without an IDL property
                // (for example WebKit's onfocusin). Reserve on* attributes, but
                // permit non-handler properties/booleans such as .one and ?online.
                if (isEventBinding(m[1], m[2], node as Element)) {
                  throw new Error(
                    `MN_HTML_EVENT_BINDING: ${realName} is not supported; use Marionette events or triggers.`
                  );
                }
                parts.push({
                  type: ATTRIBUTE_PART,
                  index: nodeIndex,
                  name: m[2],
                  strings: statics,
                  ctor:
                    m[1] === '.'
                      ? PropertyPart
                      : m[1] === '?'
                        ? BooleanAttributePart
                        : AttributePart,
                });
                (node as Element).removeAttribute(name);
              } else if (name.startsWith(marker)) {
                parts.push({
                  type: ELEMENT_PART,
                  index: nodeIndex,
                });
                (node as Element).removeAttribute(name);
              }
            }
          }
          // TODO (justinfagnani): benchmark the regex against testing for each
          // of the 3 raw text element names.
          if (rawTextElement.test((node as Element).tagName)) {
            // For raw text elements we need to split the text content on
            // markers, create a Text node for each segment, and create
            // a TemplatePart for each marker.
            const strings = (node as Element).textContent!.split(marker);
            const lastIndex = strings.length - 1;
            if (lastIndex > 0) {
              (node as Element).textContent = trustedTypes
                ? (trustedTypes.emptyScript as unknown as '')
                : '';
              // Generate a new text node for each literal section
              // These nodes are also used as the markers for child parts
              for (let i = 0; i < lastIndex; i++) {
                (node as Element).append(strings[i], createMarker());
                // Walk past the marker node we just added
                walker.nextNode();
                parts.push({type: CHILD_PART, index: ++nodeIndex});
              }
              // Note because this marker is added after the walker's current
              // node, it will be walked to in the outer loop (and ignored), so
              // we don't need to adjust nodeIndex here
              (node as Element).append(strings[lastIndex], createMarker());
            }
          }
        } else if (node.nodeType === 8) {
          const data = (node as Comment).data;
          if (data === markerMatch) {
            parts.push({type: CHILD_PART, index: nodeIndex});
          } else {
            let i = -1;
            while ((i = (node as Comment).data.indexOf(marker, i + 1)) !== -1) {
              // Comment node has a binding marker inside, make an inactive part
              // The binding won't work, but subsequent bindings will
              parts.push({type: COMMENT_PART, index: nodeIndex});
              // Move to the end of the match
              i += marker.length - 1;
            }
          }
        }
        nodeIndex++;
      }

      if (DEV_MODE) {
        // If there was a duplicate attribute on a tag, then when the tag is
        // parsed into an element the attribute gets de-duplicated. We can detect
        // this mismatch if we haven't precisely consumed every attribute name
        // when preparing the template. This works because `attrNames` is built
        // from the template string and `attrNameIndex` comes from processing the
        // resulting DOM.
        if (attrNames.length !== attrNameIndex) {
          throw new Error(
            `Detected duplicate attribute bindings. This occurs if your template ` +
              `has duplicate attributes on an element tag. For example ` +
              `"<input ?disabled=\${true} ?disabled=\${false}>" contains a ` +
              `duplicate "disabled" attribute. The error was detected in ` +
              `the following template: \n` +
              '`' +
              strings.join('${...}') +
              '`'
          );
        }
      }

      debugLogEvent &&
        debugLogEvent({
          kind: 'template prep',
          template: this,
          clonableTemplate: this.el,
          parts: this.parts,
          strings,
        });
    } finally {
      // Preparation owns its walker; do not retain the last parsed DOM tree.
      walker.currentNode = d;
    }
  }

}

export const prepareTemplate = (result: TemplateResult, options?: RenderOptions): Template =>
  new PreparedTemplate(result, options);

// This module is explicitly side-effectful. Both ordinary entrypoints import
// it; module evaluation installs the shared factory exactly once.
_installTemplatePreparation(prepareTemplate);

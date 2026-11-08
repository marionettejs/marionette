/** @license Copyright 2017 Google LLC. SPDX-License-Identifier: BSD-3-Clause */
// Side-effect metadata retains preparation without grouping the public exports.
import './template.js';
export {html, svg, mathml, render, nothing, noChange} from './renderer.js';
export type {TemplateResult, HTMLTemplateResult, SVGTemplateResult, MathMLTemplateResult,
  RenderOptions, RenderRootNode, RootPart, Part, ChildPart, AttributePart,
  BooleanAttributePart, PropertyPart, ElementPart, Renderer, SanitizerFactory, ValueSanitizer} from './renderer.js';

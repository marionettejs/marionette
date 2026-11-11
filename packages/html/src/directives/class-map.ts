/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {AttributePart, noChange} from '../renderer.js';
import {
  directive,
  Directive,
  DirectiveParameters,
  PartInfo,
  PartType,
} from '../directive.js';

/**
 * A key-value set of class names to truthy values.
 */
export interface ClassInfo {
  [name: string]: string | boolean | number;
}

class ClassMapDirective extends Directive {
  /**
   * Stores the ClassInfo object applied to a given AttributePart.
   * Used to unset existing values when a new ClassInfo object is applied.
   */
  private _previousClasses?: string[];
  private _previousClassSet?: Set<string>;
  private _staticClasses?: Set<string>;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (
      partInfo.type !== PartType.ATTRIBUTE ||
      partInfo.name !== 'class' ||
      (partInfo.strings?.length as number) > 2
    ) {
      throw new Error(
        '`classMap()` can only be used in the `class` attribute ' +
          'and must be the only part in the attribute.'
      );
    }
  }

  render(classInfo: ClassInfo) {
    // Add spaces to ensure separation from static classes
    return (
      ' ' +
      Object.keys(classInfo)
        .filter((key) => classInfo[key])
        .join(' ') +
      ' '
    );
  }

  override update(part: AttributePart, [classInfo]: DirectiveParameters<this>) {
    // Remember dynamic classes on the first render
    if (this._previousClasses === undefined) {
      if (part.strings !== undefined) {
        this._staticClasses = new Set(
          part.strings
            .join(' ')
            .split(/\s/)
            .filter((s) => s !== '')
        );
      }
      this._previousClasses = Object.keys(classInfo).filter(
        name => classInfo[name] && !this._staticClasses?.has(name)
      );
      return this.render(classInfo);
    }

    const classList = part.element.classList;
    const previous = this._previousClasses;
    const next = Object.keys(classInfo);
    let count = 0;
    for (const name of next) {
      if (classInfo[name] && !this._staticClasses?.has(name)) next[count++] = name;
    }
    next.length = count;

    // Stable map order makes unchanged prefixes/suffixes cheap to skip.
    // Compare only the changed span; Set membership bounds arbitrary reorders.
    let start = 0;
    let oldEnd = previous.length;
    let newEnd = next.length;
    while (start < oldEnd && start < newEnd && previous[start] === next[start]) {
      start++;
    }
    while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === next[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    const oldSet = newEnd > start && oldEnd - start > 1
      ? (this._previousClassSet ??= new Set(previous)) : undefined;
    // A key-order change alone requires no DOM writes or new membership set.
    if (oldSet && previous.length === next.length && next.every(name => oldSet.has(name))) {
      return noChange;
    }
    const nextSet = oldEnd > start && newEnd - start > 1 ? new Set(next.slice(start, newEnd)) : undefined;
    for (let i = start; i < oldEnd; i++) {
      if (nextSet ? !nextSet.has(previous[i]) : newEnd === start || next[start] !== previous[i]) {
        classList.remove(previous[i]);
        this._previousClassSet?.delete(previous[i]);
      }
    }
    for (let i = start; i < newEnd; i++) {
      if (oldSet ? !oldSet.has(next[i]) : oldEnd === start || previous[start] !== next[i]) {
        classList.add(next[i]);
        this._previousClassSet?.add(next[i]);
      }
    }
    this._previousClasses = next;
    return noChange;
  }
}

/**
 * A directive that applies dynamic CSS classes.
 *
 * This must be used in the `class` attribute and must be the only part used in
 * the attribute. It takes each property in the `classInfo` argument and adds
 * the property name to the element's `classList` if the property value is
 * truthy; if the property value is falsy, the property name is removed from
 * the element's `class`.
 *
 * For example `{foo: bar}` applies the class `foo` if the value of `bar` is
 * truthy.
 *
 * @param classInfo
 */
export const classMap = directive(ClassMapDirective);

/**
 * The type of the class that powers this directive. Necessary for naming the
 * directive's return type.
 */
export type {ClassMapDirective};

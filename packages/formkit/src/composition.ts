import type { FormKitNode } from '@formkit/core';
import type { RuntimeOptions } from './runtime.ts';
import type { RowLocation } from './row-ownership.ts';
import type { ValueUpdateOptions } from './index.ts';
export type FieldPath = string[] | RowLocation;
export interface FieldResource {
    parent: FormKitNode;
    release(): void;
    update(): void;
}
export interface Composition {
    options: RuntimeOptions;
    fields: Set<FieldResource>;
    excluded: Map<string, FieldPath>;
    mutate(operation: () => void): void;
    baseline(path: FieldPath, value: unknown): unknown;
    notify(): boolean;
    write(node: FormKitNode, value: unknown, options: ValueUpdateOptions): void;
}
export const compositions = new WeakMap<FormKitNode, Composition>();
export const inputSources = new WeakMap<FormKitNode, unknown>();
export function fieldPathKey(path: FieldPath): string {
  return Array.isArray(path) ? path.join('.') : JSON.stringify(path);
}

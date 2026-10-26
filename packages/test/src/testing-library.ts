import { within } from '@testing-library/dom';
import type { BoundFunctions, queries } from '@testing-library/dom';
import type { MountedRegion } from './index.ts';

export interface WithQueriesOptions {
  /** Query this borrowed root instead of the mounted container; ownership is unchanged. */
  baseElement?: HTMLElement;
}

export type WithQueries<Mounted extends MountedRegion> = Mounted & BoundFunctions<typeof queries>;

// Decorate in place so live getters, readiness and the runner's cleanup identity survive.
// Repeated decoration replaces the bound queries with those for the selected root.
export function withQueries<Mounted extends MountedRegion>(
  mounted: Mounted, options: WithQueriesOptions = {}
): WithQueries<Mounted> {
  return Object.assign(mounted, within((options.baseElement ?? mounted.container) as HTMLElement));
}

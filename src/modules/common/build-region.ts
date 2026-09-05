import { assignOwn } from '../../utils/assign-in.js';
import MarionetteError from '../error.ts';
import isString from '../../utils/is-string.js';
import { defaultRuntimeId, runtimeId } from '../../runtime/runtime-id.js';
import Region from '../region.ts';
import type { RegionInstance, RegionInternals, RegionOptions } from '../region.ts';

export type RegionClass = new (options: never) => RegionInstance;
export type RegionDefinition = RegionInstance | RegionClass | string | (RegionOptions & { regionClass?: RegionClass });
export interface RegionDefaults extends RegionOptions {
  regionClass: RegionClass;
  [runtimeId]?: object;
}


function throwRegionRegistrationConflict(message: string) {
  throw new MarionetteError({
    code: 'MN0030',
    name: 'RegionError',
    message
  });
}

// return the region instance from the definition
function buildRegion(definition: RegionDefinition, defaults: RegionDefaults): RegionInternals {
  if (definition instanceof Region) {
    if ((definition as RegionInternals)[runtimeId] !== (defaults[runtimeId] || defaultRuntimeId)) {
      throwRegionRegistrationConflict('A Region instance must belong to the same Marionette runtime as its owner.');
    }
    return definition as RegionInternals;
  }

  if (isString(definition)) {
    return buildRegionFromObject(defaults, { el: definition as string });
  }

  if (typeof definition === 'function') {
    return buildRegionFromObject(defaults, { regionClass: definition });
  }

  if (definition !== null && typeof definition === 'object') {
    return buildRegionFromObject(defaults, definition);
  }

  throw new MarionetteError({
    code: 'MN0008',
    message: 'Improper region configuration type.',
    url: 'marionette.region.html#defining-regions'
  });
}

function buildRegionFromObject(defaults: RegionDefaults, definition: RegionOptions & { regionClass?: RegionClass }): RegionInternals {
  const options = assignOwn({}, defaults, definition) as RegionDefaults;

  const RegionClass = options.regionClass;

  const RegionRuntimeId = (RegionClass.prototype as Partial<RegionInternals>)[runtimeId];
  if (RegionRuntimeId && RegionRuntimeId !== (defaults[runtimeId] || defaultRuntimeId)) {
    throwRegionRegistrationConflict('A Region class must belong to the same Marionette runtime as its owner.');
  }

  delete (options as Partial<RegionDefaults>).regionClass;

  return new (RegionClass as new (options: RegionOptions) => RegionInternals)(options);
}

export default buildRegion;

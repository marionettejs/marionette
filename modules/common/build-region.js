import { assignOwn } from '../../utils/assign-in.js';
import MarionetteError from '../../utils/error.js';
import isString from '../../utils/is-string.js';
import { defaultRuntimeId, runtimeId } from '../../runtime/runtime-id.js';
import Region from '../region.js';

function throwRegionRegistrationConflict(message) {
  throw new MarionetteError({
    code: 'MN0030',
    name: 'RegionError',
    message
  });
}

// return the region instance from the definition
function buildRegion(definition, defaults) {
  if (definition instanceof Region) {
    if (definition[runtimeId] !== (defaults[runtimeId] || defaultRuntimeId)) {
      throwRegionRegistrationConflict('A Region instance must belong to the same Marionette runtime as its owner.');
    }
    return definition;
  }

  if (isString(definition)) {
    return buildRegionFromObject(defaults, { el: definition });
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

function buildRegionFromObject(defaults, definition) {
  const options = assignOwn({}, defaults, definition);

  const RegionClass = options.regionClass;

  const RegionRuntimeId = RegionClass.prototype[runtimeId];
  if (RegionRuntimeId && RegionRuntimeId !== (defaults[runtimeId] || defaultRuntimeId)) {
    throwRegionRegistrationConflict('A Region class must belong to the same Marionette runtime as its owner.');
  }

  delete options.regionClass;

  return new RegionClass(options);
}

export default buildRegion;

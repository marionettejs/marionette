import { each } from 'underscore';
import { setProperty } from '../../utils/assign-in.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

// Merge `keys` from `options` onto `this`
const mergeOptions = function(options, keys) {
  if (!options) { return; }

  each(keys, (key) => {
    if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) { return; }

    const option = options[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  });
};

export default mergeOptions;

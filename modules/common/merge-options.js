import { each } from 'underscore';

// Merge `keys` from `options` onto `this`
const mergeOptions = function(options, keys) {
  if (!options) { return; }

  each(keys, (key) => {
    const option = options[key];
    if (option !== undefined) {
      this[key] = option;
    }
  });
};

export default mergeOptions;

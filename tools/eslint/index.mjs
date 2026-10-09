import noPrivateFrameworkMembers from '../../eslint-rules/no-private-framework-members.mjs';

const rules = {
  'no-private-framework-members': noPrivateFrameworkMembers,
};

const plugin = {
  meta: { name: 'marionette' },
  rules,
};

plugin.configs = {
  recommended: {
    plugins: { marionette: plugin },
    rules: {
      'marionette/no-private-framework-members': 'error',
    },
  },
};

export default plugin;

import type { ESLint, Linter } from 'eslint';

declare const plugin: ESLint.Plugin & {
  configs: {
    recommended: Linter.Config;
  };
};

export = plugin;

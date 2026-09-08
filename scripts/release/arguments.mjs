import { parseArgs } from 'node:util';

export function readArguments(options) {
  const parsed = parseArgs({ options, tokens: true });
  const seen = new Set();
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') { continue; }
    if (seen.has(token.name)) {
      throw new Error(`Duplicate argument --${token.name}.`);
    }
    seen.add(token.name);
  }
  return parsed.values;
}

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateInventory } from './inventory.mjs';

const root = resolve(import.meta.dirname, '../..');
const semantics = JSON.parse(readFileSync(resolve(root, 'config/api-contracts/semantics.json'), 'utf8'));
const path = resolve(root, 'config/api-contracts/inventory.json');
const actual = `${JSON.stringify(generateInventory(root, semantics), null, 2)}\n`;
if (process.argv.includes('--write')) {
  writeFileSync(path, actual);
  console.log('Updated public contract inventory. Review signature, source, semantic, and evidence changes before committing.');
} else {
  if (readFileSync(path, 'utf8') !== actual) {
    throw new Error('Public contract drift: review source and behavioral evidence, update semantics as needed, then run node scripts/api-contracts/check.mjs --write.');
  }
  console.log('Public contract inventory matches source signatures, semantics, diagnostics, documentation, and public test anchors.');
}

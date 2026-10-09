import { cpSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Executable fixture copies retain their original source identities in V8/c8 reports.
// Every UTF-16 column is mapped so line, branch and function ranges retain their
// original positions, without changing any executable source bytes.
export function copyCoverageFixture(source, destination) {
  cpSync(source, destination, { recursive: true });
  if (!process.env.NODE_V8_COVERAGE) { return; }
  function mapSource(original, copied) {
    if (statSync(original).isDirectory()) {
      for (const entry of readdirSync(original)) { mapSource(join(original, entry), join(copied, entry)); }
      return;
    }
    if (!/\.[cm]?js$/.test(original)) { return; }
    const text = readFileSync(original, 'utf8');
    if (readFileSync(copied, 'utf8') !== text) { throw new Error(`Fixture copy differs from ${original}`); }
    let previousColumn = 0;
    const mappings = text.split('\n').map((line, index) => {
      // Source-map columns carry between lines; generated columns reset to zero.
      let delta = previousColumn * 2 + (previousColumn ? 1 : 0);
      let column = '';
      do {
        const digit = delta % 32;
        delta = Math.floor(delta / 32);
        column += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[digit + (delta ? 32 : 0)];
      } while (delta);
      previousColumn = line.length;
      return `AA${index ? 'C' : 'A'}${column}${',CAAC'.repeat(line.length)}`;
    }).join(';');
    const map = {
      version: 3, sources: [pathToFileURL(original).href], sourcesContent: [text], names: [],
      mappings,
    };
    writeFileSync(copied, `${text}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`);
  }
  mapSource(source, destination);
}

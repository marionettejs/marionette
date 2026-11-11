import { rollup } from 'rollup';
import { minify } from 'terser';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const results = [];
for (const variant of ['core', 'core+repeat'])
    for (const engine of ['lit-html@3.3.3', '@mnjs/html']) {
        const root = resolve(engine === '@mnjs/html' ? 'dist' : 'node_modules/lit-html');
        const entry = `export {html,render,nothing} from ${JSON.stringify(root + (engine === '@mnjs/html' ? '/index.js' : '/lit-html.js'))};` +
            (variant === 'core+repeat' ? `export {repeat} from ${JSON.stringify(root + '/directives/repeat.js')};` : '');
        const bundle = await rollup({ input: 'entry', plugins: [{ name: 'entry', resolveId: id => id === 'entry' ? '\0entry' : null, load: id => id === '\0entry' ? entry : null }] });
        const { output } = await bundle.generate({ format: 'es' });
        const code = (await minify(output[0].code, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: /@license|SPDX/ } })).code;
        results.push({ engine, variant, bytes: Buffer.byteLength(code), gzip: gzipSync(code).length, brotli: brotliCompressSync(code).length });
        await bundle.close();
    }
const evidenceDir = process.env.EVIDENCE_DIR ?? 'evidence';
await mkdir(evidenceDir, { recursive: true });
await writeFile(`${evidenceDir}/size-results.json`, JSON.stringify({ date: new Date().toISOString(), note: 'Equivalent exports bundled with the same Rollup/Terser pipeline. Both production builds omit custom sanitizer hooks. The runtime keeps template preparation separate from public exports so unused tags and adapter functions can tree-shake. These are byte counts, not speed results.', results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));

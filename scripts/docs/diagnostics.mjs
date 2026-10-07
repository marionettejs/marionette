import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function diagnosticSections(markdown, catalog) {
  const start = '<!-- diagnostics:start -->';
  const end = '<!-- diagnostics:end -->';
  const startOffset = markdown.indexOf(start);
  const endOffset = markdown.indexOf(end);
  if (startOffset < 0 || endOffset < startOffset ||
      markdown.indexOf(start, startOffset + start.length) !== -1 ||
      markdown.indexOf(end, endOffset + end.length) !== -1) {
    throw new Error('DIAGNOSTIC_DOCS: expected one ordered pair of generated section markers');
  }
  const entries = catalog.diagnostics.map(item => {
    if (item.docsSection !== `docs/api/errors.md#${item.code.toLowerCase()}`) {
      throw new Error(`DIAGNOSTIC_DOCS: invalid section for ${item.code}`);
    }
    return `## ${item.code}\n\n${item.slug}. Status: **${item.status}**. Applies to ${item.objects.join(', ')}.\n\n${item.remediation}${item.replacementCode ? `\n\nReplacement: [${item.replacementCode}](#${item.replacementCode.toLowerCase()}).` : ''}`;
  });
  return markdown.slice(0, startOffset) + `${start}\n\n${entries.join('\n\n')}\n\n` + markdown.slice(endOffset);
}

export async function checkDiagnosticSections(root, write = false) {
  const path = resolve(root, 'docs/api/errors.md');
  const current = await readFile(path, 'utf8');
  const catalog = JSON.parse(await readFile(resolve(root, 'config/diagnostics/catalog.json'), 'utf8'));
  const expected = diagnosticSections(current, catalog);
  if (write) { await writeFile(path, expected); } else if (expected !== current) {
    throw new Error('DIAGNOSTIC_DOCS: run node scripts/docs/diagnostics.mjs --write');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkDiagnosticSections(resolve(import.meta.dirname, '../..'), process.argv.includes('--write'));
}

import { loadDiagnosticCatalog } from './catalog.mjs';

try {
  const catalog = await loadDiagnosticCatalog();
  console.log(`Validated ${catalog.diagnostics.length} diagnostic catalog entries.`);
} catch (error) {
  console.error('Diagnostic catalog validation failed:');
  console.error(error.message);
  process.exitCode = 1;
}

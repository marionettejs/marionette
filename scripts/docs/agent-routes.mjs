import { readFile, writeFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const start = '<!-- task-routes:start -->';
const end = '<!-- task-routes:end -->';

const primarySources = [
  'docs/guides/composition.md',
  'docs/quick-start.md',
  'docs/guides/migration.md',
  'docs/guides/testing.md',
  'docs/guides/lists.md',
  'docs/api/region.md',
  'docs/architecture.md',
  'docs/api/shared/view-bindings.md#dom-events',
  'docs/guides/routing.md',
  'docs/guides/async-requests.md',
];

export function skillRoutes(guide, skill, { primary = false } = {}) {
  const table = guide.split(start)[1]?.split(end)[0];
  if (!table || !skill.includes(start) || !skill.includes(end)) {
    throw new Error('AGENT_ROUTES: missing task routing markers');
  }
  const rows = table.trim().split('\n').slice(2).map(line => {
    const [, task, links] = line.split('|');
    const sources = [...links.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(([, href]) => {
      const [source, fragment] = href.split('#');
      return `\`${posix.normalize(posix.join('docs', source))}${fragment ? `#${fragment}` : ''}\``;
    });
    if (!sources.length) { throw new Error(`AGENT_ROUTES: no guide for ${task.trim()}`); }
    return { task: task.trim(), sources };
  });
  const selected = primary ? primarySources.map(source => {
    const matches = rows.filter(row => row.sources.includes('`' + source + '`'));
    if (matches.length !== 1) {
      throw new Error(`AGENT_ROUTES: expected one primary route for ${source}, found ${matches.length}`);
    }
    return matches[0];
  }) : rows;
  const lines = selected.map(({ task, sources }) => `| ${task} | ${sources.join(', ')} |`);
  const generated = `${start}\n| Task | Packaged page |\n| --- | --- |\n${lines.join('\n')}\n${end}`;
  return skill.slice(0, skill.indexOf(start)) + generated + skill.slice(skill.indexOf(end) + end.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '../..');
  const path = resolve(root, 'skills/marionette/SKILL.md');
  const skill = await readFile(path, 'utf8');
  const generated = skillRoutes(await readFile(resolve(root, 'docs/agents.md'), 'utf8'), skill, { primary: true });
  if (process.argv.includes('--write')) {
    await writeFile(path, generated);
  } else if (skill !== generated) {
    throw new Error('AGENT_ROUTES: run node scripts/docs/agent-routes.mjs --write');
  }
  console.log('Consumer skill routes match the application task guide.');
}

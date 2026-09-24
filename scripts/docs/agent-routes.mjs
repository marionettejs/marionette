import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const start = '<!-- task-routes:start -->';
const end = '<!-- task-routes:end -->';

export function skillRoutes(guide, skill) {
  const table = guide.split(start)[1]?.split(end)[0];
  if (!table || !skill.includes(start) || !skill.includes(end)) {
    throw new Error('AGENT_ROUTES: missing task routing markers');
  }
  const rows = table.trim().split('\n').slice(2).map(line => {
    const [, task, links] = line.split('|');
    const sources = [...links.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(([, href]) =>
      `\`${posix.normalize(posix.join('docs', href.split('#')[0]))}\``);
    if (!sources.length) { throw new Error(`AGENT_ROUTES: no guide for ${task.trim()}`); }
    return `| ${task.trim()} | ${sources.join(', ')} |`;
  });
  const generated = `${start}\n| Task | Packaged page |\n| --- | --- |\n${rows.join('\n')}\n${end}`;
  return skill.slice(0, skill.indexOf(start)) + generated + skill.slice(skill.indexOf(end) + end.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '../..');
  const path = resolve(root, 'skills/marionette/SKILL.md');
  const skill = await readFile(path, 'utf8');
  const generated = skillRoutes(await readFile(resolve(root, 'docs/agents.md'), 'utf8'), skill);
  if (process.argv.includes('--write')) {
    await writeFile(path, generated);
    const destination = resolve(root, 'plugins/marionette/skills/marionette');
    await rm(destination, { recursive: true, force: true });
    await cp(resolve(root, 'skills/marionette'), destination, { recursive: true });
  } else if (skill !== generated) {
    throw new Error('AGENT_ROUTES: run node scripts/docs/agent-routes.mjs --write');
  }
  console.log('Consumer skill routes match the application task guide.');
}

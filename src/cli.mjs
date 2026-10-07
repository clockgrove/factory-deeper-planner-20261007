import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseCsv } from './ingest.mjs';
import { normalizeRows } from './normalize.mjs';
import { analyzeDependencies } from './analyze.mjs';
import { scheduleTasks } from './schedule.mjs';
import { renderReport } from './report.mjs';

export function runCli(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError('Arguments must be an array of strings');
  }
  for (const argument of argv) {
    if (typeof argument !== 'string') {
      throw new TypeError('Arguments must be an array of strings');
    }
  }
  if (argv.length === 1 && argv[0] === '--help') {
    return 'Usage: planner <tasks.csv> [--workers 1|2]\n';
  }

  let inputPath;
  let workers = 2;
  let workersSeen = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--workers') {
      if (workersSeen) {
        throw new TypeError('Worker flag may be supplied only once');
      }
      const value = argv[++index];
      if (value !== '1' && value !== '2') {
        throw new TypeError('Worker flag requires 1 or 2');
      }
      workersSeen = true;
      workers = Number(value);
    } else if (argument.startsWith('-')) {
      throw new TypeError(`Unknown flag: ${argument}`);
    } else {
      if (argument === '' || inputPath !== undefined) {
        throw new TypeError('Exactly one nonempty input path is required');
      }
      inputPath = argument;
    }
  }
  if (inputPath === undefined) {
    throw new TypeError('An input path is required');
  }

  const text = readFileSync(resolve(inputPath), 'utf8');
  const tasks = normalizeRows(parseCsv(text));
  const analysis = analyzeDependencies(tasks);
  const plan = scheduleTasks(tasks, analysis, { workers });
  return renderReport(tasks, analysis, plan);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(runCli(process.argv.slice(2))); }
  catch (error) { process.stderr.write(`planner: ${error.message}\n`); process.exitCode = 2; }
}

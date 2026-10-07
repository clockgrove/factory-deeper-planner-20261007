const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Unlike `$`, this end assertion does not accept a trailing line terminator.
const isId = value => typeof value === 'string' && /^[a-z][a-z0-9_-]*(?![\s\S])/.test(value);
const isNonnegativeInteger = value => Number.isInteger(value) && value >= 0;

export function renderReport(tasks, analysis, plan) {
  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks must be an array');
  }
  const titles = new Map();
  for (const task of tasks) {
    if (!isObject(task) || !isId(task.id) || titles.has(task.id)) {
      throw new TypeError('Tasks must have unique canonical IDs');
    }
    const { title } = task;
    if (typeof title !== 'string' || title.length === 0 ||
        title !== title.trim().replace(/\s+/g, ' ')) {
      throw new TypeError('Titles must be nonempty and whitespace-normalized');
    }
    titles.set(task.id, title);
  }
  if (!isObject(analysis) || !isNonnegativeInteger(analysis.criticalPath)) {
    throw new TypeError('Critical path must be a nonnegative integer');
  }
  if (!isObject(plan) || (plan.workers !== 1 && plan.workers !== 2) ||
      !isNonnegativeInteger(plan.makespan) || !Array.isArray(plan.entries)) {
    throw new TypeError('Plan must contain valid workers, makespan and entries');
  }

  const seen = new Set();
  const rows = [];
  let maximumEnd = 0;
  for (const entry of plan.entries) {
    if (!isObject(entry) || !titles.has(entry.id) || seen.has(entry.id)) {
      throw new TypeError('Entries must contain each task ID exactly once');
    }
    const { id, worker, start, end } = entry;
    if (!Number.isInteger(worker) || worker < 1 || worker > plan.workers ||
        !isNonnegativeInteger(start) || !Number.isInteger(end) || end <= start) {
      throw new TypeError('Entries must have a valid worker and integer start and end times');
    }
    seen.add(id);
    maximumEnd = Math.max(maximumEnd, end);
    // Replace original characters together so inserted backslashes are not escaped again.
    const title = titles.get(id).replace(/[\\|]/g, character => `\\${character}`);
    rows.push(`| ${id} | ${title} | ${worker} | ${start} | ${end} |\n`);
  }
  if (seen.size !== titles.size || plan.makespan !== maximumEnd) {
    throw new TypeError('Entries must cover all tasks and makespan must equal maximum end');
  }

  return '# Project plan\n\n' +
    '| Task | Title | Worker | Start | End |\n' +
    '| --- | --- | --- | --- | --- |\n' +
    rows.join('') +
    `\nMakespan: ${plan.makespan}\nCritical path: ${analysis.criticalPath}\nWorkers: ${plan.workers}\n`;
}

// Require actual end of input: `$` also permits a trailing line terminator.
const ID_PATTERN = /^[a-z][a-z0-9_-]*(?![\s\S])/;
const isId = value => typeof value === 'string' && ID_PATTERN.test(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const compareTasks = (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function scheduleTasks(tasks, analysis, options = {}) {
  if (!isObject(options)) {
    throw new TypeError('Options must be an object');
  }
  const workers = 'workers' in options ? options.workers : 2;
  if (workers !== 1 && workers !== 2) {
    throw new TypeError('Workers must be integer 1 or 2');
  }
  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks must be an array');
  }

  const records = new Map();
  for (const task of tasks) {
    if (!isObject(task)) {
      throw new TypeError('Each task must be an object');
    }
    const { id, duration, dependsOn, resource, priority } = task;
    if (!isId(id) || records.has(id)) {
      throw new TypeError('Task IDs must be canonical and unique');
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1000000) {
      throw new TypeError('Duration must be an integer from 1 to 1000000');
    }
    if (resource !== '' && !isId(resource)) {
      throw new TypeError('Resource must be empty or a canonical ID');
    }
    if (!Number.isInteger(priority) || priority < -9 || priority > 9) {
      throw new TypeError('Priority must be an integer from -9 to 9');
    }
    if (!Array.isArray(dependsOn)) {
      throw new TypeError('Dependencies must be an array');
    }
    const dependencies = new Set();
    for (const dependency of dependsOn) {
      if (!isId(dependency) || dependency === id || dependencies.has(dependency)) {
        throw new TypeError('Dependencies must be distinct canonical IDs other than the task ID');
      }
      dependencies.add(dependency);
    }
    records.set(id, { id, duration, dependencies, resource, priority });
  }

  if (!isObject(analysis) || !Array.isArray(analysis.order) ||
      !isObject(analysis.dependencies) || !Number.isInteger(analysis.criticalPath) ||
      analysis.criticalPath < 0) {
    throw new TypeError('Analysis must contain order, dependencies and a nonnegative integer criticalPath');
  }
  if (analysis.order.length !== records.size) {
    throw new TypeError('Analysis order must list every task exactly once');
  }
  const positions = new Map();
  for (const id of analysis.order) {
    if (!records.has(id) || positions.has(id)) {
      throw new TypeError('Analysis order contains an unknown or duplicate ID');
    }
    positions.set(id, positions.size);
  }
  const keys = Reflect.ownKeys(analysis.dependencies);
  if (keys.length !== records.size || keys.some(id => !records.has(id))) {
    throw new TypeError('Analysis dependency keys must match task IDs');
  }

  const remaining = new Map();
  const dependents = new Map([...records.keys()].map(id => [id, []]));
  const ready = [];
  for (const record of records.values()) {
    const supplied = analysis.dependencies[record.id];
    if (!Array.isArray(supplied) || supplied.length !== record.dependencies.size) {
      throw new TypeError('Analysis dependency arrays must match task dependency sets');
    }
    const seen = new Set();
    for (const dependency of supplied) {
      if (!record.dependencies.has(dependency) || seen.has(dependency)) {
        throw new TypeError('Analysis dependency arrays must match task dependency sets');
      }
      seen.add(dependency);
    }
    for (const dependency of record.dependencies) {
      if (!records.has(dependency) || positions.get(dependency) >= positions.get(record.id)) {
        throw new TypeError('Analysis order must be topological with known dependencies');
      }
      dependents.get(dependency).push(record.id);
    }
    remaining.set(record.id, record.dependencies.size);
    if (record.dependencies.size === 0) ready.push(record);
  }
  ready.sort(compareTasks);

  const running = Array(workers).fill(null);
  const busyResources = new Set();
  const entries = [];
  let time = 0;
  let makespan = 0;
  let completed = 0;
  while (completed < records.size) {
    // Release every simultaneous finish before considering any new dispatch.
    for (let worker = 0; worker < workers; worker++) {
      const active = running[worker];
      if (active === null || active.end !== time) continue;
      running[worker] = null;
      completed++;
      if (active.task.resource !== '') busyResources.delete(active.task.resource);
      for (const id of dependents.get(active.task.id)) {
        const count = remaining.get(id) - 1;
        remaining.set(id, count);
        if (count === 0) ready.push(records.get(id));
      }
    }
    ready.sort(compareTasks);
    for (let worker = 0; worker < workers; worker++) {
      if (running[worker] !== null) continue;
      const index = ready.findIndex(task => task.resource === '' || !busyResources.has(task.resource));
      if (index === -1) continue;
      const [task] = ready.splice(index, 1);
      const end = time + task.duration;
      if (task.resource !== '') busyResources.add(task.resource);
      running[worker] = { task, end };
      entries.push({ id: task.id, worker: worker + 1, start: time, end });
      makespan = Math.max(makespan, end);
    }
    if (completed === records.size) break;
    // A validated DAG always has a running task until all tasks complete.
    let next = Infinity;
    for (const active of running) {
      if (active !== null) next = Math.min(next, active.end);
    }
    time = next;
  }
  return { workers, entries, makespan };
}

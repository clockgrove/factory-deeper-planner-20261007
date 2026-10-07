// The final assertion requires actual EOF, including for IDs ending in LF.
const idPattern = /^[a-z][a-z0-9_-]*(?![\s\S])/;
const isId = (value) => typeof value === 'string' && idPattern.test(value);

export function analyzeDependencies(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks must be an array');
  }

  const records = new Map();
  for (const task of tasks) {
    if (task === null || typeof task !== 'object' || Array.isArray(task)) {
      throw new TypeError('Each task must be an object');
    }
    const { id, duration, dependsOn } = task;
    if (!isId(id) || records.has(id)) {
      throw new TypeError('Task IDs must be canonical and unique');
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1000000) {
      throw new TypeError('Task duration must be an integer from 1 to 1000000');
    }
    if (!Array.isArray(dependsOn)) {
      throw new TypeError('Task dependencies must be an array');
    }
    const seen = new Set();
    for (const dependency of dependsOn) {
      if (!isId(dependency) || dependency === id || seen.has(dependency)) {
        throw new TypeError('Dependencies must be distinct canonical IDs other than the task ID');
      }
      seen.add(dependency);
    }
    records.set(id, { duration, dependsOn: [...seen].sort() });
  }

  const ids = [...records.keys()].sort();
  const dependencies = {};
  const remaining = new Map();
  const dependents = new Map(ids.map((id) => [id, []]));
  const finishes = new Map();
  const ready = [];

  for (const id of ids) {
    const record = records.get(id);
    dependencies[id] = [...record.dependsOn];
    remaining.set(id, record.dependsOn.length);
    finishes.set(id, record.duration);
    for (const dependency of record.dependsOn) {
      if (!records.has(dependency)) {
        throw new TypeError(`Unknown dependency: ${dependency}`);
      }
      dependents.get(dependency).push(id);
    }
    if (record.dependsOn.length === 0) ready.push(id);
  }

  const order = [];
  let criticalPath = 0;
  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    const finish = finishes.get(id);
    criticalPath = Math.max(criticalPath, finish);
    for (const dependent of dependents.get(id)) {
      finishes.set(dependent, Math.max(
        finishes.get(dependent),
        finish + records.get(dependent).duration,
      ));
      const count = remaining.get(dependent) - 1;
      remaining.set(dependent, count);
      if (count === 0) {
        // Insert among all ready IDs, including those ready before this removal.
        let low = 0;
        let high = ready.length;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (ready[middle] < dependent) low = middle + 1;
          else high = middle;
        }
        ready.splice(low, 0, dependent);
      }
    }
  }
  if (order.length !== ids.length) {
    throw new TypeError('Task dependencies contain a cycle');
  }
  return { order, dependencies, criticalPath };
}

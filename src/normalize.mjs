const RAW_KEYS = ['id', 'title', 'duration', 'depends_on', 'resource', 'priority'];
const ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

export function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('Rows must be an array');
  }

  const tasks = [];
  const ids = new Set();
  for (const row of rows) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new TypeError('Each row must be an object');
    }
    const keys = Reflect.ownKeys(row).filter(key =>
      Object.prototype.propertyIsEnumerable.call(row, key));
    if (keys.length !== RAW_KEYS.length || keys.some(key => !RAW_KEYS.includes(key))) {
      throw new TypeError('Each row must have exactly the six raw fields');
    }
    const values = RAW_KEYS.map(key => row[key]);
    if (values.some(value => typeof value !== 'string')) {
      throw new TypeError('Every raw field must be a string');
    }
    const [rawId, rawTitle, rawDuration, rawDependencies, rawResource, rawPriority] = values;
    const id = rawId.trim().toLowerCase();
    const resource = rawResource.trim().toLowerCase();
    if (!ID_PATTERN.test(id) || (resource !== '' && !ID_PATTERN.test(resource))) {
      throw new TypeError('Invalid task ID or resource');
    }
    if (ids.has(id)) {
      throw new TypeError('Duplicate task ID');
    }
    ids.add(id);

    const title = rawTitle.trim().replace(/\s+/g, ' ');
    if (title === '') {
      throw new TypeError('Title must be nonempty');
    }
    const durationText = rawDuration.trim();
    const duration = Number(durationText);
    if (!/^[1-9][0-9]*$/.test(durationText) || duration > 1000000) {
      throw new TypeError('Duration must be an integer from 1 to 1000000');
    }
    const priorityText = rawPriority.trim();
    if (priorityText !== '' && !/^(?:0|-?[1-9])$/.test(priorityText)) {
      throw new TypeError('Priority must be an integer from -9 to 9');
    }
    const priority = priorityText === '' ? 0 : Number(priorityText);

    const dependsOn = [];
    const dependencies = new Set();
    if (rawDependencies.trim() !== '') {
      for (const token of rawDependencies.split('|')) {
        const dependency = token.trim().toLowerCase();
        if (!ID_PATTERN.test(dependency) || dependency === id || dependencies.has(dependency)) {
          throw new TypeError('Invalid, repeated or self dependency');
        }
        dependencies.add(dependency);
        dependsOn.push(dependency);
      }
    }
    dependsOn.sort();
    tasks.push({ id, title, duration, dependsOn, resource, priority });
  }
  return tasks.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

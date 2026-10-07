const columns = ['id', 'title', 'duration', 'depends_on', 'resource', 'priority'];

export function parseCsv(text) {
  if (typeof text !== 'string') {
    throw new TypeError('CSV input must be a string');
  }

  let position = text.startsWith('\uFEFF') ? 1 : 0;
  if (position === text.length) {
    throw new TypeError('CSV input must contain a header');
  }

  const rows = [];
  let headerRead = false;
  while (position < text.length) {
    const fields = [];
    // A comma starts another field even when it is the last character.
    while (true) {
      let field = '';
      if (text[position] === '"') {
        position++;
        let closed = false;
        while (position < text.length) {
          const character = text[position++];
          if (character !== '"') {
            field += character;
          } else if (text[position] === '"') {
            field += '"';
            position++;
          } else {
            closed = true;
            break;
          }
        }
        if (!closed) {
          throw new TypeError('Unterminated quoted CSV field');
        }
        if (position < text.length && ![',', '\n', '\r'].includes(text[position])) {
          throw new TypeError('Unexpected character after closing CSV quote');
        }
      } else {
        const start = position;
        while (position < text.length && ![',', '\n', '\r'].includes(text[position])) {
          if (text[position] === '"') {
            throw new TypeError('Quote in unquoted CSV field');
          }
          position++;
        }
        field = text.slice(start, position);
      }
      fields.push(field);
      if (text[position] !== ',') break;
      position++;
    }

    if (text[position] === '\r') {
      if (text[position + 1] !== '\n') {
        throw new TypeError('Bare carriage return outside quoted CSV field');
      }
      position += 2;
    } else if (text[position] === '\n') {
      position++;
    }

    if (fields.length !== columns.length) {
      throw new TypeError('CSV records must contain exactly six fields');
    }
    if (!headerRead) {
      if (fields.some((field, index) => field !== columns[index])) {
        throw new TypeError('CSV header does not match the required columns');
      }
      headerRead = true;
    } else {
      rows.push(Object.fromEntries(columns.map((column, index) => [column, fields[index]])));
    }
  }
  return rows;
}

// JSON Preview's rules: reading JSON into a tree that keeps what was written (numbers exactly as typed, names in
// their order, even repeated ones), and saying what's wrong in plain words, with the line and column. The browser's
// own reader isn't used: its messages differ from browser to browser (Safari gives no position at all), it rounds
// big numbers, and it reorders names that look like numbers.

/** Deeper than this is refused with a plain message, rather than running the page out of room. */
export const MAX_DEPTH = 500;

/**
 * @typedef {{ type: 'object', entries: { key: string, value: JsonNode }[] }
 *   | { type: 'array', items: JsonNode[] }
 *   | { type: 'string', value: string }
 *   | { type: 'number', raw: string }
 *   | { type: 'boolean', value: boolean }
 *   | { type: 'null' }} JsonNode
 * @typedef {{ ok: true, value: JsonNode } | { ok: false, message: string, line: number, column: number, offset: number }} JsonResult
 */

class Wrong extends Error {
  /** @param {string} message @param {number} offset */
  constructor(message, offset) {
    super(message);
    this.offset = offset;
  }
}

const SPACE = new Set([' ', '\t', '\n', '\r']);
const ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const DIGIT = /[0-9]/;
const WORD = /[A-Za-z_$]/;
const VALUE_HINT = 'text in quotes, a number, true, false, null, { or [';

/**
 * Reads JSON. A problem comes back as a plain message with where it is (line and column start at 1).
 * @param {string} text @returns {JsonResult}
 */
export function readJson(text) {
  let i = 0;
  // A file saved with a byte-order mark starts with an invisible character; it isn't part of the JSON.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const skip = () => {
    while (i < text.length && SPACE.has(text[i])) i++;
    if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) throw new Wrong("JSON can't have comments. Take this one out.", i);
  };

  const string = () => {
    const start = i;
    i++;
    let out = '';
    for (;;) {
      const c = text[i];
      if (c === undefined) throw new Wrong('This text never closes: it needs a " at its end.', start);
      if (c === '"') { i++; return out; }
      if (c === '\n' || c === '\r') throw new Wrong('Text can\'t run on to a new line. Close it with ", or write \\n for a line break.', i);
      if (c < ' ') throw new Wrong("There's an invisible control character in this text. Write a tab as \\t.", i);
      if (c !== '\\') { out += c; i++; continue; }
      const e = text[i + 1];
      if (e === 'u') {
        const hex = text.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Wrong('\\u needs four letters or digits after it, like \\u00e9.', i);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
      } else if (e !== undefined && e in ESCAPES) {
        out += ESCAPES[/** @type {keyof typeof ESCAPES} */ (e)];
        i += 2;
      } else {
        throw new Wrong(`\\${e ?? ''} isn't an escape JSON knows. For a backslash itself, write \\\\.`, i);
      }
    }
  };

  const number = () => {
    const start = i;
    if (text[i] === '-') i++;
    if (!DIGIT.test(text[i] ?? '')) throw new Wrong('A minus sign needs a number right after it.', start);
    if (text[i] === '0' && DIGIT.test(text[i + 1] ?? '')) throw new Wrong("A number can't start with 0, unless it's 0 itself or 0.something.", i);
    while (DIGIT.test(text[i] ?? '')) i++;
    if (text[i] === '.') {
      i++;
      if (!DIGIT.test(text[i] ?? '')) throw new Wrong('A decimal point needs digits after it.', i - 1);
      while (DIGIT.test(text[i] ?? '')) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      const e = i;
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!DIGIT.test(text[i] ?? '')) throw new Wrong('The e in a number needs digits after it, like 1e5.', e);
      while (DIGIT.test(text[i] ?? '')) i++;
    }
    return text.slice(start, i);
  };

  // What to say about a character that can't start a value.
  const notAValue = () => {
    const c = text[i];
    if (c === undefined) return new Wrong(`The JSON stops here, but a value is still missing (${VALUE_HINT}).`, i);
    if (c === "'") return new Wrong('Text needs double quotes ("), not single quotes (\').', i);
    if (c === '.') return new Wrong("A number can't start with a dot. Write 0.5, not .5.", i);
    if (c === '+') return new Wrong("A number can't start with +.", i);
    if (c === '}' || c === ']') return new Wrong(`This ${c} has nothing to close here.`, i);
    if (WORD.test(c)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))?.[0] ?? c;
      const fix = { True: 'true', False: 'false', TRUE: 'true', FALSE: 'false', None: 'null', NULL: 'null', Null: 'null', nil: 'null' }[word];
      if (fix) return new Wrong(`${word} must be written ${fix}, in small letters.`, i);
      return new Wrong(`${word} isn't JSON. A value is ${VALUE_HINT}.`, i);
    }
    return new Wrong(`${c} can't start a value. A value is ${VALUE_HINT}.`, i);
  };

  /** @param {number} depth @returns {JsonNode} */
  const value = (depth) => {
    if (depth > MAX_DEPTH) throw new Wrong(`This JSON is nested more than ${MAX_DEPTH} levels deep, which is more than this page can show.`, i);
    skip();
    const c = text[i];
    if (c === '"') return { type: 'string', value: string() };
    if (c === '-' || DIGIT.test(c ?? '')) return { type: 'number', raw: number() };
    if (text.startsWith('true', i) && !/[\w$]/.test(text[i + 4] ?? '')) { i += 4; return { type: 'boolean', value: true }; }
    if (text.startsWith('false', i) && !/[\w$]/.test(text[i + 5] ?? '')) { i += 5; return { type: 'boolean', value: false }; }
    if (text.startsWith('null', i) && !/[\w$]/.test(text[i + 4] ?? '')) { i += 4; return { type: 'null' }; }
    if (c === '[') {
      const open = i;
      i++;
      /** @type {JsonNode[]} */
      const items = [];
      skip();
      if (text[i] === ']') { i++; return { type: 'array', items }; }
      for (;;) {
        items.push(value(depth + 1));
        skip();
        if (text[i] === ']') { i++; return { type: 'array', items }; }
        if (text[i] === undefined) throw new Wrong('The JSON stops before this [ is closed with ].', open);
        if (text[i] !== ',') throw new Wrong(text[i] === '}' ? 'This list was opened with [, so it closes with ], not }.' : 'A comma is missing before this.', i);
        const comma = i;
        i++;
        skip();
        if (text[i] === ']') throw new Wrong('Take out this comma: nothing comes after it.', comma);
        if (text[i] === '}') throw new Wrong('This list was opened with [, so it closes with ], not }.', i);
      }
    }
    if (c === '{') {
      const open = i;
      i++;
      /** @type {{ key: string, value: JsonNode }[]} */
      const entries = [];
      skip();
      if (text[i] === '}') { i++; return { type: 'object', entries }; }
      for (;;) {
        if (text[i] === undefined) throw new Wrong('The JSON stops before this { is closed with }.', open);
        if (text[i] === "'") throw new Wrong('Names need double quotes ("), not single quotes (\').', i);
        if (text[i] !== '"') throw new Wrong(WORD.test(text[i]) ? 'Names need double quotes, like "name".' : `A name in double quotes should come here, not ${text[i]}.`, i);
        const key = string();
        skip();
        if (text[i] !== ':') throw new Wrong(text[i] === undefined ? 'The JSON stops after this name: a colon (:) and a value are missing.' : 'A colon (:) is missing after this name.', i);
        const colon = i;
        i++;
        skip();
        if (text[i] === undefined || text[i] === '}' || text[i] === ',') throw new Wrong('A value is missing after this colon.', colon);
        entries.push({ key, value: value(depth + 1) });
        skip();
        if (text[i] === '}') { i++; return { type: 'object', entries }; }
        if (text[i] === undefined) throw new Wrong('The JSON stops before this { is closed with }.', open);
        if (text[i] !== ',') throw new Wrong(text[i] === ']' ? 'This was opened with {, so it closes with }, not ].' : 'A comma is missing before this.', i);
        const comma = i;
        i++;
        skip();
        if (text[i] === '}') throw new Wrong('Take out this comma: nothing comes after it.', comma);
        if (text[i] === ']') throw new Wrong('This was opened with {, so it closes with }, not ].', i);
      }
    }
    throw notAValue();
  };

  try {
    const result = value(0);
    skip();
    if (i < text.length) throw new Wrong("The JSON has ended, but there's more text after it. JSON holds one value.", i);
    return { ok: true, value: result };
  } catch (e) {
    if (!(e instanceof Wrong)) throw e;
    const before = text.slice(0, e.offset);
    const line = before.split('\n').length;
    return { ok: false, message: e.message, line, column: e.offset - before.lastIndexOf('\n'), offset: e.offset };
  }
}

/** How many names or items a value holds directly. @param {JsonNode} node */
export const sizeOf = (node) => (node.type === 'object' ? node.entries.length : node.type === 'array' ? node.items.length : 0);

/** A value that isn't an object or a list, as JSON text. @param {JsonNode} node */
export const leafText = (node) =>
  node.type === 'string' ? JSON.stringify(node.value) : node.type === 'number' ? node.raw : node.type === 'boolean' ? String(node.value) : 'null';

/**
 * The tree as JSON text, a piece at a time, each with its kind so it can be coloured: a name ('key'), a value
 * ('string', 'number', 'boolean' or 'null'), or 'mark' for the brackets, commas, colons and the spacing between.
 * Tidy (one item a line, indented by `indent`) or, with an empty indent, compact on one line. Walked without
 * recursion, so deep JSON can't run it out of room.
 * @param {JsonNode} root
 * @returns {Generator<['key' | 'string' | 'number' | 'boolean' | 'null' | 'mark', string]>}
 */
export function* jsonPieces(root, indent = '  ') {
  const tidy = indent !== '';
  /** @param {number} depth */
  const pad = (depth) => (tidy ? `\n${indent.repeat(depth)}` : '');
  /** @type {{ node: JsonNode, at: number }[]} What's open, and how far through each. */
  const stack = [];
  /** @type {JsonNode | null} The value to write next; once written, the open object or list it sits in carries on. */
  let value = root;
  while (value || stack.length) {
    if (value) {
      if (value.type !== 'object' && value.type !== 'array') {
        yield [value.type, leafText(value)];
      } else if (sizeOf(value) === 0) {
        yield ['mark', value.type === 'object' ? '{}' : '[]'];
      } else {
        yield ['mark', value.type === 'object' ? '{' : '['];
        stack.push({ node: value, at: 0 });
      }
      value = null;
      continue;
    }
    const top = stack[stack.length - 1];
    const { node } = top;
    if (top.at === sizeOf(node)) {
      stack.pop();
      yield ['mark', `${pad(stack.length)}${node.type === 'object' ? '}' : ']'}`];
      continue;
    }
    const lead = `${top.at > 0 ? ',' : ''}${pad(stack.length)}`;
    if (lead) yield ['mark', lead];
    const index = top.at++;
    if (node.type === 'object') {
      yield ['key', JSON.stringify(node.entries[index].key)];
      yield ['mark', tidy ? ': ' : ':'];
      value = node.entries[index].value;
    } else if (node.type === 'array') {
      value = node.items[index];
    }
  }
}

/**
 * The tree as JSON text: tidy (one item a line, indented by `indent`) or, with an empty indent, compact on one line.
 * @param {JsonNode} root
 */
export function writeJson(root, indent = '  ') {
  const out = [];
  for (const [, text] of jsonPieces(root, indent)) out.push(text);
  return out.join('');
}

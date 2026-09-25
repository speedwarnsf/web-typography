/** Development-time option checks for the public API. Each message is printed
 * once. The ESM and CommonJS entries call this only when process.env.NODE_ENV
 * is not "production", so production bundles drop it; the script-tag builds
 * keep it. Invalid values keep their existing behaviour: this only warns. */
const warned = new Set<string>();

export function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'function') return 'a function';
  if ((value as Node).nodeType !== undefined) return 'a ' + ((value as Node).nodeName || 'node').toLowerCase() + ' node';
  return 'an object';
}

function warn(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn('[typeset] ' + message);
}

const choices: Record<string, readonly unknown[]> = {
  lineBreaks: ['unicode', 'legacy'],
  smartQuotes: ['en', false],
  contour: ['finished', 'natural'],
  mode: ['body', 'heading', 'title', 'ui'],
  density: ['compact', 'editorial'],
};
const booleans = ['opticalHanging', 'spacing', 'tracking'];
const list = (values: readonly unknown[]) => values.map(value => typeof value === 'string' ? JSON.stringify(value) : String(value)).join(' or ').replace(/ or (?=.* or )/g, ', ');

export function checkOptions(api: string, options: unknown): void {
  if (options === undefined) return;
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    warn(api + ' options must be an object (received ' + describe(options) + ')');
    return;
  }
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    // Own keys only: `in` also finds Object.prototype's members, and an
    // options object parsed from JSON with a "constructor" key threw here,
    // which check() swallowed with every later warning.
    if (Object.prototype.hasOwnProperty.call(choices, key)) {
      if (!choices[key].includes(value)) warn(key + ' must be ' + list(choices[key]) + ' (received ' + describe(value) + ')');
    } else if (booleans.includes(key)) {
      if (typeof value !== 'boolean') warn(key + ' must be true or false (received ' + describe(value) + ')');
    } else if (key === 'maxLines') {
      if (!Number.isInteger(value) || (value as number) < 1) warn('maxLines must be a positive integer (received ' + describe(value) + ')');
    } else if (key === 'keep') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) warn('keep must be an array of strings (received ' + describe(value) + ')');
    } else if (key === 'text') {
      if (typeof value !== 'string') warn('text must be a string (received ' + describe(value) + ')');
    } else warn(api + ' has no option ' + JSON.stringify(key) + '; it is ignored');
  }
}

export function checkSelector(api: string, selector: unknown): void {
  if (selector !== undefined && typeof selector !== 'string') warn(api + ' selector must be a string (received ' + describe(selector) + ')');
}

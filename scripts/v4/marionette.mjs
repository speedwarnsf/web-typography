// @ts-check
// A minimal Marionette client for Playwright's Firefox, used by the optional
// Firefox lane of verify-native-ax.mjs to read Gecko's own accessibility tree
// (nsIAccessible) from privileged chrome-context script. Firefox must be
// launched with -marionette -remote-allow-system-access and MOZ_MARIONETTE=1;
// it listens on port 2828 and greets only once a window exists.
import net from 'node:net';

/** @param {number} port */
export async function marionette(port) {
  // Marionette starts listening shortly after the browser does.
  let socket;
  for (let attempt = 0; ; attempt++) {
    try {
      socket = net.connect(port, '127.0.0.1');
      await new Promise((resolve, reject) => { /** @type {net.Socket} */ (socket).once('connect', resolve); /** @type {net.Socket} */ (socket).once('error', reject); });
      break;
    } catch (error) {
      socket?.destroy();
      if (attempt >= 40) throw error;
      await new Promise(r => setTimeout(r, 250));
    }
  }
  let buffer = Buffer.alloc(0), id = 0;
  /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
  const pending = new Map();
  /** @type {(value: unknown) => void} */
  let hello = () => {};
  const greeted = new Promise(resolve => { hello = resolve; });
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const colon = buffer.indexOf(':');
      if (colon < 0) return;
      const length = Number(buffer.subarray(0, colon).toString('utf8'));
      if (buffer.length < colon + 1 + length) return;
      const message = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString('utf8'));
      buffer = buffer.subarray(colon + 1 + length);
      if (!Array.isArray(message)) { hello(message); continue; }
      const [, messageId, error, result] = message;
      const waiter = pending.get(messageId);
      pending.delete(messageId);
      if (waiter) error ? waiter.reject(new Error(JSON.stringify(error))) : waiter.resolve(result);
    }
  });
  await greeted;
  /** @param {string} name @param {Record<string, unknown>} [params] @returns {Promise<any>} */
  const send = (name, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    const body = Buffer.from(JSON.stringify([0, messageId, name, params]), 'utf8');
    socket.write(body.length + ':');
    socket.write(body);
  });
  await send('WebDriver:NewSession', { capabilities: {} });
  await send('Marionette:SetContext', { value: 'chrome' });
  return {
    /** @param {string} script @param {unknown[]} [args] */
    exec: async (script, args = []) => (await send('WebDriver:ExecuteAsyncScript', { script, args, scriptTimeout: 15000 })).value,
    close: () => socket.destroy(),
  };
}

// Chrome-context script: in the tab showing `url`, return for each element id
// Gecko's accessible name, its flattened text (text leaves joined, whitespace
// accessibles as line breaks) and the names of the links inside it.
export const GECKO_AX = `
const [url, ids, resolve] = arguments;
(async () => {
  const svc = Cc["@mozilla.org/accessibilityService;1"].getService(Ci.nsIAccessibilityService);
  let browser = null;
  for (const w of Services.wm.getEnumerator(null)) {
    const bs = w.gBrowser ? w.gBrowser.browsers : [...w.document.querySelectorAll('browser')];
    for (const b of bs) if (b.currentURI && b.currentURI.spec.startsWith(url)) browser = b;
  }
  if (!browser) return resolve({ error: 'no browser for ' + url });
  const want = new Set(ids);
  // One walk collects every wanted accessible; XPCOM tree calls are slow.
  const collect = (acc, found, depth = 0) => {
    if (!acc || depth > 80) return;
    let id = null;
    try { id = acc.id; } catch {}
    if (id && want.has(id)) found.set(id, acc);
    if (acc.childCount) for (let c = acc.firstChild; c; c = c.nextSibling) collect(c, found, depth + 1);
  };
  const flat = a => { let s = ''; for (let c = a.firstChild; c; c = c.nextSibling) { const r = svc.getStringRole(c.role);
    if (r === 'text leaf' || r === 'statictext') s += c.name || ''; else if (r === 'whitespace') s += '\\n'; else s += flat(c); } return s; };
  for (let attempt = 0; attempt < 40; attempt++) {
    const outer = svc.getAccessibleFor(browser);
    const found = new Map();
    collect(outer && outer.firstChild, found);
    const out = {};
    let ok = true;
    for (const id of ids) {
      const acc = found.get(id);
      if (!acc) { ok = false; break; }
      const links = [];
      const walk = a => { for (let c = a.firstChild; c; c = c.nextSibling) { if (c.role === Ci.nsIAccessibleRole.ROLE_LINK) links.push(c.name); walk(c); } };
      walk(acc);
      out[id] = { role: svc.getStringRole(acc.role), name: acc.name, text: flat(acc), links };
    }
    if (ok) return resolve(out);
    await new Promise(r => setTimeout(r, 250));
  }
  resolve({ error: 'accessibles not found' });
})();
`;

// Init script for scripts/v4/verify-react.mjs: counts observers, observed
// targets and window/document/font listeners, records console warnings, and
// provides a host-mutation watcher built on the uninstrumented observer.
(() => {
  const I = window.__inst = { mo: { created: 0, active: new Set(), observe: 0 }, ro: { created: 0, active: new Set(), observe: 0 }, io: { created: 0, active: new Set(), observe: 0 }, listeners: new Map(), warnings: [] };
  const NativeMO = window.__NativeMO = window.MutationObserver;
  for (const [name, key] of [['MutationObserver', 'mo'], ['ResizeObserver', 'ro'], ['IntersectionObserver', 'io']]) {
    const Original = window[name];
    if (!Original) continue;
    window[name] = class extends Original {
      constructor(...args) { super(...args); I[key].created++; this.__targets = new Set(); }
      observe(target, ...rest) { I[key].observe++; this.__targets.add(target); I[key].active.add(this); return super.observe(target, ...rest); }
      unobserve(target) { this.__targets?.delete(target); if (!this.__targets?.size) I[key].active.delete(this); return super.unobserve(target); }
      disconnect() { this.__targets?.clear(); I[key].active.delete(this); return super.disconnect(); }
    };
  }
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const label = target => target === window ? 'window' : target === document ? 'document' : (document.fonts && target === document.fonts) ? 'fonts' : null;
  EventTarget.prototype.addEventListener = function (type, fn, options) {
    const l = label(this);
    if (l) { const key = l + ':' + type; if (!I.listeners.has(key)) I.listeners.set(key, new Set()); I.listeners.get(key).add(fn); }
    return add.call(this, type, fn, options);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, options) {
    const l = label(this);
    if (l) I.listeners.get(l + ':' + type)?.delete(fn);
    return remove.call(this, type, fn, options);
  };
  const error = console.error.bind(console), warn = console.warn.bind(console);
  console.error = (...args) => { I.warnings.push('error: ' + args.map(String).join(' ').slice(0, 400)); error(...args); };
  console.warn = (...args) => { I.warnings.push('warn: ' + args.map(String).join(' ').slice(0, 400)); warn(...args); };
  const hosts = '[data-typeset-react], [data-typeset-react-rich]';
  window.__snapshot = () => ({
    mo: { created: I.mo.created, active: I.mo.active.size, observe: I.mo.observe },
    ro: { created: I.ro.created, active: I.ro.active.size, observe: I.ro.observe },
    io: { created: I.io.created, active: I.io.active.size, observe: I.io.observe },
    listeners: Object.fromEntries([...I.listeners].filter(([, set]) => set.size).map(([key, set]) => [key, set.size])),
  });
  /** Count DOM writes inside adapter hosts until stop() is called. */
  window.__watch = () => {
    const counts = { childList: 0, characterData: 0, markerStyle: 0, text: 0, rich: 0, hosts: new Set() };
    const take = records => {
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const host = target?.closest(hosts);
        if (!host) continue;
        const kind = host.hasAttribute('data-typeset-react-rich') ? 'rich' : 'text';
        if (record.type !== 'attributes' || target !== host) counts[kind]++;
        if (record.type === 'childList' && (record.addedNodes.length || record.removedNodes.length)) { counts.childList++; counts.hosts.add(host.id); }
        if (record.type === 'characterData') { counts.characterData++; counts.hosts.add(host.id); }
        if (record.type === 'attributes' && target !== host) { counts.markerStyle++; counts.hosts.add(host.id); }
      }
    };
    const observer = new NativeMO(take);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return () => { take(observer.takeRecords()); observer.disconnect(); return { childList: counts.childList, characterData: counts.characterData, markerStyle: counts.markerStyle, text: counts.text, rich: counts.rich, hosts: [...counts.hosts] }; };
  };
  /** Resolve once no host has been written for `ms`, or after `max`. */
  window.__quiet = (ms = 300, max = 8000) => new Promise(resolve => {
    const started = performance.now();
    let last = performance.now();
    const observer = new NativeMO(records => { if (records.some(r => (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest(hosts))) last = performance.now(); });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    const tick = () => {
      const now = performance.now();
      if (now - last >= ms || now - started >= max) { observer.disconnect(); resolve(now - started < max); }
      else setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
  });
  window.__frames = n => new Promise(resolve => { let i = 0; const step = () => (++i >= n ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); });
})();

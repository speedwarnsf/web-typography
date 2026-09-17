import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

export async function acceptanceFixture() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Typeset acceptance</title><style>
  *{box-sizing:border-box}body{margin:24px;background:#fff;color:#171717;font:18px/1.5 Georgia}main{max-width:640px}h1{font:600 24px/1.2 system-ui}p{margin:0 0 24px;text-wrap:wrap}a{color:#146044}button,textarea,[contenteditable]{font:inherit;border-radius:0}textarea,[contenteditable]{display:block;width:100%;min-height:80px;border:1px solid #555}#passages{max-width:280px}button{margin:8px 8px 8px 0}
  </style><link rel="stylesheet" href="/styles.css"></head><body><main><h1>Typeset acceptance</h1>
  <div id="passages"><p id="first" data-compose>"Read <strong>the curator's notes</strong> at <a href="#destination">the neighborhood gallery</a>," she said. "There is always <em>another detail</em> to discover."</p><p id="second" data-compose>The letters from <strong>Oak Street</strong> describe a neighborhood that changed over time. Visit <a href="#destination">the collection</a> to read the original accounts.</p></div>
  <p id="authored">An authored line.<br>Another authored line.</p>
  <ul id="list"><li>A photograph of the street.</li><li>A letter about the gallery.</li></ul>
  <div id="destination" tabindex="-1">The collection</div><button id="apply">Compose</button><button id="restore">Restore</button>
  <label for="plain">Plain paste</label><textarea id="plain"></textarea><div id="rich" contenteditable="true" role="textbox" aria-label="Rich paste" aria-multiline="true"></div>
  </main><script src="/typeset.js"></script><script>
  window.events=[];document.addEventListener('copy',e=>events.push({type:'copy',trusted:e.isTrusted}));document.addEventListener('paste',e=>events.push({type:'paste',trusted:e.isTrusted}));
  window.compose=()=>{window.controller?.disconnect();window.controller=Typeset.mount(document,'[data-compose]',{smartQuotes:'en',opticalHanging:true});return controller.ready;};
  document.querySelector('#apply').onclick=compose;document.querySelector('#restore').onclick=()=>{window.controller?.disconnect();document.querySelectorAll('[data-compose]').forEach(p=>Typeset.restore(p));};
  window.activations=0;document.querySelector('#first a').addEventListener('click',()=>window.activations++);
  </script></body></html>`;
  const files = { '/typeset.js': ['packages/typeset-v4/dist/typeset.global.js', 'text/javascript'], '/styles.css': ['packages/typeset-v4/dist/styles.css', 'text/css'], '/font.woff2': ['lab/fraunces-latin-variable.woff2', 'font/woff2'] };
  const server = createServer(async (req, res) => {
    try {
      const file = files[new URL(req.url, 'http://localhost').pathname];
      res.setHeader('Content-Type', file ? file[1] : 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(file ? await readFile(file[0]) : html);
    } catch { res.writeHead(500); res.end('Fixture unavailable'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

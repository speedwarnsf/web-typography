import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
  const text = "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact.";
  await p.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:360px;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#d4d4d4;padding:16px">${text}</div></body></html>`);
  await p.waitForTimeout(300);
  const dbg = await p.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.5;
    const lhScale = 1 + (lh - 1.5) * 1.0;
    const MAX_WS_EXPAND = 3.0 * lhScale;
    const MAX_WS_TIGHTEN = 2.0 * lhScale;
    const MAX_LS = 0.4 * lhScale;
    const log = [`cw=${cw} lh=${lh.toFixed(2)} lhScale=${lhScale.toFixed(2)} MAX_WS_E=${MAX_WS_EXPAND.toFixed(1)} MAX_LS=${MAX_LS.toFixed(2)}`];

    const words = el.textContent.split(/ +/).filter(Boolean);
    el.innerHTML = words.map((w,i)=>`<span data-w="${i}">${w}</span>`).join(' ');
    const spans = el.querySelectorAll('span[data-w]');
    const lines = []; let top=-1, cur=[];
    spans.forEach((s,i) => {
      const t = Math.round(s.getBoundingClientRect().top);
      if (top===-1){top=t;cur=[i];}
      else if(Math.abs(t-top)>3){const f=spans[cur[0]],l=spans[cur[cur.length-1]];lines.push({indices:cur,width:l.getBoundingClientRect().right-f.getBoundingClientRect().left});top=t;cur=[i];}
      else cur.push(i);
    });
    if(cur.length){const f=spans[cur[0]],l=spans[cur[cur.length-1]];lines.push({indices:cur,width:l.getBoundingClientRect().right-f.getBoundingClientRect().left});}

    const nlw = lines.slice(0,-1).map(l=>l.width).sort((a,b)=>a-b);
    const mid = Math.floor(nlw.length/2);
    let target = nlw.length%2===0 ? (nlw[mid-1]+nlw[mid])/2 : nlw[mid];
    log.push(`target=${target.toFixed(1)}`);

    const adjs = lines.map((line,i) => {
      const isLast = i === lines.length-1;
      const lw = line.indices.map(idx=>words[idx]);
      const lt = lw.join(' ');
      const spaces = lw.length-1;
      const cc = lt.replace(/\s/g,'').length;
      const gap = target - line.width;
      if (isLast || spaces===0 || Math.abs(gap)<=1) {
        log.push(`L${i}: SKIP (last=${isLast} spaces=${spaces} gap=${gap.toFixed(1)})`);
        return {ws:0,ls:0,text:lt,ow:line.width};
      }
      const rawWs = gap/spaces;
      let ws = rawWs > 0 ? Math.min(MAX_WS_EXPAND, rawWs) : Math.max(-MAX_WS_TIGHTEN, rawWs*0.7);
      const wsCov = ws*spaces;
      const rem = gap - wsCov;
      let ls = 0;
      if (rem>2&&cc>0) ls = Math.min(MAX_LS,rem/cc);
      else if (rem<-2&&cc>0) ls = Math.max(-MAX_LS*0.5,rem/cc);
      log.push(`L${i}: gap=${gap.toFixed(1)} spaces=${spaces} rawWs=${rawWs.toFixed(2)} ws=${ws.toFixed(2)} wsCov=${wsCov.toFixed(1)} rem=${rem.toFixed(1)} ls=${ls.toFixed(3)} total=${(wsCov+ls*cc).toFixed(1)}`);
      return {ws,ls,text:lt,ow:line.width};
    });

    // Neighbor
    for (let i=0;i<adjs.length-1;i++) {
      const a=adjs[i],b=adjs[i+1];
      if (a.ws*b.ws<0) {
        const aDir = a.ws>0?'expand':'tighten', bDir=b.ws>0?'expand':'tighten';
        if (a.ws>0){a.ws*=0.85;a.ls*=0.85;b.ws*=0.65;b.ls*=0.65;}
        else{a.ws*=0.65;a.ls*=0.65;b.ws*=0.85;b.ls*=0.85;}
        log.push(`NEIGHBOR i=${i}: L${i}(${aDir}) L${i+1}(${bDir}) → L${i}.ws=${a.ws.toFixed(2)} L${i+1}.ws=${b.ws.toFixed(2)}`);
      }
    }

    // Anti-just
    const aw = adjs.map((a,i)=>{const s=lines[i].indices.length-1;const c=a.text.replace(/\s/g,'').length;return a.ow+a.ws*s+a.ls*c;});
    const af = aw.slice(0,-1).map(w=>w/cw);
    const minF=Math.min(...af),maxF=Math.max(...af);
    log.push(`ANTI-JUST: fills=[${af.map(f=>(f*100).toFixed(1)+'%').join(', ')}] minF=${(minF*100).toFixed(1)}% maxF=${(maxF*100).toFixed(1)}% range=${((maxF-minF)*100).toFixed(1)}%`);
    if (minF>0.92 && maxF-minF<0.04) {
      log.push(`ANTI-JUST FIRED: scaling back 50%`);
      adjs.forEach(a=>{a.ws*=0.5;a.ls*=0.5;});
    }

    // Final
    adjs.forEach((a,i) => {
      const s=lines[i].indices.length-1;const c=a.text.replace(/\s/g,'').length;
      const adjW=a.ow+a.ws*s+a.ls*c;
      log.push(`FINAL L${i}: ${Math.round(a.ow/cw*100)}% → ${Math.round(adjW/cw*100)}% (ws=${a.ws.toFixed(2)} ls=${a.ls.toFixed(3)})`);
    });

    return log.join('\n');
  });
  console.log(dbg);
  await browser.close();
}
run();

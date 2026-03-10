import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const page = (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
  const p = await page;
  const text = "Pathos is the emotional layer \u2014 the warmth of a serif, the sharpness of a sans, the rhythm of a well-set paragraph. Type can evoke calm, urgency, warmth, or dramatic impact.";
  await p.setContent(`<html><body style="background:#0a0a0a;margin:0;padding:0"><div id="d" style="width:360px;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#d4d4d4;padding:16px">${text}</div></body></html>`);
  await p.waitForTimeout(300);
  const info = await p.evaluate(() => {
    const el = document.getElementById('d');
    const cs = getComputedStyle(el);
    const cw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const words = el.textContent.split(/ +/).filter(Boolean);
    el.innerHTML = words.map((w,i)=>`<span data-w="${i}">${w}</span>`).join(' ');
    const spans = el.querySelectorAll('span[data-w]');
    const lines = []; let top=-1, cur=[];
    spans.forEach((s,i) => {
      const t = Math.round(s.getBoundingClientRect().top);
      if (top === -1) { top=t; cur=[i]; }
      else if (Math.abs(t-top)>3) {
        const f=spans[cur[0]], l=spans[cur[cur.length-1]];
        lines.push({ words: cur.map(j=>words[j]), width: Math.round(l.getBoundingClientRect().right - f.getBoundingClientRect().left), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left)/cw*100) });
        top=t; cur=[i];
      } else cur.push(i);
    });
    if (cur.length) { const f=spans[cur[0]], l=spans[cur[cur.length-1]]; lines.push({ words: cur.map(j=>words[j]), width: Math.round(l.getBoundingClientRect().right - f.getBoundingClientRect().left), fill: Math.round((l.getBoundingClientRect().right - f.getBoundingClientRect().left)/cw*100) }); }
    return { containerWidth: cw, lines: lines.map(l => ({ text: l.words.join(' '), wordCount: l.words.length, gaps: l.words.length-1, width: l.width, fill: l.fill, charCount: l.words.join(' ').replace(/\s/g,'').length })) };
  });
  console.log(`Container: ${info.containerWidth}px`);
  const nonLast = info.lines.slice(0,-1).map(l=>l.width);
  nonLast.sort((a,b)=>a-b);
  const mid = Math.floor(nonLast.length/2);
  const target = nonLast.length%2===0 ? (nonLast[mid-1]+nonLast[mid])/2 : nonLast[mid];
  console.log(`Target: ${target}px (${Math.round(target/info.containerWidth*100)}%)`);
  info.lines.forEach((l,i) => {
    const gap = target - l.width;
    const isLast = i === info.lines.length - 1;
    console.log(`  Line ${i} [${l.fill}%] ${l.width}px, ${l.gaps} gaps, ${l.charCount} chars, gap=${Math.round(gap)}px ${isLast?'(LAST)':''}`);
    console.log(`    "${l.text}"`);
  });
  await browser.close();
}
run();

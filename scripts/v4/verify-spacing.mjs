// @ts-check
import { browsers } from './browsers.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { releaseIdentity } from './release-evidence.mjs';
import { build } from 'esbuild';
import { fixtureFont } from './font-fixture.mjs';
import { reactUnderTest } from './candidate.mjs';

const proof='Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.';
const paragraphs=JSON.parse(await readFile('tests/v4-corpus.json','utf8')).paragraphs;
const report={...await releaseIdentity(),checks:[],cases:[],errors:[],browsers:{}};
await mkdir('output/playwright',{recursive:true});
const fixtureHTML=await readFile('lab/spacing-react.html','utf8');
const fixtureBundle=await build({entryPoints:['lab/spacing-react.tsx'],bundle:true,format:'esm',target:'es2022',write:false,plugins:[reactUnderTest()]});
/**
 * 4.4 moved the declarations every spacing and hanging marker and tracking
 * wrapper shares into the engine's stylesheet (the markers' !important in a
 * named layer); each keeps only its own advance or spacing inline. Checked on corpus
 * paragraphs with the default finish and optical hanging: the inline styles
 * are those values alone; a page that removes constructable stylesheets gets
 * the 4.3 inline declarations with identical outcomes and geometry; hostile
 * page CSS on every span gives the outcome 4.3.1 gives or a native one, never
 * broken text; and a shadow root gets the sheet too.
 * @param {any} browser @param {string} name
 */
async function markerStyles(browser,name){
  const check=(label,pass,detail)=>report.checks.push({browser:name,label:'markers (4.4): '+label,pass:!!pass,...(detail!==undefined&&{detail})});
  const subject=await readFile(process.env.TYPESET_BUNDLE||'packages/typeset-v4/dist/typeset.global.js','utf8');
  const baseline=await readFile('public/releases/4.3.1/typeset.global.js','utf8');
  const open=async(/** @type {{ init?: () => void, css?: string }} */ {init,css=''}={})=>{
    const tab=await browser.newPage({viewport:{width:1200,height:900}});
    tab.on('pageerror',error=>report.errors.push({browser:name,error:error.message}));
    await tab.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:20px/1.5 Georgia;width:340px;text-wrap:wrap;margin:0 0 12px}'+css+'</style></head><body></body></html>');
    // setContent does not navigate, so an init script would not run: run it before the engine loads.
    if(init)await tab.evaluate(init);
    await tab.addScriptTag({content:baseline});await tab.evaluate(()=>{window.Baseline=window.Typeset;});
    await tab.addScriptTag({content:subject});
    return tab;
  };
  // Composes each text with one build, reports what a reader and the audit see, and restores.
  const run=(tab,build)=>tab.evaluate(({texts,build})=>{
    const api=build==='baseline'?window.Baseline:window.Typeset,round=v=>Math.round(v*100)/100;
    return texts.map(text=>{
      const p=document.createElement('p');p.textContent=text;document.body.append(p);
      const result=api.typeset(p,{opticalHanging:true}),layout=api.measureLayout(p);
      const markers=[...p.querySelectorAll('[data-ts-space][data-ts-break], [data-ts-hang][data-ts-break]')],tracks=[...p.querySelectorAll('[data-ts-track]')];
      const record={outcome:result.outcome,features:result.features,intact:p.textContent===text,overflow:layout.overflow,
        lines:layout.lines.length,breaks:p.querySelectorAll('br[data-ts-break]').length,
        geometry:JSON.stringify([layout.lines.map(line=>[line.left,line.top,line.width].map(round)),[...markers,...tracks].map(el=>{const cs=getComputedStyle(el),box=el.getBoundingClientRect();return [cs.marginLeft,cs.letterSpacing,cs.wordSpacing,round(box.width),round(box.height)].join(' ');})]),
        markerStyles:[...new Set(markers.map(el=>Array.from({length:el.style.length},(_,i)=>el.style[i]).sort().join(',')))],
        trackStyles:[...new Set(tracks.map(el=>el.style.length<=2?Array.from({length:el.style.length},(_,i)=>el.style[i]).sort().join(','):'all '+el.style.length))],
        computed:[...markers.map(el=>{const cs=getComputedStyle(el);return cs.display+' '+cs.position+' '+cs.fontSize+' '+cs.paddingLeft+' '+cs.marginRight;}),...tracks.map(el=>{const cs=getComputedStyle(el);return cs.display+' '+cs.paddingLeft+' '+cs.marginLeft;})],
        markers:markers.length,tracks:tracks.length};
      api.restore(p);p.remove();return record;
    });
  },{texts,build});
  const texts=paragraphs.slice(0,16);
  const sheet=await open(),withSheet=await run(sheet,'subject');
  const layered=await sheet.evaluate(()=>document.adoptedStyleSheets.some(s=>[...s.cssRules].some(rule=>/** @type {any} */ (rule).name==='typeset-markers')));
  check('the engine adopts one stylesheet with the typeset-markers layer',layered);
  const markers=withSheet.reduce((n,r)=>n+r.markers,0),tracks=withSheet.reduce((n,r)=>n+r.tracks,0);
  check('spacing and hanging markers carry only margin-left inline',markers>20&&withSheet.every(r=>r.markerStyles.every(list=>list==='margin-left')),{markers,styles:[...new Set(withSheet.flatMap(r=>r.markerStyles))]});
  check('tracking wrappers carry only letter-spacing and word-spacing inline',tracks>5&&withSheet.every(r=>r.trackStyles.every(v=>v==='letter-spacing,word-spacing')),{tracks,styles:[...new Set(withSheet.flatMap(r=>r.trackStyles))]});
  check('markers compute as 4.3 wrote them: inline, static, font-size 0, no padding or right margin',withSheet.every(r=>r.computed.every(v=>/^inline (static 0px 0px 0px|0px 0px)$/.test(v))),[...new Set(withSheet.flatMap(r=>r.computed))].slice(0,6));
  // A shadow root gets the same sheet.
  const shadow=await sheet.evaluate(async text=>{
    const host=document.createElement('div');document.body.append(host);
    const root=host.attachShadow({mode:'open'});root.innerHTML='<style>p{font:20px/1.5 Georgia;width:340px;margin:0}</style><p></p>';
    root.querySelector('p').textContent=text;
    const controller=window.Typeset.mount(root,'p',{opticalHanging:true});await controller.ready;
    const markers=[...root.querySelectorAll('[data-ts-space], [data-ts-hang]')];
    const out={outcome:root.querySelector('p').dataset.tsOutcome,adopted:root.adoptedStyleSheets.length,markers:markers.length,
      inline:markers.every(el=>el.style.length===1&&el.style.marginLeft),computed:markers.every(el=>getComputedStyle(el).fontSize==='0px'&&getComputedStyle(el).display==='inline')};
    controller.disconnect();host.remove();return out;
  },paragraphs[20]);
  check('inside a shadow root: the sheet is adopted there and markers carry only margin-left',shadow.outcome==='composed:rich'&&shadow.adopted>0&&shadow.markers>0&&shadow.inline&&shadow.computed,shadow);
  await sheet.close();
  // No constructable stylesheets: the 4.3 inline declarations, same result.
  const bare=await open({init:()=>{delete Document.prototype.adoptedStyleSheets;delete ShadowRoot.prototype.adoptedStyleSheets;}});
  const inline=await run(bare,'subject');await bare.close();
  check('without constructable stylesheets markers fall back to the 4.3 inline declarations',inline.every(r=>r.markerStyles.every(list=>list.split(',').length>=17&&list.includes('font-size')))&&inline.every(r=>r.trackStyles.every(v=>v.startsWith('all '))),[...new Set(inline.flatMap(r=>[...r.markerStyles,...r.trackStyles]))].slice(0,4));
  const drift=inline.map((r,i)=>({i,same:r.outcome===withSheet[i].outcome&&JSON.stringify(r.features)===JSON.stringify(withSheet[i].features)&&r.geometry===withSheet[i].geometry})).filter(r=>!r.same);
  check('the inline fallback gives identical outcomes, finishes and geometry',!drift.length,drift.slice(0,4));
  // Hostile CSS on every span: 4.3.1's outcome or a native one, text intact, lines as composed.
  const hostile=await open({css:'span{display:block!important;padding:3px!important;margin:9px}'});
  const before=await run(hostile,'baseline'),after=await run(hostile,'subject');await hostile.close();
  const broken=after.map((r,i)=>({i,r,b:before[i]})).filter(({r,b})=>!r.intact||r.overflow>.5||(r.outcome!==b.outcome&&!r.outcome.startsWith('native'))||(r.outcome==='composed:rich'&&r.lines!==r.breaks+1)||!r.computed.every(v=>/^inline (static 0px 0px 0px|0px 0px)$/.test(v)));
  check('span{display:block!important;padding:3px!important;margin:9px} gives 4.3.1\'s outcome or a native one, never broken text',!broken.length,
    {broken:broken.slice(0,3).map(({i,r,b})=>({i,subject:[r.outcome,r.features],baseline:[b.outcome,b.features]})),
      spacing:{baseline:before.filter(r=>r.features?.spacing==='applied').length,subject:after.filter(r=>r.features?.spacing==='applied').length}});
}

for(const {name,engine,executablePath} of browsers){
  const browser=await engine.launch({executablePath});report.browsers[name]=browser.version();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>report.errors.push({browser:name,error:error.message}));
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:20px/1.5 Georgia;text-wrap:wrap;margin:0}a{color:#176650}</style></head><body></body></html>');
    await page.addScriptTag({path:process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js'});
    const evaluated=await page.evaluate(({proof,paragraphs})=>{
      const api=window.Typeset,checks=[],cases=[];
      const check=(label,pass,detail)=>checks.push({label,pass:!!pass,...(detail!==undefined&&{detail})});
      const boundaries=layout=>JSON.stringify(layout.lines.map(l=>[l.sourceStart,l.sourceEnd]));
      const create=(text,width=340,font='Georgia',rich=false)=>{
        const p=document.createElement('p');p.style.width=width+'px';p.style.fontFamily=font;
        if(rich){const strong=document.createElement('strong'),a=document.createElement('a');strong.textContent=text.slice(36,88);a.href='#sample';a.textContent=text.slice(88,128);p.append(text.slice(0,36),strong,a,text.slice(128));}
        else p.textContent=text;
        document.body.append(p);return p;
      };
      const samples=[...['Georgia','Arial','Times New Roman'].flatMap(font=>[220,288,340,420,560].flatMap(width=>[false,true].map(rich=>({text:proof,width,font,rich})))),
        ...paragraphs.flatMap(text=>[240,340,560].map(width=>({text,width,font:'Georgia',rich:false})))];
      for(const [index,sample] of samples.entries()){
        const p=create(sample.text,sample.width,sample.font,sample.rich);
        const markup=p.innerHTML,head=p.firstChild,link=p.querySelector('a');
        const base=api.typeset(p,{spacing:false});
        const baseBounds=boundaries(base.after);
        let natural=0,expected;
        if(index<30&&!sample.rich){
          const space=document.createElement('span');space.style.cssText='position:fixed;white-space:pre;font:inherit;letter-spacing:0;word-spacing:0';space.textContent=' '.repeat(32);p.append(space);natural=space.getBoundingClientRect().width/32;space.remove();
          expected=api.shapeExactLines(base.after.lines.map(line=>({tokens:api.tokenize(line.text,()=>0),width:line.width,fill:line.width/base.after.width})),base.after.width/10,base.after.width,false,natural/20,20);
        }
        api.restore(p);
        const result=api.typeset(p),after=api.measureLayout(p);
        check('fixed membership '+index,boundaries(after)===baseBounds,{before:base.outcome,after:result.outcome,spacing:result.features.spacing});
        check('source and final line '+index,p.textContent===sample.text&&Math.abs((after.lines.at(-1)?.width||0)-(base.after.lines.at(-1)?.width||0))<=.5);
        check('no added overflow '+index,after.overflow<=Math.max(.5,base.after.overflow));
        const markers=[...p.querySelectorAll('[data-ts-space]')];
        if(expected&&base.outcome==='composed:rich'){
          check('V3 full finish parity '+index,base.after.lines.every((line,i)=>{
            const delta=markers.filter(marker=>Number(marker.dataset.tsSpace)>line.sourceStart&&Number(marker.dataset.tsSpace)<line.sourceEnd).reduce((sum,marker)=>sum+parseFloat(marker.style.marginLeft),0);
            return Math.abs(delta-(expected[i].wordSpacingEm||0)*20*(line.words-1))<.15;
          }));
          check('natural-space bounds '+index,markers.every(marker=>{const px=parseFloat(marker.style.marginLeft);return px<=natural*.33+.02&&px>=-natural*.2-.02;}));
        }
        check('reported finish '+index,result.features.spacing==='applied'?markers.length>0:markers.length===0);
        if(index<30&&base.outcome==='composed:rich'&&base.after.lines.length>2)check('proof finish actually applied '+index,markers.length>0,result);
        const first=p.innerHTML;api.typeset(p);check('repeat pass '+index,p.innerHTML===first);
        cases.push({index,...sample,text:undefined,outcome:result.outcome,spacing:result.features.spacing,adjustments:markers.length,before:base.after.lines.map(l=>l.width),after:after.lines.map(l=>l.width)});
        api.restore(p);check('exact restore '+index,p.innerHTML===markup&&p.firstChild===head&&(!link||p.querySelector('a')===link));p.remove();
      }
      const p=create(proof,340,'Georgia',true),link=p.querySelector('a'),head=p.firstChild,markup=p.innerHTML;
      let clicks=0;link.addEventListener('click',event=>{event.preventDefault();clicks++;});link.focus();
      const selection=getSelection();selection.setBaseAndExtent(p.lastChild,12,head,4);
      const selected=selection.toString();
      api.typeset(p);check('selection source and focus preserved',selection.getRangeAt(0).toString()===selected&&document.activeElement===link);
      const anchor=document.createRange(),focus=document.createRange();anchor.selectNodeContents(p);focus.selectNodeContents(p);
      anchor.setEnd(selection.anchorNode,selection.anchorOffset);focus.setEnd(selection.focusNode,selection.focusOffset);
      check('backward selection direction preserved',anchor.toString().length===140&&focus.toString().length===4);
      link.click();check('link listener preserved',clicks===1);
      const range=document.createRange();range.selectNodeContents(p);selection.removeAllRanges();selection.addRange(range);
      const copy=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});p.dispatchEvent(copy);
      check('plain and HTML copy exclude all generated markers',copy.clipboardData.getData('text/plain')===proof&&!copy.clipboardData.getData('text/html').includes('data-ts-')&&copy.clipboardData.getData('text/html').includes('<a href='));
      selection.removeAllRanges();api.restore(p);
      check('restore after selection/copy',p.innerHTML===markup&&p.firstChild===head);
      const style=document.createElement('style');style.textContent='[data-ts-space]{margin-left:60px!important}';document.head.append(style);
      const failed=api.typeset(p);
      check('unsafe finish retains composed breaks',failed.outcome==='composed:rich'&&failed.features.spacing==='native:spacing-verification'&&p.querySelector('br')&&!p.querySelector('[data-ts-space]'),failed);
      api.restore(p);style.remove();
      style.textContent='[data-ts-space]::before{content:"X"}';document.head.append(style);
      check('decorated generated spaces retain unspaced composition',api.typeset(p).features.spacing==='native:spacing-verification');api.restore(p);style.remove();
      const scaled=[-0.02,0.02];
      for(const tracking of scaled){p.style.letterSpacing=tracking+'em';const base=api.typeset(p,{spacing:false});api.restore(p);const r=api.typeset(p);check('authored tracking '+tracking,boundaries(base.after)===boundaries(r.after)&&p.style.letterSpacing===tracking+'em');api.restore(p);}
      p.style.letterSpacing='0em';p.style.textAlign='center';
      check('centered text declines finish',api.typeset(p).features.spacing==='native:spacing-layout');api.restore(p);
      p.style.textAlign='left';api.typeset(p);link.textContent='updated exhibition link';api.restore(p);
      check('external content updates survive',link.textContent==='updated exhibition link');p.remove();
      const short=create('A short sentence.');check('native retained honestly',api.typeset(short).features.spacing==='native:spacing-uncomposed');api.restore(short);short.remove();
      const title=create(proof);check('title composition not retuned',api.typeset(title,{mode:'title'}).features.spacing==='native:spacing-mode');api.restore(title);title.remove();
      return {checks,cases};
    },{proof,paragraphs});
    report.checks.push(...evaluated.checks.map(check=>({browser:name,...check})));
    report.cases.push(...evaluated.cases.map(sample=>({browser:name,...sample})));
    // Serve the freshly built fixture through Playwright, independent of a
    // developer's preview port or a stale lab bundle.
    await page.route('http://typeset-spacing.test/**',route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/lab/spacing-react.html')return route.fulfill({contentType:'text/html',body:fixtureHTML});
      if(pathname==='/lab/dist/spacing-react.js')return route.fulfill({contentType:'text/javascript',body:fixtureBundle.outputFiles[0].text});
      if(pathname==='/lab/fraunces-latin-variable.woff2')return route.fulfill({contentType:'font/woff2',body:fixtureFont});
      return route.fulfill({status:404,body:'Not found'});
    });
    await page.goto('http://typeset-spacing.test/lab/spacing-react.html');
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsSpacing==='applied'&&document.querySelector('#plain')?.dataset.tsSpacing==='applied');
    const check=(label,pass)=>report.checks.push({browser:name,label,pass:!!pass});
    check('React adapters apply default finish',true);
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsTracking==='applied'&&document.querySelector('#plain')?.dataset.tsTracking==='applied');
    check('React adapters apply tracking',true);
    await page.getByRole('button',{name:'Toggle tracking',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsTracking==='off');
    check('React tracking toggle preserves word-space finish',await page.locator('[data-ts-track]').count()===0&&await page.locator('[data-ts-space]').count()>0);
    await page.getByRole('button',{name:'Toggle tracking',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsTracking==='applied');
    const link=await page.locator('#rich a').elementHandle();
    await page.locator('#rich a').click();
    check('React link handler fires once',await page.locator('#clicks').textContent()==='1');
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsSpacing==='applied');
    check('React link node survives state update',await link.evaluate(el=>el===document.querySelector('#rich a')));
    await page.getByRole('button',{name:'Toggle finish',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsSpacing==='off');
    check('React option disable removes markers',await page.locator('[data-ts-space]').count()===0);
    await page.getByRole('button',{name:'Toggle finish',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsSpacing==='applied');
    await page.getByRole('button',{name:'Update source',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#rich')?.textContent.startsWith('The exhibition')&&document.querySelector('#rich')?.dataset.typesetDone==='1');
    check('React new source matches both adapters',await page.locator('#rich').textContent()===await page.locator('#plain').textContent());
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(200);check('React responsive '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/playwright/spacing-react-'+name+'-'+width+'.png',fullPage:true});}
    await page.getByRole('button',{name:'Toggle mount',exact:true}).click();check('React unmount',await page.locator('#rich').count()===0);
    await page.getByRole('button',{name:'Toggle mount',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.typesetDone==='1');check('React remount',true);
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsTracking==='applied');
    check('React markers carry only their own values inline (4.4)',await page.evaluate(()=>{
      const own=(el,names)=>{const style=el.style;return style.length===names.length&&names.every(name=>style.getPropertyValue(name));};
      const spaces=[...document.querySelectorAll('#rich [data-ts-space], #rich [data-ts-hang]')],tracks=[...document.querySelectorAll('#rich [data-ts-track]')];
      return spaces.length>0&&tracks.length>0&&spaces.every(el=>own(el,['margin-left'])&&getComputedStyle(el).fontSize==='0px')&&tracks.every(el=>own(el,['letter-spacing','word-spacing'])&&getComputedStyle(el).display==='inline');
    }));
    await markerStyles(browser,name);
    console.log(name+': spacing matrix complete');
  }catch(error){report.errors.push({browser:name,error:error.stack});}
  finally{await browser.close();}
}
report.summary={checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).length,cases:report.cases.length,applied:report.cases.filter(c=>c.spacing==='applied').length,retained:report.cases.filter(c=>c.spacing.startsWith('native:')).length,errors:report.errors.length};
await writeFile('output/spacing.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report.summary,failures:report.checks.filter(c=>!c.pass).slice(0,8),errors:report.errors},null,2));
if(report.summary.failed||report.summary.errors)process.exitCode=1;

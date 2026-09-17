import { browsers } from './browsers.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { releaseIdentity } from './release-evidence.mjs';
import { build } from 'esbuild';

const proof='Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.';
const paragraphs=JSON.parse(await readFile('tests/v4-corpus.json','utf8')).paragraphs;
const report={...await releaseIdentity(),checks:[],cases:[],errors:[],browsers:{}};
await mkdir('output/playwright',{recursive:true});
const fixtureHTML=await readFile('lab/spacing-react.html','utf8');
const fixtureBundle=await build({entryPoints:['lab/spacing-react.tsx'],bundle:true,format:'esm',target:'es2022',write:false});
for(const {name,engine,executablePath} of browsers){
  const browser=await engine.launch({executablePath});report.browsers[name]=browser.version();
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>report.errors.push({browser:name,error:error.message}));
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:20px/1.5 Georgia;text-wrap:wrap;margin:0}a{color:#176650}</style></head><body></body></html>');
    await page.addScriptTag({path:'packages/typeset-v4/dist/typeset.global.js'});
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
      return route.fulfill({status:404,body:'Not found'});
    });
    await page.goto('http://typeset-spacing.test/lab/spacing-react.html');
    await page.waitForFunction(()=>document.querySelector('#rich')?.dataset.tsSpacing==='applied'&&document.querySelector('#plain')?.dataset.tsSpacing==='applied');
    const check=(label,pass)=>report.checks.push({browser:name,label,pass:!!pass});
    check('React adapters apply default finish',true);
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
    console.log(name+': spacing matrix complete');
  }catch(error){report.errors.push({browser:name,error:error.stack});}
  finally{await browser.close();}
}
report.summary={checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).length,cases:report.cases.length,applied:report.cases.filter(c=>c.spacing==='applied').length,retained:report.cases.filter(c=>c.spacing.startsWith('native:')).length,errors:report.errors.length};
await writeFile('output/spacing.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report.summary,failures:report.checks.filter(c=>!c.pass).slice(0,8),errors:report.errors},null,2));
if(report.summary.failed||report.summary.errors)process.exitCode=1;

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { browsers } from './browsers.mjs';
import { releaseIdentity } from './release-evidence.mjs';

const report={...await releaseIdentity(),checks:[],samples:[],errors:[],browsers:{}};
const helpers=await build({stdin:{contents:`export {planOpticalHanging} from './src/lib/v4/optical-hanging';export {planRichText,richLayoutVerified} from './src/lib/v4/rich-text';export {searchParagraph,createParagraphProblem,rankParagraphLayouts,tokenize} from './src/lib/v4/typeset';`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'Internals',target:'es2022'});
const texts=JSON.parse(await readFile('tests/v4-corpus.json','utf8')).paragraphs;
const specimenFont=(await readFile('lab/fraunces-latin-variable.woff2')).toString('base64');
const react=await build({stdin:{contents:`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{TypesetRichText}from'./src/lib/v4/typeset.release.react';
function Fixture(){const[bad,setBad]=useState(false),[count,setCount]=useState(0);return <>
<button onClick={()=>setBad(!bad)}>Toggle interference</button><button onClick={()=>setCount(count+1)}>Update source</button>
<TypesetRichText id="fit" className={bad?'bad':''} opticalHanging lang="en">"A short quotation."</TypesetRichText>
<TypesetRichText id="linked" className={bad?'bad':''} opticalHanging lang="en">"Read <strong>the curator's notes</strong> at <a href="#notes" onClick={event=>event.preventDefault()}>the neighborhood gallery</a>," she said. There is always <em>another detail</em> to discover. {count>0?'A new exhibition opens tomorrow.':''}</TypesetRichText>
</>};createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',target:'es2022'});
await mkdir('output/playwright',{recursive:true});
for(const config of browsers){
  const browser=await config.engine.launch({executablePath:config.executablePath});
  report.browsers[config.name]=browser.version();
  try{
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    page.on('pageerror',error=>report.errors.push({browser:config.name,error:error.message}));
    page.on('console',message=>{if(['warning','error'].includes(message.type()))report.errors.push({browser:config.name,error:message.text()});});
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:20px/1.5 Georgia;width:340px;margin:0 0 12px;text-wrap:wrap}a{color:#176650}</style></head><body></body></html>');
    await page.addScriptTag({path:process.env.TYPESET_BUNDLE || 'packages/typeset-v4/dist/typeset.global.js'});
    await page.addScriptTag({content:helpers.outputFiles[0].text});
    await page.evaluate(async bytes=>{
      const face=new FontFace('PromiseSpecimen',`url(data:font/woff2;base64,${bytes})`);
      document.fonts.add(face);await face.load();await document.fonts.ready;
    },specimenFont);
    const result=await page.evaluate(texts=>{
      const api=window.Typeset,internals=window.Internals,checks=[],samples=[];
      const check=(label,pass,detail)=>checks.push({label,pass:!!pass,detail});
      const p=document.createElement('p');document.body.append(p);
      const ink=[];
      for(const font of ['Georgia','Arial','Times New Roman','Courier New'])for(const size of [16,32,48])for(const char of ['"','\u201c','\u2018','T','V','A','O','H']){
        p.style.fontFamily=font;p.style.fontSize=size+'px';p.style.width='900px';p.textContent=char+'he gallery';
        const before=api.measureLayout(p),r=document.createRange();r.setStart(p.firstChild,0);r.setEnd(p.firstChild,1);
        const advance=r.getBoundingClientRect().width,plan=internals.planOpticalHanging(p,before);
        const result=api.typeset(p,{opticalHanging:true}),after=api.measureLayout(p);
        const hang=plan.hangs.find(h=>h.offset===0)?.px||0;
        check('optical source and fit '+font+size+char,p.textContent===char+'he gallery'&&after.overflow<=.5&&after.lines.length===1);
        if(['"','\u201c','\u2018'].includes(char))check('full measured quote '+font+size+char,plan.outcome==='applied'&&Math.abs(hang-advance)<.01&&Math.abs(before.lines[0].left-after.lines[0].left-advance)<=.75);
        else {ink.push({font,size,char,hang,outcome:plan.outcome});check('font measured capital '+font+size+char,plan.outcome!=='native:hanging-font');}
        if(char==='H')check('upright reference stays aligned '+font+size,hang===0);
        api.restore(p);check('optical markers restore '+font+size+char,!p.querySelector('[data-ts-hang]'));
      }
      check('capital alignment varies with font', ['T','V','A','O'].some(char=>new Set(ink.filter(x=>x.char===char&&x.size===32).map(x=>x.hang)).size>1),ink.filter(x=>x.size===32));
      p.style.fontFamily='Georgia';p.style.fontSize='20px';p.style.width='340px';
      p.textContent='"A short quotation."';
      const original=p.innerHTML;
      for(const css of ['[data-ts-hang]{margin-left:-80px!important}','[data-ts-hang]::before{content:"X"}','[data-ts-hang]{position:relative!important;top:10px}']){
        const style=document.createElement('style');style.textContent=css;document.head.append(style);
        const r=api.typeset(p,{opticalHanging:true});
        check('unsafe optical finish rolls back '+css,r.features.hanging==='native:hanging-verification'&&!p.querySelector('[data-ts-hang]')&&p.textContent==='"A short quotation."',r.features);
        api.restore(p);style.remove();check('rollback restores source '+css,p.innerHTML===original);
      }
      // Independent contour oracle: no production scoring/finish helper calls.
      const score=widths=>{
        const w=widths.slice(0,-1);if(w.length<2)return 0;
        const spread=Math.max(...w)-Math.min(...w),steps=w.slice(1).map((v,i)=>Math.abs(v-w[i]));
        const k=Math.ceil(w.length/2),average=a=>a.reduce((s,v)=>s+v,0)/a.length;
        return 2*spread+3*Math.max(...steps)+(w.length<4?0:1.5*Math.abs(average(w.slice(0,k))-average(w.slice(k))));
      };
      let seed=1729;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
      for(let trial=0;trial<200;trial++){
        const states=Array.from({length:200},(_,id)=>({tokenIndex:id,cost:500+random()*5000,lines:Array.from({length:5},()=>({tokens:[],width:100+random()*200,fill:.35+random()*.6}))}));
        const widths=lines=>lines.map(line=>line.width/340);
        const ordered=[...states].sort((a,b)=>a.cost-b.cost),slack=Math.min(ordered[0].cost*.15+600,3200);
        const eligible=ordered.filter(s=>s.cost<=ordered[0].cost+slack);
        const expected=eligible.reduce((a,b)=>score(widths(b.lines))<score(widths(a.lines))?b:a);
        const actual=internals.rankParagraphLayouts([...states],widths);
        check('independent finished contour ranking '+trial,actual.winner===expected&&actual.eligible===eligible.length&&Math.abs(actual.score-score(widths(expected.lines)))<1e-10);
      }
      let maxRetained=0;
      for(const count of [40,80,160])for(const measure of [140,220,340]){
        const tokens=internals.tokenize(Array(count).fill('gallery').join(' '),text=>text.length*6);
        const problem=internals.createParagraphProblem(tokens,measure,measure/10,{candidateBar:1});
        const searched=internals.searchParagraph(problem,{exactTokens:0});
        const evidence=searched.evidence;maxRetained=Math.max(maxRetained,evidence.retained);
        check('bounded complete candidate pool '+count+':'+measure,evidence.poolLimit===200&&evidence.retained<=200&&evidence.completed>=evidence.retained,evidence);
      }
      check('search actually retains two hundred complete layouts',maxRetained===200,maxRetained);
      const synthetic=[{tokens:[{text:'one'},{text:'two'}],width:100,fill:.5},{tokens:[{text:'three'},{text:'four'}],width:160,fill:.8},{tokens:[{text:'five'}],width:40,fill:.2}];
      for(const missing of [undefined,0,NaN,Infinity,-1])check('no guessed space '+missing,api.shapeExactLines(synthetic,20,200,false,missing,20).every(line=>line.wordSpacingEm===0));
      let composed=0,changed=0;
      // A real bundled font keeps this coverage assertion independent of OS font aliases.
      p.style.fontFamily='PromiseSpecimen';
      for(const text of texts.slice(0,25))for(const width of [220,240,280,320,340,400,480,560]){
        p.style.width=width+'px';p.textContent=text;
        const natural=api.typeset(p,{contour:'natural'});api.restore(p);
        const finished=api.typeset(p);
        check('finished candidate source/overflow '+samples.length,p.textContent===text&&finished.after.overflow<=Math.max(.5,finished.before.overflow));
        if(finished.outcome==='composed:rich'){
          composed++;check('finished candidate proves ranking '+samples.length,finished.search?.length&&finished.search.every(s=>s.finished));
          if(JSON.stringify(natural.after.lines.map(l=>l.text))!==JSON.stringify(finished.after.lines.map(l=>l.text)))changed++;
        }
        samples.push({width,text,outcome:finished.outcome,natural:natural.after.lines.map(l=>l.text),finished:finished.after.lines.map(l=>l.text),search:finished.search});
        api.restore(p);
      }
      check('finished ranking exercised on real text',composed>40&&changed>0,{composed,changed});
      p.style.fontFamily='Georgia';p.style.width='340px';p.textContent=texts[0];
      const plan=internals.planRichText(p,{lineBreaks:'unicode'}),composition=api.typeset(p,{spacing:false,contour:'natural'});
      if(composition.outcome==='composed:rich'){
        const after=api.measureLayout(p);check('valid actual lines verify',internals.richLayoutVerified(plan,after));
        check('same line count with wrong membership rejected',!internals.richLayoutVerified(plan,{...after,lines:after.lines.map((line,i)=>i?line:{...line,sourceEnd:line.sourceEnd-1})}));
        check('preexisting overflow cannot authorize composed overflow',!internals.richLayoutVerified({...plan,before:{...plan.before,overflow:40}},{...after,overflow:1}));
      }else check('verification proof composed',false,composition.outcome);
      api.restore(p);p.remove();return {checks,samples,ink};
    },texts);
    report.checks.push(...result.checks.map(check=>({browser:config.name,...check})));
    report.samples.push({browser:config.name,samples:result.samples,ink:result.ink});
    const check=(label,pass)=>report.checks.push({browser:config.name,label,pass:!!pass});
    await page.setContent('<!doctype html><html lang="en"><head><style>body{margin:24px}p{font:20px/1.5 Georgia;width:280px;max-width:100%;text-wrap:wrap}.bad [data-ts-hang]{margin-left:-80px!important}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({content:react.outputFiles[0].text});
    await page.waitForFunction(()=>document.querySelector('#fit')?.dataset.tsHanging==='applied'&&document.querySelector('#linked')?.dataset.tsHanging==='applied');
    const authorLink=await page.locator('#linked a').elementHandle();
    await authorLink.focus();
    check('React native fitting line verified and hung',await page.locator('#fit').getAttribute('data-ts-outcome')==='native:fits');
    await page.getByRole('button',{name:'Toggle interference'}).click();
    await page.waitForFunction(()=>document.querySelector('#fit')?.dataset.tsHanging==='native:hanging-verification'&&document.querySelector('#linked')?.dataset.tsHanging==='native:hanging-verification');
    check('React rejects unsafe optical markers on single and composed lines',await page.locator('[data-ts-hang]').count()===0);
    check('React optical rollback retains author link',await authorLink.evaluate(el=>el===document.querySelector('#linked a')));
    await page.getByRole('button',{name:'Toggle interference'}).click();
    await page.waitForFunction(()=>document.querySelector('#linked')?.dataset.tsHanging==='applied');
    await page.getByRole('button',{name:'Update source'}).click();
    await page.waitForFunction(()=>document.querySelector('#linked')?.textContent.includes('tomorrow')&&document.querySelector('#linked')?.dataset.typesetDone==='1');
    check('React optical source updates retain markup',await page.locator('#linked strong').count()===1&&await page.locator('#linked em').count()===1);
    for(const width of [320,390,768]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);check('React optical mobile '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    console.log(config.name+': promise checks complete');
  }catch(error){report.errors.push({browser:config.name,error:error.stack});}
  finally{await browser.close();}
}
report.summary={checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).length,errors:report.errors.length};
await writeFile('output/promise.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report.summary,failures:report.checks.filter(c=>!c.pass).slice(0,12),errors:report.errors},null,2));
assert.equal(report.summary.failed+report.summary.errors,0);

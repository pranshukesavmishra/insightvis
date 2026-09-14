import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errs=[];
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(2500);
const ids = ['lorentz','ydse','cyclotron','resolving','orbitals','substitution','bohr','elimination','ak-key','ak-symmetry','ak-coelom','ak-canal','ak-cnidaria','ak-wvs','ak-heart','ak-chordata','ak-challenge','actionpotential','cardiac','synapse','conduction'];
const shots = {'ak-key':1,'ak-symmetry':1,'ak-canal':1,'ak-wvs':1,'ak-heart':1,'ak-chordata':1,'ak-coelom':1,'ak-cnidaria':1,'ak-challenge':1};
for (const id of ids){
  const ok = await p.evaluate(i=>{ const b=document.querySelector('.navbtn[data-sim="'+i+'"]'); if(!b) return false; b.click(); return true; }, id);
  if(!ok){ errs.push('MISSING NAV: '+id); continue; }
  await p.waitForTimeout(2200);
  // exercise the hover tooltip + record button on every sim
  await p.evaluate(()=>{
    const cv=document.querySelectorAll('.plot canvas'); 
    cv.forEach(c=>{const r=c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width*0.55,clientY:r.top+r.height*0.5,bubbles:true}));});
    const rec=[...document.querySelectorAll('.mbtn')].find(b=>b.textContent.trim()==='Record'); if(rec) rec.click();
    const q=document.querySelector('.quiz-opt'); if(q) q.click();
    const sc=document.querySelector('.stage canvas');
    if(sc){const r=sc.getBoundingClientRect();
      ['pointerdown','pointerup'].forEach(tp=>sc.dispatchEvent(new PointerEvent(tp,{clientX:r.left+r.width*0.25,clientY:r.top+r.height*0.72,bubbles:true})));}
  });
  await p.waitForTimeout(500);
  if(shots[id]) await p.screenshot({path:'shot-'+id+'.png'});
}
const counts = await p.evaluate(()=>({nav:document.querySelectorAll('.navbtn').length, chapters:document.querySelectorAll('.rail-chapter').length}));
console.log('sims in rail:', counts.nav, ' chapters:', counts.chapters);
console.log('ERRORS:', errs.length ? errs.slice(0,25).join('\n') : 'none');
await b.close();

/* Walk every mechanism scene of a lab and screenshot each one, so a
   broken intermediate cannot hide behind a good-looking first frame. */
import { chromium } from 'playwright'; import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file://'+process.cwd()+'/_preview.html'); await p.waitForTimeout(2200);
for (const id of process.argv.slice(2)){
  await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
  await p.waitForTimeout(700);
  const n = await p.evaluate(()=> (window.__S.steps||[]).length || 0);
  if(!n){ errs.push('NO STEPS: '+id); continue; }
  for (let k=0;k<n;k++){
    await p.evaluate(j=>{ __S.p.mechPlay=false; __S.p.mechStep=j;
      if(__S.mech){__S.mech.i=j; __S.mech.u=0; __S.mech.playing=false;} }, k);
    await p.waitForTimeout(420);
    const box = await p.evaluate(()=>{const e=document.querySelector('.stagepanel');
      const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};});
    await p.screenshot({path:'step-'+id+'-'+k+'.png', clip:box});
  }
  console.log(id+': '+n+' scenes captured');
}
console.log('ERRORS:', errs.length? errs.join('\n'):'none');
await b.close();

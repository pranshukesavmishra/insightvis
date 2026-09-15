import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1600);
const id = process.argv[2];
await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
await p.waitForTimeout(1200);
const n = await p.evaluate(i=>(window.__REG.find(r=>r.id===i).problems||[]).length, id);
for (let k=0;k<n;k++){
  await p.evaluate(([i,k])=>{
    const def = window.__REG.find(r=>r.id===i), pr = def.problems[k];
    if (pr.params) { Object.assign(window.__S.p, pr.params); if (def.setup) def.setup(window.__S); }
  },[id,k]);
  await p.waitForTimeout(1400);
  console.log(k, await p.evaluate(([i,k])=>{
    const def = window.__REG.find(r=>r.id===i), pr = def.problems[k];
    try { return pr.predict.label+' = '+(+pr.measure(window.__S)).toPrecision(5)+' '+(pr.predict.unit||''); }
    catch(e){ return 'ERR '+e.message; }
  },[id,k]));
}
await b.close();

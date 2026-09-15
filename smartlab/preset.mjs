import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1700);
const id = process.argv[2];
await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
await p.waitForTimeout(1500);
const box = await p.evaluate(()=>{const e=document.querySelector('.stagepanel');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
const idxs = JSON.parse(process.argv[3]||'[0]');
for (const k of idxs) {
  await p.evaluate(([i,k])=>{
    const def=window.__REG.find(r=>r.id===i);
    Object.assign(window.__S.p, def.presets[k].params);
    if (def.setup) def.setup(window.__S);
  },[id,k]);
  await p.waitForTimeout(1600);
  await p.screenshot({path:'bio-'+id+'-p'+k+'.png', clip:box});
}
await b.close();
console.log('done');

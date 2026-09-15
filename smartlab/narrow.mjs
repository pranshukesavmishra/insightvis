import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:430,height:900}});
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1800);
for (const id of process.argv[2].split(',')) {
  await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{const e=document.querySelector('.stagepanel'); if(e) e.scrollIntoView();});
  await p.waitForTimeout(500);
  await p.screenshot({path:'nw-'+id+'.png'});
  const w = await p.evaluate(()=>{const e=document.querySelector('.stage canvas');return e?e.getBoundingClientRect().width:0;});
  const ov = await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(id, 'canvas', Math.round(w), 'h-overflow', ov);
}
if (errs.length) console.log('PAGEERRORS:', errs.slice(0,4).join(' | '));
await b.close();

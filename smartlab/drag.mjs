import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(2000);
const id = process.argv[2];
await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
await p.waitForTimeout(1500);
const snap = ()=>p.evaluate(()=>({p:JSON.parse(JSON.stringify(window.__S.p)), y:window.__S.y}));
const before = await snap();
// find the stage canvas and drag from the handle position reported by the engine
const h = await p.evaluate(()=>window.__R && window.__R.handles ? window.__R.handles.map(x=>({x:x.x,y:x.y,r:x.r,id:x.id})) : null);
console.log('handles:', JSON.stringify(h));
if (h && h.length) {
  const box = await p.evaluate(()=>{const e=document.querySelector('.stage canvas');const r=e.getBoundingClientRect();return {x:r.x,y:r.y};});
  const want = process.argv[5];
  const t = want ? (h.find(x=>x.id===want)||h[0]) : h[0];
  await p.mouse.move(box.x+t.x, box.y+t.y);
  await p.mouse.down();
  await p.mouse.move(box.x+t.x+(+process.argv[3]||0), box.y+t.y+(+process.argv[4]||-60), {steps:12});
  await p.mouse.up();
  await p.waitForTimeout(600);
}
const after = await snap();
const ch = Object.keys(after.p).filter(k=>JSON.stringify(after.p[k])!==JSON.stringify(before.p[k])).map(k=>k+': '+before.p[k]+' -> '+after.p[k]);
if (before.y!==after.y) ch.push('S.y: '+before.y+' -> '+after.y);
console.log('changed by drag:', ch.join(', ') || 'NOTHING');
await b.close();

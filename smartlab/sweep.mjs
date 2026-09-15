import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const id = process.argv[2], wait = +(process.argv[3]||2200);
const views = process.argv[4] ? JSON.parse(process.argv[4])
  : [[-1.15,0.62],[0.9,0.35],[2.4,0.75],[-2.2,1.35],[-1.15,0.12]];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1800);
await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
await p.waitForTimeout(wait);
const box = await p.evaluate(()=>{const e=document.querySelector('.stagepanel');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
const shots=[];
for (let i=0;i<views.length;i++){
  await p.evaluate(v=>{ window.__S.cam.theta=v[0]; window.__S.cam.phi=v[1]; }, views[i]);
  await p.waitForTimeout(350);
  const f='bio-'+id+'-v'+i+'.png';
  await p.screenshot({path:f, clip:box}); shots.push(f);
}
await b.close();
console.log(shots.join(' '));

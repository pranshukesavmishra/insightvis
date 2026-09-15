import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
const errs=[];
p.on('pageerror', e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1800);
const ids = process.argv[2].split(',');
for (const id of ids) {
  await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
  await p.waitForTimeout(2200);
  const home = await p.evaluate(()=>window.__S.cam ? {t:window.__S.cam.theta,f:window.__S.cam.phi} : null);
  if (!home) { console.log(id, 'NO CAM'); continue; }
  const box = await p.evaluate(()=>{const e=document.querySelector('.stagepanel');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  const views = [[home.t, home.f], [home.t+2.1, home.f+0.25], [home.t-1.9, Math.max(home.f-0.22,0.06)]];
  for (let k=0;k<views.length;k++){
    await p.evaluate(v=>{window.__S.cam.theta=v[0]; window.__S.cam.phi=v[1];}, views[k]);
    await p.waitForTimeout(400);
    await p.screenshot({path:'sw-'+id+'-'+k+'.png', clip:box});
  }
  console.log(id, 'ok');
}
if (errs.length) console.log('PAGEERRORS:', errs.slice(0,5).join(' | '));
await b.close();

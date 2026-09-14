import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1400,height:900}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1800);
await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), process.argv[2]);
await p.waitForTimeout(800);
// go fullscreen the way the user did
await p.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/full/i.test(x.textContent)); if(b) b.click(); });
await p.waitForTimeout(+(process.argv[3]||2000));
await p.screenshot({path:'bio-'+(process.argv[4]||'wide')+'.png'});
// report the scene geometry the sim actually built
console.log(JSON.stringify(await p.evaluate(()=>{
  const S=window.__S, p=S.p;
  return { theta:p.theta, len:S.len, R:S.R, runs:S.runs.map(r=>({id:r.sh.id, s:+r.s.toFixed(3), v:+r.v.toFixed(3), phi:+r.phi.toFixed(2)})) };
}), null, 1));
await b.close();

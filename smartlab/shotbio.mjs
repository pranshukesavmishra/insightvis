import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const errs=[];
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(2200);
// args: id[:presetName][@tag]
for (const arg of process.argv.slice(2)){
  const [spec, tag] = arg.split('@');
  const [id, preset] = spec.split(':');
  const ok = await p.evaluate(i=>{const b=document.querySelector('.navbtn[data-sim="'+i+'"]'); if(!b) return false; b.click(); return true;}, id);
  if(!ok){ errs.push('MISSING: '+id); continue; }
  await p.waitForTimeout(1200);
  if (preset){
    const hit = await p.evaluate(n=>{
      const bs=[...document.querySelectorAll('button')].filter(b=>!b.classList.contains('navbtn') && b.textContent.trim().toLowerCase().includes(n.toLowerCase()));
      if(!bs.length) return false; bs[0].click(); return true;
    }, preset.replace(/_/g,' '));
    if(!hit) errs.push('NO PRESET: '+preset+' on '+id);
  }
  await p.waitForTimeout(2600);
  const box = await p.evaluate(()=>{const e=document.querySelector('.stagepanel'); if(!e) return null;
    const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};});
  if (box) await p.screenshot({path:'bio-'+(tag||id)+'.png', clip:box});
}
console.log('ERRORS:', errs.length? errs.join('\n'):'none');
await b.close();

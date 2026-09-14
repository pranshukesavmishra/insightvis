import { chromium } from 'playwright'; import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(2000);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="actionpotential"]').click());
for (const name of ['Normal spike','Myelinated']){
  await p.evaluate(n=>{[...document.querySelectorAll('button')].filter(b=>b.textContent.trim().includes(n))[0].click();}, name);
  await p.evaluate(()=>{window._MAX=new Float64Array(100).fill(-99);
    window._iv=setInterval(()=>{const S=window._AP; if(!S)return; for(let i=0;i<100;i++) if(S.V[i]>window._MAX[i]) window._MAX[i]=S.V[i];},16);});
  await p.waitForTimeout(9000);
  const r = await p.evaluate(()=>{clearInterval(window._iv); const S=window._AP;
    return {vel:S.vel, peaks:[0,10,20,30,50,70,80,99].map(i=>i+':'+window._MAX[i].toFixed(0)).join(' ')};});
  console.log(name,'=>',JSON.stringify(r));
}
await b.close();

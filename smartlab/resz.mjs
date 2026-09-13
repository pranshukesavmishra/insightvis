import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1000}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+process.cwd()+'/_preview.html'); await p.waitForTimeout(1800);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="bohr"]').click());
const read = async () => p.evaluate(()=>{
  const st=document.querySelector('.stage'), cv=st.querySelector('canvas');
  const r=st.getBoundingClientRect();
  return [Math.round(r.width),Math.round(r.height),cv.width,cv.height];
});
for (const [w,h] of [[1500,1000],[1100,900],[820,900],[420,800],[1500,1000]]){
  await p.setViewportSize({width:w,height:h});
  await p.waitForTimeout(1100);
  const a = await read(); await p.waitForTimeout(1400); const c = await read();
  console.log(`viewport ${w}x${h}  stage ${a[0]}x${a[1]} attr ${a[2]}x${a[3]}  → after 1.4s ${c[0]}x${c[1]}  ${a[1]===c[1]?'STABLE':'GROWING'}`);
}
await b.close();

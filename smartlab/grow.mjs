import { chromium } from 'playwright'; import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1000}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+process.cwd()+'/_preview.html'); await p.waitForTimeout(2000);
for (const id of process.argv.slice(2)){
  await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), id);
  const rows=[];
  for (let k=0;k<6;k++){
    await p.waitForTimeout(900);
    rows.push(await p.evaluate(()=>{
      const st=document.querySelector('.stage'), cv=st.querySelector('canvas');
      const sr=st.getBoundingClientRect();
      const pl=document.querySelector('.plot');
      return { stage:[Math.round(sr.width),Math.round(sr.height)],
               cssCv:[Math.round(cv.getBoundingClientRect().width),Math.round(cv.getBoundingClientRect().height)],
               attr:[cv.width,cv.height],
               plot: pl?[Math.round(pl.getBoundingClientRect().width),Math.round(pl.getBoundingClientRect().height)]:null,
               bodyH: Math.round(document.body.scrollHeight) };
    }));
  }
  console.log(id);
  rows.forEach(r=>console.log('  stage',r.stage,'cv',r.cssCv,'attr',r.attr,'plot',r.plot,'bodyH',r.bodyH));
}
await b.close();

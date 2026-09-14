import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+process.cwd()+'/_preview.html'); await p.waitForTimeout(2200);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="orbitals"]').click());
await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{
  const log=[];
  const seg=[...document.querySelectorAll('#main .ctl')].find(c=>/Azimuthal/.test(c.textContent));
  const nseg=[...document.querySelectorAll('#main .ctl')].find(c=>/Principal/.test(c.textContent));
  log.push('start n='+__S.p.n+' l='+__S.p.l);
  // raise n to 3 first
  [...nseg.querySelectorAll('button')].forEach(b=>{ if(b.textContent.includes('3')) b.click(); });
  log.push('after n=3 → n='+__S.p.n+' l='+__S.p.l);
  const s2=[...document.querySelectorAll('#main .ctl')].find(c=>/Azimuthal/.test(c.textContent));
  [...s2.querySelectorAll('button')].forEach(b=>{ b.click(); log.push('click "'+b.textContent.trim()+'" → l='+__S.p.l+' mi='+__S.p.mi); });
  return log.join('\n');
}));
await b.close();

import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1400,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1600);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="resolving"]').click());
await p.waitForTimeout(1000);
console.log(await p.evaluate(()=>{
  const def=window.__REG.find(r=>r.id==='resolving'), S=window.__S; const out={};
  ['eye','eyeblue','scope','hubble','custom'].forEach(k=>{
    Object.assign(S.p,{instr:k}); def.setup(S);
    out[k] = {name:S.instr.name, Dmm:+S.Dmm.toFixed(3), lam:S.p.lam,
              thMin_urad:+(S.thMin*1e6).toFixed(3),
              moon_m:+(S.thMin*3.844e8).toFixed(1)};
  });
  return JSON.stringify(out,null,1);
}));
await b.close();

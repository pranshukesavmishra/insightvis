import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('file://'+process.cwd()+'/_preview.html'); await p.waitForTimeout(2200);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="huckel"]').click());
await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{
  const L=[]; const find=()=>[...document.querySelectorAll('#main .ctl')].find(c=>c.dataset.key==='cyclic');
  L.push('initial cyclic='+__S.p.cyclic+' n='+__S.p.n);
  let c=find(); L.push('found ctl: '+!!c+' checkbox checked='+(c&&c.querySelector('input').checked));
  const inp=c.querySelector('input'); inp.checked=false; inp.dispatchEvent(new Event('change',{bubbles:true}));
  L.push('after uncheck cyclic='+__S.p.cyclic);
  const c2=find(); L.push('ctl still in DOM: '+(c2===c));
  const inp2=find().querySelector('input'); inp2.checked=true; inp2.dispatchEvent(new Event('change',{bubbles:true}));
  L.push('after recheck cyclic='+__S.p.cyclic);
  return L.join('\n');
}));
await b.close();

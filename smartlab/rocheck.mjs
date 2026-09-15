import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1400,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1600);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="rayoptics"]').click());
await p.waitForTimeout(1000);
console.log(await p.evaluate(()=>{
  const def=window.__REG.find(r=>r.id==='rayoptics'), S=window.__S;
  const set=o=>{Object.assign(S.p,o); def.setup(S);};
  const out=[];
  def.problems.forEach((pr,i)=>{
    set(pr.params);
    out.push('problem '+i+'  traced v = '+(S.vMeas*100).toFixed(3)+' cm   formula '+(S.vPred*100).toFixed(3)+
             ' cm   diff '+Math.abs((S.vMeas-S.vPred)*1000).toFixed(2)+' mm   aberration '+
             (S.aberration*1000).toFixed(2)+' mm');
  });
  // the aberration claim: opening the aperture must push the focus IN
  set({mode:'convex',u:0.60,f:0.20,nGlass:1.5,thick:0.010,aperture:0.014,autoFocus:true});
  const vNarrow=S.vMeas;
  set({aperture:0.16}); const vWide=S.vMeas;
  out.push('narrow f/14 v = '+(vNarrow*100).toFixed(3)+' cm,  wide f/1.25 v = '+(vWide*100).toFixed(3)+' cm');
  out.push(vWide<vNarrow ? 'PASS  opening the aperture pulls the focus IN' : 'FAIL  aberration has the wrong sign');
  return out.join('\n');
}));
await b.close();

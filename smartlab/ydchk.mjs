import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1400,height:1000}});
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1600);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="ydse"]').click());
await p.waitForTimeout(1200);
console.log(await p.evaluate(()=>{
  const def = window.__REG.find(r=>r.id==='ydse'), S = window.__S;
  const set = o => { Object.assign(S.p, o); def.setup(S); };
  // reach the intensity function through a plot's hover, which uses ydseAt
  const I = y => def.plots[0].hover(S, y*1000)[1].value*1;
  const peak = (guess) => { // golden refine around guess
    let lo = guess - S.beta*0.45, hi = guess + S.beta*0.45;
    for (let k=0;k<80;k++){ const m1=lo+(hi-lo)/3, m2=hi-(hi-lo)/3;
      if (I(m1) < I(m2)) lo = m1; else hi = m2; }
    return (lo+hi)/2;
  };
  const out = {};
  set({lam:589,d:0.25,a:0.08,D:1.2,mode:'double',nMed:1,plate:false,ratio:1,white:false});
  out.centre_mm = (peak(0)*1000).toFixed(5);
  out.firstMax_mm = (peak(S.beta)*1000).toFixed(5);
  out.beta_pred_mm = (S.beta*1000).toFixed(5);
  out.beta_meas_mm = ((peak(S.beta)-peak(0))*1000).toFixed(5);
  set({lam:600,d:0.25,a:0.08,D:1.2,plate:true,t:3.6,mu:1.5,nMed:1});
  out.plate_centre_meas_mm = (peak(S.shift)*1000).toFixed(4);
  out.plate_centre_pred_mm = (S.shift*1000).toFixed(4);
  out.plate_beta_meas_mm = ((peak(S.shift+S.beta)-peak(S.shift))*1000).toFixed(5);
  out.plate_beta_pred_mm = (S.beta*1000).toFixed(5);
  set({lam:589,d:0.24,a:0.08,D:1.2,plate:false,nMed:1,ratio:1});
  out.order3_I = I(3*S.beta).toExponential(3);   // should be ~0 (missing order)
  out.order2_I = I(2*S.beta).toFixed(4);
  set({lam:589,d:0.25,a:0.08,D:1.2,ratio:0.25,nMed:1,plate:false});
  const Imax = I(peak(0)), Imin = I(peak(0)+S.beta/2);
  out.IminOverImax = (Imin/Imax).toFixed(5);
  return JSON.stringify(out,null,1);
}));
await b.close();

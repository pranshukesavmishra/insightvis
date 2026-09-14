const ENa=50,EK=-77,EL=-54.387;
const aM=V=>{const d=V+40;return Math.abs(d)<1e-6?1:0.1*d/(1-Math.exp(-d/10));};
const bM=V=>4*Math.exp(-(V+65)/18);
const aH=V=>0.07*Math.exp(-(V+65)/20);
const bH=V=>1/(1+Math.exp(-(V+35)/10));
const aN=V=>{const d=V+55;return Math.abs(d)<1e-6?0.1:0.01*d/(1-Math.exp(-d/10));};
const bN=V=>0.125*Math.exp(-(V+65)/80);
function run(I,dur,ttx=0,tea=0,temp=18.5){
  let V=-65,m=aM(-65)/(aM(-65)+bM(-65)),h=aH(-65)/(aH(-65)+bH(-65)),n=aN(-65)/(aN(-65)+bN(-65));
  const gNaM=120*(1-ttx/100), gKM=36*(1-tea/100), phi=Math.pow(3,(temp-6.3)/10);
  const hs=0.005; let peak=-100, minV=0;
  for(let t=0;t<30;t+=hs){
    const stim = t<dur ? I : 0;
    const gNa=gNaM*m*m*m*h, gK=gKM*n*n*n*n;
    const Iion=gNa*(V-ENa)+gK*(V-EK)+0.3*(V-EL);
    const dV=(stim-Iion);
    const am=aM(V),bm=bM(V),ah=aH(V),bh=bH(V),an=aN(V),bn=bN(V);
    m+=hs*phi*(am*(1-m)-bm*m); h+=hs*phi*(ah*(1-h)-bh*h); n+=hs*phi*(an*(1-n)-bn*n);
    V+=hs*dV;
    if(t>dur){peak=Math.max(peak,V); minV=Math.min(minV,V);}
  }
  return {peak:peak.toFixed(1), undershoot:minV.toFixed(1)};
}
console.log('I=12 (suprathreshold) ', run(12,0.6));
console.log('I=3.2 (subthreshold)  ', run(3.2,0.6));
console.log('I=30 (strong)         ', run(30,0.6));
console.log('TTX 70%               ', run(14,0.6,70,0));
console.log('TEA 80%               ', run(12,0.6,0,80));

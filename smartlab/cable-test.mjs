const ENa=50,EK=-77,EL=-54.387,N=100;
const aM=V=>{const d=V+40;return Math.abs(d)<1e-6?1:0.1*d/(1-Math.exp(-d/10));};
const bM=V=>4*Math.exp(-(V+65)/18);
const aH=V=>0.07*Math.exp(-(V+65)/20);
const bH=V=>1/(1+Math.exp(-(V+35)/10));
const aN=V=>{const d=V+55;return Math.abs(d)<1e-6?0.1:0.01*d/(1-Math.exp(-d/10));};
const bN=V=>0.125*Math.exp(-(V+65)/80);
function cable(I,dur,gax,nstim,tmax=26){
  const V=new Float64Array(N).fill(-65),m=new Float64Array(N),h=new Float64Array(N),n=new Float64Array(N);
  for(let i=0;i<N;i++){m[i]=aM(-65)/(aM(-65)+bM(-65));h[i]=aH(-65)/(aH(-65)+bH(-65));n[i]=aN(-65)/(aN(-65)+bN(-65));}
  const hs=0.005; let peakRec=-100, tA=null,tB=null;
  for(let t=0;t<tmax;t+=hs){
    const stim=t<dur?I:0;
    for(let i=0;i<N;i++){
      const v=V[i];
      const gNa=120*m[i]**3*h[i], gK=36*n[i]**4;
      const Iion=gNa*(v-ENa)+gK*(v-EK)+0.3*(v-EL);
      const vl=i>0?V[i-1]:V[0], vr=i<N-1?V[i+1]:V[N-1];
      const dV=((i<nstim?stim:0)-Iion+gax*(vl-2*v+vr));
      const am=aM(v),bm=bM(v),ah=aH(v),bh=bH(v),an=aN(v),bn=bN(v);
      m[i]+=hs*(am*(1-m[i])-bm*m[i]); h[i]+=hs*(ah*(1-h[i])-bh*h[i]); n[i]+=hs*(an*(1-n[i])-bn*n[i]);
      V[i]=v+hs*dV;
    }
    peakRec=Math.max(peakRec,V[30]);
    if(tA===null&&V[20]>0)tA=t;
    if(tA!==null&&tB===null&&V[80]>0)tB=t;
  }
  const dx=(80-20)/N*0.04; // metres
  return {peak:peakRec.toFixed(1), prop: tB!==null, vel: tB!==null?(dx/((tB-tA)/1000)).toFixed(1):'—'};
}
for (const gax of [1.6, 4, 8]){
  console.log('--- gax='+gax);
  for (const [I,d,ns] of [[12,0.6,4],[20,1,4],[30,1,4],[40,1,6],[60,1,6],[80,0.8,6]])
    console.log(`  I=${I} dur=${d} nstim=${ns} ->`, cable(I,d,gax,ns));
}

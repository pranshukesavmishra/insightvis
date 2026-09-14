const ENa=50,EK=-77,EL=-54.387,N=100;
const aM=V=>{const d=V+40;return Math.abs(d)<1e-6?1:0.1*d/(1-Math.exp(-d/10));};
const bM=V=>4*Math.exp(-(V+65)/18);
const aH=V=>0.07*Math.exp(-(V+65)/20);
const bH=V=>1/(1+Math.exp(-(V+35)/10));
const aN=V=>{const d=V+55;return Math.abs(d)<1e-6?0.1:0.01*d/(1-Math.exp(-d/10));};
const bN=V=>0.125*Math.exp(-(V+65)/80);
const gax=8;
function cable(I,dur,{ttx=0,tea=0,temp=18.5,paired=0,tmax=30}={}){
  const V=new Float64Array(N).fill(-65),m=new Float64Array(N),h=new Float64Array(N),n=new Float64Array(N);
  for(let i=0;i<N;i++){m[i]=aM(-65)/(aM(-65)+bM(-65));h[i]=aH(-65)/(aH(-65)+bH(-65));n[i]=aN(-65)/(aN(-65)+bN(-65));}
  const gNaM=120*(1-ttx/100),gKM=36*(1-tea/100),phi=Math.pow(3,(temp-6.3)/10),hs=0.005;
  let p1=-100,p2=-100;
  for(let t=0;t<tmax;t+=hs){
    let stim=t<dur?I:0;
    if(paired&&t>=paired&&t<paired+dur)stim=I;
    for(let i=0;i<N;i++){
      const v=V[i];
      const Iion=gNaM*m[i]**3*h[i]*(v-ENa)+gKM*n[i]**4*(v-EK)+0.3*(v-EL);
      const vl=i>0?V[i-1]:V[0],vr=i<N-1?V[i+1]:V[N-1];
      const dV=((i<4?stim:0)-Iion+gax*(vl-2*v+vr));
      const am=aM(v),bm=bM(v),ah=aH(v),bh=bH(v),an=aN(v),bn=bN(v);
      m[i]+=hs*phi*(am*(1-m[i])-bm*m[i]);h[i]+=hs*phi*(ah*(1-h[i])-bh*h[i]);n[i]+=hs*phi*(an*(1-n[i])-bn*n[i]);
      V[i]=v+hs*dV;
    }
    if(paired){ if(t<paired+2)p1=Math.max(p1,V[30]); else p2=Math.max(p2,V[30]); }
    else p1=Math.max(p1,V[30]);
  }
  return paired?{first:p1.toFixed(1),second:p2.toFixed(1)}:{peak:p1.toFixed(1)};
}
console.log('threshold scan (dur=1.0):');
for(const I of [8,10,12,14,16,18,20,26]) console.log('  I='+I, cable(I,1.0));
console.log('\nchosen defaults I=20 dur=1.0:');
console.log('  normal      ', cable(20,1.0));
console.log('  TTX 70%     ', cable(20,1.0,{ttx:70}));
console.log('  TTX 40%     ', cable(20,1.0,{ttx:40}));
console.log('  TEA 80%     ', cable(20,1.0,{tea:80}));
console.log('  cold 6.3C   ', cable(20,1.0,{temp:6.3}));
console.log('\npaired pulse (I=24):');
for(const gap of [4,6,9,12,16]) console.log('  gap='+gap+'ms', cable(24,1.0,{paired:gap,tmax:40}));

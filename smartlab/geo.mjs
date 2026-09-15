import { chromium } from 'playwright';
import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1400,height:900}});
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(1800);
await p.evaluate(()=>document.querySelector('.navbtn[data-sim="rolling"]').click());
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(()=>{
  const S=window.__S,p=S.p,th=S.th;
  const run=S.len*Math.cos(th), rise=S.len*Math.sin(th);
  const laneRaw=S.R*2.25, wantHalf=laneRaw*S.runs.length/2+S.R*0.6;
  const halfW=Math.min(wantHalf, S.len*0.36);
  const laneW=S.runs.length>1?Math.min(laneRaw,(halfW-S.R*0.6)*2/S.runs.length):0;
  return { theta:p.theta, len:+S.len.toFixed(3), R:+S.R.toFixed(3),
    run:+run.toFixed(3), rise:+rise.toFixed(3), laneW:+laneW.toFixed(3), halfW:+halfW.toFixed(3),
    rampWidth:+(2*halfW).toFixed(3), sideWallDepthZ:0.10,
    lanes:S.runs.map((r,i)=>+(((i-(S.runs.length-1)/2)*laneW)).toFixed(3)),
    // is the drawn ramp wide enough for the lanes?
    widestLane:+(Math.abs((0-(S.runs.length-1)/2)*laneW)+S.R).toFixed(3),
    lengthOverWidth:+(S.len/(2*halfW)).toFixed(3),
    gapBetweenAdjacentBodies:+(laneW-2*S.R).toFixed(3) };
}), null, 1));
await b.close();

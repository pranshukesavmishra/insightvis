/* Control audit: static wiring check + a live click-through of every
   control on every sim, confirming the param actually moves and the
   stage keeps rendering without throwing. */
import { chromium } from 'playwright'; import fs from 'fs';
const body = fs.readFileSync('index.html','utf8');
fs.writeFileSync('_preview.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const files = fs.readdirSync('.').filter(f=>/^(sims|art|data|lab)-?.*\.js$/.test(f));
const src = {}; files.forEach(f=>src[f]=fs.readFileSync(f,'utf8'));
const ext = files.filter(f=>/-x\d+\.js$|^sims-extend\.js$/.test(f)).map(f=>src[f]).join('\n');
const owner = id => files.find(f=>src[f].includes("id: '"+id+"'")) || null;

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1500,height:1050}});
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.goto('file://'+process.cwd()+'/_preview.html');
await p.waitForTimeout(2500);

const meta = await p.evaluate(()=> (window.__REG||[]).map(d=>({
  id:d.id, name:d.name, params:Object.keys(d.params||{}),
  controls:[].concat(...(d.controls||[]).map(g=>(g.items||[]).map(i=>({
    key:i.key, label:(i.label||'').replace(/<[^>]*>/g,''), type:i.type||'range',
    n:(i.options||[]).length })))),
  presets:(d.presets||[]).map(x=>Object.keys(x.params||{}))
})));

let issues = 0;
const say = (tag,msg)=>{ issues++; console.log(tag.padEnd(9)+msg); };

/* ---- 1. static wiring ---- */
for (const m of meta){
  const own = owner(m.id);
  const pool = (own?src[own]:'') + '\n' + ext;
  const dynamic = /\bp\[[^\]]+\]/.test(pool);     // sim indexes params dynamically
  for (const c of m.controls){
    const k = c.key;
    if (!m.params.includes(k)){ say('NO-PARAM', `${m.id} · ${k} — control has no entry in params`); continue; }
    const used = pool.includes('p.'+k) || pool.includes("p['"+k+"']") || pool.includes('p["'+k+'"]')
              || new RegExp('[{,]\\s*'+k+'\\s*[,}]').test(pool);
    if (!used && !dynamic) say('DEAD', `${m.id} · ${k} — never read  "${c.label}"`);
  }
  m.presets.forEach((ks,i)=>ks.forEach(k=>{
    if(!m.params.includes(k)) say('PRESET', `${m.id} · preset#${i} sets unknown param "${k}"`);
  }));
}

/* ---- 2. live click-through ---- */
for (const m of meta){
  await p.evaluate(i=>document.querySelector('.navbtn[data-sim="'+i+'"]').click(), m.id);
  await p.waitForTimeout(420);
  const res = await p.evaluate(async (sim)=>{
    const out = [];
    const before = JSON.stringify(window.__REG.find(d=>d.id===sim.id).params);
    const ctls = [...document.querySelectorAll('#main .ctl')];
    for (const ctl of ctls){
      const range = ctl.querySelector('input[type=range]');
      const check = ctl.querySelector('input[type=checkbox]');
      const seg   = ctl.querySelector('.seg');
      const label = (ctl.querySelector('.ctl-label')||ctl.querySelector('.switch-label')||{}).textContent||'?';
      const read = () => JSON.stringify(window.__S ? window.__S.p : null);
      if (range){
        const a = read();
        const mid = (+range.min + +range.max)/2, hi = +range.max;
        range.value = String(Math.abs(+range.value-mid) < 1e-9 ? hi : mid);
        range.dispatchEvent(new Event('input',{bubbles:true}));
        if (read() === a) out.push('range did not change state: '+label);
      } else if (check){
        // drive from the live param, not from the node's own checked flag —
        // an earlier control may have changed the param under it
        const key = ctl.dataset.key;
        const was = !!window.__S.p[key];
        check.checked = !was;
        check.dispatchEvent(new Event('change',{bubbles:true}));
        if (!!window.__S.p[key] === was) out.push('toggle did not change state: '+label);
        check.checked = was;
        check.dispatchEvent(new Event('change',{bubbles:true}));
      } else if (seg){
        // a select is correct when, after clicking an option, the param
        // holds that option's value
        const key = ctl.dataset.key;
        const def = window.__REG.find(d=>d.id===sim.id);
        const item = [].concat(...(def.controls||[]).map(g=>g.items||[])).find(i=>i.key===key);
        const opts = (item&&item.options)||[];
        const btns = [...seg.querySelectorAll('button')];
        for (let i=0;i<btns.length;i++){
          btns[i].click();
          const want = opts[i] ? opts[i].value : undefined;
          const got = window.__S.p[key];
          if (want !== undefined && String(got) !== String(want))
            out.push('option left param wrong: '+label+' → "'+btns[i].textContent.trim()+'" wanted '+want+' got '+got);
        }
      }
    }
    return out;
  }, m);
  res.forEach(r=>say('LIVE', `${m.id} · ${r}`));
  // presets
  const pres = await p.evaluate(()=>{
    const out=[]; const bs=[...document.querySelectorAll('#main .mbtn.preset')];
    bs.forEach(b=>{ try{ b.click(); }catch(e){ out.push('preset threw: '+b.textContent+' — '+e.message); } });
    return out;
  });
  pres.forEach(r=>say('PRESET', `${m.id} · ${r}`));
  await p.waitForTimeout(280);
}

errs.filter(e=>!/ERR_CONNECTION_RESET|Failed to load resource/.test(e)).forEach(e=>say('ERROR', e));
console.log(issues ? `\n${issues} issue(s) across ${meta.length} sims` : `\nCLEAN — ${meta.length} sims, every control and preset exercised`);
await b.close();

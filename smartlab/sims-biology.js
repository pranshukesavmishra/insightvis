/* ============================================================
   BIOLOGY — 5. Hodgkin–Huxley action potential
              6. Cardiac cycle, PV loop and ECG
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;

  /* =========================================================================
     5 · ACTION POTENTIAL — the full Hodgkin–Huxley equations on a cable
     ========================================================================= */
  const ENa = 50, EK = -77, EL = -54.387, CM = 1;
  const NSEG = 100, AXON_CM = 4;           // 4 cm of axon in 100 compartments

  function aM(V) { const d = V + 40; return Math.abs(d) < 1e-6 ? 1.0 : 0.1 * d / (1 - Math.exp(-d / 10)); }
  function bM(V) { return 4 * Math.exp(-(V + 65) / 18); }
  function aH(V) { return 0.07 * Math.exp(-(V + 65) / 20); }
  function bH(V) { return 1 / (1 + Math.exp(-(V + 35) / 10)); }
  function aN(V) { const d = V + 55; return Math.abs(d) < 1e-6 ? 0.1 : 0.01 * d / (1 - Math.exp(-d / 10)); }
  function bN(V) { return 0.125 * Math.exp(-(V + 65) / 80); }

  L.register({
    id: 'actionpotential', subject: 'biology',
    name: 'Nerve Impulse — the Hodgkin–Huxley Action Potential',
    chapter: 'Neural Control & Coordination',
    exams: ['NEET UG', 'JEE Main'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'The axon, the membrane patch and the gates are all driven by the same integrated equations',
    lede: 'The nerve impulse is not a metaphor — it is a solution of four coupled differential equations that ' +
      'Hodgkin and Huxley fitted to the squid giant axon in 1952, and won a Nobel Prize for. ' +
      'This lab integrates those equations live across <b>100 connected compartments</b>, so the spike you see ' +
      'sweeping down the axon is genuinely propagating, and the sodium and potassium gates open and shut ' +
      'because <b>m, h and n</b> say so.',

    params: { mode: 'single', Istim: 20, dur: 1.0, gap: 5, ttx: 0, tea: 0, temp: 18.5, patch: true },

    presets: [
      { name: 'Normal spike', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 0, tea: 0, temp: 18.5 } },
      { name: 'Subthreshold', params: { mode: 'single', Istim: 9, dur: 1.0, ttx: 0, tea: 0 } },
      { name: 'Paired pulse (refractory)', params: { mode: 'paired', Istim: 24, dur: 1.0, gap: 5 } },
      { name: 'TTX — Na⁺ blocked', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 70, tea: 0 } },
      { name: 'Partial TTX (40%)', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 40, tea: 0 } },
      { name: 'TEA — K⁺ blocked', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 0, tea: 80 } },
      { name: 'Cold axon (6 °C)', params: { mode: 'single', Istim: 20, dur: 1.0, temp: 6.3 } }
    ],

    controls: [
      { group: 'Stimulus', items: [
        { key: 'mode', type: 'select', label: 'Protocol', restructure: true, options: [
          { value: 'single', label: 'Single' }, { value: 'paired', label: 'Paired' }, { value: 'train', label: 'Train' }] },
        { key: 'Istim', label: 'Stimulus current <i>I</i>', min: 0, max: 40, step: 0.2, unit: 'µA/cm²',
          fmt: v => v.toFixed(1) },
        { key: 'dur', label: 'Pulse duration', min: 0.1, max: 3, step: 0.1, unit: 'ms', fmt: v => v.toFixed(1) },
        { key: 'gap', label: 'Gap between pulses', min: 2, max: 25, step: 0.5, unit: 'ms', fmt: v => v.toFixed(1) }
      ] },
      { group: 'Pharmacology & environment', items: [
        { key: 'ttx', label: 'Tetrodotoxin — blocks Na⁺', min: 0, max: 100, step: 1, unit: '%', fmt: v => v.toFixed(0) },
        { key: 'tea', label: 'TEA — blocks K⁺', min: 0, max: 100, step: 1, unit: '%', fmt: v => v.toFixed(0) },
        { key: 'temp', label: 'Temperature', min: 6.3, max: 30, step: 0.1, unit: '°C', fmt: v => v.toFixed(1) }
      ] },
      { group: 'Display', items: [
        { key: 'patch', type: 'toggle', label: 'Show membrane patch & gates' }
      ] }
    ],

    setup(S) {
      const V0 = -65;
      S.V = new Float64Array(NSEG).fill(V0);
      S.m = new Float64Array(NSEG); S.h = new Float64Array(NSEG); S.n = new Float64Array(NSEG);
      for (let i = 0; i < NSEG; i++) {
        S.m[i] = aM(V0) / (aM(V0) + bM(V0));
        S.h[i] = aH(V0) / (aH(V0) + bH(V0));
        S.n[i] = aN(V0) / (aN(V0) + bN(V0));
      }
      S.tms = 0; S.cycle = 0;
      S.rec = 30;                     // recording compartment
      S.hist = [];
      S.ions = [];
      S.peak = -65; S.lastPeak = null;
      S.tArrive = null; S.vel = null;
      S.period = S.p.mode === 'train' ? 12 : 30;
    },

    step(S, dt) {
      const p = S.p;
      const gNaMax = 120 * (1 - p.ttx / 100);
      const gKMax = 36 * (1 - p.tea / 100);
      const phi = Math.pow(3, (p.temp - 6.3) / 10);
      const gax = 8;
      const period = p.mode === 'train' ? Math.max(6, 1000 / 90) : 30;

      const msPerSec = 15;            // slow motion: 15 simulated ms per wall second
      const total = dt * msPerSec;
      const hstep = 0.005;
      let steps = Math.ceil(total / hstep);
      steps = clamp(steps, 1, 260);
      const h = total / steps;

      const V = S.V, m = S.m, hh = S.h, n = S.n;

      for (let s = 0; s < steps; s++) {
        const tc = S.tms % period;
        let stim = 0;
        if (tc < p.dur) stim = p.Istim;
        if (p.mode === 'paired' && tc >= p.gap && tc < p.gap + p.dur) stim = p.Istim;

        for (let i = 0; i < NSEG; i++) {
          const v = V[i];
          const gNa = gNaMax * m[i] * m[i] * m[i] * hh[i];
          const gK = gKMax * n[i] * n[i] * n[i] * n[i];
          const Iion = gNa * (v - ENa) + gK * (v - EK) + 0.3 * (v - EL);
          const vl = i > 0 ? V[i - 1] : V[0];
          const vr = i < NSEG - 1 ? V[i + 1] : V[NSEG - 1];
          const Iax = gax * (vl - 2 * v + vr);
          const Is = i < 4 ? stim : 0;
          const dV = (Is - Iion + Iax) / CM;

          const am = aM(v), bm = bM(v), ah = aH(v), bh = bH(v), an = aN(v), bn = bN(v);
          m[i] += h * phi * (am * (1 - m[i]) - bm * m[i]);
          hh[i] += h * phi * (ah * (1 - hh[i]) - bh * hh[i]);
          n[i] += h * phi * (an * (1 - n[i]) - bn * n[i]);
          V[i] = v + h * dV;
        }
        S.tms += h;
      }

      // conduction velocity: time for the spike to reach two markers
      const iA = 20, iB = 80;
      if (V[iA] > 0 && S.tA == null) S.tA = S.tms;
      if (V[iB] > 0 && S.tA != null && S.tB == null) {
        S.tB = S.tms;
        const dx = (iB - iA) / NSEG * AXON_CM / 100;      // metres
        S.vel = dx / ((S.tB - S.tA) / 1000);
      }
      if (V[iA] < -50 && V[iB] < -50) { S.tA = null; S.tB = null; }

      const v = V[S.rec];
      if (v > S.peak) S.peak = v;
      if (v < -50 && S.peak > -20) { S.lastPeak = S.peak; S.peak = -65; }

      S.hist.push([S.tms, v]);
      while (S.hist.length > 2 && S.hist[0][0] < S.tms - 45) S.hist.shift();

      /* ion particle flux for the patch view */
      const gNa = 120 * (1 - p.ttx / 100) * Math.pow(m[S.rec], 3) * hh[S.rec];
      const gK = 36 * (1 - p.tea / 100) * Math.pow(n[S.rec], 4);
      S.gNa = gNa; S.gK = gK;
      const iNa = Math.abs(gNa * (v - ENa)), iK = Math.abs(gK * (v - EK));
      if (p.patch) {
        if (Math.random() < clamp(iNa / 180, 0, 0.9)) S.ions.push({ t: 'Na', u: 0, j: (Math.random() - .5) });
        if (Math.random() < clamp(iK / 90, 0, 0.9)) S.ions.push({ t: 'K', u: 0, j: (Math.random() - .5) });
        S.ions.forEach(o => o.u += dt * 1.7);
        S.ions = S.ions.filter(o => o.u < 1);
        if (S.ions.length > 160) S.ions.splice(0, S.ions.length - 160);
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const bio = th.bio, na = '#FFC24B', k = '#5AA9FF';

      const axH = p.patch ? H * 0.30 : H * 0.72;
      const pad = 16;

      /* ---------- axon with membrane potential mapped along its length ---------- */
      const ax0 = pad + 42, ax1 = W - pad - 12, axY = pad + axH * 0.5, axR = Math.min(26, axH * 0.30);
      for (let i = 0; i < NSEG; i++) {
        const v = S.V[i];
        const t = clamp((v + 80) / 130, 0, 1);
        const col = t < 0.42
          ? g.mix('#16263F', '#2E5F8A', t / 0.42)
          : g.mix('#2E5F8A', '#FFD36B', (t - 0.42) / 0.58);
        const x0 = ax0 + (i / NSEG) * (ax1 - ax0);
        const w = (ax1 - ax0) / NSEG + 1;
        ctx.fillStyle = col;
        ctx.fillRect(x0, axY - axR, w, axR * 2);
      }
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(ax0 + .5, axY - axR + .5, ax1 - ax0, axR * 2);

      // depolarised front glow
      let front = -1;
      for (let i = NSEG - 1; i >= 0; i--) if (S.V[i] > 0) { front = i; break; }
      if (front >= 0) {
        const fx = ax0 + (front / NSEG) * (ax1 - ax0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(fx, axY, 0, fx, axY, axR * 2.6);
        rg.addColorStop(0, g.alpha(na, .5)); rg.addColorStop(1, g.alpha(na, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(fx, axY, axR * 2.6, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // stimulating electrode
      ctx.strokeStyle = g.alpha(th['text-2'], .9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax0 - 22, axY - axR - 16); ctx.lineTo(ax0 + 4, axY - axR + 2); ctx.stroke();
      ctx.font = '500 9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('stimulus', ax0 - 26, axY - axR - 18);

      // recording electrode
      const rx = ax0 + (S.rec / NSEG) * (ax1 - ax0);
      ctx.strokeStyle = bio; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx, axY + axR + 16); ctx.lineTo(rx, axY + axR - 2); ctx.stroke();
      ctx.fillStyle = bio; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('recording  ' + S.V[S.rec].toFixed(1) + ' mV', rx, axY + axR + 19);

      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = th['text-3'];
      ctx.fillText('axon', pad, axY);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = th['text-3'];
      ctx.fillText(AXON_CM + ' cm of axon · ' + NSEG + ' compartments', ax1, axY - axR - 6);

      /* ---------- gating bar meters ---------- */
      const gy = pad + axH + 6;
      const bars = [
        { l: 'm  Na⁺ activation', v: S.m[S.rec], c: na },
        { l: 'h  Na⁺ inactivation', v: S.h[S.rec], c: '#C98A2E' },
        { l: 'n  K⁺ activation', v: S.n[S.rec], c: k },
        { l: 'gNa  (mS/cm²)', v: clamp((S.gNa || 0) / 120, 0, 1), c: na, raw: S.gNa },
        { l: 'gK  (mS/cm²)', v: clamp((S.gK || 0) / 36, 0, 1), c: k, raw: S.gK }
      ];
      const bw = Math.min(148, (W - pad * 2) / 5 - 8);
      bars.forEach((b, i) => {
        const x = pad + i * (bw + 8);
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(b.l, x, gy + 9);
        ctx.fillStyle = g.alpha(th['ink-700'], 1); ctx.fillRect(x, gy + 12, bw, 6);
        ctx.fillStyle = b.c; ctx.fillRect(x, gy + 12, bw * b.v, 6);
        ctx.fillStyle = th['text-2']; ctx.textBaseline = 'top';
        ctx.fillText(b.raw != null ? b.raw.toFixed(1) : b.v.toFixed(3), x, gy + 21);
      });

      if (!p.patch) return;

      /* ---------- membrane patch with ion channels ---------- */
      const py0 = gy + 34, py1 = H - 12;
      const memY = (py0 + py1) / 2, memH = clamp((py1 - py0) * 0.22, 22, 52);
      const mx0 = pad + 60, mx1 = W - pad - 60;

      ctx.fillStyle = th['text-3']; ctx.font = '9.5px "IBM Plex Mono",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('OUTSIDE', pad, memY - memH - 14);
      ctx.fillText('high Na⁺', pad, memY - memH);
      ctx.fillText('INSIDE', pad, memY + memH + 14);
      ctx.fillText('high K⁺', pad, memY + memH + 28);

      // bilayer
      const headR = Math.max(2.6, memH * 0.16);
      ctx.fillStyle = g.alpha(th['ink-700'], 1);
      ctx.fillRect(mx0, memY - memH, mx1 - mx0, memH * 2);
      for (let x = mx0 + headR; x < mx1; x += headR * 2.6) {
        ctx.fillStyle = g.alpha(th['text-3'], .55);
        ctx.beginPath(); ctx.arc(x, memY - memH + headR, headR, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x, memY + memH - headR, headR, 0, TAU); ctx.fill();
      }

      // two channels
      const chan = [
        { x: mx0 + (mx1 - mx0) * 0.33, type: 'Na', c: na, m: S.m[S.rec], h: S.h[S.rec] },
        { x: mx0 + (mx1 - mx0) * 0.67, type: 'K', c: k, n: S.n[S.rec] }
      ];
      chan.forEach(ch => {
        const cw = 26, gate = ch.type === 'Na' ? ch.m : ch.n;
        const inact = ch.type === 'Na' ? ch.h : 1;
        const open = gate * inact;
        ctx.fillStyle = g.alpha(ch.c, .18 + .55 * open);
        ctx.fillRect(ch.x - cw / 2, memY - memH - 4, cw, memH * 2 + 8);
        ctx.strokeStyle = g.alpha(ch.c, .9); ctx.lineWidth = 1.5;
        ctx.strokeRect(ch.x - cw / 2, memY - memH - 4, cw, memH * 2 + 8);
        // activation gate (bottom for Na, bottom for K) — closes the pore when low
        const gw = (cw / 2) * (1 - gate);
        ctx.fillStyle = g.alpha(ch.c, .95);
        ctx.fillRect(ch.x - cw / 2, memY + memH * 0.25, gw, 5);
        ctx.fillRect(ch.x + cw / 2 - gw, memY + memH * 0.25, gw, 5);
        if (ch.type === 'Na') {
          // inactivation ball plugs from inside when h is low
          const drop = (1 - inact) * memH * 0.8;
          ctx.fillStyle = g.alpha('#C98A2E', .95);
          ctx.beginPath(); ctx.arc(ch.x, memY + memH * 0.55 - drop, 5, 0, TAU); ctx.fill();
        }
        ctx.font = '600 10px "IBM Plex Mono",monospace';
        ctx.fillStyle = ch.c; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(ch.type === 'Na' ? 'Na⁺ channel' : 'K⁺ channel', ch.x, memY - memH - 10);
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textBaseline = 'top';
        ctx.fillText(ch.type === 'Na' ? 'open ' + (open * 100).toFixed(0) + '%' : 'open ' + (open * 100).toFixed(0) + '%',
          ch.x, memY + memH + 12);
      });

      // ions in transit
      S.ions.forEach(o => {
        const ch = o.t === 'Na' ? chan[0] : chan[1];
        const inward = o.t === 'Na';
        const y = inward ? (memY - memH - 22) + o.u * (memH * 2 + 44)
                         : (memY + memH + 22) - o.u * (memH * 2 + 44);
        const x = ch.x + o.j * 16 * (1 - Math.abs(0.5 - o.u) * 1.2);
        ctx.fillStyle = g.alpha(ch.c, 0.9 * (1 - Math.abs(o.u - 0.5) * 0.6));
        ctx.beginPath(); ctx.arc(x, y, 3.1, 0, TAU); ctx.fill();
      });

      ctx.font = '9.5px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = th['text-3'];
      ctx.fillText('Na⁺ in ↓   K⁺ out ↑', mx1 + 54, memY + memH + 12);
    },

    plotTitle: 'Membrane potential at the recording electrode',
    legend: [{ c: '#FF6B9D', label: 'Vm (mV)' }, { c: '#63729A', label: 'threshold ≈ −55 mV' }],
    drawPlot(S, g) {
      if (!S.hist.length) return;
      const t1 = Math.max(45, S.tms);
      const P = g.Plot({
        xmin: t1 - 45, xmax: t1, ymin: -95, ymax: 55,
        xlabel: 'time (ms)', ylabel: 'Vm (mV)',
        yticks: [-90, -70, -55, -35, 0, 30, 50],
        xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
      }).frame();
      P.clip(() => {
        P.hline(ENa, g.alpha('#FFC24B', .45), [3, 4]);
        P.hline(EK, g.alpha('#5AA9FF', .45), [3, 4]);
        P.hline(-55, g.alpha(g.theme['text-3'], .95), [4, 3]);
        P.hline(-65, g.alpha(g.theme['text-3'], .45), [2, 5]);
        P.area(S.hist, -95, g.alpha(g.theme.bio, .10));
        P.line(S.hist, g.theme.bio, 2);
        const last = S.hist[S.hist.length - 1];
        P.dot(last[0], last[1], 4, g.theme.bio, g.theme['ink-950']);
      });
      P.tag(P.cfg.xmin, ENa, 'E_Na = +50', '#FFC24B', 'left', -8);
      P.tag(P.cfg.xmin, EK, 'E_K = −77', '#5AA9FF', 'left', 9);
      P.tag(P.cfg.xmin, -55, 'threshold', g.theme['text-2'], 'left', -8);
    },

    readouts(S) {
      const p = S.p, v = S.V[S.rec];
      const refractory = S.h[S.rec] < 0.35;
      return [
        { label: 'Vm (recording site)', value: v.toFixed(1), unit: 'mV', flag: 'accent' },
        { label: 'Last peak', value: S.lastPeak != null ? S.lastPeak.toFixed(1) : '—', unit: 'mV',
          hint: 'all-or-none amplitude' },
        { label: 'Conduction velocity', value: S.vel ? S.vel.toFixed(1) : '—', unit: 'm/s',
          hint: 'measured from the cable' },
        { label: 'gNa', value: (S.gNa || 0).toFixed(1), unit: 'mS/cm²' },
        { label: 'gK', value: (S.gK || 0).toFixed(1), unit: 'mS/cm²' },
        { label: 'State', value: refractory ? 'Refractory' : v > -50 ? 'Firing' : 'Excitable',
          unit: '', flag: refractory ? 'warn' : v > -50 ? 'crit' : 'ok',
          hint: refractory ? 'h is low — Na⁺ gates inactivated' : 'ready to fire' },
        { label: 'Q₁₀ factor φ', value: Math.pow(3, (p.temp - 6.3) / 10).toFixed(2), unit: '',
          hint: 'gating speed vs 6.3 °C' }
      ];
    },

    equation(S) {
      const p = S.p, v = S.V[S.rec];
      return E.v('C') + E.sub('m') + E.frac('d' + E.v('V'), 'd' + E.v('t')) + ' ' + E.op('=') + ' ' +
        E.v('I') + E.op('−') + ' ' + E.v('ḡ') + E.sub('Na') + E.v('m') + '<sup>3</sup>' + E.v('h') +
        '(' + E.v('V') + E.op('−') + E.v('E') + E.sub('Na') + ')' + E.op('−') +
        ' ' + E.v('ḡ') + E.sub('K') + E.v('n') + '<sup>4</sup>' +
        '(' + E.v('V') + E.op('−') + E.v('E') + E.sub('K') + ')' + E.op('−') +
        ' ' + E.v('ḡ') + E.sub('L') + '(' + E.v('V') + E.op('−') + E.v('E') + E.sub('L') + ')' +
        '<br>' + E.v('V') + ' ' + E.op('=') + ' ' + E.n(v.toFixed(1), 'mV') + E.op(',') +
        ' ' + E.v('m') + E.op('=') + E.n(S.m[S.rec].toFixed(3), '') + E.op(',') +
        ' ' + E.v('h') + E.op('=') + E.n(S.h[S.rec].toFixed(3), '') + E.op(',') +
        ' ' + E.v('n') + E.op('=') + E.n(S.n[S.rec].toFixed(3), '') +
        '<br>' + E.v('ḡ') + E.sub('Na') + E.v('m') + '<sup>3</sup>' + E.v('h') + ' ' + E.op('=') + ' ' +
        E.n((S.gNa || 0).toFixed(1), 'mS/cm²') + E.op('·') +
        ' ' + E.v('ḡ') + E.sub('K') + E.v('n') + '<sup>4</sup> ' + E.op('=') + ' ' +
        E.n((S.gK || 0).toFixed(1), 'mS/cm²');
    },
    eqNote: '<b>The exponents are the mechanism.</b> m³ means three activation gates must all open, which makes ' +
      'sodium activation explosively steep; n⁴ makes potassium slower and smoother. The separate <i>h</i> term is ' +
      'what shuts sodium off on its own — and that single variable is the entire explanation of the refractory period.',

    walkthrough: [
      { title: '1 · Resting potential',
        body: 'With no stimulus the membrane sits near −65 mV. Look at the gate meters: n is partly open, m is almost shut, h is almost fully open.',
        ask: 'Why does the resting value sit close to E_K (−77 mV) rather than E_Na (+50 mV)?',
        reveal: 'Because at rest the membrane is far more permeable to <b>K⁺</b> than to Na⁺. The resting potential always drifts towards the equilibrium potential of whichever ion can move most easily — here, potassium.',
        params: { mode: 'single', Istim: 0, dur: 1.0, ttx: 0, tea: 0, temp: 18.5 } },
      { title: '2 · All-or-none',
        body: 'Start with a small stimulus that produces only a bump, then raise it past about 11 µA/cm² and watch the trace snap into a full spike.',
        ask: 'Once you are above threshold, does a bigger stimulus give a bigger action potential?',
        reveal: '<b>No — this is the all-or-none law.</b> Compare "Last peak" across stimulus strengths; it barely moves. Above threshold, sodium influx becomes self-reinforcing and the spike runs to completion on its own. A stronger stimulus changes the <b>frequency</b> of firing, not the height.',
        params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 0, tea: 0 } },
      { title: '3 · Rising phase — sodium runs away',
        body: 'Watch the m bar and the gNa bar during the upstroke. They shoot up together while the trace climbs towards +50 mV.',
        ask: 'What makes the upstroke so steep?',
        reveal: '<b>Positive feedback.</b> Depolarisation opens Na⁺ gates → Na⁺ rushes in → more depolarisation → more gates open. The trace heads for E_Na (+50 mV) and would reach it if the sodium gates stayed open.',
        params: { mode: 'single', Istim: 20, dur: 1.0 } },
      { title: '4 · Falling phase and the undershoot',
        body: 'Now follow h and n. As the spike peaks, h collapses (sodium self-inactivates) while n rises slowly and potassium leaves the cell.',
        ask: 'Why does the trace dip <i>below</i> the resting potential before settling?',
        reveal: 'The slow K⁺ gates stay open past the point where the membrane is back at rest, so extra K⁺ keeps leaking out and pulls the potential towards E_K = −77 mV. That dip is <b>hyperpolarisation</b>, and it is why the membrane is briefly harder to excite.',
        params: { mode: 'single', Istim: 20, dur: 1.0 } },
      { title: '5 · The refractory period',
        body: 'Switch to the paired-pulse protocol. Two identical stimuli are delivered with an adjustable gap. Start with a small gap and increase it.',
        ask: 'At short gaps the second stimulus produces nothing at all. Why?',
        reveal: 'The <b>h</b> gates have not recovered. Sodium channels are inactivated, and no stimulus of any size can reopen them — that is the <b>absolute refractory period</b>. As the gap widens, h recovers and a smaller-than-normal spike appears (relative refractory period). This is what caps the maximum firing frequency of a neuron and forces the impulse to travel one way only.',
        params: { mode: 'paired', Istim: 24, dur: 1.0, gap: 5 } },
      { title: '6 · Blocking the channels',
        body: 'Tetrodotoxin from pufferfish plugs sodium channels; TEA blocks potassium ones. Try each.',
        ask: 'Predict what each toxin does to the trace before you move the slider.',
        reveal: '<b>TTX abolishes the spike entirely</b> — no sodium influx, no upstroke, and this is exactly why pufferfish poisoning is fatal (paralysis of respiratory nerves). <b>TEA leaves the spike but cripples repolarisation</b>, so the action potential becomes long and broad and the undershoot disappears.',
        params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 70, tea: 0 } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Resting vs action potential values, and the ionic basis of each phase — a NEET staple.</li>' +
      '<li>Sequence-ordering questions: depolarisation → repolarisation → hyperpolarisation → resting.</li>' +
      '<li>Role of the Na⁺/K⁺ ATPase in restoring the gradients (3 Na⁺ out, 2 K⁺ in, against the gradient, using ATP).</li>' +
      '<li>Why conduction in myelinated fibres is faster — saltatory conduction at the nodes of Ranvier.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The sodium–potassium pump does <b>not</b> generate the action potential. ' +
      'The spike is driven entirely by ions flowing <i>down</i> pre-existing gradients through gated channels; the ' +
      'pump works in the background to rebuild those gradients afterwards.</div>'
  });

  /* =========================================================================
     6 · CARDIAC CYCLE — time-varying elastance, PV loop and ECG
     ========================================================================= */
  function elastance(tn, a1, a2, n1, n2) {
    const t = Math.max(tn, 1e-6);
    const g1 = Math.pow(t / a1, n1), g2 = Math.pow(t / a2, n2);
    return (g1 / (1 + g1)) * (1 / (1 + g2));
  }
  const E_PEAK = (function () {
    let mx = 0; for (let i = 0; i <= 400; i++) mx = Math.max(mx, elastance(i / 400, 0.303, 0.508, 1.32, 21.9));
    return mx;
  })();
  const LA_PEAK = (function () {
    let mx = 0; for (let i = 0; i <= 400; i++) mx = Math.max(mx, elastance(i / 400, 0.10, 0.20, 1.4, 18));
    return mx;
  })();
  const gauss = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

  function ecgAt(tn) {
    return 0.14 * gauss(tn, 0.80, 0.030)
      - 0.09 * gauss(tn, 0.013, 0.006)
      + 1.00 * gauss(tn, 0.035, 0.008)
      - 0.22 * gauss(tn, 0.058, 0.009)
      + 0.27 * gauss(tn, 0.330, 0.045);
  }

  L.register({
    id: 'cardiac', subject: 'biology',
    name: 'The Cardiac Cycle — Pressure, Volume and the ECG',
    chapter: 'Body Fluids & Circulation',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Valves open and close purely from the pressure difference across them — nothing is scripted',
    lede: 'Every valve click, every heart sound and every deflection of the ECG comes down to one thing: ' +
      '<b>which side of a valve has the higher pressure right now.</b> This lab runs a time-varying elastance ' +
      'model of the left heart with a Windkessel aorta, so the pressure curves, the volume curve, the ' +
      '<b>pressure–volume loop</b> and the derived stroke volume and ejection fraction all emerge from the ' +
      'physics rather than being drawn in by hand.',

    params: { hr: 72, emax: 1.85, preload: 10, afterload: 1.0, showECG: true },

    presets: [
      { name: 'Resting adult (72 bpm)', params: { hr: 72, emax: 2.0, preload: 10, afterload: 1.0 } },
      { name: 'Exercise', params: { hr: 140, emax: 3.4, preload: 14, afterload: 0.75 } },
      { name: 'Raised afterload', params: { hr: 72, emax: 2.0, preload: 10, afterload: 1.8 } },
      { name: 'Weak contractility', params: { hr: 72, emax: 1.1, preload: 12, afterload: 1.1 } },
      { name: 'Bradycardia (45 bpm)', params: { hr: 45, emax: 2.0, preload: 10, afterload: 1.0 } }
    ],

    controls: [
      { group: 'Heart', items: [
        { key: 'hr', label: 'Heart rate', min: 40, max: 180, step: 1, unit: 'bpm', fmt: v => v.toFixed(0) },
        { key: 'emax', label: 'Contractility <i>E</i><sub>max</sub>', min: 0.8, max: 4, step: 0.05,
          unit: 'mmHg/mL', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Loading conditions', items: [
        { key: 'preload', label: 'Preload (filling pressure)', min: 2, max: 20, step: 0.5, unit: 'mmHg',
          fmt: v => v.toFixed(1) },
        { key: 'afterload', label: 'Afterload (systemic resistance)', min: 0.4, max: 2.2, step: 0.05,
          unit: 'mmHg·s/mL', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Display', items: [
        { key: 'showECG', type: 'toggle', label: 'Show ECG trace' }
      ] }
    ],

    setup(S) {
      S.Vlv = 120; S.Vla = 45; S.Pao = 80;
      S.tc = 0; S.hist = []; S.loop = []; S.loopPrev = [];
      S.edv = 120; S.esv = 50; S.sysP = 120; S.diaP = 80;
      S._maxV = 0; S._minV = 999; S._maxP = 0; S._minP = 999;
    },

    step(S, dt) {
      const p = S.p;
      const T = 60 / p.hr;
      const Rmv = 0.006, Rav = 0.005, Rpv = 0.015, Pven = 4;
      const Cao = 1.45, V0 = 10, V0la = 12;
      const EminLV = 0.05, EmaxLA = 0.28, EminLA = 0.09;

      const h = 0.0004;
      let steps = Math.ceil(dt / h);
      steps = clamp(steps, 1, 200);
      const hs = dt / steps;

      for (let s = 0; s < steps; s++) {
        const tn = S.tc / T;
        const eLV = elastance(tn, 0.303, 0.508, 1.32, 21.9) / E_PEAK;
        // atrial systole occurs late in the cycle, just before the next ventricular beat
        const tnA = (tn + 0.14) % 1;
        const eLA = elastance(tnA, 0.10, 0.20, 1.4, 18) / LA_PEAK;

        const Elv = EminLV + (p.emax - EminLV) * eLV;
        const Ela = EminLA + (EmaxLA - EminLA) * eLA;

        const Plv = Elv * (S.Vlv - V0);
        const Pla = Ela * (S.Vla - V0la);

        const Qmv = Pla > Plv ? (Pla - Plv) / Rmv : 0;
        const Qav = Plv > S.Pao ? (Plv - S.Pao) / Rav : 0;
        const Qpv = (p.preload - Pla) / Rpv;
        const Qsys = (S.Pao - Pven) / p.afterload;

        S.Vlv += hs * (Qmv - Qav);
        S.Vla += hs * (Qpv - Qmv);
        S.Pao += hs * (Qav - Qsys) / Cao;

        S.Vlv = Math.max(S.Vlv, 5); S.Vla = Math.max(S.Vla, 5);
        S.Pao = Math.max(S.Pao, 5);

        S.Plv = Plv; S.Pla = Pla;
        S.mvOpen = Qmv > 0.1; S.avOpen = Qav > 0.1; S.eLV = eLV;

        S._maxV = Math.max(S._maxV, S.Vlv); S._minV = Math.min(S._minV, S.Vlv);
        S._maxP = Math.max(S._maxP, S.Pao); S._minP = Math.min(S._minP, S.Pao);

        S.tc += hs;
        if (S.tc >= T) {
          S.tc -= T;
          S.edv = S._maxV; S.esv = S._minV;
          S.sysP = S._maxP; S.diaP = S._minP;
          S._maxV = 0; S._minV = 999; S._maxP = 0; S._minP = 999;
          S.loopPrev = S.loop; S.loop = [];
        }
      }

      const tn = S.tc / T;
      S.tn = tn;
      S.ecg = ecgAt(tn);
      S.hist.push([S.hist.length ? S.hist[S.hist.length - 1][0] + dt : 0,
        S.Plv, S.Pao, S.Pla, S.Vlv, S.ecg]);
      const span = 2.1 * T;
      while (S.hist.length > 2 && S.hist[0][0] < S.hist[S.hist.length - 1][0] - span) S.hist.shift();
      S.loop.push([S.Vlv, S.Plv]);
      if (S.loop.length > 1400) S.loop.shift();

      S.phase = S.avOpen ? 'Ventricular ejection'
        : S.mvOpen ? (tn > 0.82 || tn < 0.02 ? 'Atrial systole' : 'Ventricular filling')
        : (S.eLV > 0.03 && tn < 0.35) ? 'Isovolumetric contraction' : 'Isovolumetric relaxation';
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const bio = th.bio, artC = '#FFB454', venC = '#5A8FD8';
      const split = Math.min(W * 0.40, 300);

      /* ================= heart schematic ================= */
      const hx = split / 2, hy = H * 0.5, sc = Math.min(split, H) / 2.5;
      const nV = clamp((S.Vlv - 40) / 100, 0.1, 1.2);
      const nA = clamp((S.Vla - 20) / 55, 0.1, 1.2);

      // body outline
      ctx.save();
      ctx.translate(hx, hy);
      ctx.fillStyle = g.alpha('#3A1F2C', .55);
      ctx.beginPath();
      ctx.moveTo(-sc * 0.95, -sc * 0.85);
      ctx.bezierCurveTo(sc * 1.0, -sc * 1.15, sc * 1.05, sc * 0.2, 0, sc * 1.05);
      ctx.bezierCurveTo(-sc * 1.0, sc * 0.2, -sc * 1.05, -sc * 1.1, -sc * 0.95, -sc * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1; ctx.stroke();

      // right heart (schematic, passive)
      ctx.fillStyle = g.alpha(venC, .32);
      ctx.beginPath(); ctx.ellipse(-sc * 0.46, sc * 0.12, sc * 0.30, sc * 0.44, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-sc * 0.44, -sc * 0.55, sc * 0.24, sc * 0.20, 0, 0, TAU); ctx.fill();
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = g.alpha(venC, .95);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('RV', -sc * 0.46, sc * 0.12); ctx.fillText('RA', -sc * 0.44, -sc * 0.55);

      // left atrium
      ctx.fillStyle = g.alpha(artC, .30 + .22 * nA);
      ctx.beginPath(); ctx.ellipse(sc * 0.36, -sc * 0.58, sc * 0.26 * (0.75 + .35 * nA), sc * 0.20 * (0.75 + .35 * nA), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = th.text; ctx.fillText('LA', sc * 0.36, -sc * 0.58);

      // left ventricle — wall thickness grows as it contracts
      const lvR = sc * 0.30 * (0.62 + 0.48 * nV), lvRy = sc * 0.46 * (0.62 + 0.48 * nV);
      ctx.fillStyle = g.alpha(artC, .34 + .3 * (1 - S.eLV));
      ctx.beginPath(); ctx.ellipse(sc * 0.34, sc * 0.16, lvR, lvRy, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = g.alpha(artC, .55 + .4 * S.eLV);
      ctx.lineWidth = 3 + 7 * S.eLV;
      ctx.stroke();
      ctx.fillStyle = th.text; ctx.font = '600 10px "IBM Plex Mono",monospace';
      ctx.fillText('LV', sc * 0.34, sc * 0.16);
      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-2'];
      ctx.fillText(S.Vlv.toFixed(0) + ' mL', sc * 0.34, sc * 0.16 + 14);

      // mitral valve
      const mvY = -sc * 0.30, mvX = sc * 0.34;
      ctx.strokeStyle = S.mvOpen ? th.ok : g.alpha(th['text-3'], .95);
      ctx.lineWidth = 2.4;
      const mvA = S.mvOpen ? 1.15 : 0.12;
      ctx.beginPath();
      ctx.moveTo(mvX - sc * 0.17, mvY);
      ctx.lineTo(mvX - sc * 0.17 + sc * 0.15 * Math.cos(mvA), mvY + sc * 0.17 * Math.sin(mvA));
      ctx.moveTo(mvX + sc * 0.17, mvY);
      ctx.lineTo(mvX + sc * 0.17 - sc * 0.15 * Math.cos(mvA), mvY + sc * 0.17 * Math.sin(mvA));
      ctx.stroke();

      // aorta + aortic valve
      ctx.strokeStyle = g.alpha(artC, .75); ctx.lineWidth = Math.max(7, sc * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sc * 0.10, -sc * 0.42);
      ctx.quadraticCurveTo(sc * 0.02, -sc * 1.05, -sc * 0.30, -sc * 1.02);
      ctx.stroke();
      const avY = -sc * 0.42, avX = sc * 0.10;
      ctx.strokeStyle = S.avOpen ? th.ok : g.alpha(th['text-3'], .95);
      ctx.lineWidth = 2.4; ctx.lineCap = 'butt';
      const avA = S.avOpen ? 1.2 : 0.1;
      ctx.beginPath();
      ctx.moveTo(avX - sc * 0.11, avY);
      ctx.lineTo(avX - sc * 0.11 + sc * 0.10 * Math.cos(avA), avY - sc * 0.13 * Math.sin(avA));
      ctx.moveTo(avX + sc * 0.11, avY);
      ctx.lineTo(avX + sc * 0.11 - sc * 0.10 * Math.cos(avA), avY - sc * 0.13 * Math.sin(avA));
      ctx.stroke();

      ctx.font = '9px "IBM Plex Mono",monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = S.mvOpen ? th.ok : th['text-3'];
      ctx.fillText(S.mvOpen ? 'mitral OPEN' : 'mitral shut', mvX + sc * 0.22, mvY);
      ctx.fillStyle = S.avOpen ? th.ok : th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(S.avOpen ? 'aortic OPEN' : 'aortic shut', avX - sc * 0.30, avY - 10);
      ctx.restore();

      // phase caption
      ctx.font = '700 13px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(S.phase || '', 12, 12);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(p.hr + ' bpm  ·  cycle ' + (S.tn * 100).toFixed(0) + '%', 12, 30);

      /* ================= Wiggers stack ================= */
      if (!S.hist.length) return;
      const gx0 = split + 46, gx1 = W - 14;
      if (gx1 - gx0 < 60) return;
      const t0 = S.hist[0][0], t1 = S.hist[S.hist.length - 1][0];
      const span = Math.max(t1 - t0, 1e-3);
      const X = t => gx0 + (t - t0) / span * (gx1 - gx0);

      const rows = p.showECG
        ? [{ h: .42, kind: 'P' }, { h: .30, kind: 'V' }, { h: .28, kind: 'E' }]
        : [{ h: .58, kind: 'P' }, { h: .42, kind: 'V' }];
      let yTop = 14;
      const usable = H - 34;

      rows.forEach(row => {
        const hh = usable * row.h, y0 = yTop + hh - 12, y1 = yTop + 2;
        const box = { y0: y0, y1: y1 };
        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx0, y0 + .5); ctx.lineTo(gx1, y0 + .5); ctx.stroke();

        const mapY = (v, lo, hi) => y0 + (v - lo) / (hi - lo) * (y1 - y0);
        const drawSeries = (idx, lo, hi, color, width, dash) => {
          ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 1.8;
          ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
          ctx.beginPath();
          S.hist.forEach((r, i) => {
            const x = X(r[0]), y = mapY(clamp(r[idx], lo, hi), lo, hi);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke(); ctx.restore();
        };

        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        if (row.kind === 'P') {
          drawSeries(3, 0, 140, g.alpha(venC, .9), 1.5);              // LA
          drawSeries(2, 0, 140, artC, 2);                             // aorta
          drawSeries(1, 0, 140, bio, 2);                              // LV
          ctx.fillStyle = th['text-3'];
          [0, 40, 80, 120].forEach(v => ctx.fillText(String(v), gx0 - 6, mapY(v, 0, 140)));
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillStyle = bio; ctx.fillText('LV', gx0 + 4, y1);
          ctx.fillStyle = artC; ctx.fillText('aorta', gx0 + 26, y1);
          ctx.fillStyle = venC; ctx.fillText('LA', gx0 + 64, y1);
          ctx.fillStyle = th['text-3']; ctx.textAlign = 'right';
          ctx.fillText('mmHg', gx1, y1);
        } else if (row.kind === 'V') {
          drawSeries(4, 30, 150, g.alpha(th.text, .92), 2);
          ctx.fillStyle = th['text-3'];
          [50, 100, 150].forEach(v => ctx.fillText(String(v), gx0 - 6, mapY(v, 30, 150)));
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillStyle = th['text-2']; ctx.fillText('LV volume (mL)', gx0 + 4, y1);
        } else {
          ctx.save(); ctx.strokeStyle = th.ok; ctx.lineWidth = 1.6; ctx.beginPath();
          S.hist.forEach((r, i) => {
            const x = X(r[0]), y = y0 - (r[5] + 0.3) / 1.6 * (y0 - y1);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke(); ctx.restore();
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillStyle = th.ok; ctx.fillText('ECG', gx0 + 4, y1);
          // wave labels on the most recent complex
          const T = 60 / p.hr;
          [['P', .80], ['R', .035], ['T', .33]].forEach(w => {
            const tt = t1 - (S.tn - w[1] + 1) % 1 * T;
            if (tt < t0) return;
            ctx.fillStyle = th['text-3']; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(w[0], X(tt), y1 + 8);
          });
        }
        yTop += hh;
      });

      // time cursor
      const cx = X(t1);
      ctx.strokeStyle = g.alpha(th.text, .45); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 12); ctx.lineTo(cx, H - 18); ctx.stroke();
    },

    plotTitle: 'Pressure–volume loop of the left ventricle',
    legend: [{ c: '#FF6B9D', label: 'current beat' }, { c: '#63729A', label: 'previous beat' }],
    drawPlot(S, g) {
      const P = g.Plot({
        xmin: 0, xmax: 180, ymin: 0, ymax: 200,
        xlabel: 'LV volume (mL)', ylabel: 'LV pressure (mmHg)',
        xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
      }).frame();
      P.clip(() => {
        if (S.loopPrev && S.loopPrev.length > 3) P.line(S.loopPrev, g.alpha(g.theme['text-3'], .85), 1.5);
        if (S.loop.length > 3) {
          P.area(S.loop, 0, g.alpha(g.theme.bio, .10));
          P.line(S.loop, g.theme.bio, 2);
        }
        P.dot(S.Vlv, S.Plv, 4.5, g.theme.text, g.theme['ink-950']);
        P.vline(S.esv, g.alpha(g.theme['text-3'], .6), [3, 3]);
        P.vline(S.edv, g.alpha(g.theme['text-3'], .6), [3, 3]);
      });
      P.tag(S.esv, 190, 'ESV ' + S.esv.toFixed(0), g.theme['text-2'], 'right', 0);
      P.tag(S.edv, 190, 'EDV ' + S.edv.toFixed(0), g.theme['text-2'], 'left', 0);
      P.tag((S.esv + S.edv) / 2, 20, 'SV = ' + (S.edv - S.esv).toFixed(0) + ' mL',
        g.theme.bio, 'left', 0);
    },

    readouts(S) {
      const p = S.p;
      const sv = Math.max(S.edv - S.esv, 0);
      const ef = S.edv > 0 ? sv / S.edv * 100 : 0;
      const co = sv * p.hr / 1000;
      const map = S.diaP + (S.sysP - S.diaP) / 3;
      return [
        { label: 'EDV', value: S.edv.toFixed(0), unit: 'mL', hint: 'end of filling' },
        { label: 'ESV', value: S.esv.toFixed(0), unit: 'mL', hint: 'end of ejection' },
        { label: 'Stroke volume EDV−ESV', value: sv.toFixed(0), unit: 'mL', flag: 'accent' },
        { label: 'Ejection fraction SV/EDV', value: ef.toFixed(0), unit: '%',
          flag: ef < 40 ? 'crit' : ef < 50 ? 'warn' : 'ok', hint: 'normal 55–70%' },
        { label: 'Cardiac output SV×HR', value: co.toFixed(2), unit: 'L/min', flag: 'accent' },
        { label: 'Blood pressure', value: S.sysP.toFixed(0) + '/' + S.diaP.toFixed(0), unit: 'mmHg' },
        { label: 'Mean arterial pressure', value: map.toFixed(0), unit: 'mmHg', hint: 'DBP + PP/3' },
        { label: 'Cycle duration', value: (60 / p.hr).toFixed(2), unit: 's' }
      ];
    },

    equation(S) {
      const p = S.p;
      const sv = Math.max(S.edv - S.esv, 0);
      return E.v('P') + E.sub('LV') + '(' + E.v('t') + ') ' + E.op('=') + ' ' + E.v('E') + '(' + E.v('t') + ')' +
        E.op('·') + '(' + E.v('V') + E.op('−') + E.v('V') + '₀)' + E.op('·') +
        ' valves follow ' + E.v('ΔP') + ' alone' +
        '<br>SV ' + E.op('=') + ' EDV ' + E.op('−') + ' ESV ' + E.op('=') + ' ' +
        E.n(S.edv.toFixed(0), 'mL') + E.op('−') + E.n(S.esv.toFixed(0), 'mL') + ' ' + E.op('=') + ' ' +
        E.n(sv.toFixed(0), 'mL') +
        '<br>EF ' + E.op('=') + ' ' + E.frac('SV', 'EDV') + ' ' + E.op('=') + ' ' +
        E.n((S.edv > 0 ? sv / S.edv * 100 : 0).toFixed(0), '%') + E.op('·') +
        ' CO ' + E.op('=') + ' SV ' + E.op('×') + ' HR ' + E.op('=') + ' ' +
        E.n((sv * p.hr / 1000).toFixed(2), 'L/min');
    },
    eqNote: '<b>The loop area is the work done.</b> The area enclosed by the pressure–volume loop is the stroke ' +
      'work of the left ventricle. Raise contractility and the loop grows taller and wider; raise afterload and it ' +
      'gets taller but narrower — which is exactly why a chronically hypertensive heart ejects less per beat.',

    walkthrough: [
      { title: '1 · Four phases, two valves',
        body: 'Watch the valve labels on the heart and the phase caption at the top left. Nothing about the valves is scripted — each one opens the instant the pressure behind it exceeds the pressure in front.',
        ask: 'During isovolumetric contraction, both valves are shut. What is happening to the volume?',
        reveal: '<b>Nothing at all — that is what "isovolumetric" means.</b> The muscle is contracting hard and pressure climbs steeply, but with both valves closed no blood can leave, so the volume trace is flat. On the PV loop this is the vertical line up the right-hand side.',
        params: { hr: 72, emax: 2.0, preload: 10, afterload: 1.0 } },
      { title: '2 · Reading the PV loop',
        body: 'The loop runs anticlockwise. Follow one lap: fill along the bottom, rise vertically, eject along the top, fall vertically.',
        ask: 'Which two points on the loop give you the stroke volume?',
        reveal: 'The widest and narrowest volumes: <b>SV = EDV − ESV</b>. Those are the two dashed vertical lines. Everything clinical — ejection fraction, cardiac output — is built from this one subtraction.',
        params: { hr: 72, emax: 2.0, preload: 10, afterload: 1.0 } },
      { title: '3 · Preload and the Frank–Starling law',
        body: 'Raise the preload slider and watch EDV, then stroke volume.',
        ask: 'Filling the ventricle more makes it eject more. Why should stretching the muscle help?',
        reveal: 'This is the <b>Frank–Starling law</b>: greater stretch gives better overlap of actin and myosin filaments, so the next contraction is more forceful. The heart therefore automatically matches its output to whatever comes back to it — which is how the two sides of the heart stay balanced without any nervous control.',
        params: { hr: 72, emax: 2.0, preload: 17, afterload: 1.0 } },
      { title: '4 · Afterload works the other way',
        body: 'Return preload to normal and now push the afterload slider up, as in untreated hypertension.',
        ask: 'What happens to the loop shape and to the ejection fraction?',
        reveal: 'The loop becomes <b>taller but narrower</b>. The ventricle must generate far more pressure before the aortic valve will open, and once it does open it ejects less — so ESV rises and <b>EF falls</b>. This is the chronic load that eventually produces ventricular hypertrophy.',
        params: { hr: 72, emax: 2.0, preload: 10, afterload: 2.0 } },
      { title: '5 · Lining the ECG up with the mechanics',
        body: 'The ECG is electrical; the pressure curves are mechanical. Watch how one leads the other on the stacked traces.',
        ask: 'Does the QRS complex happen before or after the ventricle contracts?',
        reveal: '<b>Before.</b> QRS is ventricular <i>depolarisation</i> — the electrical trigger. Mechanical contraction follows a few milliseconds later, which is why the LV pressure rise begins just after the R wave. Similarly the P wave precedes atrial systole, and the T wave (repolarisation) precedes relaxation.',
        params: { hr: 72, showECG: true } },
      { title: '6 · Exercise',
        body: 'Load the exercise preset: faster rate, stronger contraction, better filling, dilated vessels.',
        ask: 'Cardiac output roughly quadruples. Which factors did the work?',
        reveal: '<b>Both terms of CO = SV × HR.</b> Heart rate nearly doubles, and stroke volume rises through increased contractility and venous return while the falling afterload lets the ventricle empty more completely. Notice diastole shortens far more than systole — which is why very high rates eventually reduce filling and cap the output.',
        params: { hr: 140, emax: 3.4, preload: 14, afterload: 0.75 } }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct numericals: CO = SV × HR, EF = SV/EDV — plug and go, appears most years.</li>' +
      '<li>Matching ECG waves to events: P → atrial depolarisation, QRS → ventricular depolarisation (atrial repolarisation is buried inside it), T → ventricular repolarisation.</li>' +
      '<li>Heart sounds: "lubb" is the AV valves shutting at the start of systole, "dupp" the semilunar valves shutting at its end.</li>' +
      '<li>Ordering the phases of the cardiac cycle correctly.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>There is no wave on a normal ECG for atrial repolarisation. It does ' +
      'happen, but it is hidden underneath the much larger QRS complex — a favourite one-mark discriminator.</div>'
  });

})(window.InsightLab);

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

    params: { mode: 'single', Istim: 20, dur: 1.0, gap: 5, ttx: 0, tea: 0, temp: 18.5, myelin: false, patch: true },

    presets: [
      { name: 'Normal spike', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 0, tea: 0, temp: 18.5 } },
      { name: 'Subthreshold', params: { mode: 'single', Istim: 9, dur: 1.0, ttx: 0, tea: 0 } },
      { name: 'Paired pulse (refractory)', params: { mode: 'paired', Istim: 24, dur: 1.0, gap: 5 } },
      { name: 'TTX — Na⁺ blocked', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 70, tea: 0 } },
      { name: 'Partial TTX (40%)', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 40, tea: 0 } },
      { name: 'TEA — K⁺ blocked', params: { mode: 'single', Istim: 20, dur: 1.0, ttx: 0, tea: 80 } },
      { name: 'Cold axon (6 °C)', params: { mode: 'single', Istim: 20, dur: 1.0, temp: 6.3 } },
      { name: 'Myelinated — saltatory', params: { mode: 'single', Istim: 20, dur: 1.0, myelin: true, temp: 18.5 } }
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
      { group: 'Myelination', items: [
        { key: 'myelin', type: 'toggle', label: 'Myelinate the axon (Schwann cells)', restructure: true }
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

      /* Per-compartment cable properties. Unmyelinated: excitable
         everywhere. Myelinated: NODES nodes of Ranvier, each 4
         compartments wide, are excitable; the internodes under the
         sheath lose their channels, their leak drops ~40-fold and the
         sheath's series capacitance drops ~25-fold, so charge runs
         ahead almost instantly and only the nodes fire. */
      S.NODES = 7;
      S.exc = new Float64Array(NSEG).fill(1);
      S.gL = new Float64Array(NSEG).fill(0.3);
      S.cm = new Float64Array(NSEG).fill(CM);
      S.gax = new Float64Array(NSEG).fill(S.p.myelin ? 12 : 8);
      S.isNode = new Uint8Array(NSEG).fill(1);
      if (S.p.myelin) {
        const seg = NSEG / S.NODES;
        for (let i = 0; i < NSEG; i++) {
          const inNode = (i % seg) < 4 || i < 6;        // hillock stays excitable
          S.isNode[i] = inNode ? 1 : 0;
          if (!inNode) {
            S.exc[i] = 0.02;
            S.gL[i] = 0.3 / 40;
            S.cm[i] = CM / 25;
            S.gax[i] = 12;
          }
        }
      }
      // velocity markers must sit on excitable membrane, or a myelinated
      // axon would never trip them
      const nearest = want => {
        for (let d = 0; d < NSEG; d++) {
          if (want + d < NSEG && S.isNode[want + d]) return want + d;
          if (want - d >= 0 && S.isNode[want - d]) return want - d;
        }
        return want;
      };
      S.iA = nearest(20); S.iB = nearest(80);
      S.rec = nearest(30);            // always record from excitable membrane
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
      const hstep = p.myelin ? 0.0015 : 0.005;   // the myelinated cable is stiffer
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
          // Under myelin the axolemma carries almost no voltage-gated
          // channels and the sheath cuts leak and capacitance, so current
          // spreads passively to the next node — saltatory conduction.
          const ex = S.exc[i];
          const gNa = gNaMax * ex * m[i] * m[i] * m[i] * hh[i];
          const gK = gKMax * ex * n[i] * n[i] * n[i] * n[i];
          const Iion = gNa * (v - ENa) + gK * (v - EK) + S.gL[i] * (v - EL);
          const vl = i > 0 ? V[i - 1] : V[0];
          const vr = i < NSEG - 1 ? V[i + 1] : V[NSEG - 1];
          const Iax = S.gax[i] * (vl - 2 * v + vr);
          const Is = i < 4 ? stim : 0;
          const dV = (Is - Iion + Iax) / S.cm[i];

          const am = aM(v), bm = bM(v), ah = aH(v), bh = bH(v), an = aN(v), bn = bN(v);
          m[i] += h * phi * (am * (1 - m[i]) - bm * m[i]);
          hh[i] += h * phi * (ah * (1 - hh[i]) - bh * hh[i]);
          n[i] += h * phi * (an * (1 - n[i]) - bn * n[i]);
          V[i] = v + h * dV;
        }
        S.tms += h;
      }

      // conduction velocity: time for the spike to reach two markers
      const iA = S.iA, iB = S.iB;
      if (V[iA] > 0 && S.tA == null) S.tA = S.tms;
      if (V[iB] > 0 && S.tA != null && S.tB == null) {
        S.tB = S.tms;
        const dx = (iB - iA) / NSEG * AXON_CM / 100;      // metres
        S.vel = dx / ((S.tB - S.tA) / 1000);
      }
      // arm the next measurement only once the whole cable is quiet — the
      // upstroke at A has long repolarised by the time the spike reaches B
      let live = false;
      for (let i = 0; i < NSEG; i++) if (V[i] > -40) { live = true; break; }
      if (!live) { S.tA = null; S.tB = null; }

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

      const axH = p.patch ? H * 0.44 : H * 0.74;
      const pad = 16;

      /* ---------- the neuron, with membrane potential painted along the axon ---------- */
      const r = clamp(axH * 0.052, 4.5, 16);
      const somaR = r * 2.6;
      const nx0 = pad + somaR * 3.5, nx1 = W - pad - Math.max(96, r * 11);
      const axY = pad + axH * 0.5;

      // volts -> colour: resting slate, depolarised amber, overshoot white-hot
      const vCol = v => {
        const t = clamp((v + 80) / 130, 0, 1);
        return t < 0.42 ? g.mix('#16263F', '#2E5F8A', t / 0.42)
                        : g.mix('#2E5F8A', '#FFD36B', (t - 0.42) / 0.58);
      };

      const N = BIOART.neuron(ctx, nx0, nx1, axY, r, {
        somaR: somaR,
        myelin: !!p.myelin,
        nodes: S.NODES || 7,
        colourAt: u => vCol(S.V[clamp(Math.round(u * (NSEG - 1)), 0, NSEG - 1)]),
        labels: axH > 150
      });
      const ax0 = N.axStart, ax1 = N.axEnd;

      // depolarised front glow, riding the leading edge of the spike
      let front = -1;
      for (let i = NSEG - 1; i >= 0; i--) if (S.V[i] > 0) { front = i; break; }
      if (front >= 0) {
        const fx = ax0 + (front / (NSEG - 1)) * (ax1 - ax0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(fx, axY, 0, fx, axY, r * 5.5);
        rg.addColorStop(0, g.alpha(na, .55)); rg.addColorStop(1, g.alpha(na, 0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(fx, axY, r * 5.5, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // stimulating electrode, on the hillock where the spike is actually started
      ctx.strokeStyle = g.alpha(th['text-2'], .9); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax0 - 16, axY - r * 3.4); ctx.lineTo(ax0 + 3, axY - r * 1.2);
      ctx.stroke();
      ctx.fillStyle = g.alpha(th['text-2'], .9);
      ctx.beginPath(); ctx.arc(ax0 + 3, axY - r * 1.2, 2.6, 0, TAU); ctx.fill();
      ctx.font = '500 9.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('stimulus', ax0 - 18, axY - r * 4.0);

      // recording micro-electrode
      const rx = ax0 + (S.rec / (NSEG - 1)) * (ax1 - ax0);
      ctx.strokeStyle = bio; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 10, axY + r * 4.6); ctx.lineTo(rx, axY + r * 0.4);
      ctx.stroke();
      ctx.fillStyle = bio;
      ctx.beginPath(); ctx.arc(rx, axY + r * 0.4, 2.6, 0, TAU); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('recording  ' + S.V[S.rec].toFixed(1) + ' mV', rx + 10, axY + r * 4.9);

      // membrane-potential colour key
      const kx = W - pad - 84, ky = pad + 4;
      const kg = ctx.createLinearGradient(kx, 0, kx + 76, 0);
      for (let q = 0; q <= 10; q++) kg.addColorStop(q / 10, vCol(-80 + q * 13));
      ctx.fillStyle = kg; ctx.fillRect(kx, ky, 76, 7);
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(kx + .5, ky + .5, 76, 7);
      ctx.font = '8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('–80', kx, ky + 10);
      ctx.textAlign = 'right'; ctx.fillText('+50 mV', kx + 76, ky + 10);

      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = th['text-3'];
      ctx.fillText(AXON_CM + ' cm of axon · ' + NSEG + ' compartments' +
        (p.myelin ? ' · ' + (S.NODES || 7) + ' nodes of Ranvier' : ' · unmyelinated'),
        nx1, axY - r * 5.6);

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
      const py0 = gy + 40, py1 = H - 16;
      const memY = py0 + (py1 - py0) * 0.44, memH = clamp((py1 - py0) * 0.24, 20, 54);
      const mx0 = pad + 62, mx1 = W - pad - 62;

      ctx.fillStyle = th['text-3']; ctx.font = '9.5px "IBM Plex Mono",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('OUTSIDE', pad, memY - memH - 14);
      ctx.fillText('high Na⁺', pad, memY - memH);
      ctx.fillText('INSIDE', pad, memY + memH + 14);
      ctx.fillText('high K⁺', pad, memY + memH + 28);

      // the phospholipid bilayer itself — two leaflets of head-and-tail
      // lipids, hydrophilic heads out, hydrophobic tails meeting in the core
      ctx.fillStyle = g.alpha(th['ink-800'], 1);
      ctx.fillRect(mx0, memY - memH, mx1 - mx0, memH * 2);
      BIOART.bilayer(ctx, mx0, mx1, memY, memH);
      ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
      ctx.strokeRect(mx0 + .5, memY - memH + .5, mx1 - mx0, memH * 2);
      ctx.font = '8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = g.alpha(th['text-3'], .8);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('heads', mx0 - 6, memY - memH + memH * 0.16);
      ctx.fillText('tails', mx0 - 6, memY);

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

      /* ================= the heart, as an anatomical plate ================= */
      const sc = Math.min(W * 0.120, H * 0.250);
      const hx = W * 0.345, hy = H * 0.50 + sc * 0.16;
      const tvOpen = S.mvOpen, pvOpen = S.avOpen;
      BIOART.heart(ctx, hx, hy, sc, {
        chambers: 4,
        sat: { ra: 60, rv: 60, la: 98, lv: 98 },
        contraction: clamp(S.eLV, 0, 1),
        mvOpen: S.mvOpen, tvOpen: tvOpen, avOpen: S.avOpen, pvOpen: pvOpen,
        labels: true, leaders: true
      });

      // live LV volume, read off the ventricle itself
      ctx.font = '600 11px "IBM Plex Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)';
      const volTxt = S.Vlv.toFixed(0) + ' mL';
      ctx.strokeText(volTxt, hx + sc * 0.32, hy + sc * 0.46);
      ctx.fillStyle = '#F2E3C0'; ctx.fillText(volTxt, hx + sc * 0.32, hy + sc * 0.46);

      g.scaleBar(hx - sc * 0.5, hy + sc * 1.34, sc * 1.0, '≈ 6 cm', th['text-3']);

      /* ---- the four valves, as a state block clear of the figure ---- */
      const vs = [['mitral', S.mvOpen], ['aortic', S.avOpen],
                  ['tricuspid', tvOpen], ['pulmonary', pvOpen]];
      ctx.font = '500 9.5px "IBM Plex Mono",monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      vs.forEach((v, i) => {
        const yy = 62 + i * 15;
        ctx.fillStyle = v[1] ? th.ok : g.alpha(th['text-3'], .95);
        ctx.beginPath(); ctx.arc(16, yy, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = v[1] ? th.ok : th['text-3'];
        ctx.fillText(v[0] + (v[1] ? '  OPEN' : '  shut'), 26, yy);
      });
      ctx.fillStyle = g.alpha('#3D6FB4', 1);
      ctx.beginPath(); ctx.arc(16, 130, 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = th['text-3'];
      ctx.fillText('deoxygenated ~60%  ·  right heart', 26, 130);
      ctx.fillStyle = g.alpha('#E8455C', 1);
      ctx.beginPath(); ctx.arc(16, 145, 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = th['text-3'];
      ctx.fillText('oxygenated ~98%  ·  left heart', 26, 145);

      /* ---- magnified: the muscle that is doing the work ---- */
      const colL = W * 0.685, colR = W - 22;
      const mx0 = colL + 12, mx1 = colR - 12, myy = H * 0.32;
      const mh = Math.min(H * 0.095, 44);
      ctx.save();
      ctx.strokeStyle = g.alpha(th['text-3'], .40); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx + sc * 0.74, hy + sc * 0.24); ctx.lineTo(mx0 - 8, myy + mh * 0.7);
      ctx.stroke();
      ctx.restore();
      ctx.font = '600 10.5px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('CARDIAC MUSCLE', (colL + colR) / 2, myy - mh * 1.85);
      ctx.font = '500 9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('branched · striated · involuntary', (colL + colR) / 2, myy - mh * 1.85 + 13);
      const mc = BIOART.myocyte(ctx, mx0, mx1, myy, mh, {
        contraction: clamp(S.eLV, 0, 1), cells: 3
      });
      const tag = (x0, y0, x1, y1, text, col, align) => {
        ctx.strokeStyle = g.alpha(col, .6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = g.alpha(col, .9);
        ctx.beginPath(); ctx.arc(x0, y0, 1.9, 0, TAU); ctx.fill();
        ctx.font = '600 9px "IBM Plex Mono",monospace';
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)';
        const tx = align === 'right' ? x1 - 4 : align === 'left' ? x1 + 4 : x1;
        ctx.strokeText(text, tx, y1);
        ctx.fillStyle = col; ctx.fillText(text, tx, y1);
      };
      if (mc.discs.length)
        tag(mc.discs[0], myy - mh * 0.5, colL + 4, myy - mh * 0.95, 'intercalated disc', '#F2E3C0', 'left');
      tag(mx1 - (mx1 - mx0) * 0.10, myy - mh * 0.34, colR - 2, myy - mh * 1.30,
        'striations', '#C8606C', 'right');
      tag((mx0 + mx1) / 2, myy + mh * 0.24, (colL + colR) / 2, myy + mh * 1.15,
        'one central nucleus per cell', '#9A8FD0', 'center');
      ctx.font = '500 8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('the discs fuse the cells into one syncytium', (colL + colR) / 2, myy + mh * 1.65);
      g.scaleBar(mx0, myy + mh * 2.25, (mx1 - mx0) * 0.34, '≈ 50 µm', th['text-3']);

      /* ---- the phase, stated plainly ---- */
      ctx.font = '700 17px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(S.phase || '', 14, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(p.hr + ' bpm  ·  cycle ' + (S.tn * 100).toFixed(0) + '%  ·  ' +
        'valves open and shut on pressure alone', 14, 32);

      /* ---- the ECG, lined up with the phase the heart is in ---- */
      if (p.showECG && S.hist.length > 2) {
        const ex0 = 20, ex1 = W * 0.62, ey = H * 0.925, eh = H * 0.055;
        const t0 = S.hist[0][0], t1 = S.hist[S.hist.length - 1][0];
        const span = Math.max(t1 - t0, 1e-3);
        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex0, ey); ctx.lineTo(ex1, ey); ctx.stroke();
        ctx.strokeStyle = th.ok; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
        ctx.beginPath();
        S.hist.forEach((r, i) => {
          const x = ex0 + (r[0] - t0) / span * (ex1 - ex0);
          const y = ey - clamp(r[5], -0.4, 1.2) * eh;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.font = '600 9.5px "IBM Plex Mono",monospace';
        ctx.fillStyle = th.ok; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('ECG', ex0, ey - eh * 1.15);
        ctx.font = '500 8.5px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.fillText('P = atrial depolarisation · QRS = ventricular · T = repolarisation',
          ex0 + 34, ey - eh * 1.15);
        // the electrical event that caused the phase now on screen
        ctx.strokeStyle = g.alpha(th.text, .45); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex1, ey - eh * 1.1); ctx.lineTo(ex1, ey + eh * 0.5); ctx.stroke();
      }

      /* ---- the pressure gradient that is actually driving it ---- */
      const gx = W * 0.685 + 12, gy = H * 0.64;
      ctx.font = '600 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = th['text-2']; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('PRESSURES NOW', gx, gy - 18);
      const rows = [['left ventricle', S.Plv, th.bio], ['aorta', S.Pao, '#FFB454'],
                    ['left atrium', S.Pla, '#5A8FD8']];
      const pmax = 140;
      rows.forEach((r, i) => {
        const yy = gy + i * 22;
        ctx.font = '500 9.5px "IBM Plex Mono",monospace';
        ctx.fillStyle = th['text-3']; ctx.textBaseline = 'middle';
        ctx.fillText(r[0], gx, yy);
        const bx = gx + 90, bw2 = (W - 60) - bx;
        ctx.fillStyle = g.alpha(th['ink-700'], 1);
        ctx.fillRect(bx, yy - 5, bw2, 10);
        ctx.fillStyle = g.alpha(r[2], .9);
        ctx.fillRect(bx, yy - 5, bw2 * clamp(r[1] / pmax, 0, 1), 10);
        ctx.fillStyle = r[2]; ctx.textAlign = 'right';
        ctx.fillText(r[1].toFixed(0) + ' mmHg', W - 24, yy);
        ctx.textAlign = 'left';
      });
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

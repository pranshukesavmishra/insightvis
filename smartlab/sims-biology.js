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
     THE CIRCULATION — a closed loop, both sides of the heart
     Eight compartments in a ring: RA → RV → pulmonary arteries → pulmonary
     veins → LA → LV → systemic arteries → systemic veins → back to RA. Each
     heart chamber is a time-varying elastance, P = E(t)(V − V₀); each vessel
     bed is a compliance, P = (V − V₀)/C; flow between them is ΔP/R; and each
     of the four valves is a diode that conducts only forward — unless it is
     diseased. Blood is only ever moved, never made, so the total volume is
     conserved to the last millilitre, and that is checked on screen.
     ========================================================================= */
  const CV = {
    // chambers: Emin, V0 (mL); ventricular Emax is the contractility control
    lv: { Emin: 0.07, V0: 10, A: 0.55, B: 0.024 }, rv: { Emin: 0.035, V0: 10, Emax: 0.62 },
    la: { Emin: 0.16, Emax: 0.30, V0: 10 }, ra: { Emin: 0.10, Emax: 0.22, V0: 10 },
    // vessel beds: compliance (mL/mmHg) and unstressed volume (mL)
    sa: { C: 1.05, V0: 700 }, sv: { C: 100, V0: 2714 },
    pa: { C: 4.2, V0: 110 }, pv: { C: 11, V0: 260 },
    // resistances (mmHg·s/mL)
    Rsv: 0.030, Rpul: 0.075, Rpv: 0.012,
    Rmv: 0.0055, Rav: 0.0045, Rtv: 0.0045, Rpvl: 0.0035,
    PR: 0.16
  };
  function actHill(x, a1, a2, n1, n2) {
    const t = Math.max(x, 1e-6);
    const g1 = Math.pow(t / a1, n1), g2 = Math.pow(t / a2, n2);
    return (g1 / (1 + g1)) * (1 / (1 + g2));
  }
  const V_PK = (function () { let m = 0; for (let i = 0; i <= 800; i++) m = Math.max(m, actHill(i / 800, 0.303, 0.508, 1.32, 21.9)); return m; })();
  const A_PK = (function () { let m = 0; for (let i = 0; i <= 800; i++) m = Math.max(m, actHill(i / 800, 0.10, 0.20, 1.4, 18)); return m; })();

  function cvNew(p) {
    // a first guess; the warm-up beats settle it
    const s = { lv: 120, la: 55, rv: 125, ra: 70, sa: 830, pa: 190, pv: 360, t: 0, beat: 0 };
    s.sv = p.vol - (s.lv + s.la + s.rv + s.ra + s.sa + s.pa + s.pv);
    return s;
  }
  /* activation of ventricles and atria at time t after the QRS. Systole
     shortens with the square root of the cycle length (Bazett), so at high
     heart rates it is diastole that is squeezed — as in a real heart. */
  function cvAct(t, RR) {
    const Ts = Math.sqrt(0.833 * RR);
    /* electromechanical delay: the ventricles begin to squeeze about 35 ms
       after the QRS starts, and the atria about 30 ms after the P wave */
    const ev = actHill((t - 0.035) / Ts, 0.303, 0.508, 1.32, 21.9) / V_PK;
    let ta = t - (RR - CV.PR + 0.03);
    if (ta < 0) ta += RR;
    const ea = actHill(ta / 0.833, 0.10, 0.20, 1.4, 18) / A_PK;
    return { ev: ev, ea: ea, Ts: Ts };
  }
  function cvPress(s, p, a) {
    const Elv = CV.lv.Emin + (p.emax - CV.lv.Emin) * a.ev;
    const Erv = CV.rv.Emin + (CV.rv.Emax * p.emax / 2.6 - CV.rv.Emin) * a.ev;
    const Ela = CV.la.Emin + (CV.la.Emax - CV.la.Emin) * a.ea;
    const Era = CV.ra.Emin + (CV.ra.Emax - CV.ra.Emin) * a.ea;
    /* The relaxed ventricle is not a linear spring: its wall stiffens
       exponentially as it stretches, which is what makes the Frank–Starling
       curve bend over instead of rising forever. Contraction blends in the
       linear active stiffness on top. */
    const dV = s.lv - CV.lv.V0;
    const Plv = a.ev * p.emax * dV + (1 - a.ev) * CV.lv.A * (Math.exp(CV.lv.B * dV) - 1);
    return {
      lv: Plv, rv: Erv * (s.rv - CV.rv.V0),
      la: Ela * (s.la - CV.la.V0), ra: Era * (s.ra - CV.ra.V0),
      sa: (s.sa - CV.sa.V0) / CV.sa.C, sv: (s.sv - CV.sv.V0) / CV.sv.C,
      pa: (s.pa - CV.pa.V0) / CV.pa.C, pv: (s.pv - CV.pv.V0) / CV.pv.C,
      Elv: Elv
    };
  }
  /* flows, positive forward. A valve is a diode: forward flow through its
     resistance, nothing backwards — except a leaking mitral valve, which
     lets blood back into the atrium through the regurgitant orifice. */
  function cvFlow(P, p) {
    const f = {};
    f.tv = P.ra > P.rv ? (P.ra - P.rv) / CV.Rtv : 0;
    f.pvl = P.rv > P.pa ? (P.rv - P.pa) / CV.Rpvl : 0;
    f.pul = (P.pa - P.pv) / CV.Rpul;
    f.pvn = (P.pv - P.la) / CV.Rpv;
    f.mv = P.la > P.lv ? (P.la - P.lv) / CV.Rmv : 0;
    f.mr = P.lv > P.la ? p.mr * (P.lv - P.la) / 0.6 : 0;          // back-leak, only when shut
    f.av = P.lv > P.sa ? (P.lv - P.sa) / (CV.Rav * p.as) : 0;
    f.sys = (P.sa - P.sv) / p.afterload;
    f.ven = (P.sv - P.ra) / CV.Rsv;
    return f;
  }
  function cvStep(s, p, h) {
    const RR = 60 / p.hr;
    const a = cvAct(s.t, RR), P = cvPress(s, p, a), f = cvFlow(P, p);
    s.ra += h * (f.ven - f.tv);
    s.rv += h * (f.tv - f.pvl);
    s.pa += h * (f.pvl - f.pul);
    s.pv += h * (f.pul - f.pvn);
    s.la += h * (f.pvn - f.mv + f.mr);
    s.lv += h * (f.mv - f.av - f.mr);
    s.sa += h * (f.av - f.sys);
    s.sv += h * (f.sys - f.ven);
    s.t += h;
    let wrapped = false;
    if (s.t >= RR) { s.t -= RR; s.beat++; wrapped = true; }
    return { a: a, P: P, f: f, wrapped: wrapped };
  }
  /* run whole beats and collect what a cardiologist would measure */
  function cvBeat(s, p, h) {
    const RR = 60 / p.hr, n = Math.round(RR / h);
    const m = { edv: 0, esv: 1e9, sysA: 0, diaA: 1e9, sysPA: 0, diaPA: 1e9, laSum: 0, raSum: 0,
                lvPk: 0, rvPk: 0, fwd: 0, regurg: 0, rvIn: 0, avGrad: 0, n: 0 };
    let mvWas = null;
    for (let i = 0; i < n; i++) {
      const r = cvStep(s, p, h);
      const P = r.P, f = r.f;
      if (mvWas === true && f.mv <= 0) m.edv = s.lv;      // end-diastolic: the instant the mitral valve shuts
      mvWas = f.mv > 0;
      m.esv = Math.min(m.esv, s.lv);
      m.sysA = Math.max(m.sysA, P.sa); m.diaA = Math.min(m.diaA, P.sa);
      m.sysPA = Math.max(m.sysPA, P.pa); m.diaPA = Math.min(m.diaPA, P.pa);
      m.lvPk = Math.max(m.lvPk, P.lv); m.rvPk = Math.max(m.rvPk, P.rv);
      m.laSum += P.la; m.raSum += P.ra; m.n++;
      m.fwd += f.av * h; m.regurg += f.mr * h; m.rvIn += f.pvl * h;
      if (f.av > 0) m.avGrad = Math.max(m.avGrad, P.lv - P.sa);
    }
    if (!m.edv) m.edv = s.lv;
    m.la = m.laSum / m.n; m.ra = m.raSum / m.n;
    m.sv = m.fwd + m.regurg;              // total ejected by the ventricle
    m.fsv = m.fwd;                        // what actually reaches the aorta
    m.ef = m.sv / m.edv;
    m.co = m.fwd * p.hr / 1000;
    m.map = m.diaA + (m.sysA - m.diaA) / 3;
    m.total = s.lv + s.la + s.rv + s.ra + s.sa + s.sv + s.pa + s.pv;
    return m;
  }
  function cvSettle(p, beats) {
    const s = cvNew(p), h = 0.00025;
    let m = null;
    for (let b = 0; b < beats; b++) { s.t = 0; m = cvBeat(s, p, h); }
    return { s: s, m: m };
  }

  /* the ECG, from time since the QRS in seconds: a P wave one PR interval
     before, QRS at zero, and a T wave that ends with ventricular relaxation */
  const gss = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
  function ecgAt(t, RR, Ts) {
    const qt = 0.46 * Ts;
    let v = 0;
    [t, t - RR].forEach(u => {
      v += 0.15 * gss(u, -CV.PR + 0.045, 0.028);
      v += -0.10 * gss(u, -0.012, 0.007) + 1.00 * gss(u, 0.010, 0.009) - 0.24 * gss(u, 0.032, 0.009);
      v += 0.30 * gss(u, qt - 0.07, 0.048);
    });
    return v;
  }

  const PH = {
    as:   { n: 'Atrial systole', ncert: 'atrial systole', c: '#B98CFF', k: 'AS' },
    ivc:  { n: 'Isovolumetric contraction', ncert: 'ventricular systole begins', c: '#FF6B9D', k: 'IVC' },
    rej:  { n: 'Rapid ejection', ncert: 'ventricular systole', c: '#FF8F5A', k: 'RE' },
    redj: { n: 'Reduced ejection', ncert: 'ventricular systole', c: '#FFC24B', k: 'rE' },
    ivr:  { n: 'Isovolumetric relaxation', ncert: 'ventricular diastole begins', c: '#5AD1FF', k: 'IVR' },
    rf:   { n: 'Rapid filling', ncert: 'joint diastole', c: '#4ADE80', k: 'RF' },
    ds:   { n: 'Slow filling (diastasis)', ncert: 'joint diastole', c: '#7FA3C8', k: 'SF' }
  };
  const PH_ORDER = ['as', 'ivc', 'rej', 'redj', 'ivr', 'rf', 'ds'];

  /* a heart sound is a short, damped low-frequency burst */
  function heartThump(S, freq, amp) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = S._ac || (S._ac = new AC());
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), gn = ac.createGain(), t0 = ac.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t0);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + 0.09);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(0.5 * amp, t0 + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(gn); gn.connect(ac.destination); o.start(t0); o.stop(t0 + 0.14);
    } catch (e) { /* audio unavailable: the trace still shows the sound */ }
  }

  /* the Frank–Starling relation, measured: settle the loop at several
     blood volumes and record stroke volume against end-diastolic volume */
  function starling(p) {
    const out = [];
    for (let v = 4200; v <= 6400; v += 275) {
      const q = Object.assign({}, p, { vol: v });
      const s = cvNew(q);
      let m = null;
      for (let b = 0; b < 8; b++) { s.t = 0; m = cvBeat(s, q, 0.0005); }
      out.push([m.la, m.sv, m.fsv, m.edv]);
    }
    return out;
  }
  let STARLING_REF = null;

  /* blood-flow paths through the heart, in the heart figure's own units */
  const FLOW_R = [[-0.46, -1.34], [-0.45, -0.86], [-0.42, -0.46], [-0.35, -0.14], [-0.30, 0.18],
                  [-0.22, 0.40], [-0.10, 0.12], [-0.10, -0.36], [-0.11, -0.78], [-0.26, -1.02], [-0.48, -1.14]];
  const FLOW_R_SEG = ['ven', 'ven', 'tv', 'tv', 'tv', 'pvl', 'pvl', 'pvl', 'pvl', 'pvl'];
  const FLOW_L = [[0.98, -0.62], [0.62, -0.50], [0.38, -0.44], [0.32, -0.14], [0.30, 0.18],
                  [0.22, 0.42], [0.10, 0.14], [0.08, -0.34], [0.08, -0.82], [0.04, -1.20], [-0.10, -1.44]];
  const FLOW_L_SEG = ['pvn', 'pvn', 'mv', 'mv', 'mv', 'av', 'av', 'av', 'av', 'av'];

  function cardiacReset(S) {
    const p = S.p;
    const r = cvSettle(p, 12);
    S.s = r.s; S.m = r.m; S.s.t = 0;
    S.T = 0; S.hist = []; S.events = []; S.loop = []; S.loopPrev = []; S.phases = []; S.phasesPrev = [];
    S.valve = { mv: false, av: false, tv: false, pvl: false };
    S.acc = null; S.qmvPk = 300; S.lastPh = null; S.lvPrev = 0;
    S.particles = [];
    for (let i = 0; i < 26; i++) S.particles.push({ side: 0, u: i / 26 * 10 });
    for (let i = 0; i < 26; i++) S.particles.push({ side: 1, u: i / 26 * 10 });
    S._fsKey = null;
    S.phase = 'ds'; S.volNow = r.m.total;
  }

  L.register({
    id: 'cardiac', subject: 'biology',
    name: 'The Cardiac Cycle — Pressure, Volume, Valves and the ECG',
    chapter: 'Body Fluids & Circulation',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Valves move on pressure alone · Labels switch is below',
    lede: 'This is a <b>whole circulation</b>, not a heart on its own: right atrium, right ventricle, lungs, ' +
      'left atrium, left ventricle, the arteries and veins of the body, joined in one closed loop. Each ' +
      'chamber squeezes on the timing the ECG sets. Each of the <b>four valves</b> opens only when the pressure ' +
      'behind it is higher than the pressure in front, and nothing about when they open is scripted. The ' +
      'pressures, the volume curve, the heart sounds and the pressure–volume loop all come out of the ' +
      'simulation, and they line up the way the textbook Wiggers diagram says they must. Blood is never ' +
      'created or lost, and the lab checks that it all adds up.',

    params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0, flow: true, sound: false },

    presets: [
      { name: 'Resting adult', params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } },
      { name: 'Exercise', params: { hr: 140, emax: 4.2, afterload: 0.55, vol: 5900, as: 1, mr: 0 } },
      { name: 'Hypertension', params: { hr: 72, emax: 2.6, afterload: 1.7, vol: 5000, as: 1, mr: 0 } },
      { name: 'Heart failure', params: { hr: 90, emax: 1.2, afterload: 1.2, vol: 5200, as: 1, mr: 0 } },
      { name: 'Blood loss (500 mL)', params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 4500, as: 1, mr: 0 } },
      { name: 'Aortic stenosis', params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 25, mr: 0 } },
      { name: 'Mitral regurgitation', params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 1.2 } },
      { name: 'Slow heart (45 bpm)', params: { hr: 45, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } }
    ],

    controls: [
      { group: 'The heart', items: [
        { key: 'hr', label: 'Heart rate', min: 40, max: 180, step: 1, unit: 'bpm', fmt: v => v.toFixed(0) },
        { key: 'emax', label: 'Contractility <i>E</i><sub>max</sub>', min: 0.8, max: 5, step: 0.05,
          unit: 'mmHg/mL', fmt: v => v.toFixed(2) }
      ] },
      { group: 'The circulation', items: [
        { key: 'afterload', label: 'Resistance of the body\'s arteries', min: 0.5, max: 2.5, step: 0.05,
          unit: 'mmHg·s/mL', fmt: v => v.toFixed(2) },
        { key: 'vol', label: 'Blood volume', min: 4000, max: 6000, step: 10, unit: 'mL', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Valve disease', items: [
        { key: 'as', label: 'Aortic valve narrowing', min: 1, max: 40, step: 0.5, unit: '× resistance',
          fmt: v => v.toFixed(1) },
        { key: 'mr', label: 'Mitral valve leak', min: 0, max: 2, step: 0.05, unit: '', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Display', items: [
        { key: 'flow', type: 'toggle', label: 'Show blood moving through the heart' },
        { key: 'sound', type: 'toggle', label: 'Play the heart sounds (lub-dub)' }
      ] }
    ],

    setup(S) {
      cardiacReset(S);
      S.fs = starling(S.p);
      S._fsKey = [S.p.hr, S.p.emax, S.p.afterload, S.p.as, S.p.mr].join('|');
      if (!STARLING_REF) STARLING_REF = starling({ hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 });
      /* run one full sweep silently, so the Wiggers diagram and the PV loop
         are already drawn when the lab opens instead of starting blank */
      S._quiet = true;
      const sweep = Math.max(2 * 60 / S.p.hr, 1.7) + 0.05;
      for (let k = 0; k < Math.ceil(sweep * 60); k++) this.step(S, 1 / 60);
      S._quiet = false;
    },

    step(S, dt) {
      const p = S.p, RR = 60 / p.hr, s = S.s;
      /* the blood-volume slider adds or removes real blood, at the veins,
         as a transfusion or a bleed would; the heart then adapts beat by beat */
      const tot = s.lv + s.la + s.rv + s.ra + s.sa + s.sv + s.pa + s.pv;
      if (Math.abs(p.vol - tot) > 0.01) s.sv += p.vol - tot;
      dt = Math.min(dt, 0.12);
      const n = Math.max(1, Math.ceil(dt / 0.00025)), hs = dt / n;
      let last = null;
      const ev = (k, P) => {
        const e = { T: S.T, k: k, V: s.lv, P: P.lv };
        S.events.push(e);
        if (S.acc) {
          if (k === 'MC') S.acc.tS1 = s.t;
          if (k === 'AC') S.acc.tS2 = s.t;
          if (k === 'MC' || k === 'AO' || k === 'AC' || k === 'MO') S.acc.loopEv.push(e);
        }
        if (p.sound && !S._quiet && (k === 'MC' || k === 'AC')) heartThump(S, k === 'MC' ? 52 : 74, k === 'MC' ? 1 : 0.75);
      };
      for (let i = 0; i < n; i++) {
        const r = cvStep(s, p, hs), P = r.P, f = r.f, a = r.a;
        S.T += hs;
        if (!S.acc) S.acc = { edv: 0, esv: 1e9, sysA: 0, diaA: 1e9, sysPA: 0, diaPA: 1e9, laSum: 0, raSum: 0,
                              lvPk: 0, rvPk: 0, fwd: 0, regurg: 0, avGrad: 0, n: 0, loopEv: [], tS1: null, tS2: null,
                              qmvPk: 0 };
        const A = S.acc;
        /* valve events, debounced so a valve sitting at equal pressures does
           not chatter: a change counts only after the old state lasted 20 ms */
        const vo = { mv: f.mv > 0, av: f.av > 0, tv: f.tv > 0, pvl: f.pvl > 0 };
        S.vt = S.vt || { mv: -1, av: -1, tv: -1, pvl: -1 };
        [['mv', 'MO', 'MC'], ['av', 'AO', 'AC'], ['tv', 'TO', 'TC'], ['pvl', 'PO', 'PC']].forEach(q => {
          if (vo[q[0]] !== S.valve[q[0]]) {
            if (S.T - S.vt[q[0]] > 0.02) ev(vo[q[0]] ? q[1] : q[2], P);
            S.vt[q[0]] = S.T;
          }
        });
        if (S.valve.mv && !vo.mv) A.edv = s.lv;
        S.valve = vo;
        // the phase, from the valves and the pressures alone
        let ph;
        if (vo.av) S.ejected = true;
        if (vo.av) ph = P.lv >= S.lvPrev ? 'rej' : 'redj';
        else if (vo.mv) ph = a.ea > 0.12 ? 'as' : (f.mv > 0.35 * S.qmvPk ? 'rf' : 'ds');
        else ph = S.ejected ? 'ivr' : 'ivc';          // shut, before or after this beat's ejection
        S.lvPrev = P.lv;
        if (ph !== S.lastPh) { S.phases.push([s.t / RR, ph]); S.lastPh = ph; }
        S.phase = ph;
        // what a cardiologist would measure over this beat
        A.esv = Math.min(A.esv, s.lv);
        A.sysA = Math.max(A.sysA, P.sa); A.diaA = Math.min(A.diaA, P.sa);
        A.sysPA = Math.max(A.sysPA, P.pa); A.diaPA = Math.min(A.diaPA, P.pa);
        A.lvPk = Math.max(A.lvPk, P.lv); A.rvPk = Math.max(A.rvPk, P.rv);
        A.laSum += P.la; A.raSum += P.ra; A.n++;
        A.fwd += f.av * hs; A.regurg += f.mr * hs;
        A.qmvPk = Math.max(A.qmvPk, f.mv);
        if (f.av > 0) A.avGrad = Math.max(A.avGrad, P.lv - P.sa);
        if (i % 4 === 0) S.loop.push([s.lv, P.lv, ph]);
        S._since = (S._since || 0) + hs;
        if (S._since >= 0.0025) {
          S._since = 0;
          const mur = (p.as > 1.5 ? f.av / 450 * Math.min(1, (p.as - 1) / 12) : 0) + (p.mr > 0.02 ? f.mr / 180 : 0);
          S.hist.push({ T: S.T, plv: P.lv, pao: P.sa, pla: P.la, prv: P.rv, ppa: P.pa, vlv: s.lv,
                        ecg: ecgAt(s.t, RR, a.Ts), ph: ph, mur: Math.min(1.2, mur) });
        }
        if (r.wrapped) {
          if (A.edv > 0 && A.n > 50) {
            const m = { edv: A.edv, esv: A.esv, sysA: A.sysA, diaA: A.diaA, sysPA: A.sysPA, diaPA: A.diaPA,
                        la: A.laSum / A.n, ra: A.raSum / A.n, lvPk: A.lvPk, rvPk: A.rvPk,
                        fwd: A.fwd, regurg: A.regurg, avGrad: A.avGrad };
            m.sv = m.fwd + m.regurg; m.fsv = m.fwd; m.ef = m.sv / m.edv; m.co = m.fwd * p.hr / 1000;
            m.map = m.diaA + (m.sysA - m.diaA) / 3;
            m.total = s.lv + s.la + s.rv + s.ra + s.sa + s.sv + s.pa + s.pv;
            m.tSys = A.tS1 != null && A.tS2 != null ? A.tS2 - A.tS1 + (A.tS2 < A.tS1 ? RR : 0) : null;
            S.m = m;
          }
          S.qmvPk = A.qmvPk || S.qmvPk;
          S.loopPrev = S.loop; S.loop = [];
          S.loopEvPrev = A.loopEv;
          S.phasesPrev = S.phases; S.phases = [[0, ph]];
          S.acc = null; S.ejected = false;
        }
        last = { r: r, a: a, P: P, f: f };
      }
      if (!last) return;
      S.P = last.P; S.f = last.f; S.ev = last.a.ev; S.ea = last.a.ea; S.Ts = last.a.Ts;
      const keep = Math.max(2 * RR, 1.7) + 0.3;
      while (S.hist.length > 2 && S.hist[0].T < S.T - keep) S.hist.shift();
      while (S.events.length && S.events[0].T < S.T - keep) S.events.shift();
      // blood moving through the heart: each dot is pushed by the flow in its own segment
      const F = last.f;
      S.particles.forEach(q => {
        const seg = (q.side ? FLOW_L_SEG : FLOW_R_SEG)[Math.min(9, Math.floor(q.u))];
        const Q = seg === 'ven' ? F.ven : seg === 'pvn' ? F.pvn : F[seg] || 0;
        q.u += dt * Q * 0.0042;
        /* flow can reverse: a badly leaking mitral valve pushes blood back up
           the pulmonary veins in systole. The dots move back with it, but not
           out of the drawing. */
        if (q.u >= 10) q.u -= 10;
        if (q.u < 0) q.u = 0;
      });
      // the Frank–Starling curve follows the controls, recomputed once they settle
      const key = [p.hr, p.emax, p.afterload, p.as, p.mr].join('|');
      if (key !== S._fsKey) {
        if (S._fsWant !== key) { S._fsWant = key; S._fsWantT = S.T; }
        else if (S.T - S._fsWantT > 0.35) { S.fs = starling(p); S._fsKey = key; }
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const RR = 60 / p.hr, P = S.P, s = S.s;
      if (!P) return;
      const labels = g.labels !== false;
      const narrow = W < 700;
      const ph = PH[S.phase] || PH.ds;
      const cLV = '#FF6B9D', cAo = '#FFB454', cLA = '#6FA8F0', cRV = '#B98CFF', cPA = '#7CE0A8';
      const mono = (wt, sz) => wt + ' ' + sz + 'px "IBM Plex Mono",monospace';

      /* ---------- zones: they are laid out, never overlapped ---------- */
      const Z = narrow
        ? { hx0: 0, hx1: W, hy0: 70, hy1: H * 0.56, wx0: 12, wx1: W - 12, wy0: H * 0.60, wy1: H - 33 }
        : { hx0: 0, hx1: W * 0.46, hy0: 74, hy1: H - 30, wx0: W * 0.485, wx1: W - 14, wy0: 28, wy1: H - 32 };

      /* ---------- the phase, named, and where we are in the beat ---------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 18px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = ph.c; ctx.fillText(ph.n, 14, 10);
      ctx.font = mono(500, 9.5); ctx.fillStyle = th['text-3'];
      ctx.fillText('NCERT: ' + ph.ncert + '  ·  ' + p.hr + ' bpm  ·  ' +
        (s.t * 1000).toFixed(0) + ' ms after the QRS', 14, 32);
      {
        const rx0 = 14, rx1 = (narrow ? W : Z.hx1) - 14, ry = 50, rh = 13;
        const segs = S.phasesPrev && S.phasesPrev.length ? S.phasesPrev : S.phases;
        ctx.fillStyle = g.alpha(th['ink-700'], 1); ctx.fillRect(rx0, ry, rx1 - rx0, rh);
        segs.forEach((q, i) => {
          const a = q[0], b = i + 1 < segs.length ? segs[i + 1][0] : 1;
          if (b - a < 0.004) return;
          const x0 = rx0 + a * (rx1 - rx0), x1 = rx0 + b * (rx1 - rx0);
          ctx.fillStyle = g.alpha(PH[q[1]].c, q[1] === S.phase ? 0.95 : 0.55);
          ctx.fillRect(x0, ry, x1 - x0, rh);
          if (labels && x1 - x0 > 26) {
            ctx.font = mono(700, 8.5); ctx.fillStyle = '#0B1020'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(PH[q[1]].k, (x0 + x1) / 2, ry + rh / 2 + 0.5);
          }
        });
        const cx = rx0 + (s.t / RR) * (rx1 - rx0);
        ctx.strokeStyle = th.text; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, ry - 3); ctx.lineTo(cx, ry + rh + 3); ctx.stroke();
        ctx.font = mono(500, 8.5); ctx.fillStyle = th['text-3']; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('QRS', rx0, ry + rh + 3);
        ctx.textAlign = 'right'; ctx.fillText('next QRS · one beat = ' + (RR * 1000).toFixed(0) + ' ms', rx1, ry + rh + 3);
      }

      /* ---------- the heart: all four valves from the model ---------- */
      {
        const zw = Z.hx1 - Z.hx0, zh = Z.hy1 - Z.hy0;
        const sc = narrow ? Math.min(zw * 0.22, zh * 0.36) : Math.min(zw * 0.225, zh * 0.30);
        const hx = Z.hx0 + zw * (narrow ? 0.5 : 0.555), hy = Z.hy0 + zh * 0.52;
        BIOART.heart(ctx, hx, hy, sc, {
          chambers: 4, sat: { ra: 65, rv: 65, la: 98, lv: 98 },
          contraction: clamp(S.ev, 0, 1),
          mvOpen: S.valve.mv, tvOpen: S.valve.tv, avOpen: S.valve.av, pvOpen: S.valve.pvl,
          labels: labels, leaders: labels && !narrow
        });
        // the blood itself, pushed along by the computed flows
        if (p.flow) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          S.particles.forEach(q => {
            const path = q.side ? FLOW_L : FLOW_R;
            const k = Math.min(9, Math.floor(q.u)), f = q.u - k;
            const x = hx + sc * (path[k][0] + (path[k + 1][0] - path[k][0]) * f);
            const y = hy + sc * (path[k][1] + (path[k + 1][1] - path[k][1]) * f);
            const col = q.side ? '#FF5E6E' : '#5E8CFF';
            const gr = ctx.createRadialGradient(x, y, 0, x, y, 5);
            gr.addColorStop(0, g.alpha(col, 0.95)); gr.addColorStop(1, g.alpha(col, 0));
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
          });
          ctx.restore();
        }
        // live chamber numbers, only where there is room for them
        if (labels && sc > 62) {
          const tag = (x, y, txt, col, al) => {
            ctx.font = mono(600, 9.5); ctx.textAlign = al; ctx.textBaseline = 'middle';
            ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.9)'; ctx.strokeText(txt, x, y);
            ctx.fillStyle = col; ctx.fillText(txt, x, y);
          };
          tag(hx + sc * 0.32, hy + sc * 0.40, P.lv.toFixed(0) + ' mmHg', cLV, 'center');
          tag(hx + sc * 0.32, hy + sc * 0.53, s.lv.toFixed(0) + ' mL', '#F2E3C0', 'center');
          tag(hx - sc * 0.30, hy + sc * 0.46, P.rv.toFixed(0) + ' mmHg', cRV, 'center');
        }
        // the four valves, in words, in one line under the heart
        const vs = [['tricuspid', S.valve.tv], ['pulmonary', S.valve.pvl], ['mitral', S.valve.mv], ['aortic', S.valve.av]];
        const vy = Math.min(Z.hy1 - 6, hy + sc * (narrow ? 1.18 : 1.30));
        ctx.font = mono(600, 9); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        const tw = vs.map(v => ctx.measureText(v[0] + (v[1] ? ' open' : ' shut')).width + 22);
        let vx = hx - tw.reduce((a, b) => a + b, 0) / 2;
        vs.forEach((v, i) => {
          ctx.fillStyle = v[1] ? th.ok : g.alpha(th['text-3'], .9);
          ctx.beginPath(); ctx.arc(vx + 4, vy, 3.4, 0, TAU); ctx.fill();
          ctx.fillStyle = v[1] ? th.ok : th['text-3'];
          ctx.fillText(v[0] + (v[1] ? ' open' : ' shut'), vx + 11, vy);
          vx += tw[i];
        });
      }

      /* ---------- the Wiggers diagram, drawn live as a sweep ---------- */
      {
        const x0 = Z.wx0, x1 = Z.wx1, span = Math.max(2 * RR, 1.7);
        /* on a phone the heart-sound strip is dropped so the other three stay
           readable; the sounds can still be heard, and MC and AC mark them */
        const strips = narrow
          ? [['PRESSURE · mmHg', 0.50], ['LV VOLUME · mL', 0.26], ['ECG', 0.24]]
          : [['PRESSURE · mmHg', 0.44], ['LEFT VENTRICLE VOLUME · mL', 0.20], ['ECG', 0.17], ['HEART SOUNDS', 0.19]];
        const gap = 10, tot = Z.wy1 - Z.wy0 - gap * (strips.length - 1);
        let yy = Z.wy0;
        const box = strips.map(q => { const b = { t: q[0], y0: yy, y1: yy + tot * q[1] }; yy = b.y1 + gap; return b; });
        const xOf = T => x0 + ((T % span + span) % span) / span * (x1 - x0);
        const Tn = S.T, vis = S.hist.filter(q => q.T > Tn - span * 0.93);
        // phase bands behind every strip, so the diagram reads column by column
        for (let i = 1; i < vis.length; i++) {
          const a = xOf(vis[i - 1].T), b = xOf(vis[i].T);
          if (b < a) continue;
          ctx.fillStyle = g.alpha(PH[vis[i].ph].c, 0.075);
          ctx.fillRect(a, Z.wy0, b - a + 0.6, Z.wy1 - Z.wy0);
        }
        box.forEach(b => {
          ctx.strokeStyle = g.alpha(th.line, 0.9); ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 0.5, b.y0 + 0.5, x1 - x0 - 1, b.y1 - b.y0 - 1);
          ctx.font = mono(500, 8.5); ctx.fillStyle = th['text-3']; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(b.t, x0 + 6, b.y0 + 4);
        });
        const trace = (bx, val, lo, hi, col, w, alpha) => {
          ctx.save();
          ctx.beginPath(); ctx.rect(x0, bx.y0, x1 - x0, bx.y1 - bx.y0); ctx.clip();
          ctx.strokeStyle = g.alpha(col, alpha == null ? 1 : alpha); ctx.lineWidth = w; ctx.lineJoin = 'round';
          ctx.beginPath();
          let px = -1;
          vis.forEach(q => {
            const x = xOf(q.T), y = bx.y1 - 6 - (val(q) - lo) / (hi - lo) * (bx.y1 - bx.y0 - 20);
            if (x < px || px < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            px = x;
          });
          ctx.stroke(); ctx.restore();
        };
        const m = S.m;
        const pHi = Math.max(140, (m ? m.lvPk : 130) * 1.12);
        trace(box[0], q => q.ppa, 0, pHi, cPA, 1.2, 0.55);
        trace(box[0], q => q.prv, 0, pHi, cRV, 1.2, 0.55);
        trace(box[0], q => q.pla, 0, pHi, cLA, 1.6);
        trace(box[0], q => q.pao, 0, pHi, cAo, 1.9);
        trace(box[0], q => q.plv, 0, pHi, cLV, 2.3);
        const vLo = m ? Math.max(0, m.esv - 25) : 20, vHi = m ? m.edv + 25 : 180;
        trace(box[1], q => q.vlv, vLo, vHi, '#F2E3C0', 2);
        trace(box[2], q => q.ecg, -0.45, 1.25, th.ok, 1.6);
        // heart sounds: a damped burst at every valve closure, and a murmur where flow is turbulent
        if (box[3]) {
          const bx = box[3], mid = (bx.y0 + bx.y1) / 2 + 5, amp = (bx.y1 - bx.y0) * 0.36;
          const closes = S.events.filter(e => e.k === 'MC' || e.k === 'TC' || e.k === 'AC' || e.k === 'PC');
          ctx.save();
          ctx.beginPath(); ctx.rect(x0, bx.y0, x1 - x0, bx.y1 - bx.y0); ctx.clip();
          ctx.strokeStyle = '#E6ECF8'; ctx.lineWidth = 1.1;
          ctx.beginPath();
          let px = -1;
          vis.forEach(q => {
            let v = 0;
            closes.forEach(e => {
              const d = q.T - e.T;
              if (d >= 0 && d < 0.12) {
                const A = e.k === 'MC' ? 1 : e.k === 'AC' ? 0.8 : e.k === 'TC' ? 0.55 : 0.45;
                v += A * Math.exp(-d / 0.022) * Math.sin(TAU * 48 * d);
              }
            });
            v += q.mur * 0.45 * Math.sin(q.T * 911) * Math.sin(q.T * 377 + 1.3);
            const x = xOf(q.T), y = mid - clamp(v, -1.3, 1.3) * amp;
            if (x < px || px < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            px = x;
          });
          ctx.stroke(); ctx.restore();
          if (labels) closes.forEach(e => {
            if (e.T < Tn - span * 0.93 || (e.k !== 'MC' && e.k !== 'AC')) return;
            ctx.font = mono(700, 9); ctx.fillStyle = e.k === 'MC' ? cLV : cAo; ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(e.k === 'MC' ? 'S1 lub' : 'S2 dub', xOf(e.T) + 14, bx.y0 + 14);
          });
        }
        // valve events, through every strip at once: the Wiggers diagram's spine
        S.events.forEach(e => {
          if (e.T < Tn - span * 0.93) return;
          if (!/^(MC|AO|AC|MO)$/.test(e.k)) return;
          const x = xOf(e.T);
          ctx.save();
          ctx.strokeStyle = g.alpha('#E6ECF8', .28); ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, Z.wy0); ctx.lineTo(x, Z.wy1); ctx.stroke();
          ctx.restore();
          if (labels) {
            ctx.font = mono(700, 8.5); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.9)';
            ctx.strokeText(e.k, x, Z.wy0 - 13);
            ctx.fillStyle = e.k[0] === 'M' ? cLA : cAo; ctx.fillText(e.k, x, Z.wy0 - 13);
          }
        });
        // the sweep cursor
        const cx = xOf(Tn);
        ctx.strokeStyle = g.alpha(th.text, .7); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx, Z.wy0); ctx.lineTo(cx, Z.wy1); ctx.stroke();
        // legend and live values for the pressure strip
        {
          const b = box[0], items = [['LV', P.lv, cLV], ['aorta', P.sa, cAo], ['LA', P.la, cLA],
                                     ['RV', P.rv, cRV], ['pulm. artery', P.pa, cPA]];
          ctx.font = mono(600, 8.5); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          let lx = x1 - 6;
          items.slice().reverse().forEach(it => {
            const t = it[0] + ' ' + it[1].toFixed(0);
            ctx.fillStyle = it[2]; ctx.fillText(t, lx, b.y0 + 4);
            lx -= ctx.measureText(t).width + 10;
          });
        }
        if (m) {
          const b = box[1];
          ctx.font = mono(500, 8.5); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = th['text-2'];
          ctx.fillText('EDV ' + m.edv.toFixed(0) + '  ·  ESV ' + m.esv.toFixed(0) + '  ·  SV ' + m.sv.toFixed(0),
                       x1 - 6, b.y0 + 4);
        }
      }
    },

    plots: [
      { title: 'Pressure–volume loop of the left ventricle, coloured by phase',
        legend: PH_ORDER.map(k => ({ c: PH[k].c, label: PH[k].k + ' ' + PH[k].n.toLowerCase() })),
        draw(S, g) {
          const p = S.p, m = S.m || {};
          const xmax = Math.max(200, (m.edv || 150) + 40), ymax = Math.max(160, (m.lvPk || 130) * 1.18);
          const P = g.Plot({ xmin: 0, xmax: xmax, ymin: 0, ymax: ymax,
            xlabel: 'LV volume (mL)', ylabel: 'LV pressure (mmHg)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          const loop = S.loopPrev && S.loopPrev.length > 10 ? S.loopPrev : S.loop;
          P.clip(() => {
            // the two boundaries the loop lives between
            const V0 = CV.lv.V0;
            P.line([[V0, 0], [V0 + ymax / p.emax, ymax]], g.alpha(g.theme['text-2'], .75), 1.3, [6, 4]);
            const ed = [];
            for (let v = V0; v <= xmax; v += 2) ed.push([v, CV.lv.A * (Math.exp(CV.lv.B * (v - V0)) - 1)]);
            P.line(ed, g.alpha(g.theme['text-3'], .85), 1.3, [3, 4]);
            let seg = [], ph = null;
            const flush = () => { if (seg.length > 1) P.line(seg, PH[ph].c, 2.6); };
            loop.forEach(q => {
              if (q[2] !== ph) { flush(); seg = seg.length ? [seg[seg.length - 1]] : []; ph = q[2]; }
              seg.push([q[0], q[1]]);
            });
            flush();
            if (S.loop.length > 2 && loop !== S.loop) P.line(S.loop.map(q => [q[0], q[1]]), g.alpha(g.theme.text, .35), 1);
            if (S.P) P.dot(S.s.lv, S.P.lv, 5, g.theme.text, g.theme['ink-950']);
            (S.loopEvPrev || []).forEach(e => P.dot(e.V, e.P, 3.8, '#E6ECF8', g.theme['ink-950']));
          });
          if (g.labels !== false) {
            (S.loopEvPrev || []).forEach(e => {
              const up = e.k === 'AO' || e.k === 'AC';
              P.tag(e.V, e.P, e.k, '#E6ECF8', e.k === 'MC' || e.k === 'AO' ? 'left' : 'right', up ? -10 : 12);
            });
            P.tag(CV.lv.V0 + ymax * 0.93 / p.emax - 2, ymax * 0.93, 'end-systolic line · slope = contractility',
                  g.theme['text-2'], 'right', 0);
            const vx = Math.min(xmax * 0.97, CV.lv.V0 + Math.log(1 + ymax * 0.22 / CV.lv.A) / CV.lv.B);
            P.tag(vx, ymax * 0.22, 'relaxed wall: stiffens as it stretches', g.theme['text-3'], 'right', -8);
            if (m.sv) P.tag((m.edv + m.esv) / 2, (m.lvPk || 100) * 0.45, '← stroke volume ' + m.sv.toFixed(0) + ' mL →',
                            g.theme.text, 'center', 0);
          }
        },
        hover(S, x) {
          const loop = S.loopPrev || [];
          let best = null;
          loop.forEach(q => { if (!best || Math.abs(q[0] - x) < Math.abs(best[0] - x)) best = q; });
          if (!best) return null;
          return [{ label: 'volume', value: best[0].toFixed(0) + ' mL' },
                  { label: 'pressure', value: best[1].toFixed(0) + ' mmHg', color: PH[best[2]].c },
                  { label: 'phase', value: PH[best[2]].n }];
        } },

      { title: 'Frank–Starling — stroke volume against filling pressure, measured by the model',
        legend: [{ c: '#FF6B9D', label: 'this heart' }, { c: '#63729A', label: 'normal heart' },
                 { c: '#FFB454', label: 'reaching the aorta (if the mitral leaks)' }],
        draw(S, g) {
          const fs = S.fs || [], ref = STARLING_REF || [], m = S.m || {};
          const all = fs.concat(ref);
          const xmax = Math.max(24, Math.max.apply(null, all.map(q => q[0]).concat([m.la || 0])) * 1.06);
          const ymax = Math.max(120, Math.max.apply(null, all.map(q => q[1]).concat([m.sv || 0])) * 1.15);
          const P = g.Plot({ xmin: 0, xmax: xmax, ymin: 0, ymax: ymax,
            xlabel: 'filling pressure — mean left atrial (mmHg)', ylabel: 'stroke volume (mL)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0) }).frame();
          P.clip(() => {
            if (ref.length) P.line(ref.map(q => [q[0], q[1]]), g.alpha('#63729A', 1), 1.6, [5, 4]);
            if (fs.length) {
              P.line(fs.map(q => [q[0], q[1]]), g.theme.bio, 2.4);
              if (S.p.mr > 0.02) P.line(fs.map(q => [q[0], q[2]]), '#FFB454', 1.8);
              fs.forEach(q => P.dot(q[0], q[1], 2.6, g.theme.bio, g.theme['ink-950']));
            }
            P.vline(18, g.alpha(g.theme.crit, .55), [4, 4]);
            if (m.la) P.dot(m.la, m.sv, 5.5, g.theme.text, g.theme['ink-950']);
          });
          if (g.labels !== false) {
            if (m.la) P.tag(m.la, m.sv, 'now', g.theme.text, 'left', -10);
            P.tag(18.3, ymax * 0.08, 'above ~18 mmHg fluid leaks into the lungs', g.theme.crit, 'left', 0);
          }
        } }
    ],

    readouts(S) {
      const p = S.p, m = S.m || {};
      const RR = 60 / p.hr;
      const out = [
        { label: 'End-diastolic volume', value: (m.edv || 0).toFixed(0), unit: 'mL', hint: 'filled, just as the mitral shuts' },
        { label: 'End-systolic volume', value: (m.esv || 0).toFixed(0), unit: 'mL', hint: 'left after ejection' },
        { label: 'Stroke volume', value: (m.sv || 0).toFixed(0), unit: 'mL', flag: 'accent', hint: 'EDV − ESV' },
        { label: 'Ejection fraction', value: ((m.ef || 0) * 100).toFixed(0), unit: '%',
          flag: m.ef < 0.40 ? 'crit' : m.ef < 0.50 ? 'warn' : 'ok', hint: 'normal 55–70%' },
        { label: 'Cardiac output', value: (m.co || 0).toFixed(2), unit: 'L/min', flag: 'accent',
          hint: 'forward SV × HR' },
        { label: 'Blood pressure', value: (m.sysA || 0).toFixed(0) + '/' + (m.diaA || 0).toFixed(0), unit: 'mmHg',
          hint: 'mean ' + (m.map || 0).toFixed(0) },
        { label: 'Lung artery pressure', value: (m.sysPA || 0).toFixed(0) + '/' + (m.diaPA || 0).toFixed(0),
          unit: 'mmHg', hint: 'right heart: a fifth of the left' },
        { label: 'Left atrial pressure', value: (m.la || 0).toFixed(1), unit: 'mmHg',
          flag: m.la > 15 ? 'crit' : undefined, hint: m.la > 15 ? 'high: fluid backs up into the lungs' : 'mean' },
        { label: 'Systole · S1 to S2', value: m.tSys ? (m.tSys * 1000).toFixed(0) : '—', unit: 'ms',
          hint: m.tSys ? 'diastole ' + ((RR - m.tSys) * 1000).toFixed(0) + ' ms' : 'measuring' },
        { label: 'Blood volume, checked', value: (m.total || p.vol).toFixed(1), unit: 'mL', flag: 'ok',
          hint: 'moved, never made or lost' }
      ];
      if (p.mr > 0.02) out.push({ label: 'Leaks back through mitral', value: (m.regurg || 0).toFixed(0), unit: 'mL/beat',
        flag: 'crit', hint: ((m.regurg || 0) / Math.max(m.sv || 1, 1) * 100).toFixed(0) + '% of what the LV pumps' });
      if (p.as > 1.5) out.push({ label: 'Pressure lost across aortic valve', value: (m.avGrad || 0).toFixed(0), unit: 'mmHg',
        flag: m.avGrad > 40 ? 'crit' : 'warn', hint: 'peak LV − aortic, same instant' });
      return out;
    },

    equation(S) {
      const p = S.p, m = S.m || {};
      return 'CO ' + E.op('=') + ' SV ' + E.op('×') + ' HR ' + E.op('=') + ' ' + E.n((m.fsv || 0).toFixed(1), 'mL') +
        E.op('×') + ' ' + E.n(p.hr, '/min') + ' ' + E.op('=') + ' ' + E.n((m.co || 0).toFixed(2), 'L/min') +
        '<br>EF ' + E.op('=') + ' ' + E.frac('EDV ' + E.op('−') + ' ESV', 'EDV') + ' ' + E.op('=') + ' ' +
        E.frac(E.n((m.edv || 0).toFixed(0), '') + E.op('−') + E.n((m.esv || 0).toFixed(0), ''), E.n((m.edv || 0).toFixed(0), '')) +
        ' ' + E.op('=') + ' ' + E.n(((m.ef || 0) * 100).toFixed(1), '%') +
        '<br>MAP ' + E.op('≈') + ' DBP ' + E.op('+') + ' ' + E.frac('SBP ' + E.op('−') + ' DBP', '3') + ' ' + E.op('=') + ' ' +
        E.n((m.map || 0).toFixed(0), 'mmHg') + E.op('·') + ' a valve opens only when ' + E.v('P') + E.sub('behind') +
        ' ' + E.op('>') + ' ' + E.v('P') + E.sub('in front');
    },

    eqNote: '<b>One rule runs the whole cycle: blood moves from high pressure to low, and a valve opens only ' +
      'when the pressure behind it is higher than the pressure in front.</b> On the Wiggers diagram every valve ' +
      'event is a crossing of two pressure curves. The mitral valve shuts (MC) when LV pressure rises above LA ' +
      'pressure, the aortic valve opens (AO) when LV pressure passes aortic pressure, and so on around the ' +
      'beat. The heart sounds are those closures: <b>S1 "lub"</b> when the AV valves shut, and <b>S2 "dub"</b> ' +
      'when the semilunar valves shut. The ECG comes <i>before</i> each event, because electrical activity ' +
      'triggers the contraction.',

    problems: [
      { source: 'NEET pattern · ejection fraction',
        q: 'The lab\'s resting heart fills to an end-diastolic volume of 131.4 mL and empties to an end-systolic volume of 59.2 mL. What is its ejection fraction, in per cent?',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 },
        predict: { label: 'ejection fraction', unit: '%', tol: 0.03 },
        measure: S => S.m.ef * 100,
        working: 'SV = EDV − ESV = 131.4 − 59.2 = 72.2 mL, and EF = SV/EDV = 72.2/131.4 = <b>54.9%</b>. That is at the ' +
          'bottom of the normal 55–70% range. The ventricle never empties: nearly half its blood stays behind ' +
          'every beat as a reserve that exercise can draw on.' },
      { source: 'NEET pattern · cardiac output',
        q: 'The same heart ejects 72.2 mL per beat at 72 beats per minute. What is its cardiac output, in litres per minute?',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 },
        predict: { label: 'cardiac output', unit: 'L/min', tol: 0.02 },
        measure: S => S.m.co,
        working: 'CO = SV × HR = 72.2 mL × 72 /min = 5198 mL/min = <b>5.20 L/min</b>. The whole 5 L of blood goes ' +
          'round the body about once a minute. The right ventricle pumps exactly the same amount into the lungs; ' +
          'the lab checks this, because in a closed loop it cannot be otherwise for long.' },
      { source: 'NEET pattern · mean arterial pressure',
        q: 'The lab reads a blood pressure of 129.5/85.7 mmHg. Estimate the mean arterial pressure, in mmHg.',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 },
        predict: { label: 'mean arterial pressure', unit: 'mmHg', tol: 0.02 },
        measure: S => S.m.map,
        working: 'MAP ≈ DBP + (SBP − DBP)/3 = 85.7 + 43.8/3 = <b>100.3 mmHg</b>. It is not the simple average (107.6), ' +
          'because the heart spends about two thirds of each beat in diastole, when the pressure is near the ' +
          'lower value.' },
      { source: 'JEE/NEET extension · a leaking mitral valve',
        q: 'With the mitral leak set to 1.2, the left ventricle pumps 117.1 mL per beat, but 60.6 mL of it goes backwards into the left atrium. What percentage of each beat leaks back?',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 1.2 },
        predict: { label: 'fraction leaking back', unit: '%', tol: 0.03 },
        measure: S => S.m.regurg / S.m.sv * 100,
        working: '60.6/117.1 = <b>51.7%</b> of every beat goes the wrong way. The trap is the ejection fraction: it ' +
          'reads a healthy-looking 77%, because the ventricle does empty — but half of it into the atrium. ' +
          'The forward stroke volume is only 56.5 mL, and the cardiac output falls to 4.07 L/min.' },
      { source: 'NEET pattern · output in exercise',
        q: 'In the exercise preset the heart beats at 140 per minute and ejects 84.7 mL per beat. What is the cardiac output, in litres per minute?',
        params: { hr: 140, emax: 4.2, afterload: 0.55, vol: 5900, as: 1, mr: 0 },
        predict: { label: 'cardiac output', unit: 'L/min', tol: 0.02 },
        measure: S => S.m.co,
        working: 'CO = 84.7 × 140 = 11 858 mL/min = <b>11.9 L/min</b>, more than double the resting value. Both ' +
          'factors rose. Faster rate is the bigger one; stronger contraction (a steeper end-systolic line on the ' +
          'PV loop) and more venous return kept the stroke volume up even though diastole became very short.' }
    ],

    walkthrough: [
      { title: '1 · One rule for all four valves',
        body: 'Watch the pressure strip and the dashed vertical lines. Each is labelled with the valve event it marks.',
        ask: 'What makes the mitral valve shut (MC) at exactly that instant?',
        reveal: 'The <b>LV pressure (pink) climbs past the LA pressure (blue)</b>. Nothing else is involved. The ' +
          'aortic valve opens (AO) where pink passes orange, shuts (AC) where it falls back below, and the ' +
          'mitral reopens (MO) where pink drops under blue. Every valve event on the Wiggers diagram is a ' +
          'crossing of two curves.',
        params: { hr: 60, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } },
      { title: '2 · Squeezing without emptying',
        body: 'Look at the volume strip between MC and AO, and at the matching vertical edge of the PV loop.',
        ask: 'Pressure rises steeply there. Why does the volume not change at all?',
        reveal: 'Both valves are shut, so blood has nowhere to go. That is <b>isovolumetric contraction</b>. The ' +
          'muscle turns its effort into pressure until LV pressure beats aortic pressure. The same happens in ' +
          'reverse between AC and MO: isovolumetric relaxation.',
        params: { hr: 60, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } },
      { title: '3 · Lub and dub',
        body: 'Tick "Play the heart sounds" and watch the bottom strip.',
        ask: 'Which valves make the first sound, and which the second?',
        reveal: '<b>S1, "lub", is the AV valves (mitral and tricuspid) shutting</b> at the start of ventricular ' +
          'systole. <b>S2, "dub", is the semilunar valves (aortic and pulmonary) shutting</b> at its end. Opening ' +
          'valves make no sound. The time from S1 to S2 is systole, shown in the readouts.',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0, sound: true } },
      { title: '4 · Electrical first, mechanical second',
        body: 'Compare the ECG strip with the pressure strip.',
        ask: 'Does the QRS come before or after the LV pressure starts to rise?',
        reveal: '<b>Before.</b> QRS is ventricular depolarisation, the trigger, and contraction follows. The P ' +
          'wave comes before atrial systole (the small bump in LV volume at the end of filling), and the T ' +
          'wave comes before relaxation. Atrial repolarisation has no wave of its own: it is hidden inside the QRS.',
        params: { hr: 60, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } },
      { title: '5 · More in, more out — Frank–Starling',
        body: 'Raise the blood volume slider slowly and watch the dot move on the second graph.',
        ask: 'The contractility control has not changed. Why does the stroke volume rise?',
        reveal: 'More blood returns, so the ventricle fills further (EDV rises) and its stretched fibres contract ' +
          'harder. That is the <b>Frank–Starling law</b>: the heart pumps out what comes in. The two sides of the ' +
          'heart stay balanced this way without any nerves telling them to.',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5600, as: 1, mr: 0 } },
      { title: '6 · Fast hearts steal from diastole',
        body: 'Push the heart rate to 150 and watch the phase ribbon under the title.',
        ask: 'Which part of the beat gets shorter: systole or diastole?',
        reveal: '<b>Mostly diastole.</b> Systole shortens only a little; the filling phases collapse. At very high ' +
          'rates the ventricle has no time to fill, the stroke volume falls, and cardiac output stops rising. ' +
          'This is also why the heart muscle, which is fed during diastole, suffers first at high rates.',
        params: { hr: 150, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 0 } },
      { title: '7 · A leaking valve fools the ejection fraction',
        body: 'Load the mitral regurgitation preset. Watch the heart-sound strip and the readouts.',
        ask: 'EF is 77%, higher than normal. Is this heart pumping well?',
        reveal: '<b>No.</b> Half of every beat goes backwards into the left atrium, which is why LA pressure ' +
          'climbs and a murmur fills the whole of systole. Forward output has fallen. EF counts blood leaving ' +
          'the ventricle, not blood reaching the body.',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 5000, as: 1, mr: 1.2 } },
      { title: '8 · Rescue a bleeding patient',
        body: 'Load "Blood loss". Blood pressure falls to about 83/55 — this model has no reflexes.',
        ask: 'Using only heart rate and the resistance of the arteries, can you bring the pressure back towards normal?',
        reveal: 'Raising both works: that is exactly what the <b>baroreceptor reflex</b> does, through the ' +
          'sympathetic nerves — faster heart, narrower arterioles. Notice what it cannot do: it cannot restore ' +
          'the lost filling, so the stroke volume stays low. Only replacing the blood (raise the volume) fixes that.',
        params: { hr: 72, emax: 2.6, afterload: 1.2, vol: 4500, as: 1, mr: 0 } }
    ],

    quiz: [
      { q: 'The first heart sound "lubb" is produced by:',
        options: ['closure of the semilunar valves', 'closure of the atrioventricular valves',
                  'opening of the AV valves', 'atrial contraction'], answer: 1,
        why: 'The mitral and tricuspid valves snap shut when ventricular pressure rises above atrial pressure at the start of systole. The semilunar valves shutting at the end of systole give "dupp".' },
      { q: 'During isovolumetric ventricular contraction:',
        options: ['both AV and semilunar valves are open', 'both are closed',
                  'only the AV valves are open', 'only the semilunar valves are open'], answer: 1,
        why: 'With every valve shut no blood can enter or leave, so pressure rises at constant volume.' },
      { q: 'Stroke volume is 70 mL and heart rate is 72 bpm. Cardiac output is:',
        options: ['about 5.0 L/min', 'about 0.5 L/min', 'about 50 L/min', 'about 1.4 L/min'], answer: 0,
        why: 'CO = SV × HR = 70 × 72 = 5040 mL/min ≈ 5 L/min.' },
      { q: 'If EDV is 120 mL and ESV is 50 mL, the ejection fraction is:',
        options: ['42%', '58%', '70%', '120%'], answer: 1,
        why: 'SV = 70 mL, and EF = 70/120 = 58%.' },
      { q: 'On a normal ECG, atrial repolarisation:',
        options: ['is the T wave', 'is the P wave', 'is hidden within the QRS complex', 'does not occur'], answer: 2,
        why: 'It happens, but it coincides with the far larger ventricular depolarisation and is masked by the QRS.' },
      { q: 'When the heart rate rises from 70 to 150 bpm, the phase that shortens most is:',
        options: ['ventricular ejection', 'isovolumetric contraction', 'ventricular filling (diastole)', 'none — all shorten equally'], answer: 2,
        why: 'Systole shortens only slightly; most of the time saved comes out of diastole, which limits filling at very high rates.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>CO = SV × HR and EF = SV/EDV: direct numericals, most years.</li>' +
      '<li>The order of events in one beat, and which valves are open in each phase. NCERT splits the cycle ' +
      'into joint diastole, atrial systole and ventricular systole; the Wiggers diagram splits the same beat ' +
      'into seven phases.</li>' +
      '<li>Heart sounds: lub = AV valves closing, dub = semilunar valves closing.</li>' +
      '<li>ECG waves: P = atrial depolarisation, QRS = ventricular depolarisation, T = ventricular ' +
      'repolarisation; the P–Q interval is the delay at the AV node.</li>' +
      '<li>Normal values: about 120/80 mmHg, EDV about 130 mL, stroke volume about 70 mL, cardiac output ' +
      'about 5 L/min, a cycle of 0.8 s at 72 bpm.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Valves open and close <b>passively</b>, on pressure differences ' +
      'alone. No nerve and no muscle opens a heart valve. The papillary muscles and chordae tendineae only stop ' +
      'the AV valves being pushed back into the atria.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>"Lub" is not atrial contraction and "dub" is not ventricular ' +
      'contraction. Both sounds are valves <b>closing</b>.</div>'
  });


})(window.InsightLab);

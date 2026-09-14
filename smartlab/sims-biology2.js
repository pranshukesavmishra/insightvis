/* ============================================================
   BIOLOGY (depth) — 11. Synaptic transmission & summation
                     12. Cardiac conduction system & arrhythmias
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;

  /* =========================================================================
     11 · CHEMICAL SYNAPSE — quantal release, summation and pharmacology
     Release follows the real fourth-power dependence on external Ca²⁺
     (Dodge & Rahamimoff), and the post-synaptic cell integrates a genuine
     conductance-based membrane equation.
     ========================================================================= */
  const EL_S = -70, VTH = -55, VRESET = -72, C_S = 1, GL_S = 0.05;

  L.register({
    id: 'synapse', subject: 'biology',
    name: 'The Synapse — Quantal Release, Summation and Drugs',
    chapter: 'Neural Control & Coordination',
    exams: ['NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Every vesicle you see fuse was drawn from the computed release probability',
    lede: 'An action potential cannot jump a synaptic cleft — it has to be converted into a chemical signal ' +
      'and back again. That conversion is where almost every drug, toxin and neurological disease acts. ' +
      'This lab runs the real chain: <b>Ca²⁺ entry → quantal vesicle release → transmitter in the cleft → ' +
      'receptor conductance → EPSP</b>, and the post-synaptic cell fires only when summation carries it past ' +
      'threshold.',

    params: { rate: 45, nSyn: 4, ca: 2.0, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 0 },

    presets: [
      { name: 'Single weak input', params: { rate: 12, nSyn: 1, ca: 2, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Temporal summation', params: { rate: 90, nSyn: 2, ca: 2, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Spatial summation', params: { rate: 20, nSyn: 9, ca: 2, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Low Ca²⁺ — release fails', params: { rate: 60, nSyn: 5, ca: 0.6, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Curare (receptor block)', params: { rate: 60, nSyn: 5, ca: 2, ache: 100, curare: 75, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Neostigmine (AChE inhibited)', params: { rate: 25, nSyn: 3, ca: 2, ache: 12, curare: 0, botox: 0, type: 'exc', inhib: 0 } },
      { name: 'Botulinum (no release)', params: { rate: 60, nSyn: 6, ca: 2, ache: 100, curare: 0, botox: 88, type: 'exc', inhib: 0 } },
      { name: 'Inhibition wins', params: { rate: 60, nSyn: 5, ca: 2, ache: 100, curare: 0, botox: 0, type: 'exc', inhib: 6 } }
    ],

    controls: [
      { group: 'Presynaptic input', items: [
        { key: 'rate', label: 'Firing rate', min: 2, max: 200, step: 1, unit: 'Hz', fmt: v => v.toFixed(0) },
        { key: 'nSyn', label: 'Excitatory synapses (spatial)', min: 1, max: 12, step: 1, unit: '',
          fmt: v => v.toFixed(0) },
        { key: 'inhib', label: 'Inhibitory synapses', min: 0, max: 10, step: 1, unit: '', fmt: v => v.toFixed(0) },
        { key: 'ca', label: 'External [Ca²⁺]', min: 0.1, max: 5, step: 0.05, unit: 'mM', fmt: v => v.toFixed(2) }
      ] },
      { group: 'Pharmacology', items: [
        { key: 'curare', label: 'Curare — blocks receptors', min: 0, max: 100, step: 1, unit: '%',
          fmt: v => v.toFixed(0) },
        { key: 'botox', label: 'Botulinum — blocks release', min: 0, max: 100, step: 1, unit: '%',
          fmt: v => v.toFixed(0) },
        { key: 'ache', label: 'Acetylcholinesterase activity', min: 3, max: 100, step: 1, unit: '%',
          fmt: v => v.toFixed(0) }
      ] }
    ],

    setup(S) {
      S.V = EL_S; S.T = 0; S.Ti = 0;
      S.tms = 0; S.next = 0; S.nextI = 0;
      S.hist = []; S.thist = [];
      S.vesicles = []; S.nt = [];
      S.spikes = 0; S.inputs = 0; S.lastQ = 0;
      S.fired = 0; S.flash = 0;
    },

    step(S, dt) {
      const p = S.p;
      const msPerSec = 200;                       // 5× slow motion
      const total = dt * msPerSec;
      const h = 0.05;
      let n = clamp(Math.ceil(total / h), 1, 400);
      const hs = total / n;

      const interval = 1000 / p.rate;
      // Dodge–Rahamimoff: quanta released rise as the fourth power of [Ca²⁺]
      const K = 1.6;
      const ca4 = Math.pow(p.ca, 4) / (Math.pow(p.ca, 4) + Math.pow(K, 4));
      const quanta = 14 * ca4 * (1 - p.botox / 100);
      S.quanta = quanta;
      const tauT = 1.1 / (0.12 + (p.ache / 100) * 1.5);   // ms — slower clearance when AChE is inhibited

      for (let i = 0; i < n; i++) {
        if (S.tms >= S.next) {
          S.next = S.tms + interval;
          S.inputs++;
          S.T += quanta * 0.075 * p.nSyn;
          S.lastQ = quanta;
          for (let k = 0; k < Math.min(6, Math.round(quanta / 2.2)); k++)
            S.vesicles.push({ u: 0, j: Math.random() - 0.5, lane: Math.floor(Math.random() * Math.max(1, p.nSyn)) });
          for (let k = 0; k < Math.min(26, Math.round(quanta * 1.6)); k++)
            S.nt.push({ u: 0, j: Math.random() - 0.5, sp: 0.7 + Math.random() * 0.8, lane: Math.floor(Math.random() * Math.max(1, p.nSyn)) });
        }
        if (p.inhib > 0 && S.tms >= S.nextI) {
          S.nextI = S.tms + interval;
          S.Ti += 0.075 * 10 * p.inhib;
        }

        S.T = Math.max(0, S.T - hs * S.T / tauT);
        S.Ti = Math.max(0, S.Ti - hs * S.Ti / 1.6);

        const occ = S.T / (S.T + 1.0);
        const gE = 0.004 * occ * 10 * (1 - p.curare / 100);
        const gI = 0.004 * (S.Ti / (S.Ti + 1.0)) * 10;
        S.gE = gE; S.gI = gI;

        const dV = (-GL_S * (S.V - EL_S) - gE * (S.V - 0) - gI * (S.V - (-75))) / C_S;
        S.V += hs * dV;
        if (S.V > VTH) { S.V = 28; S.spikes++; S.flash = 1; }
        if (S.V > 20) S.V = VRESET;
        S.tms += hs;
      }

      S.flash = Math.max(0, S.flash - dt * 3.2);
      S.hist.push([S.tms, clamp(S.V, -90, 30)]);
      while (S.hist.length > 2 && S.hist[0][0] < S.tms - 320) S.hist.shift();
      S.thist.push([S.tms, S.T, S.Ti]);
      while (S.thist.length > 2 && S.thist[0][0] < S.tms - 320) S.thist.shift();

      S.vesicles.forEach(v => v.u += dt * 1.9);
      S.vesicles = S.vesicles.filter(v => v.u < 1);
      S.nt.forEach(o => o.u += dt * 1.5 * o.sp);
      S.nt = S.nt.filter(o => o.u < 1);
      if (S.nt.length > 240) S.nt.splice(0, S.nt.length - 240);
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const bio = th.bio, Z = window.ZOOART, RXo = window.RX;

      /* ---- plate frame ----
         The header band is reserved first and every structure is laid out
         below it, so nothing in the figure can ever reach the title. */
      const HDR = 54, FOOT = 22;
      const y0 = HDR, y1 = H - FOOT;
      const knobH = Math.min(70, (y1 - y0) * 0.19);
      const preY = y0 + knobH * 1.32;
      const postY = y0 + (y1 - y0) * 0.52;
      const x0 = W * 0.17, x1 = W * 0.72;

      const nSyn = Math.max(1, p.nSyn | 0);
      const laneW = (x1 - x0) / nSyn;
      const knobW = Math.min(laneW * 0.82, 150);
      const cleftTop = preY + knobH * 0.5 + 2;
      const memY = postY - 16;
      const laneX = i => x0 + (i + 0.5) * laneW;
      // the end plate runs off both edges — a muscle fibre does not stop at
      // a rectangle, and the hard border was what made it read as pasted on
      const mL = -30, mR = W + 30;

      const caOpen = clamp(p.ca / 3, 0, 1);
      for (let i = 0; i < nSyn; i++) {
        const cx = laneX(i);
        const K = BIOART.synapticKnob(ctx, cx, preY, knobW, knobH, { axonTop: y0 + 4 });

        // reserve pool of vesicles waiting in the terminal
        for (let q = 0; q < 9; q++) {
          const a = q * 2.399;                          // golden-angle scatter
          const rr = knobW * 0.21 * Math.sqrt(q / 9);
          const vx = cx + Math.cos(a) * rr + knobW * 0.12;
          const vy = preY + knobH * 0.02 + Math.sin(a) * rr * 0.7;
          RXo.ball(ctx, vx, vy, knobH * 0.085, bio, { rim: 0.4 });
        }

        // voltage-gated Ca²⁺ channels in the active zone
        for (let q = 0; q < 4; q++) {
          const chx = cx + (q - 1.5) * knobW * 0.20;
          const ch = c => {
            c.beginPath();
            if (c.roundRect) c.roundRect(chx - 5.5, K.bottom - 6, 11, 11, 2.5);
            else c.rect(chx - 5.5, K.bottom - 6, 11, 11);
          };
          RXo.volume(ctx, ch, { fill: g.mix('#2C5A48', '#7CE0A8', caOpen) === null ? '#7CE0A8'
                                  : RXo.mix('#2C5A48', '#7CE0A8', caOpen),
                                r: 7, cx: chx, cy: K.bottom - 0.5,
                                gloss: 0.35, contour: 1 });
        }
        // the active zone itself — the thickened patch vesicles dock at
        ctx.fillStyle = g.alpha('#9FD8FF', .34);
        ctx.fillRect(cx - knobW * 0.36, K.bottom - 1, knobW * 0.72, 2.5);
      }

      // vesicles migrating to the active zone and fusing with the membrane
      S.vesicles.forEach(v => {
        const cx = laneX(Math.min(v.lane, nSyn - 1));
        const vx = cx + v.j * knobW * 0.34;
        const vy = (preY - knobH * 0.22) + v.u * (knobH * 0.72);
        const r = knobH * 0.085 * (1 - v.u * 0.45);
        ctx.save(); ctx.globalAlpha = 1 - v.u * 0.3;
        if (v.u < 0.85) {
          RXo.ball(ctx, vx, vy, r, bio, { rim: 0.5 });
        } else {                                        // the omega figure
          ctx.strokeStyle = g.alpha(bio, .95); ctx.lineWidth = 1.8;
          ctx.fillStyle = g.alpha(bio, .34);
          ctx.beginPath(); ctx.arc(vx, vy, r, Math.PI * 0.15, Math.PI * 0.85, true);
          ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      });

      /* ---- synaptic cleft ---- */
      const mh = Math.min(24, H * 0.055), mDrop = mh * 1.5;
      const domeY = xx => memY + mDrop * Math.pow(2 * ((xx - mL) / (mR - mL)) - 1, 2);
      ctx.fillStyle = g.alpha(th['ink-900'], .55);
      ctx.beginPath();
      ctx.moveTo(mL, cleftTop); ctx.lineTo(mR, cleftTop);
      for (let q = 60; q >= 0; q--) { const xx = mL + (mR - mL) * q / 60; ctx.lineTo(xx, domeY(xx)); }
      ctx.closePath(); ctx.fill();

      // acetylcholine diffusing across
      S.nt.forEach(o => {
        const cx = laneX(Math.min(o.lane == null ? 0 : o.lane, nSyn - 1));
        const nx = cx + o.j * knobW * 0.62;
        const ny = cleftTop + 2 + o.u * (domeY(nx) - cleftTop - 4);
        ctx.fillStyle = g.alpha(bio, 0.9 * (1 - o.u * 0.3));
        ctx.beginPath(); ctx.arc(nx, ny, 2.8, 0, TAU); ctx.fill();
      });

      /* ---- postsynaptic membrane with its receptors ---- */
      const occ = S.T / (S.T + 1.0), bound = occ * (1 - p.curare / 100);
      BIOART.postsynapticMembrane(ctx, mL, mR, memY, {
        occupancy: occ, blocked: p.curare / 100, h: mh, n: 13,
        depth: Math.max(mh * 3, y1 + FOOT - memY - mDrop + 30)
      });

      /* ---- leader labels on the structures themselves ----
         The left margin is a fixed column of rows, so two captions can
         never land on the same line however the layout scales. */
      {
        const kx = laneX(0), lx = Math.max(10, kx - knobW * 0.86);
        const cy2 = (cleftTop + memY) / 2;
        const rx = laneX(0) - knobW * 0.92, ry = domeY(rx);
        Z.leader(ctx, kx - knobW * 0.30, preY - knobH * 0.10, lx + 4, preY - knobH * 0.44, '#8FB6E8');
        Z.lbl(ctx, lx, preY - knobH * 0.52, 'presynaptic terminal', '#8FB6E8', 'left', 9.5);
        Z.leader(ctx, kx - knobW * 0.50, cy2, lx + 4, cy2, th['text-3']);
        Z.lbl(ctx, lx, cy2 - 6, 'synaptic cleft', th['text-2'], 'left', 9.5);
        Z.lbl(ctx, lx, cy2 + 7, '≈ 20 nm', th['text-3'], 'left', 9);
        Z.leader(ctx, rx, ry, Math.max(10, rx - 42) + 4, ry + mDrop * 1.05, '#FF9BC1');
        Z.lbl(ctx, Math.max(10, rx - 42), ry + mDrop * 1.05 + 8, 'nicotinic ACh receptor',
              '#FF9BC1', 'left', 9.5);
        Z.lbl(ctx, Math.max(10, rx - 42), ry + mDrop * 1.05 + 20,
              (bound * 100).toFixed(0) + '% activated',
              p.curare > 0 ? th.crit : th['text-2'], 'left', 9);
        if (p.curare > 0) Z.lbl(ctx, Math.max(10, rx - 42), ry + mDrop * 1.05 + 32,
              p.curare + '% curare-blocked', th.crit, 'left', 9);
        // the calcium caption belongs on the other flank, clear of the column
        const kx2 = laneX(nSyn - 1), rxx = Math.min(W - 12, kx2 + knobW * 0.62);
        Z.leader(ctx, kx2 + knobW * 0.28, preY + knobH * 0.46, rxx - 4, preY + knobH * 0.80, '#7CE0A8');
        Z.lbl(ctx, rxx, preY + knobH * 0.88, 'Ca²⁺ channels', '#7CE0A8', 'right', 9.5);
        Z.lbl(ctx, rxx, preY + knobH * 0.88 + 12, '[Ca²⁺]o = ' + p.ca.toFixed(2) + ' mM',
              '#7CE0A8', 'right', 9);
      }
      g.scaleBar(14, y1 + 6, knobW * 0.55, '≈ 0.5 µm', th['text-3']);

      /* ---- magnified inset: one receptor, at the moment of binding ---- */
      {
        const iw = Math.min(W * 0.19, 158), ih = Math.min((y1 - y0) * 0.34, 112);
        const ix = W - iw - 12, iy = y1 - ih - 4;
        ctx.save();
        ctx.fillStyle = g.alpha('#080C16', .90);
        ctx.strokeStyle = g.alpha(bio, .40); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.clip();
        Z.lbl(ctx, ix + 8, iy + 11, '×40  ONE RECEPTOR', th['text-3'], 'left', 8.5);
        // a slab of bilayer with a single receptor standing in it
        const bY = iy + ih * 0.60, bx2 = ix + iw * 0.5;
        BIOART.postsynapticMembrane(ctx, ix - iw * 0.55, ix + iw * 1.55, bY - ih * 0.10, {
          occupancy: occ, blocked: p.curare / 100, h: mh * 1.5, n: 3,
          depth: ih * 0.9
        });
        // the two ACh molecules that have to bind before the gate opens
        const lit = occ > 0.15 && p.curare < 50;
        [-1, 1].forEach(sg => {
          const ax = bx2 + sg * iw * 0.085;
          RXo.ball(ctx, ax, bY - ih * 0.30 - (lit ? 0 : ih * 0.16), 4.2,
                   lit ? '#FFE9A8' : bio, { rim: 0 });
        });
        Z.lbl(ctx, ix + iw * 0.5, iy + ih - 9,
              p.curare >= 50 ? 'curare occupies the site'
                             : lit ? '2 ACh bound → gate open' : 'gate shut — no ACh',
              p.curare >= 50 ? th.crit : lit ? th.ok : th['text-3'], 'center', 8.5);
        ctx.restore();
      }

      /* ---- postsynaptic cell body, above the end plate on the right ---- */
      const br = Math.min(W * 0.075, 38);
      const bx = W - br - 26, by = y0 + br + 6;
      const t = clamp((S.V + 80) / 110, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br * (1.3 + S.flash));
      rg.addColorStop(0, g.alpha(bio, .18 + .7 * S.flash));
      rg.addColorStop(1, g.alpha(bio, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, br * (1.3 + S.flash), 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(W * 0.80, domeY(W * 0.80)); ctx.lineTo(bx - br * 0.4, by + br * 0.8);
      ctx.stroke(); ctx.setLineDash([]);
      RXo.ball(ctx, bx, by, br, RXo.mix('#16263F', '#FFD36B', t), { rim: 0.8 });
      Z.lbl(ctx, bx, by, S.V.toFixed(0) + ' mV', '#F2F6FF', 'center', 11);
      Z.lbl(ctx, bx, by + br + 10, 'Vm · postsynaptic cell', th['text-3'], 'center', 9);

      /* ---- inhibitory inputs ---- */
      if (p.inhib > 0) {
        ctx.strokeStyle = g.alpha('#5AA9FF', .8); ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - br - 30, by + br * 0.9); ctx.lineTo(bx - br * 0.7, by + br * 0.5);
        ctx.stroke();
        Z.lbl(ctx, bx - br - 34, by + br * 0.9, p.inhib + '× IPSP', '#5AA9FF', 'right', 9.5);
      }

      /* ---- headline ---- */
      ctx.font = '700 15px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const firing = S.spikes > 0 && S.tms > 40;
      ctx.fillText(firing ? 'POSTSYNAPTIC CELL IS FIRING' : 'SUBTHRESHOLD — no output spike', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace';
      ctx.fillStyle = firing ? th.ok : th['text-3'];
      ctx.fillText(S.quanta.toFixed(1) + ' quanta per impulse   ·   ' +
        (S.inputs ? (S.spikes / Math.max(1, S.inputs) * 100).toFixed(0) : '0') +
        '% of inputs produced an output spike', 14, 29);
      ctx.textAlign = 'left';
      ctx.fillStyle = th['text-3'];
      ctx.fillText(nSyn + ' presynaptic terminal' + (nSyn > 1 ? 's' : '') + '  ·  ' +
        p.rate + ' Hz', 14, 41);
    },
    plots: [
      { title: 'Postsynaptic membrane potential — summation towards threshold',
        legend: [{ c: '#FF6B9D', label: 'Vm' }, { c: '#63729A', label: 'threshold −55 mV' }],
        draw(S, g) {
          if (!S.hist.length) return;
          const t1 = Math.max(320, S.tms);
          const P = g.Plot({
            xmin: t1 - 320, xmax: t1, ymin: -90, ymax: 35,
            xlabel: 'time (ms)', ylabel: 'Vm (mV)',
            yticks: [-85, -70, -55, -40, 0, 30],
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(VTH, g.alpha(g.theme['text-3'], .95), [4, 3]);
            P.hline(EL_S, g.alpha(g.theme['text-3'], .45), [2, 5]);
            P.area(S.hist, -90, g.alpha(g.theme.bio, .10));
            P.line(S.hist, g.theme.bio, 2);
          });
          P.tag(P.cfg.xmin, VTH, 'threshold', g.theme['text-2'], 'left', -8);
          P.tag(P.cfg.xmin, EL_S, 'rest −70', g.theme['text-3'], 'left', 9);
        },
        hover(S, x) {
          const r = S.hist.reduce((b, q) => Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b, S.hist[0] || [0, 0]);
          return [{ label: 'time', value: r[0].toFixed(1) + ' ms' },
                  { label: 'Vm', value: r[1].toFixed(1) + ' mV', color: '#FF6B9D' },
                  { label: 'distance to threshold', value: (VTH - r[1]).toFixed(1) + ' mV' }];
        } },
      { title: 'Transmitter in the cleft — how fast it is cleared decides summation',
        legend: [{ c: '#FF6B9D', label: 'excitatory transmitter' }, { c: '#5AA9FF', label: 'inhibitory' }],
        draw(S, g) {
          if (!S.thist.length) return;
          const t1 = Math.max(320, S.tms);
          const mx = Math.max(2, S.thist.reduce((m, r) => Math.max(m, r[1], r[2]), 0) * 1.15);
          const P = g.Plot({
            xmin: t1 - 320, xmax: t1, ymin: 0, ymax: mx,
            xlabel: 'time (ms)', ylabel: 'cleft concentration (a.u.)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.area(S.thist.map(r => [r[0], r[1]]), 0, g.alpha(g.theme.bio, .14));
            P.line(S.thist.map(r => [r[0], r[1]]), g.theme.bio, 2);
            if (S.p.inhib > 0) P.line(S.thist.map(r => [r[0], r[2]]), '#5AA9FF', 2);
          });
        } }
    ],

    readouts(S) {
      const p = S.p;
      const occ = S.T / (S.T + 1.0);
      const eff = S.inputs ? S.spikes / S.inputs : 0;
      return [
        { label: 'Quanta per impulse', value: (S.quanta || 0).toFixed(1), unit: '', flag: 'accent',
          hint: '∝ [Ca²⁺]⁴' },
        { label: 'Receptor occupancy', value: (occ * 100).toFixed(0), unit: '%' },
        { label: 'Effective (unblocked)', value: (occ * (1 - p.curare / 100) * 100).toFixed(0), unit: '%',
          flag: p.curare > 50 ? 'crit' : '' },
        { label: 'Postsynaptic Vm', value: S.V.toFixed(1), unit: 'mV', flag: 'accent' },
        { label: 'Output spikes', value: String(S.spikes), unit: '' },
        { label: 'Input impulses', value: String(S.inputs), unit: '' },
        { label: 'Transmission ratio', value: (eff * 100).toFixed(0), unit: '%',
          flag: eff > 0.5 ? 'ok' : eff > 0 ? 'warn' : 'crit',
          hint: eff > 0 ? 'synapse is transmitting' : 'transmission has failed' },
        { label: 'Synaptic conductance', value: (S.gE || 0).toFixed(3), unit: 'mS/cm²' },
        { label: 'Excitatory inputs', value: String(p.nSyn), unit: '', hint: 'spatial summation' },
        { label: 'Inhibitory inputs', value: String(p.inhib), unit: '',
          flag: p.inhib > 0 ? 'warn' : '', hint: p.inhib ? 'IPSPs oppose' : 'none' },
        { label: 'Interval between inputs', value: (1000 / p.rate).toFixed(1), unit: 'ms',
          hint: 'temporal summation if < ~15 ms' },
        { label: 'Transmitter half-life', value: (1.1 / (0.12 + p.ache / 100 * 1.5) * 0.69).toFixed(2),
          unit: 'ms', flag: p.ache < 30 ? 'warn' : '', hint: p.ache < 30 ? 'AChE inhibited' : 'normal clearance' }
      ];
    },

    equation(S) {
      const p = S.p;
      return 'quanta ' + E.op('∝') + ' ' + E.frac('[Ca<sup>2+</sup>]<sup>4</sup>',
        '[Ca<sup>2+</sup>]<sup>4</sup> ' + E.op('+') + ' ' + E.v('K') + '<sup>4</sup>') +
        ' ' + E.op('=') + ' ' + E.frac(E.n(p.ca, 'mM') + '<sup>4</sup>', E.n(p.ca, '') + '<sup>4</sup>+1.6<sup>4</sup>') +
        ' ' + E.op('→') + ' ' + E.n((S.quanta || 0).toFixed(1), ' quanta') +
        '<br>' + E.v('C') + E.frac('d' + E.v('V'), 'd' + E.v('t')) + ' ' + E.op('=') + ' ' +
        E.op('−') + E.v('g') + '<sub>L</sub>(' + E.v('V') + E.op('−') + E.v('E') + '<sub>L</sub>)' +
        E.op('−') + E.v('g') + '<sub>syn</sub>(' + E.v('V') + E.op('−') + E.v('E') + '<sub>syn</sub>)' +
        '<br>' + E.v('V') + ' ' + E.op('=') + ' ' + E.n(S.V.toFixed(1), 'mV') + E.op(',') +
        ' threshold ' + E.op('=') + ' ' + E.n('−55', 'mV') + E.op('·') +
        ' ' + E.v('g') + '<sub>syn</sub> ' + E.op('=') + ' ' + E.n((S.gE || 0).toFixed(3), 'mS/cm²');
    },
    eqNote: '<b>The fourth power is the whole reason Ca²⁺ matters so much.</b> Halving external calcium does not ' +
      'halve the release — it cuts it by roughly sixteen times. This steepness is why a small change in ' +
      'presynaptic calcium is such a powerful way for the nervous system (and for drugs) to control transmission.',

    walkthrough: [
      { title: '1 · One input is never enough',
        body: 'A single synapse firing slowly produces small EPSPs that decay away between impulses.',
        ask: 'Why does one excitatory synapse almost never make a neuron fire?',
        reveal: 'A single EPSP is only a few millivolts, and the membrane needs about <b>15 mV</b> of depolarisation to reach threshold. The cell is a <b>summing device</b>, not a relay — it needs many inputs, or one input arriving rapidly.',
        params: { rate: 12, nSyn: 1, ca: 2, ache: 100, curare: 0, botox: 0, inhib: 0 } },
      { title: '2 · Temporal summation',
        body: 'Keep a single pair of synapses but push the firing rate right up.',
        ask: 'Why does firing faster work when firing harder would not?',
        reveal: 'Each EPSP decays over about 20 ms. If the next impulse arrives <b>before the last one has decayed</b>, they add. This is <b>temporal summation</b> — the same synapse, stacking its own effects in time.',
        params: { rate: 110, nSyn: 2, ca: 2, ache: 100, curare: 0, botox: 0, inhib: 0 } },
      { title: '3 · Spatial summation',
        body: 'Now drop the rate back down and instead increase the number of excitatory synapses.',
        ask: 'How is this different from temporal summation?',
        reveal: 'Here <b>many different synapses fire at once</b> and their EPSPs add at the cell body. Real neurons use both together — thousands of inputs, each weak, integrated in space and time. That integration <i>is</i> the computation a neuron performs.',
        params: { rate: 20, nSyn: 10, ca: 2, ache: 100, curare: 0, botox: 0, inhib: 0 } },
      { title: '4 · Calcium controls release',
        body: 'With a strong input running, pull the external calcium down from 2 mM to 0.6 mM.',
        ask: 'Release collapses far faster than the calcium falls. Why?',
        reveal: 'Release depends on roughly the <b>fourth power</b> of [Ca²⁺], because about four calcium ions must bind the sensor protein to trigger fusion. Cutting calcium to a third cuts release by around eighty times — which is why calcium-channel blockers are such effective neuromuscular depressants.',
        params: { rate: 60, nSyn: 6, ca: 0.6, ache: 100, curare: 0, botox: 0, inhib: 0 } },
      { title: '5 · Three drugs, three different targets',
        body: 'Try curare, then botulinum, then neostigmine, watching where in the chain each one acts.',
        ask: 'Curare and botulinum both cause paralysis. What is the difference?',
        reveal: '<b>Botulinum acts presynaptically</b> — it stops vesicles fusing, so no transmitter is released at all. <b>Curare acts postsynaptically</b> — transmitter is released normally but cannot bind, because the receptors are occupied by a competitive antagonist. <b>Neostigmine</b> does the opposite: it blocks the enzyme that clears acetylcholine, so transmitter lingers and summation becomes much easier — which is why it treats myasthenia gravis.',
        params: { rate: 25, nSyn: 3, ca: 2, ache: 12, curare: 0, botox: 0, inhib: 0 } },
      { title: '6 · Inhibition',
        body: 'Add inhibitory synapses alongside the excitatory ones.',
        ask: 'How does an IPSP stop the cell firing?',
        reveal: 'Inhibitory transmitters open channels with a reversal potential <b>below</b> threshold (Cl⁻ or K⁺), so they pull the membrane away from firing and also shunt the excitatory current. The neuron fires only when excitation <b>minus</b> inhibition crosses threshold — the real arithmetic every neuron performs.',
        params: { rate: 60, nSyn: 5, ca: 2, ache: 100, curare: 0, botox: 0, inhib: 6 } }
    ],

    quiz: [
      { q: 'Neurotransmitter release at a synapse is triggered directly by the influx of:',
        options: ['Na⁺', 'K⁺', 'Ca²⁺', 'Cl⁻'], answer: 2,
        why: 'Depolarisation opens voltage-gated Ca²⁺ channels in the terminal; calcium entry is what makes vesicles fuse with the membrane.' },
      { q: 'Curare causes paralysis because it:',
        options: ['prevents vesicle fusion', 'competitively blocks postsynaptic acetylcholine receptors',
                  'inhibits acetylcholinesterase', 'blocks Ca²⁺ channels'], answer: 1,
        why: 'Curare is a competitive antagonist at the nicotinic receptor. Acetylcholine is still released normally but has nowhere to bind.' },
      { q: 'Two impulses arriving at the same synapse 5 ms apart produce a larger depolarisation than one. This is:',
        options: ['spatial summation', 'temporal summation', 'saltatory conduction', 'accommodation'], answer: 1,
        why: 'Same synapse, successive impulses close together in time — the second EPSP builds on the undecayed remains of the first.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Sequence of events at a synapse — a NEET favourite, usually as an ordering question.</li>' +
      '<li>Role of Ca²⁺, and the difference between electrical and chemical synapses.</li>' +
      '<li>Drug and toxin actions: curare, botulinum, organophosphates, neostigmine.</li>' +
      '<li>Temporal vs spatial summation, and EPSP vs IPSP.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Synaptic transmission is <b>one-way</b>, and not because of the cleft. ' +
      'It is because only the presynaptic terminal has vesicles and only the postsynaptic membrane has receptors — ' +
      'a structural asymmetry, not a barrier.</div>'
  });

  /* =========================================================================
     12 · CARDIAC CONDUCTION SYSTEM & ARRHYTHMIAS
     ========================================================================= */
  const gauss = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

  L.register({
    id: 'conduction', subject: 'biology',
    name: 'Cardiac Conduction System & Heart Block',
    chapter: 'Body Fluids & Circulation',
    exams: ['NEET UG'],
    weight: 'High yield',
    is3D: false,
    stageHint: 'The ladder diagram shows every impulse — watch which ones get through the AV node',
    lede: 'The heart generates its own rhythm. The SA node fires, the impulse crawls through the AV node ' +
      '(the deliberate delay that lets the atria finish emptying), then races down the bundle of His and the ' +
      'Purkinje fibres. Break the AV node and the ventricles fall back on their own slower pacemaker. ' +
      'This lab drives a real <b>event-driven conduction model</b> and builds the ECG from what actually conducted.',

    params: { sa: 75, block: 'none', bbb: false, vagal: 0, symp: 0, ectopic: 0 },

    presets: [
      { name: 'Normal sinus rhythm', params: { sa: 75, block: 'none', bbb: false, vagal: 0, symp: 0, ectopic: 0 } },
      { name: 'First-degree block', params: { sa: 75, block: 'first', bbb: false } },
      { name: 'Wenckebach (Mobitz I)', params: { sa: 78, block: 'wenck', bbb: false } },
      { name: 'Mobitz II 2:1', params: { sa: 80, block: 'mobitz2', bbb: false } },
      { name: 'Complete heart block', params: { sa: 80, block: 'third', bbb: false } },
      { name: 'Bundle branch block', params: { sa: 75, block: 'none', bbb: true } },
      { name: 'Vagal slowing', params: { sa: 75, block: 'none', vagal: 70, symp: 0 } },
      { name: 'Sympathetic drive', params: { sa: 75, block: 'none', vagal: 0, symp: 80 } }
    ],

    controls: [
      { group: 'Pacemaker', items: [
        { key: 'sa', label: 'Intrinsic SA rate', min: 50, max: 110, step: 1, unit: 'bpm', fmt: v => v.toFixed(0) },
        { key: 'vagal', label: 'Vagal (parasympathetic) tone', min: 0, max: 100, step: 1, unit: '%',
          fmt: v => v.toFixed(0) },
        { key: 'symp', label: 'Sympathetic tone', min: 0, max: 100, step: 1, unit: '%', fmt: v => v.toFixed(0) }
      ] },
      { group: 'Conduction pathology', items: [
        { key: 'block', type: 'select', label: 'AV node', restructure: true, options: [
          { value: 'none', label: 'Normal' }, { value: 'first', label: '1°' },
          { value: 'wenck', label: 'Mobitz I' }, { value: 'mobitz2', label: 'Mobitz II' },
          { value: 'third', label: 'Complete' }] },
        { key: 'bbb', type: 'toggle', label: 'Bundle branch block (wide QRS)' },
        { key: 'ectopic', label: 'Ectopic ventricular beats', min: 0, max: 40, step: 1, unit: '%',
          fmt: v => v.toFixed(0) }
      ] }
    ],

    setup(S) {
      S.t = 0; S.nextSA = 0.4; S.nextEsc = 0.9;
      S.events = [];          // {kind:'P'|'QRS', t, wide, escape}
      S.beats = [];           // {n, pr, rr, conducted}
      S.beatN = 0; S.wenckN = 0; S.m2N = 0;
      S.lastQRS = -9; S.lastP = -9;
      S.pending = [];
      S.ecgHist = [];
    },

    step(S, dt) {
      const p = S.p;
      const hr = clamp(p.sa * (1 + p.symp / 100 * 0.75) * (1 - p.vagal / 100 * 0.42), 25, 210);
      S.hr = hr;
      const saInt = 60 / hr;
      const escInt = 60 / 38;                       // ventricular escape pacemaker ≈ 38 bpm
      S.t += dt;

      /* --- SA node fires --- */
      if (S.t >= S.nextSA) {
        S.nextSA = S.t + saInt;
        S.beatN++;
        S.events.push({ kind: 'P', t: S.t });
        const rr = S.lastP > 0 ? S.t - S.lastP : saInt;
        S.lastP = S.t;

        let pr = 0.16, conducted = true;
        if (p.block === 'first') pr = 0.30;
        else if (p.block === 'wenck') {
          S.wenckN++;
          pr = 0.16 + 0.07 * (S.wenckN - 1);
          if (S.wenckN >= 4) { conducted = false; S.wenckN = 0; }
        } else if (p.block === 'mobitz2') {
          S.m2N++; pr = 0.18;
          if (S.m2N % 2 === 0) conducted = false;
        } else if (p.block === 'third') conducted = false;

        if (conducted) S.pending.push({ at: S.t + pr, wide: p.bbb, pr });
        S.beats.push({ n: S.beatN, pr: conducted ? pr : null, rr, conducted });
        if (S.beats.length > 26) S.beats.shift();
      }

      /* --- conducted impulses reach the ventricle --- */
      S.pending = S.pending.filter(q => {
        if (S.t >= q.at) {
          S.events.push({ kind: 'QRS', t: q.at, wide: q.wide });
          S.lastQRS = q.at;
          S.nextEsc = q.at + escInt;
          return false;
        }
        return true;
      });

      /* --- ventricular escape when nothing conducts --- */
      if (S.t >= S.nextEsc) {
        S.nextEsc = S.t + escInt;
        S.events.push({ kind: 'QRS', t: S.t, wide: true, escape: true });
        S.lastQRS = S.t;
      }

      /* --- ectopic ventricular beats --- */
      if (p.ectopic > 0 && Math.random() < dt * (p.ectopic / 100) * 1.1) {
        S.events.push({ kind: 'QRS', t: S.t, wide: true, ectopic: true });
        S.lastQRS = S.t;
      }

      S.events = S.events.filter(e => e.t > S.t - 7);
      S.ecg = ecg(S, S.t);
      S.ecgHist.push([S.t, S.ecg]);
      while (S.ecgHist.length > 2 && S.ecgHist[0][0] < S.t - 6) S.ecgHist.shift();

      const win = S.events.filter(e => e.t > S.t - 6);
      S.pRate = win.filter(e => e.kind === 'P').length / 6 * 60;
      S.vRate = win.filter(e => e.kind === 'QRS').length / 6 * 60;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const bio = th.bio;
      const hx = W * 0.235, hy = H * 0.485, sc = Math.min(W * 0.195, H * 0.295);

      /* ---------- heart with the conduction system ---------- */
      const since = k => {
        const e = S.events.filter(x => x.kind === k && x.t <= S.t).pop();
        return e ? S.t - e.t : 99;
      };
      const pAgo = since('P'), qAgo = since('QRS');
      const glow = (a, dur) => clamp(1 - a / dur, 0, 1);
      const vG = glow(qAgo, 0.30);

      BIOART.heart(ctx, hx, hy, sc, {
        chambers: 4,
        sat: { ra: 60, rv: 60, la: 98, lv: 98 },
        contraction: vG * 0.75,
        mvOpen: vG < 0.25, tvOpen: vG < 0.25, avOpen: vG > 0.3, pvOpen: vG > 0.3,
        labels: true, leaders: false, vessels: false
      });

      // the conduction system, drawn on top of the muscle it drives
      ctx.save(); ctx.translate(hx, hy);
      const P = (x, y) => [x * sc, y * sc];

      // atrial depolarisation sweeping out from the SA node
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g.alpha('#FFD36B', .04 + .26 * glow(pAgo, 0.32));
      ctx.beginPath(); ctx.ellipse(0, -sc * 0.44, sc * 0.74, sc * 0.28, 0, 0, TAU); ctx.fill();
      // ventricular depolarisation
      ctx.fillStyle = g.alpha('#FF8FB0', .04 + .26 * vG);
      ctx.beginPath(); ctx.ellipse(0, sc * 0.30, sc * 0.62, sc * 0.46, 0, 0, TAU); ctx.fill();
      ctx.restore();

      // internodal tracts, SA -> AV
      ctx.strokeStyle = g.alpha('#FFD36B', .22 + .55 * glow(pAgo, 0.26));
      ctx.lineWidth = Math.max(1.4, sc * 0.022); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(...P(-0.50, -0.56));
      ctx.quadraticCurveTo(...P(-0.34, -0.30), ...P(-0.05, -0.16));
      ctx.stroke();

      // bundle of His, the two bundle branches and the Purkinje fibres
      const hisG = glow(qAgo, 0.22);
      ctx.strokeStyle = g.alpha('#FFD36B', .26 + .7 * hisG);
      ctx.lineWidth = Math.max(1.8, sc * (p.bbb ? 0.022 : 0.032));
      ctx.beginPath();
      ctx.moveTo(...P(-0.05, -0.16)); ctx.lineTo(...P(0.03, 0.10));
      ctx.moveTo(...P(0.03, 0.10)); ctx.lineTo(...P(-0.28, 0.68));    // right bundle branch
      ctx.moveTo(...P(0.03, 0.10)); ctx.lineTo(...P(0.30, 0.66));     // left bundle branch
      ctx.stroke();
      // Purkinje fibres fanning up the ventricular walls from the apex
      ctx.lineWidth = Math.max(1, sc * 0.014);
      ctx.strokeStyle = g.alpha('#FFD36B', .18 + .55 * hisG);
      [[-0.28, 0.68, -0.46, 0.36], [-0.28, 0.68, -0.34, 0.18], [-0.20, 0.76, -0.10, 0.86],
       [0.30, 0.66, 0.48, 0.32], [0.30, 0.66, 0.38, 0.14], [0.22, 0.76, 0.08, 0.90]]
        .forEach(([x0, y0, x1, y1]) => {
          ctx.beginPath(); ctx.moveTo(...P(x0, y0));
          ctx.quadraticCurveTo(...P((x0 + x1) / 2, (y0 + y1) / 2 + 0.10), ...P(x1, y1));
          ctx.stroke();
        });

      // SA node — the pacemaker
      const saG = glow(pAgo, 0.22);
      ctx.fillStyle = g.alpha('#FFD36B', .35 + .65 * saG);
      ctx.beginPath(); ctx.arc(...P(-0.50, -0.56), sc * 0.055 + sc * 0.035 * saG, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(10,8,4,.7)'; ctx.lineWidth = 1; ctx.stroke();
      // AV node — the gate
      const avG = S.pending.length ? 1 : glow(qAgo, 0.2);
      ctx.fillStyle = p.block === 'third' ? g.alpha(th.crit, .9) : g.alpha('#FFD36B', .35 + .6 * avG);
      ctx.beginPath(); ctx.arc(...P(-0.05, -0.16), sc * 0.052, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(10,8,4,.7)'; ctx.lineWidth = 1; ctx.stroke();

      if (p.bbb) {                                   // bundle branch block
        ctx.strokeStyle = th.crit; ctx.lineWidth = Math.max(2, sc * 0.028);
        ctx.beginPath();
        ctx.moveTo(...P(0.10, 0.30)); ctx.lineTo(...P(0.26, 0.44));
        ctx.moveTo(...P(0.26, 0.30)); ctx.lineTo(...P(0.10, 0.44));
        ctx.stroke();
      }
      if (p.block === 'third') {                     // complete AV block
        ctx.strokeStyle = th.crit; ctx.lineWidth = Math.max(2, sc * 0.028);
        ctx.beginPath();
        ctx.moveTo(...P(-0.14, -0.06)); ctx.lineTo(...P(0.08, 0.10));
        ctx.moveTo(...P(0.08, -0.06)); ctx.lineTo(...P(-0.14, 0.10));
        ctx.stroke();
      }

      ctx.font = '600 9px "IBM Plex Mono",monospace';
      const tag = (x, y, t, align) => {
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)';
        ctx.strokeText(t, x * sc, y * sc);
        ctx.fillStyle = '#F2E3C0'; ctx.fillText(t, x * sc, y * sc);
      };
      tag(-0.62, -0.72, 'SA node', 'right');
      tag(0.04, -0.30, 'AV node', 'left');
      tag(0.12, 0.04, 'bundle of His', 'left');
      tag(-0.06, 1.02, 'Purkinje fibres', 'center');
      ctx.restore();

      /* ---------- magnified: the pacemaker cell itself ---------- */
      const px2 = W * 0.515, py2 = H * 0.44, ps = Math.min(W * 0.046, H * 0.090);
      ctx.save();
      ctx.strokeStyle = g.alpha(th['text-3'], .40); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx - sc * 0.50, hy - sc * 0.56); ctx.lineTo(px2 - ps * 1.5, py2 + ps * 0.4);
      ctx.stroke();
      ctx.restore();
      // a nodal myocyte: small, pale, few myofibrils — it conducts, it does not pump
      const nodeG = ctx.createRadialGradient(px2 - ps * .3, py2 - ps * .3, ps * .1, px2, py2, ps);
      nodeG.addColorStop(0, g.mix('#FFD36B', '#ffffff', .35));
      nodeG.addColorStop(.6, '#C9A24B');
      nodeG.addColorStop(1, '#6E5520');
      ctx.fillStyle = nodeG;
      ctx.beginPath(); ctx.ellipse(px2, py2, ps, ps * 0.74, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(42,22,8,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(58,42,94,.95)';
      ctx.beginPath(); ctx.ellipse(px2, py2, ps * 0.26, ps * 0.24, 0, 0, TAU); ctx.fill();
      // the funny current, drawn as the slow drift that makes it self-excite
      const dw = ps * 1.55, dh = ps * 0.70;
      const dx2 = px2 + ps * 1.35, dy2 = py2;
      ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
      ctx.strokeRect(dx2, dy2 - dh / 2, dw, dh);
      ctx.strokeStyle = '#FFD36B'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const ph = (u * 3) % 1;
        const vv = ph < 0.72 ? -0.85 + ph / 0.72 * 0.62 : 1 - (ph - 0.72) / 0.28 * 1.85;
        const qx = dx2 + u * dw, qy = dy2 - vv * dh * 0.42;
        i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
      }
      ctx.stroke();
      const ntag = (x0, y0, x1, y1, t2, c2, al) => {
        ctx.strokeStyle = g.alpha(c2, .6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.font = '600 9px "IBM Plex Mono",monospace';
        ctx.textAlign = al; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)';
        const tx = al === 'right' ? x1 - 4 : x1 + 4;
        ctx.strokeText(t2, tx, y1); ctx.fillStyle = c2; ctx.fillText(t2, tx, y1);
      };
      ntag(px2, py2 - ps * 0.72, px2 - ps * 0.6, py2 - ps * 1.85, 'nodal (pacemaker) cell', '#FFD36B', 'right');
      ntag(dx2 + dw * 0.3, dy2 + dh * 0.28, dx2 - dw * 0.1, dy2 + dh * 1.45,
        'no stable resting potential', '#FFD36B', 'left');
      ntag(dx2 + dw * 0.5, dy2 + dh * 0.40, dx2 - dw * 0.1, dy2 + dh * 2.25,
        'it drifts up and fires again', '#FFD36B', 'left');
      g.scaleBar(px2 - ps, py2 + ps * 1.9, ps * 1.2, '≈ 25 µm', th['text-3']);

      /* ---------- ladder diagram ---------- */
      const lx0 = W * 0.60, lx1 = W - 16;
      const span = 3.6;
      const X = t => lx1 - (S.t - t) / span * (lx1 - lx0);
      const rowsY = [H * 0.24, H * 0.50, H * 0.76];
      const names = ['A  atria', 'AV  node', 'V  ventricles'];
      rowsY.forEach((y, i) => {
        ctx.strokeStyle = g.alpha(th['line-soft'], 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx0, y); ctx.lineTo(lx1, y); ctx.stroke();
        ctx.font = '9px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(names[i], lx0 - 6, y);
      });

      // atrial marks + conduction lines
      S.events.filter(e => e.kind === 'P').forEach(e => {
        const x = X(e.t);
        if (x < lx0) return;
        ctx.fillStyle = '#FFD36B';
        ctx.beginPath(); ctx.arc(x, rowsY[0], 3.2, 0, TAU); ctx.fill();
      });
      // draw the AV traversal for each conducted beat
      S.beats.forEach(b => {
        const tP = S.lastP - (S.beatN - b.n) * (60 / Math.max(S.hr, 1));
        const x = X(tP);
        if (x < lx0 || x > lx1) return;
        if (b.conducted) {
          ctx.strokeStyle = g.alpha('#FFD36B', .9); ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, rowsY[0]);
          ctx.lineTo(X(tP + b.pr), rowsY[2]);
          ctx.stroke();
        } else {
          ctx.strokeStyle = th.crit; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, rowsY[0]); ctx.lineTo(X(tP + 0.10), rowsY[1]); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(X(tP + 0.10) - 4, rowsY[1] - 4); ctx.lineTo(X(tP + 0.10) + 4, rowsY[1] + 4);
          ctx.moveTo(X(tP + 0.10) + 4, rowsY[1] - 4); ctx.lineTo(X(tP + 0.10) - 4, rowsY[1] + 4);
          ctx.stroke();
        }
      });
      S.events.filter(e => e.kind === 'QRS').forEach(e => {
        const x = X(e.t);
        if (x < lx0) return;
        ctx.fillStyle = e.escape ? '#5AA9FF' : e.ectopic ? th.crit : '#FF8FB0';
        ctx.beginPath(); ctx.arc(x, rowsY[2], 3.6, 0, TAU); ctx.fill();
        if (e.escape) {
          ctx.font = '8px "IBM Plex Mono",monospace'; ctx.fillStyle = '#5AA9FF';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('escape', x, rowsY[2] + 6);
        }
      });

      /* ---------- diagnosis ---------- */
      ctx.font = '700 15px "IBM Plex Sans Condensed",sans-serif';
      const dx = S.diag = diagnose(S);
      ctx.fillStyle = dx.ok ? th.ok : th.crit;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(dx.name, W * 0.40, 10);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(dx.detail, W * 0.40, 30);
    },

    plots: [
      { title: 'Lead II ECG — built from the impulses that actually conducted',
        legend: [{ c: '#4ADE80', label: 'ECG (mV)' }],
        draw(S, g) {
          if (!S.ecgHist.length) return;
          const t1 = Math.max(6, S.t);
          const P = g.Plot({
            xmin: t1 - 6, xmax: t1, ymin: -0.6, ymax: 1.35,
            xlabel: 'time (s)', ylabel: 'mV',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(g.theme['text-3'], .4), [2, 4]);
            P.line(S.ecgHist, g.theme.ok, 1.8);
            S.events.forEach(e => {
              if (e.t < t1 - 6) return;
              P.tag(e.t, e.kind === 'P' ? 0.30 : 1.18, e.kind === 'P' ? 'P' :
                e.escape ? 'esc' : e.ectopic ? 'PVC' : 'QRS',
                e.kind === 'P' ? '#FFD36B' : e.escape ? '#5AA9FF' : e.ectopic ? g.theme.crit : '#FF8FB0',
                'left', 0);
            });
          });
        },
        hover(S, x) {
          const r = S.ecgHist.reduce((b, q) => Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b,
            S.ecgHist[0] || [0, 0]);
          return [{ label: 'time', value: r[0].toFixed(2) + ' s' },
                  { label: 'ECG', value: r[1].toFixed(3) + ' mV', color: '#4ADE80' }];
        } },
      { title: 'PR interval beat by beat — the diagnostic fingerprint',
        legend: [{ c: '#FF6B9D', label: 'PR interval' }, { c: '#FB7185', label: 'dropped beat' }],
        draw(S, g) {
          if (!S.beats.length) return;
          const b0 = S.beats[0].n, b1 = S.beats[S.beats.length - 1].n;
          const P = g.Plot({
            xmin: b0 - 0.5, xmax: Math.max(b1, b0 + 8) + 0.5, ymin: 0, ymax: 0.55,
            xlabel: 'beat number', ylabel: 'PR interval (s)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2)
          }).frame();
          P.clip(() => {
            P.hline(0.20, g.alpha(g.theme['text-3'], .95), [4, 3]);
            const pts = S.beats.filter(b => b.conducted).map(b => [b.n, b.pr]);
            P.line(pts, g.theme.bio, 2);
            S.beats.forEach(b => {
              if (b.conducted) P.dot(b.n, b.pr, 4, g.theme.bio, g.theme['ink-950']);
              else { P.line([[b.n, 0], [b.n, 0.52]], g.alpha(g.theme.crit, .9), 2, [3, 3]);
                     P.tag(b.n, 0.52, 'dropped', g.theme.crit, 'left', 0); }
            });
          });
          P.tag(P.cfg.xmin, 0.20, 'upper limit of normal 0.20 s', g.theme['text-2'], 'left', -8);
        } }
    ],

    readouts(S) {
      const d = S.diag || { name: '—', ok: true };
      const p = S.p;
      const conducted = S.beats.filter(b => b.conducted).length;
      const lastPR = S.beats.filter(b => b.conducted).slice(-1)[0];
      return [
        { label: 'Rhythm', value: d.name, unit: '', flag: d.ok ? 'ok' : 'crit' },
        { label: 'Atrial rate (P waves)', value: (S.pRate || 0).toFixed(0), unit: 'bpm', flag: 'accent' },
        { label: 'Ventricular rate (QRS)', value: (S.vRate || 0).toFixed(0), unit: 'bpm',
          flag: (S.vRate || 0) < 45 ? 'crit' : 'accent' },
        { label: 'PR interval', value: lastPR ? lastPR.pr.toFixed(2) : '—', unit: 's',
          flag: lastPR && lastPR.pr > 0.20 ? 'warn' : '', hint: 'normal 0.12–0.20 s' },
        { label: 'QRS duration', value: p.bbb ? '0.14' : '0.08', unit: 's',
          flag: p.bbb ? 'warn' : '', hint: p.bbb ? 'wide — bundle branch block' : 'normal < 0.12 s' },
        { label: 'Conduction ratio', value: S.beats.length ? conducted + ':' + S.beats.length : '—',
          unit: '', hint: 'QRS per P wave' },
        { label: 'Effective SA rate', value: (S.hr || 0).toFixed(0), unit: 'bpm',
          hint: 'after autonomic tone' },
        { label: 'Autonomic balance', value: p.symp > p.vagal ? 'Sympathetic' : p.vagal > p.symp ? 'Vagal' : 'Balanced',
          unit: '', hint: p.symp > p.vagal ? 'noradrenaline speeds SA' : p.vagal > p.symp ? 'ACh slows SA' : '' }
      ];
    },

    equation(S) {
      const p = S.p;
      const lastPR = S.beats.filter(b => b.conducted).slice(-1)[0];
      return 'HR ' + E.op('=') + ' HR' + E.sub('intrinsic') + E.op('×') +
        '(1 ' + E.op('+') + ' sympathetic)' + E.op('×') + '(1 ' + E.op('−') + ' vagal)' +
        ' ' + E.op('=') + ' ' + E.n(p.sa, 'bpm') + E.op('→') + E.n((S.hr || 0).toFixed(0), 'bpm') +
        '<br>PR ' + E.op('=') + ' atrial depolarisation ' + E.op('+') + ' AV delay ' + E.op('=') +
        ' ' + E.n(lastPR ? lastPR.pr.toFixed(2) : '—', 's') + E.op('·') +
        ' normal ' + E.op('=') + ' 0.12–0.20 s' +
        '<br>ventricular rate ' + E.op('=') + ' ' + E.n((S.vRate || 0).toFixed(0), 'bpm') + E.op(',') +
        ' atrial rate ' + E.op('=') + ' ' + E.n((S.pRate || 0).toFixed(0), 'bpm') +
        E.op('→') + ' ' + (S.diag ? S.diag.name : '');
    },
    eqNote: '<b>The AV delay is a feature, not a flaw.</b> Roughly 0.1 s of deliberate slowing at the AV node is ' +
      'what lets the atria finish emptying before the ventricles contract. Remove that delay and the chambers ' +
      'would squeeze together, and ventricular filling would collapse.',

    walkthrough: [
      { title: '1 · Normal sinus rhythm',
        body: 'Follow one beat on the ladder diagram: a dot on the atrial line, a sloping line through the AV node, then a dot on the ventricular line.',
        ask: 'What does the slope of that line represent?',
        reveal: 'The <b>AV nodal delay</b> — about 0.1 s. On the ECG it is most of the PR interval. It exists so that atrial systole finishes before ventricular systole begins, which is what tops the ventricles up before they contract.',
        params: { sa: 75, block: 'none', bbb: false, vagal: 0, symp: 0, ectopic: 0 } },
      { title: '2 · First-degree block',
        body: 'Switch the AV node to first degree. Watch the PR interval plot.',
        ask: 'Every P wave still produces a QRS. So what has actually changed?',
        reveal: 'Only the <b>delay</b>. PR is now above 0.20 s but constant, and nothing is dropped. First-degree block is really "first-degree delay" — usually harmless, and often the only sign is that PR measurement.',
        params: { sa: 75, block: 'first', bbb: false } },
      { title: '3 · Wenckebach',
        body: 'Now choose Mobitz I and watch the PR plot carefully over several beats.',
        ask: 'What is the pattern in the PR intervals?',
        reveal: 'PR gets <b>progressively longer</b> with each beat until one P wave fails to conduct at all — then the cycle resets. That lengthening-then-dropping staircase is the signature of Wenckebach, and the PR plot draws it for you.',
        params: { sa: 78, block: 'wenck', bbb: false } },
      { title: '4 · Mobitz II is the dangerous one',
        body: 'Switch to Mobitz II and compare the PR plot with the previous step.',
        ask: 'How do you tell Mobitz II from Mobitz I on an ECG?',
        reveal: 'In Mobitz II the PR interval is <b>constant</b> — beats simply drop without warning. That is more sinister than Wenckebach, because it signals disease below the AV node and can progress abruptly to complete block.',
        params: { sa: 80, block: 'mobitz2', bbb: false } },
      { title: '5 · Complete heart block',
        body: 'Now block the AV node completely and watch both rates.',
        ask: 'The ventricles are still beating. What is driving them?',
        reveal: 'A <b>ventricular escape pacemaker</b> at around 35–40 bpm. Cells lower in the conduction system have their own slower intrinsic rhythm and take over when nothing reaches them. Atria and ventricles now beat independently — <b>AV dissociation</b> — and the ladder shows every atrial impulse dying at the AV node.',
        params: { sa: 80, block: 'third', bbb: false } },
      { title: '6 · Autonomic control',
        body: 'Return to normal conduction and move the vagal and sympathetic sliders.',
        ask: 'Which nerve does what to the SA node?',
        reveal: 'The <b>vagus</b> releases acetylcholine and <b>slows</b> the SA node; <b>sympathetic</b> fibres release noradrenaline and <b>speed it up</b>. At rest the vagus dominates — which is why cutting the vagus raises the heart rate to about 100 bpm, the true intrinsic rate of the SA node.',
        params: { sa: 75, block: 'none', vagal: 70, symp: 0 } }
    ],

    quiz: [
      { q: 'The pacemaker of the human heart is the:',
        options: ['AV node', 'SA node', 'Bundle of His', 'Purkinje fibres'], answer: 1,
        why: 'The SA node has the fastest intrinsic rate (~70–80/min), so it fires first every cycle and sets the rhythm for the whole heart.' },
      { q: 'In complete heart block, the ventricular rate is about 35–40 bpm because:',
        options: ['the SA node slows down', 'the ventricles are driven by their own escape pacemaker',
                  'the atria stop contracting', 'the AV node fires faster'], answer: 1,
        why: 'No atrial impulse reaches the ventricles, so a slower latent pacemaker in the ventricular conducting tissue takes over.' },
      { q: 'The delay at the AV node is functionally important because it:',
        options: ['protects the ventricles from all fast rhythms',
                  'allows the atria to complete emptying before ventricular contraction',
                  'generates the T wave', 'prevents the SA node from firing'], answer: 1,
        why: 'The ~0.1 s delay separates atrial systole from ventricular systole so that atrial contraction can top up ventricular filling.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Naming and ordering the conduction pathway: SA → AV → bundle of His → bundle branches → Purkinje.</li>' +
      '<li>Why the SA node is the pacemaker, and what the AV delay achieves.</li>' +
      '<li>Autonomic control of heart rate — vagal slowing vs sympathetic acceleration.</li>' +
      '<li>Reading the P:QRS relationship off an ECG strip.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Cardiac muscle is <b>myogenic</b> — the heartbeat originates in the ' +
      'muscle itself, not in nerves. The autonomic nerves only <i>modulate</i> a rhythm the SA node generates on ' +
      'its own, which is why a heart continues to beat after transplantation.</div>'
  });

  /* ECG synthesis from the events that actually occurred */
  function ecg(S, t) {
    let v = 0;
    S.events.forEach(e => {
      const d = t - e.t;
      if (d < -0.05 || d > 0.55) return;
      if (e.kind === 'P') v += 0.14 * gauss(d, 0.02, 0.030);
      else {
        const w = e.wide ? 1.7 : 1;
        v += -0.09 * gauss(d, 0.000, 0.006 * w)
           + 1.00 * gauss(d, 0.022, 0.008 * w)
           + -0.22 * gauss(d, 0.046, 0.009 * w)
           + 0.27 * gauss(d, 0.300, 0.045);
      }
    });
    return v;
  }

  function diagnose(S) {
    const p = S.p;
    if (p.block === 'third') return { ok: false, name: 'Complete (third-degree) heart block',
      detail: 'AV dissociation · ventricles on a ~38 bpm escape rhythm' };
    if (p.block === 'mobitz2') return { ok: false, name: 'Second-degree block, Mobitz II',
      detail: 'constant PR, intermittent dropped QRS — high risk of progression' };
    if (p.block === 'wenck') return { ok: false, name: 'Second-degree block, Mobitz I (Wenckebach)',
      detail: 'PR lengthens progressively, then a beat is dropped' };
    if (p.block === 'first') return { ok: false, name: 'First-degree AV block',
      detail: 'PR > 0.20 s but every P wave conducts' };
    if (p.bbb) return { ok: false, name: 'Bundle branch block',
      detail: 'normal AV conduction but wide QRS — the ventricles depolarise out of step' };
    if ((S.hr || 75) > 100) return { ok: false, name: 'Sinus tachycardia', detail: 'rate above 100 bpm' };
    if ((S.hr || 75) < 60) return { ok: false, name: 'Sinus bradycardia', detail: 'rate below 60 bpm' };
    return { ok: true, name: 'Normal sinus rhythm', detail: 'every P conducts · PR 0.12–0.20 s · narrow QRS' };
  }

})(window.InsightLab);

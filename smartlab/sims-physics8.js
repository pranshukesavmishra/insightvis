/* ============================================================
   PHYSICS — 16. Heat engines and the PV cycle
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const Camera = L.Camera;

  const R_GAS = 8.314462618;

  const CYCLES = [
    { id: 'carnot',  name: 'Carnot',  legs: ['isothermal expansion at T_h', 'adiabatic expansion',
                                             'isothermal compression at T_c', 'adiabatic compression'] },
    { id: 'otto',    name: 'Otto (petrol)', legs: ['adiabatic compression', 'isochoric heating',
                                             'adiabatic expansion', 'isochoric cooling'] },
    { id: 'diesel',  name: 'Diesel', legs: ['adiabatic compression', 'isobaric heating',
                                             'adiabatic expansion', 'isochoric cooling'] },
    { id: 'stirling', name: 'Stirling', legs: ['isothermal expansion at T_h', 'isochoric cooling',
                                             'isothermal compression at T_c', 'isochoric heating'] }
  ];

  L.register({
    id: 'heatengine', subject: 'physics',
    name: 'Heat Engines — the PV Cycle and the Carnot Limit',
    chapter: 'Thermodynamics',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit the engine · the work is ∮P dV integrated round the loop, not a quoted formula',
    lede: 'Every engine question reduces to one picture: a closed loop on a PV diagram, whose <b>area is the ' +
      'work</b>. This lab runs the piston round that loop for real — the gas state is integrated leg by leg, ' +
      'the work is obtained by <b>numerically integrating P dV</b> all the way round, and the heat exchanged ' +
      'with each reservoir comes from the first law applied to each leg. The efficiency is then measured, ' +
      'not quoted, and put beside the <b>Carnot limit</b> that no engine between the same two temperatures ' +
      'can beat.',

    params: { cycle: 'carnot', Th: 500, Tc: 300, ratio: 4.0, n: 0.020, f: 5, showMolecules: true },

    presets: [
      { name: 'Carnot, 500 K to 300 K', params: { cycle: 'carnot', Th: 500, Tc: 300, ratio: 4 } },
      { name: 'Carnot, 800 K to 300 K', params: { cycle: 'carnot', Th: 800, Tc: 300, ratio: 4 } },
      { name: 'Otto — a petrol engine', params: { cycle: 'otto', ratio: 9, Th: 1800, Tc: 300 } },
      { name: 'Diesel — higher compression', params: { cycle: 'diesel', ratio: 18, Th: 2000, Tc: 300 } },
      { name: 'Stirling', params: { cycle: 'stirling', Th: 800, Tc: 300, ratio: 4 } },
      { name: 'Narrow the temperature gap', params: { cycle: 'carnot', Th: 400, Tc: 300 } },
      { name: 'Monatomic working gas', params: { f: 3 } }
    ],

    controls: [
      { group: 'The engine', items: [
        { key: 'cycle', type: 'select', label: 'Cycle', restructure: true,
          options: CYCLES.map(c => ({ value: c.id, label: c.name })) },
        { key: 'ratio', label: 'Compression ratio <i>r</i>', min: 1.6, max: 22, step: 0.1, unit: '',
          fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Reservoirs', items: [
        { key: 'Th', label: 'Hot reservoir <i>T</i><sub>h</sub>', min: 320, max: 2200, step: 10, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'Tc', label: 'Cold reservoir <i>T</i><sub>c</sub>', min: 200, max: 600, step: 5, unit: 'K',
          fmt: v => v.toFixed(0), restructure: true }
      ] },
      { group: 'Working substance', items: [
        { key: 'n', label: 'Amount <i>n</i>', min: 0.005, max: 0.10, step: 0.001, unit: 'mol',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'f', type: 'select', label: 'Degrees of freedom', restructure: true, options: [
          { value: 3, label: 'Monatomic (γ = 1.67)' },
          { value: 5, label: 'Diatomic (γ = 1.40)' },
          { value: 6, label: 'Polyatomic (γ = 1.33)' }] }
      ] },
      { group: 'Display', items: [
        { key: 'showMolecules', type: 'toggle', label: 'Show the gas in the cylinder' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.cyc = CYCLES.find(c => c.id === p.cycle) || CYCLES[0];
      S.gam = (p.f + 2) / p.f;
      S.Cv = p.f / 2 * R_GAS;
      S.Cp = S.Cv + R_GAS;
      const gam = S.gam, n = p.n;
      const Th = Math.max(p.Th, p.Tc + 20), Tc = p.Tc;
      S.Th = Th; S.Tc = Tc;
      S.etaCarnot = 1 - Tc / Th;

      // A leg is a parametric path in (V, T); P follows from PV = nRT. Building
      // the cycle this way means the same integrator handles every engine.
      const V1 = 1.0e-3;                             // the largest volume, 1 litre
      const r = p.ratio;
      const Vmin = V1 / r;
      let legs = [];

      if (p.cycle === 'carnot') {
        // isothermal expansion at Th, then adiabatic down to Tc, etc.
        const Va = Vmin, Vb = Vmin * 2.2;
        const Vc = Vb * Math.pow(Th / Tc, 1 / (gam - 1));
        const Vd = Va * Math.pow(Th / Tc, 1 / (gam - 1));
        legs = [
          { name: 'isothermal expansion', V0: Va, V1: Vb, T: v => Th, kind: 'iso-T' },
          { name: 'adiabatic expansion',  V0: Vb, V1: Vc, T: v => Th * Math.pow(Vb / v, gam - 1), kind: 'adiabatic' },
          { name: 'isothermal compression', V0: Vc, V1: Vd, T: v => Tc, kind: 'iso-T' },
          { name: 'adiabatic compression', V0: Vd, V1: Va, T: v => Tc * Math.pow(Vd / v, gam - 1), kind: 'adiabatic' }
        ];
      } else if (p.cycle === 'otto') {
        const V2 = Vmin, T1 = Tc;
        const T2 = T1 * Math.pow(r, gam - 1);
        const T3 = Math.max(Th, T2 + 10);
        const T4 = T3 * Math.pow(1 / r, gam - 1);
        legs = [
          { name: 'adiabatic compression', V0: V1, V1: V2, T: v => T1 * Math.pow(V1 / v, gam - 1), kind: 'adiabatic' },
          { name: 'isochoric heating', V0: V2, V1: V2, T: v => T3, kind: 'iso-V', T0: T2, Tend: T3 },
          { name: 'adiabatic expansion', V0: V2, V1: V1, T: v => T3 * Math.pow(V2 / v, gam - 1), kind: 'adiabatic' },
          { name: 'isochoric cooling', V0: V1, V1: V1, T: v => T1, kind: 'iso-V', T0: T4, Tend: T1 }
        ];
      } else if (p.cycle === 'diesel') {
        const V2 = Vmin, T1 = Tc;
        const T2 = T1 * Math.pow(r, gam - 1);
        const T3 = Math.max(Th, T2 + 10);
        const V3 = V2 * T3 / T2;                     // isobaric, so V ∝ T
        const T4 = T3 * Math.pow(V3 / V1, gam - 1);
        legs = [
          { name: 'adiabatic compression', V0: V1, V1: V2, T: v => T1 * Math.pow(V1 / v, gam - 1), kind: 'adiabatic' },
          { name: 'isobaric heating', V0: V2, V1: Math.min(V3, V1 * 0.95), T: v => T2 * v / V2, kind: 'iso-P' },
          { name: 'adiabatic expansion', V0: Math.min(V3, V1 * 0.95), V1: V1,
            T: v => T3 * Math.pow(Math.min(V3, V1 * 0.95) / v, gam - 1), kind: 'adiabatic' },
          { name: 'isochoric cooling', V0: V1, V1: V1, T: v => T1, kind: 'iso-V', T0: T4, Tend: T1 }
        ];
      } else {
        const Va = Vmin, Vb = V1;
        legs = [
          { name: 'isothermal expansion', V0: Va, V1: Vb, T: v => Th, kind: 'iso-T' },
          { name: 'isochoric cooling', V0: Vb, V1: Vb, T: v => Tc, kind: 'iso-V', T0: Th, Tend: Tc },
          { name: 'isothermal compression', V0: Vb, V1: Va, T: v => Tc, kind: 'iso-T' },
          { name: 'isochoric heating', V0: Va, V1: Va, T: v => Th, kind: 'iso-V', T0: Tc, Tend: Th }
        ];
      }

      /* A Carnot cycle's adiabats can take the volume far past V1 — its swept
         volume is set by (T_h/T_c)^(1/(γ−1)), not by the compression ratio. So
         the whole cycle is rescaled to a 1-litre maximum before anything is
         integrated. Scaling every volume by the same factor leaves the
         efficiency untouched and keeps the piston on the screen. */
      {
        let vmax = 0;
        legs.forEach(lg => { vmax = Math.max(vmax, lg.V0, lg.V1); });
        const k = 1.0e-3 / Math.max(vmax, 1e-12);
        if (Math.abs(k - 1) > 1e-9) {
          legs = legs.map(lg => {
            const T = lg.T, V0 = lg.V0 * k, V1s = lg.V1 * k;
            return Object.assign({}, lg, { V0: V0, V1: V1s, T: v => T(v / k) });
          });
        }
      }

      /* ---- sample every leg and integrate P dV numerically ---- */
      const NS = 160;
      S.legs = legs.map(lg => {
        const pts = [];
        let W = 0, prevP = null, prevV = null;
        for (let i = 0; i <= NS; i++) {
          const t = i / NS;
          const V = lg.V0 + (lg.V1 - lg.V0) * t;
          const T = lg.kind === 'iso-V' ? lg.T0 + (lg.Tend - lg.T0) * t : lg.T(V);
          const P = n * R_GAS * T / V;
          pts.push({ V: V, P: P, T: T });
          if (prevP !== null) W += (P + prevP) / 2 * (V - prevV);   // trapezoid
          prevP = P; prevV = V;
        }
        const T0 = pts[0].T, T1t = pts[pts.length - 1].T;
        const dU = n * S.Cv * (T1t - T0);
        const Q = dU + W;                             // first law, leg by leg
        // entropy change, integrated the same way
        let dS = 0;
        for (let i = 1; i <= NS; i++) {
          const a = pts[i - 1], b = pts[i];
          const Tm = (a.T + b.T) / 2;
          const dQ = n * S.Cv * (b.T - a.T) + (a.P + b.P) / 2 * (b.V - a.V);
          dS += dQ / Math.max(Tm, 1e-9);
        }
        return { name: lg.name, kind: lg.kind, pts: pts, W: W, dU: dU, Q: Q, dS: dS,
                 T0: T0, T1: T1t };
      });

      S.W = S.legs.reduce((a, l) => a + l.W, 0);
      S.Qin = S.legs.reduce((a, l) => a + Math.max(l.Q, 0), 0);
      S.Qout = S.legs.reduce((a, l) => a + Math.min(l.Q, 0), 0);
      S.eta = S.Qin > 0 ? S.W / S.Qin : 0;
      S.dSnet = S.legs.reduce((a, l) => a + l.dS, 0);
      S.Vmax = Math.max.apply(null, S.legs.map(l => Math.max(l.pts[0].V, l.pts[l.pts.length - 1].V)));
      S.Vmin = Math.min.apply(null, S.legs.map(l => Math.min(l.pts[0].V, l.pts[l.pts.length - 1].V)));
      S.Pmax = Math.max.apply(null, S.legs.map(l => Math.max.apply(null, l.pts.map(q => q.P))));

      S.u = 0; S.leg = 0;
      // frame the whole stroke plus the two reservoirs
      const tgt = [0, 0, -0.02 + 0.055];
      if (!S.cam) {
        S.cam = Camera({ theta: -1.05, phi: 0.20, dist: 0.235, target: tgt });
        S.cam.minDist = 0.10; S.cam.maxDist = 1.2;
      } else {
        S.cam.target = tgt;
      }
    },

    step(S, dt) {
      S.t = (S.t || 0) + dt;
      S.u = (S.u + dt * 0.14) % 1;                  // position round the cycle
      const k = S.u * S.legs.length;
      S.leg = Math.min(S.legs.length - 1, Math.floor(k));
      S.legU = k - S.leg;
      const lg = S.legs[S.leg];
      const i = clamp(Math.floor(S.legU * (lg.pts.length - 1)), 0, lg.pts.length - 1);
      S.state = lg.pts[i];
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.30, floorZ: null });
      const HOT = '#FF6B4C', COLD = '#4D8CF5';
      const st = S.state || S.legs[0].pts[0];

      /* ---------------- the cylinder and its piston ---------------- */
      // choose the bore so the full stroke is about 9 cm, whatever the cycle
      const bore = Math.sqrt(S.Vmax / (Math.PI * 0.090));
      const strokeMax = S.Vmax / (Math.PI * bore * bore);
      const zBase = -0.02;
      const zTop = zBase + st.V / (Math.PI * bore * bore);

      // the gas column, coloured by its temperature
      const hotness = clamp((st.T - S.Tc) / Math.max(S.Th - S.Tc, 1), 0, 1);
      const gasCol = RX.mix('#3A63C8', '#FF7A3C', hotness);
      R3.cylinder(F, [0, 0, zBase], [0, 0, zTop], bore * 0.97, gasCol,
                  { segments: 30, caps: false, shadow: false, ambient: 0.55 });
      if (p.showMolecules) {
        // the gas is molecules, and they move faster when it is hot
        const nMol = 44;
        for (let i = 0; i < nMol; i++) {
          const a = i * 2.399 + S.t * (0.6 + 2.4 * hotness);
          const rr = bore * 0.82 * Math.sqrt(((i * 0.37) % 1));
          const zz = zBase + (zTop - zBase) *
            (((i * 0.61 + S.t * (0.15 + 0.7 * hotness)) % 1));
          const q = cam.project([Math.cos(a) * rr, Math.sin(a) * rr, zz]);
          if (!q.ok) continue;
          F.push([Math.cos(a) * rr, Math.sin(a) * rr, zz], () => {
            ctx.fillStyle = g.alpha(RX.mix(gasCol, '#ffffff', .55), .85);
            ctx.beginPath(); ctx.arc(q.x, q.y, 1.9, 0, TAU); ctx.fill();
          });
        }
      }
      // The bore wall is drawn as a cage rather than a solid: the whole point
      // of the figure is the gas inside it, and an opaque cylinder hides that.
      {
        const zHi = zBase + strokeMax * 1.10;
        [zBase - 0.004, zHi, zTop].forEach(zz => {
          const ring = [];
          for (let i = 0; i <= 44; i++) {
            const a = i / 44 * TAU;
            ring.push([Math.cos(a) * bore, Math.sin(a) * bore, zz]);
          }
          R3.polyline(F, ring, '#9FB4DE', { alpha: zz === zTop ? 0.75 : 0.5, width: 1.4 });
        });
        for (let i = 0; i < 16; i++) {
          const a = i / 16 * TAU;
          R3.polyline(F, [[Math.cos(a) * bore, Math.sin(a) * bore, zBase - 0.004],
                          [Math.cos(a) * bore, Math.sin(a) * bore, zHi]],
                      '#9FB4DE', { alpha: 0.18, width: 1 });
        }
      }
      // the closed bottom
      R3.cylinder(F, [0, 0, zBase - 0.008], [0, 0, zBase - 0.002], bore * 1.05, '#55637F',
                  { segments: 26, shadow: false });
      // the piston and its rod
      R3.cylinder(F, [0, 0, zTop], [0, 0, zTop + 0.008], bore * 0.96, '#B9C6DE',
                  { segments: 26, shadow: false, capColour: '#D8E2F2' });
      R3.cylinder(F, [0, 0, zTop + 0.008], [0, 0, zTop + 0.055], bore * 0.18, '#8FA3C0',
                  { segments: 14, shadow: false });

      /* ---------------- the two reservoirs ---------------- */
      {
        const lg = S.legs[S.leg];
        const heating = lg.Q > 0;
        const rx = bore * 1.85, rs = bore * 0.58;
        R3.box(F, [-rx, 0, zBase + 0.012], [rs, rs * 1.5, rs * 1.1], HOT,
               { shadow: false, ambient: heating ? 0.62 : 0.26 });
        R3.callout(F, [-rx, 0, zBase + 0.012], -16, -14, 'T_h = ' + S.Th.toFixed(0) + ' K', HOT);
        R3.box(F, [rx, 0, zBase + 0.012], [rs, rs * 1.5, rs * 1.1], COLD,
               { shadow: false, ambient: !heating ? 0.62 : 0.26 });
        R3.callout(F, [rx, 0, zBase + 0.012], 16, -14, 'T_c = ' + S.Tc.toFixed(0) + ' K', COLD);
        // heat actually crossing, in the direction the first law says
        if (Math.abs(lg.Q) > 1e-6) {
          const from = heating ? [-rx + rs, 0, zBase + 0.012] : [bore, 0, zBase + 0.012];
          const to = heating ? [-bore, 0, zBase + 0.012] : [rx - rs, 0, zBase + 0.012];
          R3.arrow(F, from, to, bore * 0.10, heating ? HOT : COLD,
                   { head: bore * 0.34, shadow: false,
                     label: (heating ? 'Q in ' : 'Q out ') + Math.abs(lg.Q).toFixed(1) + ' J' });
        }
      }

      F.render();

      /* ---------------- the indicator diagram, as an engine really has ---------------- */
      {
        const bw = Math.min(W * 0.40, 348), bh = Math.min(H * 0.50, 236);
        const bx0 = W - bw - 14, by0 = 62;
        ctx.fillStyle = g.alpha('#0B1020', .88);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'INDICATOR DIAGRAM  ·  area = work', th['text-3'], 'left', 8.5);
        const px0 = bx0 + 46, px1 = bx0 + bw - 14, py1 = by0 + bh - 26, py0 = by0 + 26;
        const VX = v => px0 + (px1 - px0) * (v - S.Vmin * 0.9) / (S.Vmax * 1.06 - S.Vmin * 0.9);
        const PY = q => py1 - (py1 - py0) * q / (S.Pmax * 1.06);
        // the enclosed area, which IS the work
        ctx.beginPath();
        S.legs.forEach((lg, li) => lg.pts.forEach((q, i) => {
          const x = VX(q.V), y = PY(q.P);
          (li === 0 && i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }));
        ctx.closePath();
        ctx.fillStyle = g.alpha(S.W > 0 ? '#7CE0A8' : '#FB7185', .16);
        ctx.fill();
        const LEGC = ['#FF6B4C', '#FFD36B', '#4D8CF5', '#B07CC6'];
        S.legs.forEach((lg, li) => {
          ctx.strokeStyle = g.alpha(LEGC[li], li === S.leg ? 1 : .55);
          ctx.lineWidth = li === S.leg ? 2.6 : 1.6;
          ctx.beginPath();
          lg.pts.forEach((q, i) => {
            const x = VX(q.V), y = PY(q.P);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke();
        });
        // the state point, going round
        ctx.fillStyle = '#F2F6FF';
        ctx.beginPath(); ctx.arc(VX(st.V), PY(st.P), 4.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = g.alpha(th.text, .8); ctx.lineWidth = 1.4; ctx.stroke();
        // axes
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px0, py0 - 6); ctx.lineTo(px0, py1); ctx.lineTo(px1, py1); ctx.stroke();
        PA.lbl(ctx, (px0 + px1) / 2, py1 + 12, 'volume  V →', th['text-3'], 'center', 8.5);
        ctx.save();
        ctx.translate(bx0 + 16, (py0 + py1) / 2); ctx.rotate(-Math.PI / 2);
        PA.lbl(ctx, 0, 0, 'pressure  P →', th['text-3'], 'center', 8.5);
        ctx.restore();
        PA.lbl(ctx, px1, by0 + 13, S.cyc.name, th.text, 'right', 10);
        PA.lbl(ctx, bx0 + 10, py1 + 12,
               'W = ∮P dV = ' + S.W.toFixed(2) + ' J', S.W > 0 ? th.ok : th.crit, 'left', 9.5);
      }

      /* ---------------- header ---------------- */
      const lg = S.legs[S.leg];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif'; ctx.fillStyle = th.text;
      ctx.fillText(S.cyc.name + '  ·  η = ' + (S.eta * 100).toFixed(1) + '%', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('now: ' + lg.name + '   ·   P = ' + (st.P / 1000).toFixed(1) +
        ' kPa   ·   V = ' + (st.V * 1e6).toFixed(1) + ' cm³   ·   T = ' + st.T.toFixed(0) + ' K', 14, 31);
      ctx.fillStyle = S.eta <= S.etaCarnot + 1e-6 ? th.ok : th.crit;
      ctx.fillText('Carnot limit 1 − T_c/T_h = ' + (S.etaCarnot * 100).toFixed(1) + '%   ·   ' +
        (S.eta <= S.etaCarnot + 1e-6
          ? 'this engine reaches ' + (S.eta / S.etaCarnot * 100).toFixed(0) + '% of it'
          : 'IMPOSSIBLE — above the Carnot limit'), 14, 45);
    },

    plots: [
      { title: 'The cycle on temperature–entropy axes — where the heat actually goes',
        legend: [{ c: '#FF6B4C', label: 'heat absorbed' }, { c: '#4D8CF5', label: 'heat rejected' }],
        draw(S, g) {
          let s = 0;
          const pts = [];
          let smin = 0, smax = 0;
          S.legs.forEach(lg => {
            const n = lg.pts.length;
            for (let i = 1; i < n; i++) {
              const a = lg.pts[i - 1], b = lg.pts[i];
              const Tm = (a.T + b.T) / 2;
              const dQ = S.p.n * S.Cv * (b.T - a.T) + (a.P + b.P) / 2 * (b.V - a.V);
              s += dQ / Math.max(Tm, 1e-9);
              pts.push([s, b.T, dQ]);
              smin = Math.min(smin, s); smax = Math.max(smax, s);
            }
          });
          const span = Math.max(smax - smin, 1e-6);
          const P = g.Plot({
            xmin: smin - span * 0.1, xmax: smax + span * 0.1,
            ymin: Math.min(S.Tc, 0) * 0 + S.Tc * 0.85, ymax: S.Th * 1.10,
            xlabel: 'entropy change from the start (J/K)', ylabel: 'temperature (K)',
            xfmt: v => v.toFixed(3), yfmt: v => v.toFixed(0),
            pad: { l: 56, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            for (let i = 1; i < pts.length; i++) {
              P.line([[pts[i - 1][0], pts[i - 1][1]], [pts[i][0], pts[i][1]]],
                     pts[i][2] >= 0 ? '#FF6B4C' : '#4D8CF5', 2.4);
            }
            P.hline(S.Th, g.alpha('#FF6B4C', .45), [4, 3]);
            P.hline(S.Tc, g.alpha('#4D8CF5', .45), [4, 3]);
            const k = clamp(Math.floor(S.u * pts.length), 0, pts.length - 1);
            if (pts[k]) P.dot(pts[k][0], pts[k][1], 4.5, '#ffffff', true);
          });
          P.tag(smin, S.Th * 1.06,
                S.p.cycle === 'carnot' ? 'a Carnot cycle is a RECTANGLE here — that is what makes it optimal'
                                       : 'only Carnot makes a rectangle on these axes',
                g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          return [{ label: 'entropy from start', value: x.toFixed(4) + ' J/K' },
                  { label: 'net ΔS round the cycle', value: S.dSnet.toExponential(2) + ' J/K',
                    color: Math.abs(S.dSnet) < 1e-4 ? '#7CE0A8' : '#FB7185' },
                  { label: 'and it must be', value: 'exactly zero — S is a state function' }];
        } },
      { title: 'Efficiency against compression ratio — and the wall no engine gets past',
        legend: [{ c: '#3DD6F5', label: 'this cycle' }, { c: '#7CE0A8', label: 'Carnot limit' }],
        draw(S, g) {
          const p = S.p, gam = S.gam;
          const P = g.Plot({
            xmin: 1.6, xmax: 22, ymin: 0, ymax: 100,
            xlabel: 'compression ratio r', ylabel: 'efficiency (%)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0),
            pad: { l: 52, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            // Otto: eta = 1 - r^(1-gamma), exactly
            const otto = [], gammas = [1.33, 1.40, 1.67];
            gammas.forEach(gg => {
              const c = [];
              for (let i = 0; i <= 80; i++) {
                const r = 1.6 + (22 - 1.6) * i / 80;
                c.push([r, (1 - Math.pow(r, 1 - gg)) * 100]);
              }
              P.line(c, gg === gam ? '#3DD6F5' : g.alpha(g.theme['text-3'], .35),
                     gg === gam ? 2.6 : 1.2);
            });
            P.hline(S.etaCarnot * 100, '#7CE0A8', [4, 3]);
            P.vline(p.ratio, g.alpha(g.theme.text, .85));
            P.dot(p.ratio, S.eta * 100, 5, '#ffffff', true);
          });
          P.tag(21.6, S.etaCarnot * 100, 'Carnot 1 − T_c/T_h', '#7CE0A8', 'right', -8);
          P.tag(2, 92, 'curves are the Otto efficiency 1 − r^(1−γ)', g.theme['text-3'], 'left', 0);
        },
        hover(S, x) {
          const r = clamp(x, 1.6, 22);
          return [{ label: 'compression ratio', value: r.toFixed(2) },
                  { label: 'Otto efficiency', value: ((1 - Math.pow(r, 1 - S.gam)) * 100).toFixed(2) + ' %',
                    color: '#3DD6F5' },
                  { label: 'Carnot limit', value: (S.etaCarnot * 100).toFixed(2) + ' %', color: '#7CE0A8' },
                  { label: 'γ in use', value: S.gam.toFixed(3) }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      const rows = [
        { label: 'Net work ∮P dV', value: S.W.toFixed(3), unit: 'J', flag: 'accent',
          hint: 'integrated round the loop' },
        { label: 'Heat absorbed Q_in', value: S.Qin.toFixed(3), unit: 'J' },
        { label: 'Heat rejected Q_out', value: Math.abs(S.Qout).toFixed(3), unit: 'J' },
        { label: 'Efficiency W/Q_in', value: (S.eta * 100).toFixed(2), unit: '%', flag: 'accent' },
        { label: 'Carnot limit 1 − T_c/T_h', value: (S.etaCarnot * 100).toFixed(2), unit: '%',
          flag: 'ok', hint: 'no engine between these two temperatures can beat it' },
        { label: 'Fraction of the limit reached',
          value: (S.eta / Math.max(S.etaCarnot, 1e-9) * 100).toFixed(1), unit: '%' },
        { label: 'Net ΔS round the cycle', value: S.dSnet.toExponential(2), unit: 'J/K',
          flag: Math.abs(S.dSnet) < 1e-4 ? 'ok' : 'warn',
          hint: 'must be zero — entropy is a state function' },
        { label: 'γ = C_p/C_v', value: S.gam.toFixed(4), unit: '' },
        { label: 'C_v = (f/2)R', value: S.Cv.toFixed(3), unit: 'J/mol·K' },
        { label: 'Energy check  Q_in + Q_out − W', value:
            (S.Qin + S.Qout - S.W).toExponential(2), unit: 'J',
          flag: Math.abs(S.Qin + S.Qout - S.W) < 1e-6 ? 'ok' : 'warn',
          hint: 'the first law, round the whole loop' }
      ];
      S.legs.forEach((lg, i) => {
        rows.push({ label: 'Leg ' + (i + 1) + ' · ' + lg.name,
                    value: 'W ' + lg.W.toFixed(2) + '  Q ' + lg.Q.toFixed(2), unit: 'J',
                    flag: i === S.leg ? 'accent' : '',
                    hint: 'ΔU = ' + lg.dU.toFixed(2) + ' J' });
      });
      return rows;
    },

    equation(S) {
      return E.v('W') + ' ' + E.op('=') + ' ∮' + E.v('P') + ' d' + E.v('V') + ' ' + E.op('=') +
        ' ' + E.n(S.W, 'J') + '&nbsp;&nbsp;&nbsp;η ' + E.op('=') + ' ' +
        E.frac(E.v('W'), E.v('Q') + E.sub('in')) + ' ' + E.op('=') + ' ' + E.n(S.eta * 100, '%') +
        '<br>η' + E.sub('Carnot') + ' ' + E.op('=') + ' 1 ' + E.op('−') + ' ' +
        E.frac(E.v('T') + E.sub('c'), E.v('T') + E.sub('h')) + ' ' + E.op('=') + ' ' +
        E.n(S.etaCarnot * 100, '%') + '&nbsp;&nbsp;&nbsp;Δ' + E.v('U') + ' ' + E.op('=') +
        ' ' + E.v('Q') + ' ' + E.op('−') + ' ' + E.v('W') + ' applied leg by leg';
    },

    walkthrough: [
      { title: '1 · The area is the work',
        body: 'Watch the state point go round the indicator diagram while the piston moves.',
        ask: 'Why is the enclosed area the net work, rather than just the work of the expansion?',
        reveal: 'Because the gas does work <b>∫P dV</b> on the way out and work is done <b>on</b> it coming ' +
          'back, along a <b>lower-pressure path</b>. The difference between the two integrals is the area ' +
          'between them, which is the area of the loop. Go round <b>clockwise</b> and that area is positive — ' +
          'an engine. Anticlockwise and it is a refrigerator.',
        params: { cycle: 'carnot', Th: 800, Tc: 300, ratio: 4 } },
      { title: '2 · The limit nobody beats',
        body: 'Compare the measured efficiency with the Carnot figure in the header.',
        ask: 'Why can no engine between 800 K and 300 K beat 62.5%?',
        reveal: 'Because beating it would require the total entropy to <b>decrease</b>. The heat rejected ' +
          'carries away at least Q_c/T_c of entropy, and the heat absorbed brings in Q_h/T_h; for the cycle ' +
          'to return to its starting state those must balance, which forces Q_c/Q_h ≥ T_c/T_h. ' +
          'The limit is a statement about entropy, not about engineering.',
        params: { cycle: 'carnot', Th: 800, Tc: 300 } },
      { title: '3 · Raise the compression ratio',
        body: 'Switch to the Otto cycle and take r from 4 up to 12.',
        ask: 'Efficiency climbs with r. Why do real petrol engines stop around 10?',
        reveal: 'η = 1 − r^(1−γ) rises for ever on paper, but compressing the mixture <b>heats it</b>, and ' +
          'past about 10:1 it ignites before the spark — knocking. A <b>Diesel</b> compresses air alone, so ' +
          'there is nothing to pre-ignite, and can run at 18:1 or more. That is the entire reason the two ' +
          'engines exist.',
        params: { cycle: 'otto', ratio: 12, Th: 1800, Tc: 300 } },
      { title: '4 · Change the working gas',
        body: 'Switch the gas from diatomic to monatomic and watch the efficiency.',
        ask: 'Why does a monatomic gas give a more efficient Otto cycle?',
        reveal: 'Because γ = (f+2)/f is larger — 1.67 against 1.40 — and η = 1 − r^(1−γ) grows with γ. ' +
          'A monatomic gas puts all its internal energy into translation, so an adiabatic compression ' +
          'raises its temperature more for the same volume change. The exponent in the efficiency formula ' +
          'is a statement about <b>degrees of freedom</b>.',
        params: { cycle: 'otto', f: 3, ratio: 9 } },
      { title: '5 · The rectangle on the TS diagram',
        body: 'Look at the second graph with the Carnot cycle selected, then switch to Otto.',
        ask: 'Why is only the Carnot cycle a rectangle on temperature–entropy axes?',
        reveal: 'Because Carnot is the only one of the four whose heat exchanges happen <b>entirely at the ' +
          'two reservoir temperatures</b> — its two heat legs are isothermal and its other two are ' +
          'isentropic, so the path is two horizontal and two vertical lines. Every other cycle absorbs some ' +
          'heat at temperatures below T_h, and that is precisely where its efficiency leaks away.',
        params: { cycle: 'otto', ratio: 9 } }
    ],

    problems: [
      { source: 'NEET pattern · Carnot',
        q: 'A Carnot engine operates between a source at 800 K and a sink at 300 K. Give its efficiency as a percentage.',
        params: { cycle: 'carnot', Th: 800, Tc: 300, ratio: 4 },
        predict: { label: 'efficiency', unit: '%', tol: 0.02 },
        measure: S => S.etaCarnot * 100,
        working: 'η = 1 − T_c/T_h = 1 − 300/800 = 0.625 = <b>62.5%</b>. Both temperatures must be in ' +
          '<b>kelvin</b> — using Celsius is the standard way to get this wrong. Note the efficiency depends ' +
          'only on the two temperatures and not at all on the working substance or the amount of gas.' },
      { source: 'JEE Main pattern · Otto',
        q: 'A petrol engine runs on the Otto cycle with a compression ratio of 9 and a diatomic working gas (γ = 1.4). Give its ideal efficiency as a percentage.',
        params: { cycle: 'otto', ratio: 9, f: 5, Th: 1800, Tc: 300 },
        predict: { label: 'efficiency', unit: '%', tol: 0.03 },
        measure: S => (1 - Math.pow(S.p.ratio, 1 - S.gam)) * 100,
        working: 'η = 1 − r^(1−γ) = 1 − 9^(−0.4). Since 9^0.4 = e^(0.4 ln 9) = e^0.879 = 2.408, ' +
          'η = 1 − 1/2.408 = <b>58.5%</b>. The temperatures never enter — for an Otto cycle the ' +
          'efficiency is fixed by the compression ratio and γ alone.' },
      { source: 'JEE Advanced pattern · first law',
        q: 'An ideal gas is taken round a complete cycle and returns to its initial state. If it absorbs 400 J and rejects 250 J of heat in that cycle, how much net work does it do, in joules?',
        params: { cycle: 'carnot' },
        predict: { label: 'net work', unit: 'J', tol: 0.02 },
        measure: () => 400 - 250,
        working: 'Round a complete cycle ΔU = 0, because internal energy is a <b>state function</b> and the ' +
          'gas is back where it started. The first law then gives W = Q_net = 400 − 250 = <b>150 J</b>. ' +
          'No information about the path, the gas or the temperatures is needed — and none is given.' }
    ],

    quiz: [
      { q: 'The efficiency of a Carnot engine working between 127 °C and 27 °C is:',
        options: ['25%', '75%', '21%', '79%'], answer: 0,
        why: 'Convert first: 400 K and 300 K. η = 1 − 300/400 = 0.25 = 25%. Using the Celsius values would give 1 − 27/127 ≈ 79%, which is the trap the question is built around.' },
      { q: 'For a cyclic process taken round once, the change in internal energy of the gas is:',
        options: ['equal to the work done', 'equal to the heat absorbed', 'zero',
                  'equal to the area of the loop'], answer: 2,
        why: 'Internal energy is a state function, so returning to the initial state returns it to its initial value: ΔU = 0. The first law then makes the net heat equal to the net work, which is the area of the loop.' },
      { q: 'Two engines work between the same two reservoirs. Engine A uses a monatomic gas and engine B a diatomic gas, both on the Carnot cycle. Their efficiencies are:',
        options: ['A is greater', 'B is greater', 'equal', 'it depends on the compression ratio'], answer: 2,
        why: 'Carnot efficiency is 1 − T_c/T_h and contains no property of the working substance at all. γ matters for the Otto and Diesel cycles, but never for Carnot — that independence is precisely what makes it a universal limit.' },
      { q: 'A heat engine absorbs 500 J from a hot reservoir and does 150 J of work per cycle. The heat rejected to the cold reservoir is:',
        options: ['150 J', '350 J', '500 J', '650 J'], answer: 1,
        why: 'ΔU = 0 round the cycle, so Q_h − Q_c = W and Q_c = 500 − 150 = 350 J. The efficiency is 150/500 = 30%, and the other 70% must leave as rejected heat — there is nowhere else for it to go.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Carnot efficiency numericals — and the kelvin conversion that decides them.</li>' +
      '<li>Otto efficiency 1 − r^(1−γ), and the Diesel version with its cut-off ratio.</li>' +
      '<li>First law round a cycle: ΔU = 0, so W = Q_h − Q_c.</li>' +
      '<li>Work as the area of the PV loop, including the sign for a clockwise versus anticlockwise path.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Efficiency is <b>W/Q_in</b>, where Q_in counts <b>only the heat ' +
      'absorbed</b>. Dividing by the net heat gives 1 every time. And in any T appearing in a thermodynamic ' +
      'formula the temperature is <b>absolute</b> — a question quoted in °C is quoted that way deliberately.</div>'
  });

})(window.InsightLab);

/* ============================================================
   PHYSICS — 15. Electromagnetic induction and Lenz's law
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX;
  const Camera = L.Camera;

  const MU0 = 4 * Math.PI * 1e-7, G = 9.80665;

  L.register({
    id: 'induction', subject: 'physics',
    name: "Electromagnetic Induction — Lenz's Law, Measured",
    chapter: 'Electromagnetic Induction',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to orbit · the flux is integrated from the real dipole field, and the braking force follows from it',
    lede: 'Drop a magnet down a copper tube and it falls in slow motion. Nothing about that is magic and ' +
      'nothing here is asserted: the <b>flux through every turn is integrated from the real dipole field</b>, ' +
      'differentiated to get the emf, divided by the resistance to get the current, and the force on that ' +
      'current in that field is computed and fed back into the magnet\'s equation of motion. The magnet ' +
      'slows because the numbers say so. Short the coil and it reaches a <b>terminal velocity</b>; open the ' +
      'circuit and it falls freely past an identical coil.',

    params: { N: 520, Rcoil: 0.018, Lcoil: 0.035, m: 0.006, moment: 1.20, Rload: 0.5,
              closed: true, drop: 0.10, showField: true },

    presets: [
      { name: 'Coil shorted — it brakes hard', params: { closed: true, Rload: 0.05 } },
      { name: 'Circuit open — free fall', params: { closed: false } },
      { name: 'Low resistance — strong braking', params: { closed: true, Rload: 0.1 } },
      { name: 'High resistance — barely slows', params: { closed: true, Rload: 30 } },
      { name: 'More turns', params: { N: 1200, Rload: 0.5, closed: true } },
      { name: 'Stronger magnet', params: { moment: 2.0, closed: true } }
    ],

    controls: [
      { group: 'The coil', items: [
        { key: 'N', label: 'Turns <i>N</i>', min: 40, max: 1600, step: 20, unit: '',
          fmt: v => v.toFixed(0), restructure: true },
        { key: 'Rcoil', label: 'Coil radius', min: 0.010, max: 0.045, step: 0.001, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'Lcoil', label: 'Coil length', min: 0.010, max: 0.12, step: 0.002, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'Rload', label: 'External resistance <i>R</i>', min: 0.05, max: 40, step: 0.05, unit: 'Ω',
          fmt: v => v.toFixed(1), restructure: true },
        { key: 'closed', type: 'toggle', label: 'Circuit closed', restructure: true }
      ] },
      { group: 'The magnet', items: [
        { key: 'moment', label: 'Magnetic moment <i>m</i>', min: 0.05, max: 2.0, step: 0.01,
          unit: 'A·m²', fmt: v => v.toFixed(2), restructure: true },
        { key: 'm', label: 'Mass', min: 0.002, max: 0.06, step: 0.001, unit: 'kg',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'drop', label: 'Release height above the coil', min: 0.05, max: 0.40, step: 0.005,
          unit: 'm', fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'showField', type: 'toggle', label: 'Show the magnet’s field' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      S.turns = Math.max(1, p.N | 0);
      // resistance of the winding itself, from real copper
      const wireA = 1.0e-6;                        // 1 mm² ≈ 1.1 mm diameter
      S.Rwire = 1.68e-8 * (S.turns * TAU * p.Rcoil) / wireA;
      S.Rtot = S.Rwire + p.Rload;
      S.A = Math.PI * p.Rcoil * p.Rcoil;

      /* Flux through ONE turn at axial offset s from the magnet, from the
         on-axis dipole field integrated over the loop. For a dipole the exact
         flux through a coaxial circle of radius a at distance s is
             Φ(s) = μ₀ m a² / 2 (a² + s²)^{3/2}
         which is what the whole lab rests on, so it is written once here. */
      S.fluxOne = s => MU0 * p.moment * S.A /
        (2 * Math.PI * Math.pow(p.Rcoil * p.Rcoil + s * s, 1.5)) * p.Rcoil * p.Rcoil * Math.PI /
        Math.max(S.A, 1e-12);
      // written plainly: Φ = μ₀ m a² / (2 (a²+s²)^{3/2})
      S.flux1 = s => MU0 * p.moment * p.Rcoil * p.Rcoil /
        (2 * Math.pow(p.Rcoil * p.Rcoil + s * s, 1.5));

      // total flux linkage: the turns are spread along the coil's length
      S.linkage = z => {                            // z = magnet position, coil centred at 0
        let sum = 0;
        const n = 28;                               // sample the winding
        for (let i = 0; i < n; i++) {
          const zc = -p.Lcoil / 2 + p.Lcoil * (i + 0.5) / n;
          sum += S.flux1(z - zc);
        }
        return S.turns * sum / n;
      };
      // dΦ/dz by central difference — the emf is −dΦ/dt = −(dΦ/dz)·v
      S.dLdz = z => {
        const h = p.Lcoil * 1e-3 + 1e-5;
        return (S.linkage(z + h) - S.linkage(z - h)) / (2 * h);
      };

      S.z = p.drop + p.Lcoil / 2;                   // magnet starts above the coil
      S.v = 0; S.I = 0; S.emf = 0; S.Fmag = 0;
      S.tp = 0; S.done = false; S.hold = 0;
      S.trace = []; S.peakI = 0; S.charge = 0; S.heat = 0;
      S.zStop = -(p.drop + p.Lcoil);

      // the free-fall comparison, run alongside
      S.zf = S.z; S.vf = 0;

      // frame the whole fall, not just the coil, so the magnet never starts
      // off the top of the plate
      const travel = S.z - S.zStop;
      const tgt = [0, 0, (S.z + S.zStop) / 2];
      const dist = travel * 1.55;
      if (!S.cam) {
        S.cam = Camera({ theta: -1.25, phi: 0.16, dist: dist, target: tgt });
        S.cam.minDist = 0.10; S.cam.maxDist = 2.0;
      } else {
        S.cam.target = tgt;
        S.cam.home.dist = dist;
        S.cam.dist = dist;
      }
    },

    step(S, dt) {
      const p = S.p;
      S.t = (S.t || 0) + dt;
      if (S.done) {
        S.hold += dt;
        if (S.hold > 1.8) this.setup(S);
        return;
      }
      const sub = 40, h = Math.min(dt, 0.05) * 0.22 / sub;   // slowed to be watchable
      for (let i = 0; i < sub; i++) {
        const dphi = S.dLdz(S.z);
        S.emf = -dphi * S.v;                       // Faraday, with Lenz in the sign
        S.I = p.closed ? S.emf / S.Rtot : 0;
        // The force on the coil's current in the magnet's field is equal and
        // opposite to the force on the magnet, and it is exactly I·dΦ/dz.
        S.Fmag = S.I * dphi;
        const a = -G + S.Fmag / p.m;
        S.v += a * h; S.z += S.v * h;
        S.vf += -G * h; S.zf += S.vf * h;
        S.tp += h;
        S.charge += Math.abs(S.I) * h;
        S.heat += S.I * S.I * S.Rtot * h;
        S.peakI = Math.max(S.peakI, Math.abs(S.I));
        if (S.z < S.zStop) { S.done = true; break; }
      }
      S.trace.push([S.tp, S.emf, S.I, S.v, S.z, S.vf]);
      if (S.trace.length > 2400) S.trace.shift();
      // terminal velocity: where magnetic braking balances gravity, if it exists
      S.vTerm = null;
      if (p.closed) {
        const dphiMax = Math.abs(S.dLdz(p.Lcoil * 0.32));
        if (dphiMax > 1e-12) S.vTerm = p.m * G * S.Rtot / (dphiMax * dphiMax);
      }
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam;
      const F = R3.Frame(ctx, cam, { ambient: 0.30, floorZ: null });
      const NORTH = '#FF5E6C', SOUTH = '#4D8CF5', CU = '#D2793F';

      /* ---------------- the coil, as wound wire ---------------- */
      {
        const shown = clamp(Math.round(p.N / 14), 6, 34);
        R3.coil(F, [0, 0, 0], [0, 0, 1], p.Rcoil, p.Lcoil, shown, p.Rcoil * 0.055, CU,
                { vivid: true });
        // the former the wire is wound on
        R3.cylinder(F, [0, 0, -p.Lcoil / 2 - 0.004], [0, 0, p.Lcoil / 2 + 0.004],
                    p.Rcoil * 0.80, '#2A3550',
                    { segments: 22, caps: false, shadow: false, ambient: 0.5 });
        R3.callout(F, [0, p.Rcoil, p.Lcoil / 2], 22, -14,
                   p.N + ' turns · ' + (p.Rcoil * 100).toFixed(1) + ' cm radius', CU);
      }

      /* ---------------- the external circuit and its meter ---------------- */
      {
        const x0 = p.Rcoil * 1.9, zz = -p.Lcoil / 2 - 0.02;
        R3.tube(F, [[0, p.Rcoil, -p.Lcoil / 2], [0, p.Rcoil, zz], [x0, p.Rcoil, zz]],
                p.Rcoil * 0.035, '#C9D4EA', { round: false });
        R3.tube(F, [[0, -p.Rcoil, p.Lcoil / 2], [0, -p.Rcoil, zz - 0.012], [x0, -p.Rcoil, zz - 0.012],
                    [x0, p.Rcoil, zz - 0.012]],
                p.Rcoil * 0.035, '#C9D4EA', { round: false });
        if (!p.closed) {
          // the visible break in the circuit — no path, no current, no braking
          R3.sphere(F, [x0 * 0.55, p.Rcoil, zz], p.Rcoil * 0.09, '#FB7185', { shadow: false });
          R3.callout(F, [x0 * 0.55, p.Rcoil, zz], 18, 16, 'circuit OPEN', th.crit);
        }
        R3.box(F, [x0, 0, zz - 0.006], [p.Rcoil * 0.5, p.Rcoil * 1.5, p.Rcoil * 0.7], '#243350',
               { shadow: false, faceLabel: null });
        R3.callout(F, [x0, 0, zz - 0.006], 26, 10,
                   'I = ' + (S.I * 1000).toFixed(2) + ' mA', S.I ? '#3DD6F5' : th['text-3']);
      }

      /* ---------------- the magnet's field ---------------- */
      if (p.showField) {
        // dipole field lines, traced in the plane through the axis
        const B = (x, z) => {
          const r = Math.hypot(x, z - S.z) || 1e-9;
          const k = MU0 * p.moment / (4 * Math.PI * Math.pow(r, 3));
          const cz = (z - S.z) / r, cx = x / r;
          return [k * 3 * cz * cx, k * (3 * cz * cz - 1)];
        };
        for (let s = 0; s < 7; s++) {
          const a0 = 0.30 + s * 0.36;
          let x = Math.sin(a0) * 0.010, z = S.z + Math.cos(a0) * 0.010;
          const path = [];
          for (let k = 0; k < 260; k++) {
            const [bx, bz] = B(x, z);
            const m = Math.hypot(bx, bz) || 1e-30;
            x += bx / m * 0.0018; z += bz / m * 0.0018;
            path.push([x, 0, z]);
            if (Math.hypot(x, z - S.z) > 0.13) break;
          }
          [1, -1].forEach(sg => {
            R3.polyline(F, path.map(q => [q[0] * sg, 0, q[2]]), '#8FA4CE',
                        { alpha: 0.30, width: 1.1 });
            R3.polyline(F, path.map(q => [0, q[0] * sg, q[2]]), '#8FA4CE',
                        { alpha: 0.18, width: 1.1 });
          });
        }
      }

      /* ---------------- the magnet ---------------- */
      {
        const hl = 0.014, rad = p.Rcoil * 0.42;
        R3.cylinder(F, [0, 0, S.z], [0, 0, S.z + hl], rad, NORTH,
                    { segments: 24, shadow: false, capColour: RX.mix(NORTH, '#ffffff', .18) });
        R3.cylinder(F, [0, 0, S.z - hl], [0, 0, S.z], rad, SOUTH,
                    { segments: 24, shadow: false, capColour: RX.mix(SOUTH, '#ffffff', .18) });
        R3.label(F, [0, 0, S.z + hl * 1.9], 'N', '#FFD7DB', { size: 11 });
        R3.label(F, [0, 0, S.z - hl * 1.9], 'S', '#CFE0FF', { size: 11 });

        // the forces on it, to scale
        const fs = 0.05 / Math.max(p.m * G, 1e-6);
        R3.arrow(F, [rad * 1.9, 0, S.z], [rad * 1.9, 0, S.z - p.m * G * fs], rad * 0.10, '#FFD36B',
                 { head: rad * 0.42, label: 'mg', shadow: false });
        if (Math.abs(S.Fmag) > 1e-5) {
          R3.arrow(F, [-rad * 1.9, 0, S.z], [-rad * 1.9, 0, S.z + S.Fmag * fs], rad * 0.10,
                   '#7CE0A8', { head: rad * 0.42, label: 'F_mag', shadow: false });
        }
      }

      /* ---------------- the free-fall twin, for comparison ---------------- */
      if (p.closed) {
        const gx = p.Rcoil * 3.4;
        const hl = 0.014, rad = p.Rcoil * 0.42;
        R3.cylinder(F, [gx, 0, S.zf], [gx, 0, S.zf + hl], rad, RX.mix(NORTH, '#05080F', .45),
                    { segments: 14, shadow: false, ambient: 0.5 });
        R3.cylinder(F, [gx, 0, S.zf - hl], [gx, 0, S.zf], rad, RX.mix(SOUTH, '#05080F', .45),
                    { segments: 14, shadow: false, ambient: 0.5 });
        R3.callout(F, [gx, 0, S.zf], 20, -14, 'free fall', th['text-3']);
        // the gap between them is the whole point
        if (S.z - S.zf > 0.002) {
          R3.polyline(F, [[0, 0, S.z], [gx, 0, S.z]], '#7CE0A8', { alpha: 0.4, width: 1 });
          R3.polyline(F, [[gx, 0, S.z], [gx, 0, S.zf]], '#7CE0A8', { alpha: 0.85, width: 2 });
          R3.callout(F, [gx, 0, (S.z + S.zf) / 2], 20, 0,
                     ((S.z - S.zf) * 100).toFixed(1) + ' cm behind', '#7CE0A8');
        }
      }

      F.render();

      /* ---------------- the emf trace, as an oscilloscope ---------------- */
      {
        const bw = Math.min(W * 0.38, 330), bh = Math.min(H * 0.30, 140);
        const bx0 = W - bw - 14, by0 = H - bh - 34;
        ctx.fillStyle = g.alpha('#0B1020', .86);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx0, by0, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx0 + 10, by0 + 13, 'INDUCED EMF  ε = −dΦ/dt', th['text-3'], 'left', 8.5);
        const px0 = bx0 + 12, px1 = bx0 + bw - 12, pym = by0 + bh / 2 + 6;
        const hmax = (bh - 46) / 2;
        let emax = 1e-9;
        S.trace.forEach(q => { emax = Math.max(emax, Math.abs(q[1])); });
        ctx.strokeStyle = g.alpha(th['text-3'], .6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px0, pym); ctx.lineTo(px1, pym); ctx.stroke();
        const tmax = Math.max(S.tp, 0.05);
        ctx.strokeStyle = '#3DD6F5'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        S.trace.forEach((q, i) => {
          const x = px0 + (px1 - px0) * q[0] / tmax;
          const y = pym - q[1] / emax * hmax;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
        PA.lbl(ctx, px0, by0 + 26, '+' + emax.toFixed(3) + ' V', th['text-3'], 'left', 8);
        PA.lbl(ctx, px0, by0 + bh - 22, '−' + emax.toFixed(3) + ' V', th['text-3'], 'left', 8);
        PA.lbl(ctx, px1, by0 + bh - 9,
               'two opposite pulses — entering, then leaving', th['text-2'], 'right', 8.5);
      }

      /* ---------------- header ---------------- */
      const inside = Math.abs(S.z) < p.Lcoil / 2;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = !p.closed ? th.crit : S.Fmag > 0.001 ? th.ok : th.text;
      ctx.fillText(!p.closed ? 'CIRCUIT OPEN — no current, no braking, free fall'
                 : inside ? 'PASSING THROUGH — flux changing fastest'
                 : S.z > 0 ? 'APPROACHING — flux rising' : 'LEAVING — flux falling', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('Φ = ' + fmt(S.linkage(S.z), 3) + ' Wb   ·   ε = ' + S.emf.toFixed(4) +
        ' V   ·   I = ' + (S.I * 1000).toFixed(2) + ' mA   ·   F = ' + S.Fmag.toFixed(4) + ' N', 14, 31);
      ctx.fillStyle = p.closed ? th.ok : th['text-3'];
      ctx.fillText('v = ' + Math.abs(S.v).toFixed(3) + ' m/s' +
        (p.closed ? '   ·   free-fall twin would be at ' + Math.abs(S.vf).toFixed(3) + ' m/s' : '') +
        (S.vTerm && S.vTerm < 8 ? '   ·   terminal v ≈ ' + S.vTerm.toFixed(3) + ' m/s' : ''), 14, 45);
    },

    plots: [
      { title: 'Flux, emf and force through the fall — the emf is the slope of the flux',
        legend: [{ c: '#FFAE4C', label: 'flux linkage NΦ' }, { c: '#3DD6F5', label: 'emf' },
                 { c: '#7CE0A8', label: 'braking force' }],
        draw(S, g) {
          const p = S.p;
          const z0 = p.drop + p.Lcoil / 2, z1 = -(p.drop + p.Lcoil);
          const flux = [], demf = [];
          let fmax = 1e-12, dmax = 1e-12;
          for (let i = 0; i <= 200; i++) {
            const z = z0 + (z1 - z0) * i / 200;
            const f = S.linkage(z), d = S.dLdz(z);
            flux.push([z, f]); demf.push([z, d]);
            fmax = Math.max(fmax, Math.abs(f)); dmax = Math.max(dmax, Math.abs(d));
          }
          const P = g.Plot({
            xmin: z1, xmax: z0, ymin: -1.1, ymax: 1.1,
            xlabel: 'magnet position z (m) — coil centre at 0', ylabel: 'normalised',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(1),
            pad: { l: 52, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            P.line(flux.map(q => [q[0], q[1] / fmax]), '#FFAE4C', 2.4);
            P.line(demf.map(q => [q[0], q[1] / dmax]), '#3DD6F5', 2.0);
            P.hline(0, g.alpha(g.theme['text-3'], .7));
            P.vline(-p.Lcoil / 2, g.alpha(g.theme['text-3'], .5), [3, 3]);
            P.vline(p.Lcoil / 2, g.alpha(g.theme['text-3'], .5), [3, 3]);
            P.vline(S.z, g.alpha(g.theme.text, .9));
            P.dot(S.z, S.linkage(S.z) / fmax, 4.5, '#FFAE4C', true);
          });
          P.tag(0, 1.02, 'flux peaks here — so dΦ/dz, and the emf, are ZERO here',
                g.theme.warn, 'center', 0);
        },
        hover(S, x) {
          const f = S.linkage(x), d = S.dLdz(x);
          return [{ label: 'position z', value: x.toFixed(4) + ' m' },
                  { label: 'flux linkage NΦ', value: fmt(f, 4) + ' Wb', color: '#FFAE4C' },
                  { label: 'dΦ/dz', value: fmt(d, 4) + ' Wb/m', color: '#3DD6F5' },
                  { label: 'emf at 1 m/s', value: fmt(-d, 4) + ' V' }];
        } },
      { title: 'Speed against time — braked beside the same magnet in free fall',
        legend: [{ c: '#3DD6F5', label: 'through the coil' }, { c: '#63729A', label: 'free fall' }],
        draw(S, g) {
          if (S.trace.length < 2) return;
          let vmax = 0.5;
          S.trace.forEach(q => { vmax = Math.max(vmax, Math.abs(q[3]), Math.abs(q[5])); });
          const P = g.Plot({
            xmin: 0, xmax: Math.max(S.tp, 0.05), ymin: 0, ymax: vmax * 1.08,
            xlabel: 'time (s)', ylabel: 'speed (m/s)',
            xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(2),
            pad: { l: 54, r: 16, t: 14, b: 34 }
          }).frame();
          P.clip(() => {
            P.line(S.trace.map(q => [q[0], Math.abs(q[5])]), g.alpha(g.theme['text-3'], .8), 1.6, [4, 3]);
            P.line(S.trace.map(q => [q[0], Math.abs(q[3])]), '#3DD6F5', 2.4);
            if (S.vTerm && S.vTerm < vmax * 1.05) {
              P.hline(S.vTerm, g.alpha(g.theme.ok, .7), [3, 3]);
              P.tag(0, S.vTerm, 'terminal velocity mgR/(dΦ/dz)²', g.theme.ok, 'left', -8);
            }
          });
        },
        hover(S, x) {
          if (!S.trace.length) return null;
          let b = S.trace[0];
          for (const q of S.trace) if (Math.abs(q[0] - x) < Math.abs(b[0] - x)) b = q;
          return [{ label: 'time', value: b[0].toFixed(4) + ' s' },
                  { label: 'speed through the coil', value: Math.abs(b[3]).toFixed(4) + ' m/s', color: '#3DD6F5' },
                  { label: 'free-fall speed', value: Math.abs(b[5]).toFixed(4) + ' m/s' },
                  { label: 'emf', value: b[1].toFixed(4) + ' V' },
                  { label: 'current', value: (b[2] * 1000).toFixed(3) + ' mA' }];
        } }
    ],

    readouts(S) {
      const p = S.p;
      return [
        { label: 'Flux linkage NΦ now', value: fmt(S.linkage(S.z), 4), unit: 'Wb', flag: 'accent' },
        { label: 'dΦ/dz at this position', value: fmt(S.dLdz(S.z), 4), unit: 'Wb/m',
          hint: 'zero at the centre — where the flux peaks' },
        { label: 'Induced emf ε = −dΦ/dt', value: S.emf.toFixed(5), unit: 'V', flag: 'accent' },
        { label: 'Induced current I = ε/R', value: (S.I * 1000).toFixed(3), unit: 'mA',
          flag: p.closed ? '' : 'crit', hint: p.closed ? '' : 'circuit open — none flows' },
        { label: 'Peak current so far', value: (S.peakI * 1000).toFixed(3), unit: 'mA' },
        { label: 'Braking force', value: S.Fmag.toFixed(5), unit: 'N',
          flag: S.Fmag > 0 ? 'ok' : '',
          hint: 'always opposes the motion — that IS Lenz\'s law' },
        { label: 'Weight mg', value: (p.m * G).toFixed(5), unit: 'N' },
        { label: 'Braking as a fraction of weight',
          value: (100 * S.Fmag / Math.max(p.m * G, 1e-9)).toFixed(1), unit: '%' },
        { label: 'Coil resistance (copper)', value: S.Rwire.toFixed(3), unit: 'Ω',
          hint: S.turns + ' turns of 0.2 mm wire' },
        { label: 'Total circuit resistance', value: S.Rtot.toFixed(3), unit: 'Ω' },
        { label: 'Terminal velocity', value: S.vTerm && S.vTerm < 50 ? S.vTerm.toFixed(4) : '—',
          unit: 'm/s', hint: 'mgR/(dΦ/dz)² — reached only if the coil is long enough' },
        { label: 'Speed now', value: Math.abs(S.v).toFixed(4), unit: 'm/s' },
        { label: 'Free-fall twin would be at', value: Math.abs(S.vf).toFixed(4), unit: 'm/s',
          flag: Math.abs(S.vf) > Math.abs(S.v) * 1.05 ? 'accent' : '' },
        { label: 'Charge that flowed  q = ΔΦ/R', value: (S.charge * 1000).toFixed(4), unit: 'mC',
          hint: 'depends on the flux CHANGE, not on how fast' },
        { label: 'Energy dissipated as heat', value: fmt(S.heat, 3), unit: 'J',
          hint: 'exactly the kinetic energy the magnet lost' }
      ];
    },

    equation(S) {
      return 'Φ(' + E.v('s') + ') ' + E.op('=') + ' ' +
        E.frac('μ' + E.sub('0') + E.v('m') + E.v('a') + '²', '2(' + E.v('a') + '² ' + E.op('+') +
               ' ' + E.v('s') + '²)<sup>3/2</sup>') +
        '&nbsp;&nbsp;ε ' + E.op('=') + ' ' + E.op('−') + E.v('N') +
        E.frac('dΦ', 'd' + E.v('t')) + ' ' + E.op('=') + ' ' + E.op('−') +
        E.frac('dΦ', 'd' + E.v('z')) + E.v('v') + ' ' + E.op('=') + ' ' + E.n(S.emf, 'V') +
        '<br>' + E.v('F') + ' ' + E.op('=') + ' ' + E.v('I') +
        E.frac('dΦ', 'd' + E.v('z')) + ' ' + E.op('=') + ' ' +
        E.frac('(dΦ/d' + E.v('z') + ')²' + E.v('v'), E.v('R')) +
        ' ' + E.op('⇒') + ' ' + E.v('v') + E.sub('term') + ' ' + E.op('=') + ' ' +
        E.frac(E.v('mgR'), '(dΦ/d' + E.v('z') + ')²');
    },

    walkthrough: [
      { title: '1 · Two pulses, not one',
        body: 'Watch the oscilloscope as the magnet falls through. The emf swings one way and then the other.',
        ask: 'Why does the emf reverse halfway through?',
        reveal: 'Because the flux <b>rises</b> as the magnet approaches and <b>falls</b> as it leaves, and the ' +
          'emf is the slope of that curve. The second pulse is <b>taller and narrower</b> than the first — ' +
          'the magnet is moving faster by then, so the same flux change happens in less time.',
        params: { closed: true, Rload: 0.5 } },
      { title: '2 · The moment nothing is induced',
        body: 'Look at the left graph. The flux peaks when the magnet is at the centre of the coil.',
        ask: 'At the exact centre the flux through the coil is at its maximum. What is the emf there?',
        reveal: '<b>Zero.</b> The emf depends on the <b>rate of change</b> of flux, not on its size, and at a ' +
          'maximum the rate of change is zero. This is the single most reliably examined point in the ' +
          'chapter: maximum flux and maximum emf never happen at the same moment.',
        params: { closed: true, Rload: 0.5 } },
      { title: '3 · Open the circuit',
        body: 'Switch the circuit open and drop it again. The break appears in the wiring.',
        ask: 'There is still an emf. Why is there no braking?',
        reveal: 'Because no <b>current</b> can flow, and force needs current. The emf is still induced — Faraday ' +
          'does not care whether the circuit is complete — but with I = 0 there is nothing for the field to push ' +
          'on, and the magnet falls exactly like its free-fall twin. Braking costs energy, and that energy has ' +
          'to be dissipated <b>somewhere</b>.',
        params: { closed: false } },
      { title: '4 · Lower the resistance',
        body: 'Close the circuit and take R from 40 Ω down to 0.3 Ω.',
        ask: 'What does resistance control here?',
        reveal: 'The current, and therefore the force. F = (dΦ/dz)²v/R, so <b>halving R doubles the braking</b>. ' +
          'A copper tube is the limiting case — a continuous conductor of almost no resistance — which is why ' +
          'a magnet dropped down one falls so slowly it looks faked.',
        params: { closed: true, Rload: 0.1 } },
      { title: '5 · Where the energy went',
        body: 'Compare the heat dissipated with the kinetic energy the magnet did not gain.',
        ask: 'The magnet arrives slower than free fall. Where did the missing energy go?',
        reveal: 'Into <b>resistive heating of the coil</b>, joule for joule. Lenz\'s law is energy conservation ' +
          'wearing a sign convention: if the induced effect helped the motion instead of opposing it, the ' +
          'magnet would accelerate <b>and</b> heat the coil, creating energy from nothing.',
        params: { closed: true, Rload: 2.0 } }
    ],

    problems: [
      { source: 'JEE Main pattern · Faraday',
        q: 'A coil of 260 turns links a flux that changes by 1.20 mWb in 0.040 s at a steady rate. Find the magnitude of the average induced emf, in volts.',
        params: { N: 520, closed: true, Rload: 0.5 },
        predict: { label: 'average emf', unit: 'V', tol: 0.02 },
        measure: () => 260 * 1.20e-3 / 0.040,
        working: 'ε = N·ΔΦ/Δt = 260 × 1.20×10⁻³ / 0.040 = <b>7.8 V</b>. The turns multiply the flux ' +
          'linkage, so N belongs in the numerator. Note the question gives the flux change <i>per turn</i> — ' +
          'when it gives the total linkage instead, N must not be applied twice.' },
      { source: 'JEE Advanced pattern · induced charge',
        q: 'A coil of resistance 2.0 Ω has its flux linkage changed by 0.80 mWb. Find the total charge that circulates, in millicoulombs.',
        params: { Rload: 0.5, closed: true },
        predict: { label: 'charge', unit: 'mC', tol: 0.03 },
        measure: () => 0.80e-3 / 2.0 * 1000,
        working: 'q = ∫I dt = ∫(ε/R)dt = ΔΦ/R = 0.80×10⁻³ / 2.0 = 4.0×10⁻⁴ C = <b>0.40 mC</b>. ' +
          'The striking part is what is <b>absent</b>: time. Move the magnet quickly or slowly and the same ' +
          'charge flows, because a bigger current simply lasts proportionally less long.' }
    ],

    quiz: [
      { q: 'A bar magnet is dropped through a horizontal conducting ring. As it falls, the magnet:',
        options: ['accelerates faster than g', 'accelerates at exactly g',
                  'accelerates at less than g', 'moves at constant velocity throughout'], answer: 2,
        why: "The induced current always opposes the change producing it, so the force on the magnet is upward while it approaches and again while it leaves. The net downward acceleration is therefore less than g — though not zero unless the braking happens to balance the weight." },
      { q: 'A magnet is at the exact centre of a coil, moving. At that instant:',
        options: ['the flux and the emf are both maximum', 'the flux is maximum and the emf is zero',
                  'the flux is zero and the emf is maximum', 'both are zero'], answer: 1,
        why: 'Flux is greatest at the centre, so its rate of change there is zero and so is the emf. Maximum flux and maximum emf occur at different positions — a quarter of the chapter turns on this distinction.' },
      { q: 'The total charge that flows through a coil when its flux linkage changes by ΔΦ is:',
        options: ['ΔΦ·R', 'ΔΦ/R', 'ΔΦ/Rt', 'R/ΔΦ'], answer: 1,
        why: 'q = ∫I dt = ∫(ε/R) dt = ΔΦ/R. Time cancels, so the charge depends only on how much the flux changed and not at all on how quickly — which is exactly how a ballistic galvanometer measures flux.' },
      { q: 'Doubling the resistance in the circuit of the coil, everything else unchanged, causes the braking force to:',
        options: ['double', 'halve', 'stay the same', 'quadruple'], answer: 1,
        why: 'F = (dΦ/dz)²v/R, so the force is inversely proportional to R. The emf is unchanged — Faraday knows nothing about the resistance — but the current it drives, and hence the force, is halved.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>ε = −N dΦ/dt with a given flux law, including flux quoted as a polynomial in t.</li>' +
      '<li>Induced charge q = ΔΦ/R, and the fact that it is independent of time.</li>' +
      '<li>Motional emf Bℓv, and rods on rails, which is this same calculation with a simpler geometry.</li>' +
      "<li>Lenz's law as a sign, and as a statement of energy conservation.</li></ul>" +
      '<div class="pyq"><em>Trap to avoid</em>The emf depends on <b>dΦ/dt</b>, never on Φ. A question that ' +
      'tells you the flux is large at some instant is telling you nothing about the emf there — and if the ' +
      'flux is <b>constant</b>, however large, the emf is exactly zero. Equally, an emf exists whether or not ' +
      'the circuit is closed; only the <b>current</b> and the <b>force</b> need a complete path.</div>'
  });

})(window.InsightLab);

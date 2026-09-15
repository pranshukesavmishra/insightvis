/* ============================================================
   PHYSICS (syllabus core) — 13. Current electricity: the circuit bench
                             14. Ray optics: the optical bench
                             15. Waves and sound
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, TAU, fmt, E, Camera } = L;
  const PA = window.PHYSART, R3 = window.R3, RX = window.RX, SV = window.SOLVE;

  /* =========================================================================
     13 · CURRENT ELECTRICITY — every current is SOLVED, never assigned

     The lab builds the node-admittance matrix from whatever is actually
     wired up and solves it by modified nodal analysis. Nothing about
     Kirchhoff, the Wheatstone balance condition or the potentiometer's
     null is coded in: they all fall out of the solve, which is the point.
     ========================================================================= */

  /* The four circuits the syllabus actually examines. Each returns the
     network plus whatever the drawing and the readouts need to describe it. */
  function buildCircuit(S) {
    const p = S.p;
    const N = { };
    if (p.circuit === 'network') {
      /* A cell driving R1 in series with (R2 ∥ R3). Node 1 = +, 2 = junction. */
      const net = SV.Net(3);
      net.bat(0, 1, p.emf, p.rInt).res(1, 2, p.R1).res(2, 0, p.R2).res(2, 0, p.R3);
      const r = net.solve();
      const Rpar = 1 / (1 / p.R2 + 1 / p.R3);
      N.net = net; N.ok = r.ok;
      N.Rext = p.R1 + Rpar;
      N.I = net.I(1, 2, p.R1);
      N.terminal = net.V[1];
      N.Rpar = Rpar;
    } else if (p.circuit === 'wheatstone') {
      /* A(1) is the + terminal, C(0) is ground, B(2) and D(3) are the
         bridge corners with the galvanometer between them. */
      const net = SV.Net(4);
      net.bat(0, 1, p.emf, p.rInt)
         .res(1, 2, p.P).res(2, 0, p.Q)
         .res(1, 3, p.Rarm).res(3, 0, p.Sarm)
         .res(2, 3, p.Rg);
      const r = net.solve();
      N.net = net; N.ok = r.ok;
      N.Ig = net.I(2, 3, p.Rg);
      N.Vbd = net.V[2] - net.V[3];
      N.balanceErr = p.P * p.Sarm - p.Q * p.Rarm;    // zero exactly at balance
    } else if (p.circuit === 'meter') {
      /* Meter bridge: a 1 m uniform wire of total resistance Rwire, tapped
         at fraction f by the jockey. The two halves ARE the Q and S arms,
         so the balance point is a length, not a resistance setting. */
      const net = SV.Net(4);
      const f = clamp(p.jockey, 0.01, 0.99);
      const Rleft = p.Rwire * f, Rright = p.Rwire * (1 - f);
      net.bat(0, 1, p.emf, p.rInt)
         .res(1, 2, p.Rknown).res(2, 0, p.Runknown)   // the two gaps: node 2 = top
         .res(1, 3, Rleft).res(3, 0, Rright)          // the wire, tapped at node 3
         .res(2, 3, p.Rg);
      const r = net.solve();
      N.net = net; N.ok = r.ok;
      N.Ig = net.I(2, 3, p.Rg);
      N.Vbd = net.V[2] - net.V[3];
      N.f = f;
      N.balanceLen = p.Rknown / (p.Rknown + p.Runknown);   // where the null IS
      N.Rleft = Rleft; N.Rright = Rright;
    } else {
      /* Potentiometer: a driver cell sends a steady current down a wire of
         resistance Rwire; the cell under test opposes the tapped fraction.
         At balance NO current flows through the test cell — which is why a
         potentiometer measures true emf and a voltmeter cannot. */
      /* 0 = B (the far end, ground), 1 = the driver's + terminal,
         2 = A (the near end of the wire), 3 = the jockey, 4 = the test
         cell's − terminal. The galvanometer sits between 4 and 3. */
      const net = SV.Net(5);
      const f = clamp(p.jockey, 0.01, 1.0);
      net.bat(0, 1, p.emf, p.rInt).res(1, 2, p.Rseries)
         .res(2, 3, p.Rwire * f).res(3, 0, p.Rwire * (1 - f));
      // the cell under test: + terminal at A, − through the galvanometer
      // to the jockey, so it OPPOSES the drop along A→jockey
      net.bat(4, 2, p.emfTest, p.rTest).res(4, 3, p.Rg);
      const r = net.solve();
      N.net = net; N.ok = r.ok;
      N.Ig = net.I(4, 3, p.Rg);
      N.f = f;
      N.Idrive = net.I(1, 2, p.Rseries);
      N.gradient = N.Idrive * p.Rwire;                // volts across the whole wire
      N.balanceLen = N.gradient > 0 ? p.emfTest / N.gradient : 0;
    }
    return N;
  }

  L.register({
    id: 'circuits', subject: 'physics',
    name: 'The Circuit Bench — Kirchhoff, Wheatstone and the Potentiometer',
    chapter: 'Current Electricity',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: false,
    stageHint: 'Switch the circuit · drag the jockey to hunt the null · every current is solved from one matrix, not assigned',
    lede: 'Nothing in this lab knows Kirchhoff\'s laws as a rule. It builds the <b>node-admittance matrix</b> ' +
      'from whatever is wired up and solves it, so every current and every potential you see was computed ' +
      'from conservation alone. That means the Wheatstone balance condition, the meter-bridge null and the ' +
      'potentiometer\'s zero-current reading are <b>results</b>, not assumptions — and you can put the bridge ' +
      'out of balance, load a cell until its terminal voltage sags, or measure the same cell with a ' +
      'potentiometer and a voltmeter and watch them <b>disagree</b>.',

    params: { circuit: 'network', emf: 6, rInt: 0.5, R1: 2, R2: 6, R3: 3,
              P: 10, Q: 20, Rarm: 30, Sarm: 60, Rg: 50,
              Rknown: 4, Runknown: 6, Rwire: 5, jockey: 0.40,
              Rseries: 5, emfTest: 1.2, rTest: 0.8, autoNull: false },

    presets: [
      { name: 'Series + parallel network', params: { circuit: 'network', emf: 6, rInt: 0.5, R1: 2, R2: 6, R3: 3 } },
      { name: 'A cell under load', params: { circuit: 'network', emf: 6, rInt: 2.0, R1: 1, R2: 3, R3: 3 } },
      { name: 'Wheatstone at balance', params: { circuit: 'wheatstone', emf: 10, rInt: 0, P: 10, Q: 20, Rarm: 30, Sarm: 60, Rg: 50 } },
      { name: 'Wheatstone out of balance', params: { circuit: 'wheatstone', emf: 10, rInt: 0, P: 10, Q: 20, Rarm: 30, Sarm: 45, Rg: 50 } },
      { name: 'Meter bridge · find R', params: { circuit: 'meter', emf: 2, rInt: 0, Rknown: 4, Runknown: 6, Rwire: 5, Rg: 60, jockey: 0.40 } },
      { name: 'Meter bridge · off the null', params: { circuit: 'meter', emf: 2, rInt: 0, Rknown: 4, Runknown: 6, Rwire: 5, Rg: 60, jockey: 0.62 } },
      { name: 'Potentiometer · true emf', params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 5, Rwire: 10, emfTest: 1.2, rTest: 0.8, Rg: 60, jockey: 0.60 } },
      { name: 'Potentiometer · heavy internal r', params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 5, Rwire: 10, emfTest: 1.2, rTest: 6, Rg: 60, jockey: 0.60 } }
    ],

    controls: [
      { group: 'Circuit', items: [
        { key: 'circuit', type: 'select', label: 'What is wired up', restructure: true, options: [
          { value: 'network', label: 'Network' }, { value: 'wheatstone', label: 'Wheatstone' },
          { value: 'meter', label: 'Meter bridge' }, { value: 'potentiometer', label: 'Potentiometer' }] }
      ] },
      { group: 'The driving cell', items: [
        { key: 'emf', label: 'emf <i>ε</i>', min: 0.5, max: 12, step: 0.1, unit: 'V', fmt: v => v.toFixed(1), restructure: true },
        { key: 'rInt', label: 'Internal resistance <i>r</i>', min: 0, max: 5, step: 0.05, unit: 'Ω', fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Network resistors', items: [
        { key: 'R1', label: 'Series <i>R</i>₁', min: 0.5, max: 20, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'R2', label: 'Parallel <i>R</i>₂', min: 0.5, max: 20, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'R3', label: 'Parallel <i>R</i>₃', min: 0.5, max: 20, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Bridge arms', items: [
        { key: 'P', label: 'Arm <i>P</i>', min: 1, max: 60, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Q', label: 'Arm <i>Q</i>', min: 1, max: 60, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Rarm', label: 'Arm <i>R</i>', min: 1, max: 90, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Sarm', label: 'Arm <i>S</i>', min: 1, max: 90, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Bridge wire and gaps', items: [
        { key: 'Rknown', label: 'Known resistance', min: 0.5, max: 20, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Runknown', label: 'Unknown resistance <i>X</i>', min: 0.5, max: 20, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'Rwire', label: 'Wire resistance (whole metre)', min: 1, max: 20, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'jockey', label: 'Jockey position <i>ℓ</i>', min: 0.01, max: 0.99, step: 0.001, unit: 'm', fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'Potentiometer', items: [
        { key: 'Rseries', label: 'Rheostat in series', min: 0.5, max: 30, step: 0.5, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true },
        { key: 'emfTest', label: 'Cell under test <i>ε</i>₂', min: 0.2, max: 2.5, step: 0.01, unit: 'V', fmt: v => v.toFixed(2), restructure: true },
        { key: 'rTest', label: 'Its internal resistance', min: 0, max: 12, step: 0.1, unit: 'Ω', fmt: v => v.toFixed(1), restructure: true }
      ] },
      { group: 'Instrument', items: [
        { key: 'Rg', label: 'Galvanometer resistance', min: 5, max: 200, step: 1, unit: 'Ω', fmt: v => v.toFixed(0), restructure: true },
        { key: 'autoNull', type: 'toggle', label: 'Snap the jockey to the null' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      if (p.autoNull && (p.circuit === 'meter' || p.circuit === 'potentiometer')) {
        // the null position is known analytically; snapping to it lets the
        // student check the formula against where the needle actually dies
        const target = p.circuit === 'meter'
          ? p.Rknown / (p.Rknown + p.Runknown)
          : (function () {
              const I = p.emf / (p.rInt + p.Rseries + p.Rwire);
              return I * p.Rwire > 0 ? p.emfTest / (I * p.Rwire) : 0.5;
            })();
        p.jockey = clamp(target, 0.01, 0.99);
      }
      S.C = buildCircuit(S);
      /* Full-scale deflection: a real galvanometer is a µA instrument, so
         the needle is driven by the current on a scale a bridge detector
         would actually use. */
      S.fsd = 2e-3;
      S.needle = S.needle || 0;
    },

    step(S, dt) {
      // the needle has inertia — a real moving coil does not jump
      const target = clamp((S.C.Ig || 0) / S.fsd, -1, 1);
      S.needle += (target - S.needle) * Math.min(1, dt * 9);
      S.t2 = (S.t2 || 0) + dt;
    },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h, C = S.C;
      const HDR = 58, FOOT = 30;
      const y0 = HDR, y1 = H - FOOT, CH = y1 - y0;
      const acc = th.phys;

      /* Current is drawn as charge actually moving along the wires, at a
         speed proportional to the current in THAT branch — so a branch
         carrying nothing is visibly still. This is the one place the lab
         animates, and it animates a solved quantity. */
      const flow = (pts, I, colour) => {
        PA.wire(ctx, pts, colour || PA.C.wire, { r: 2.4 });
        if (!isFinite(I) || Math.abs(I) < 1e-7) return;
        let len = 0; const seg = [];
        for (let i = 1; i < pts.length; i++) {
          const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          seg.push(d); len += d;
        }
        const n = Math.max(2, Math.round(len / 34));
        const speed = clamp(Math.abs(I) * 90, 6, 150) * Math.sign(I);
        const phase = ((S.t2 || 0) * speed / len) % 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < n; k++) {
          let u = ((k / n + phase) % 1 + 1) % 1, want = u * len, acc2 = 0, px = 0, py = 0;
          for (let i = 0; i < seg.length; i++) {
            if (acc2 + seg[i] >= want) {
              const t = seg[i] > 0 ? (want - acc2) / seg[i] : 0;
              px = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
              py = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
              break;
            }
            acc2 += seg[i];
          }
          const gr = ctx.createRadialGradient(px, py, 0, px, py, 5);
          gr.addColorStop(0, g.alpha(acc, .95)); gr.addColorStop(1, g.alpha(acc, 0));
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
        }
        ctx.restore();
      };

      const node = (x, y, v, tag) => {
        ctx.fillStyle = g.alpha(PA.C.wire, .9);
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
        if (tag) PA.lbl(ctx, x, y - 12, tag, th['text-2'], 'center', 10);
        if (v != null) PA.lbl(ctx, x, y + 13, v.toFixed(2) + ' V', g.alpha(acc, .95), 'center', 9);
      };

      /* ============ the four layouts ============ */
      if (p.circuit === 'network') {
        /* The whole network is laid out inside the band left over after the
           header, the foot and the balance panel — nothing is allowed to run
           off the right edge or under the panel (§2.7). */
        const xL = W * 0.13, xR = W * 0.92;
        const yt = y0 + CH * 0.18, yb = y0 + CH * 0.66;
        const xR1 = W * 0.33, xB = W * 0.58, xRes = W * 0.76;
        const I = C.I, I2 = C.net.I(2, 0, p.R2), I3 = C.net.I(2, 0, p.R3);
        const yp1 = y0 + CH * 0.34, yp2 = y0 + CH * 0.50;

        flow([[xL, yb], [xL, yt], [xR1 - 30, yt]], I);
        PA.resistor(ctx, xR1, yt, 56, 20, { bands: ['#5A3A22', '#111722', '#C03A3A', '#D9A441'] });
        PA.lbl(ctx, xR1, yt - 20, 'R₁ = ' + p.R1.toFixed(1) + ' Ω', th['text-2'], 'center', 9.5);
        PA.lbl(ctx, xR1, yt + 21, fmt(I, 3) + ' A', acc, 'center', 9.5);
        flow([[xR1 + 30, yt], [xB, yt], [xB, yp1]], I);
        // the two parallel branches, both returning to the right rail
        [[yp1, p.R2, I2, 'R₂'], [yp2, p.R3, I3, 'R₃']].forEach(([yy, R, Ib, tag]) => {
          flow([[xB, yy], [xRes - 28, yy]], Ib);
          PA.resistor(ctx, xRes, yy, 54, 18, { bands: ['#111722', '#C03A3A', '#D9A441', '#5A3A22'] });
          PA.lbl(ctx, xRes, yy - 18, tag + ' = ' + R.toFixed(1) + ' Ω', th['text-2'], 'center', 9);
          PA.lbl(ctx, xRes, yy + 18, fmt(Ib, 3) + ' A', acc, 'center', 9);
          flow([[xRes + 28, yy], [xR, yy]], Ib);
        });
        flow([[xB, yp1], [xB, yp2]], 0);
        flow([[xR, yp1], [xR, yb], [xL, yb]], I);
        // the cell sits in the return wire, clear of the balance panel
        const cx0 = W * 0.30;
        PA.cell(ctx, cx0, yb, 54, 26, { n: 1 });
        PA.lbl(ctx, cx0, yb + 26, 'ε = ' + p.emf.toFixed(1) + ' V   ·   r = ' + p.rInt.toFixed(2) + ' Ω',
               th['text-2'], 'center', 9.5);
        node(xL, yt, C.net.V[1], 'A');
        node(xB, yp1, C.net.V[2], 'B');
        node(xR, yb, 0, 'C');
      }

      else if (p.circuit === 'wheatstone' || p.circuit === 'meter') {
        const isMeter = p.circuit === 'meter';
        /* The metre bridge carries its wire along the bottom, where the
           balance panel lives, so that layout is shifted right and tightened
           until the wire's zero mark clears the panel. */
        const cx = W * (isMeter ? 0.57 : 0.50), cy = y0 + CH * (isMeter ? 0.42 : 0.46);
        const rx = Math.min(W * (isMeter ? 0.185 : 0.21), 190);
        const ry = Math.min(CH * (isMeter ? 0.27 : 0.30), 112);
        const A = [cx - rx, cy], Cn = [cx + rx, cy];
        const B = [cx, cy - ry], D = [cx, cy + ry];
        const V = C.net.V;
        const arms = isMeter
          ? [[A, B, p.Rknown, 'known', C.net.I(1, 2, p.Rknown)],
             [B, Cn, p.Runknown, 'X', C.net.I(2, 0, p.Runknown)]]
          : [[A, B, p.P, 'P', C.net.I(1, 2, p.P)], [B, Cn, p.Q, 'Q', C.net.I(2, 0, p.Q)],
             [A, D, p.Rarm, 'R', C.net.I(1, 3, p.Rarm)], [D, Cn, p.Sarm, 'S', C.net.I(3, 0, p.Sarm)]];
        arms.forEach(([a, b, R, tag, Ib]) => {
          flow([a, b], Ib);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
          PA.resistor(ctx, 0, 0, 50, 18, { bands: ['#5A3A22', '#111722', '#C03A3A', '#D9A441'] });
          ctx.restore();
          /* Offset the label along the arm's own outward normal, not simply
             up or down: on a diagonal arm "up" lands on the resistor. */
          const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
          let nx = -dy / dl, ny = dx / dl;
          if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
          PA.lbl(ctx, mx + nx * 30, my + ny * 30,
                 tag + ' = ' + R.toFixed(1) + ' Ω  ·  ' + fmt(Ib, 3) + ' A', th['text-2'], 'center', 9);
        });

        if (isMeter) {
          /* the metre wire, with the jockey riding on it */
          const wx0 = cx - rx, wx1 = cx + rx, wy = cy + ry;
          PA.wire(ctx, [[wx0, wy], [wx1, wy]], PA.C.brass, { r: 3.4 });
          for (let i = 0; i <= 10; i++) {
            const x = wx0 + (wx1 - wx0) * i / 10;
            ctx.strokeStyle = g.alpha(th['text-3'], i % 5 === 0 ? .85 : .45);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, wy + 5); ctx.lineTo(x, wy + (i % 5 === 0 ? 13 : 9)); ctx.stroke();
            if (i % 5 === 0) PA.lbl(ctx, x, wy + 21, (i * 10) + '', th['text-3'], 'center', 8.5);
          }
          PA.lbl(ctx, cx, wy + 34, 'metre bridge wire — cm', th['text-3'], 'center', 9);
          const jx = wx0 + (wx1 - wx0) * C.f;
          flow([A, [wx0, wy]], C.net.I(1, 3, C.Rleft));
          flow([[wx1, wy], Cn], C.net.I(3, 0, C.Rright));
          // the jockey
          ctx.fillStyle = g.alpha(PA.C.steel, .95);
          ctx.beginPath(); ctx.moveTo(jx, wy - 3); ctx.lineTo(jx - 6, wy - 17);
          ctx.lineTo(jx + 6, wy - 17); ctx.closePath(); ctx.fill();
          flow([[jx, wy - 17], [jx, cy + ry * 0.42]], C.Ig);
          flow([[jx, cy + ry * 0.42], [cx + 46, cy + ry * 0.42]], C.Ig);
          S._jx = jx; S._jy = wy - 17; S._wx0 = wx0; S._wx1 = wx1;
          // galvanometer between B and the jockey
          const gX = cx + 78, gY = cy + ry * 0.42;
          flow([[cx + 46, gY], [gX - 24, gY]], C.Ig);
          PA.galvo(ctx, gX, gY, 24, S.needle, { tag: 'G' });
          flow([[gX + 24, gY], [gX + 46, gY], [gX + 46, cy - ry * 0.3], [B[0], B[1]]], C.Ig);
        } else {
          // galvanometer straight across the bridge
          const gX = cx, gY = cy;
          flow([B, [gX, gY - 26]], C.Ig);
          PA.galvo(ctx, gX, gY, 26, S.needle, { tag: 'G' });
          flow([[gX, gY + 26], D], C.Ig);
          PA.lbl(ctx, gX + 36, gY, 'R_g = ' + p.Rg.toFixed(0) + ' Ω', th['text-3'], 'left', 9);
        }

        // the cell across A and C
        const cellY = y0 + CH * 0.05;
        flow([A, [A[0], cellY], [cx - 40, cellY]], C.net.Ib ? -C.net.Ib[0] : 0);
        PA.cell(ctx, cx, cellY, 50, 24, { n: 1 });
        flow([[cx + 40, cellY], [Cn[0], cellY], Cn], C.net.Ib ? -C.net.Ib[0] : 0);
        PA.lbl(ctx, cx, cellY - 22, 'ε = ' + p.emf.toFixed(1) + ' V', th['text-2'], 'center', 9.5);

        node(A[0], A[1], V[1], 'A');
        node(B[0], B[1], V[2], 'B');
        node(Cn[0], Cn[1], V[0], 'C');
        if (!isMeter) node(D[0], D[1], V[3], 'D');
      }

      else {
        /* potentiometer: the driver loop on top, the wire across the middle,
           the cell under test hanging below with the galvanometer */
        const wx0 = W * 0.16, wx1 = W * 0.84, wy = y0 + CH * 0.50;
        const topY = y0 + CH * 0.10;
        const V = C.net.V;
        flow([[wx0, wy], [wx0, topY], [wx0 + 60, topY]], C.Idrive);
        PA.cell(ctx, wx0 + 96, topY, 50, 24, { n: 2 });
        PA.lbl(ctx, wx0 + 96, topY - 22, 'driver ε = ' + p.emf.toFixed(1) + ' V', th['text-2'], 'center', 9.5);
        flow([[wx0 + 132, topY], [wx0 + 190, topY]], C.Idrive);
        PA.resistor(ctx, wx0 + 222, topY, 56, 18, { bands: ['#111722', '#5A3A22', '#D9A441', '#C03A3A'] });
        PA.lbl(ctx, wx0 + 222, topY - 20, 'rheostat ' + p.Rseries.toFixed(1) + ' Ω', th['text-2'], 'center', 9);
        flow([[wx0 + 250, topY], [wx1, topY], [wx1, wy]], C.Idrive);

        // the potentiometer wire itself, brass and graduated
        PA.wire(ctx, [[wx0, wy], [wx1, wy]], PA.C.brass, { r: 3.6 });
        for (let i = 0; i <= 10; i++) {
          const x = wx0 + (wx1 - wx0) * i / 10;
          ctx.strokeStyle = g.alpha(th['text-3'], i % 5 === 0 ? .85 : .45);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, wy - 6); ctx.lineTo(x, wy - (i % 5 === 0 ? 15 : 10)); ctx.stroke();
          if (i % 5 === 0) PA.lbl(ctx, x, wy - 23, (i * 10) + '', th['text-3'], 'center', 8.5);
        }
        PA.lbl(ctx, (wx0 + wx1) / 2, wy - 36, 'potentiometer wire — cm from A', th['text-3'], 'center', 9);
        PA.lbl(ctx, wx0 - 12, wy, 'A', th['text-2'], 'right', 11);
        PA.lbl(ctx, wx1 + 12, wy, 'B', th['text-2'], 'left', 11);

        const jx = wx0 + (wx1 - wx0) * C.f;
        ctx.fillStyle = g.alpha(PA.C.steel, .95);
        ctx.beginPath(); ctx.moveTo(jx, wy + 3); ctx.lineTo(jx - 6, wy + 17);
        ctx.lineTo(jx + 6, wy + 17); ctx.closePath(); ctx.fill();
        S._jx = jx; S._jy = wy + 17; S._wx0 = wx0; S._wx1 = wx1;

        const gY = y0 + CH * 0.84;
        flow([[jx, wy + 17], [jx, gY]], C.Ig);
        const gX = clamp(jx, wx0 + 120, wx1 - 60);
        flow([[jx, gY], [gX - 22, gY]], C.Ig);
        PA.galvo(ctx, gX, gY, 22, S.needle, { tag: 'G' });
        flow([[gX + 22, gY], [gX + 70, gY]], C.Ig);
        PA.cell(ctx, gX + 106, gY, 44, 22, { n: 1, fill: '#3A2E55' });
        PA.lbl(ctx, gX + 106, gY + 24, 'ε₂ = ' + p.emfTest.toFixed(2) + ' V,  r = ' + p.rTest.toFixed(1) + ' Ω',
               '#C9A8F0', 'center', 9.5);
        flow([[gX + 142, gY], [wx1 - 10, gY], [wx1 - 10, wy + 40], [wx0, wy + 40], [wx0, wy]], C.Ig);
        node(wx0, wy, V[2], 'A');
        node(jx, wy, V[3], null);
      }

      /* ---------------- the jockey as a handle ---------------- */
      if ((p.circuit === 'meter' || p.circuit === 'potentiometer') && S._jx != null) {
        const on = g.dragging === 'jockey';
        ctx.save();
        ctx.strokeStyle = on ? th.text : g.alpha(acc, .7);
        ctx.lineWidth = on ? 2.2 : 1.5;
        ctx.beginPath(); ctx.arc(S._jx, S._jy, 12, 0, TAU); ctx.stroke();
        ctx.restore();
        PA.lbl(ctx, S._jx, S._jy + (p.circuit === 'meter' ? -26 : 30),
               'ℓ = ' + (p.jockey * 100).toFixed(1) + ' cm · drag',
               on ? th.text : g.alpha(th['text-3'], .95), 'center', 9);
        g.handle(S._jx, S._jy, 16, 'jockey');
      }

      /* ---------------- the balance panel ----------------
         The lab never tells the student the balance condition; it reports
         what the SOLVER found and lets the condition be checked against it. */
      {
        const two = p.circuit === 'meter' || p.circuit === 'potentiometer';
        const bw = Math.min(W * 0.30, 268), bh = two ? 118 : 90;
        const bx = 12, by = H - bh - 22;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        const title = p.circuit === 'network' ? 'THE CELL UNDER LOAD'
          : p.circuit === 'wheatstone' ? 'THE BRIDGE CONDITION'
          : p.circuit === 'meter' ? 'THE METRE BRIDGE' : 'THE POTENTIOMETER';
        PA.lbl(ctx, bx + 10, by + 13, title, th['text-3'], 'left', 8.5);
        const row = (i, k, v, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, v, c || th['text-2'], 'right', 9.5);
        };
        if (p.circuit === 'network') {
          row(0, 'external R = R₁ + R₂∥R₃', C.Rext.toFixed(3) + ' Ω');
          row(1, 'current  ε/(R + r)', fmt(C.I, 4) + ' A', acc);
          row(2, 'terminal voltage  ε − Ir', C.terminal.toFixed(3) + ' V', th.text);
          row(3, 'lost to internal r', (p.emf - C.terminal).toFixed(3) + ' V',
              p.emf - C.terminal > 0.5 ? th.warn : th['text-2']);
        } else if (p.circuit === 'wheatstone') {
          row(0, 'P/Q', (p.P / p.Q).toFixed(4));
          row(1, 'R/S', (p.Rarm / p.Sarm).toFixed(4));
          row(2, 'galvanometer current', fmt(C.Ig, 3) + ' A',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
          row(3, 'verdict', Math.abs(C.Ig) < 1e-9 ? 'BALANCED' : 'off balance',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
        } else if (p.circuit === 'meter') {
          row(0, 'jockey at  ℓ', (p.jockey * 100).toFixed(1) + ' cm');
          row(1, 'balance needs  ℓ/(100−ℓ) = known/X', (C.balanceLen * 100).toFixed(1) + ' cm', acc);
          row(2, 'galvanometer current', fmt(C.Ig, 3) + ' A',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
          row(3, 'X read off the null', (p.Rknown * (1 - C.balanceLen) / C.balanceLen).toFixed(3) + ' Ω', th.text);
          row(4, 'verdict', Math.abs(C.Ig) < 1e-9 ? 'NULL — read ℓ' : 'move the jockey',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
        } else {
          row(0, 'potential gradient  k', (C.gradient / 1.0).toFixed(4) + ' V/m', acc);
          row(1, 'jockey at  ℓ', (p.jockey * 100).toFixed(1) + ' cm');
          row(2, 'balance needs  ℓ = ε₂/k', (C.balanceLen * 100).toFixed(1) + ' cm');
          row(3, 'current through the test cell', fmt(C.Ig, 3) + ' A',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
          row(4, 'verdict', Math.abs(C.Ig) < 1e-9 ? 'NULL — reads TRUE emf' : 'move the jockey',
              Math.abs(C.Ig) < 1e-9 ? th.ok : th.crit);
        }
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      const nulled = (p.circuit === 'wheatstone' || p.circuit === 'meter' ||
                      p.circuit === 'potentiometer') && Math.abs(C.Ig) < 1e-9;
      ctx.fillStyle = nulled ? th.ok : th.text;
      ctx.fillText(
        p.circuit === 'network' ? 'I = ' + fmt(C.I, 4) + ' A through the main branch'
        : nulled ? 'NULL — the galvanometer reads zero'
        : 'galvanometer carries ' + fmt(C.Ig, 3) + ' A', 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText(p.circuit === 'network'
        ? 'ε = ' + p.emf.toFixed(1) + ' V · r = ' + p.rInt.toFixed(2) + ' Ω · every current from one matrix solve'
        : 'every potential and current here was solved from Kirchhoff, never assigned', 14, 31);
    },

    /* the jockey is the instrument: drag it and hunt the null by hand */
    onDrag(S, e) {
      if (e.id !== 'jockey' || S._wx0 == null) return;
      const span = S._wx1 - S._wx0;
      if (span <= 0) return;
      S.p.autoNull = false;
      S.p.jockey = clamp(S.p.jockey + e.dx / span, 0.01, 0.99);
      this.setup(S);
    },

    plots: [
      { title: 'Sweep the jockey — where the galvanometer dies',
        legend: [{ c: '#3DD6F5', label: 'galvanometer current (µA)' },
                 { c: '#FFAE4C', label: 'the null' }],
        draw(S, g) {
          const p = S.p;
          if (p.circuit === 'network' || p.circuit === 'wheatstone') {
            /* no jockey to sweep — sweep the arm that would balance it */
            const pts = [], keep = p.circuit === 'wheatstone' ? p.Sarm : p.R2;
            const lo = 1, hi = p.circuit === 'wheatstone' ? 90 : 20;
            for (let i = 0; i <= 140; i++) {
              const v = lo + (hi - lo) * i / 140;
              const S2 = { p: Object.assign({}, p) };
              if (p.circuit === 'wheatstone') S2.p.Sarm = v; else S2.p.R2 = v;
              const c2 = buildCircuit(S2);
              pts.push([v, (p.circuit === 'wheatstone' ? c2.Ig : c2.I) * 1e3]);
            }
            const P = g.Plot({
              xmin: lo, xmax: hi, ymin: Math.min(0, Math.min.apply(null, pts.map(q => q[1])) * 1.15),
              ymax: Math.max.apply(null, pts.map(q => q[1])) * 1.15 + 1e-6,
              xlabel: p.circuit === 'wheatstone' ? 'arm S (Ω)' : 'R₂ (Ω)',
              ylabel: p.circuit === 'wheatstone' ? 'galvanometer current (mA)' : 'main current (mA)',
              xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(2)
            }).frame();
            P.clip(() => {
              P.hline(0, g.alpha(g.theme['text-3'], .6), [3, 4]);
              if (p.circuit === 'wheatstone')
                P.vline(p.Q * p.Rarm / p.P, g.alpha(g.theme.warn, .9), [4, 3]);
              P.line(pts, g.theme.phys, 2.2);
              P.dot(keep, (p.circuit === 'wheatstone' ? S.C.Ig : S.C.I) * 1e3, 4.5,
                    g.theme.text, g.theme['ink-950']);
            });
            if (p.circuit === 'wheatstone')
              P.tag(p.Q * p.Rarm / p.P, 0, 'balance at S = QR/P = ' + (p.Q * p.Rarm / p.P).toFixed(1) + ' Ω',
                    g.theme.warn, 'left', -10);
            return;
          }
          const raw = [];
          for (let i = 1; i <= 197; i++) {
            const f = i / 198;
            const S2 = { p: Object.assign({}, p, { jockey: f, autoNull: false }) };
            raw.push([f * 100, buildCircuit(S2).Ig]);
          }
          /* Pick the unit from the sweep, so a sensitive null reads in µA and
             a coarse one does not run to five digits on the axis. */
          const peak = Math.max.apply(null, raw.map(q => Math.abs(q[1]))) || 1e-9;
          const uA = peak < 2e-3;
          const k = uA ? 1e6 : 1e3, unit = uA ? 'µA' : 'mA';
          const pts = raw.map(q => [q[0], q[1] * k]);
          const mx = peak * k;
          const P = g.Plot({
            xmin: 0, xmax: 100, ymin: -mx * 1.15, ymax: mx * 1.15,
            xlabel: 'jockey position ℓ (cm)', ylabel: 'galvanometer current (' + unit + ')',
            xfmt: v => v.toFixed(0), yfmt: v => Math.abs(mx) < 20 ? v.toFixed(1) : v.toFixed(0)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(g.theme['text-3'], .6), [3, 4]);
            P.vline(S.C.balanceLen * 100, g.alpha(g.theme.warn, .9), [4, 3]);
            P.area(pts, 0, g.alpha(g.theme.phys, .12));
            P.line(pts, g.theme.phys, 2.2);
            P.vline(p.jockey * 100, g.alpha(g.theme.text, .5), [3, 3]);
            P.dot(p.jockey * 100, S.C.Ig * k, 4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(S.C.balanceLen * 100, 0, 'null at ' + (S.C.balanceLen * 100).toFixed(1) + ' cm',
                g.theme.warn, 'left', -10);
        },
        hover(S, x) {
          const p = S.p;
          if (p.circuit === 'network' || p.circuit === 'wheatstone') return null;
          const f = clamp(x / 100, 0.01, 0.99);
          const c2 = buildCircuit({ p: Object.assign({}, p, { jockey: f, autoNull: false }) });
          return [{ label: 'ℓ', value: x.toFixed(1) + ' cm' },
                  { label: 'galvanometer', value: fmt(c2.Ig, 3) + ' A', color: '#3DD6F5' },
                  { label: 'state', value: Math.abs(c2.Ig) < 1e-9 ? 'null' : 'deflected' }];
        } },

      { title: 'Terminal voltage falls as the cell is loaded — V = ε − Ir',
        legend: [{ c: '#3DD6F5', label: 'terminal voltage' }, { c: '#4ADE80', label: 'power delivered' }],
        draw(S, g) {
          const p = S.p, V = [], Pw = [];
          const r = Math.max(p.rInt, 1e-3);
          for (let i = 0; i <= 160; i++) {
            const R = 0.05 + (12 - 0.05) * i / 160;
            const I = p.emf / (R + r);
            V.push([R, p.emf - I * r]);
            Pw.push([R, I * I * R]);
          }
          const pmax = Math.max.apply(null, Pw.map(q => q[1])) || 1;
          const P = g.Plot({
            xmin: 0, xmax: 12, ymin: 0, ymax: p.emf * 1.1,
            xlabel: 'external resistance R (Ω)', ylabel: 'terminal voltage (V)',
            xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(p.emf, g.alpha(g.theme['text-3'], .8), [4, 3]);
            P.line(Pw.map(q => [q[0], q[1] / pmax * p.emf]), g.theme.ok, 1.6, [5, 3]);
            P.area(V, 0, g.alpha(g.theme.phys, .12));
            P.line(V, g.theme.phys, 2.2);
            P.vline(r, g.alpha(g.theme.warn, .85), [3, 3]);
            if (p.circuit === 'network') {
              P.dot(S.C.Rext, S.C.terminal, 4.5, g.theme.text, g.theme['ink-950']);
            }
          });
          P.tag(0, p.emf, 'ε = ' + p.emf.toFixed(1) + ' V (open circuit)', g.theme['text-2'], 'left', -9);
          if (p.rInt < 0.02)
            P.tag(6, p.emf * 0.92, 'r ≈ 0 : an ideal cell holds its terminal voltage at ε',
                  g.theme['text-2'], 'center', -10);
          else
            P.tag(r, p.emf * 0.5, 'R = r : maximum power', g.theme.warn, 'left', 0);
        },
        hover(S, x) {
          const p = S.p, r = Math.max(p.rInt, 1e-3), R = Math.max(x, 0.01);
          const I = p.emf / (R + r);
          return [{ label: 'R', value: R.toFixed(2) + ' Ω' },
                  { label: 'current', value: fmt(I, 3) + ' A' },
                  { label: 'terminal V', value: (p.emf - I * r).toFixed(3) + ' V', color: '#3DD6F5' },
                  { label: 'power in R', value: (I * I * R).toFixed(3) + ' W', color: '#4ADE80' }];
        } }
    ],

    readouts(S) {
      const p = S.p, C = S.C;
      const out = [];
      if (p.circuit === 'network') {
        out.push({ label: 'External resistance', value: C.Rext.toFixed(3), unit: 'Ω', flag: 'accent',
                   hint: 'R₁ + R₂∥R₃' });
        out.push({ label: 'Main current  ε/(R+r)', value: fmt(C.I, 4), unit: 'A', flag: 'accent' });
        out.push({ label: 'Terminal voltage', value: C.terminal.toFixed(3), unit: 'V',
                   hint: 'ε − Ir, not ε' });
        out.push({ label: 'Current in R₂', value: fmt(C.net.I(2, 0, p.R2), 3), unit: 'A' });
        out.push({ label: 'Current in R₃', value: fmt(C.net.I(2, 0, p.R3), 3), unit: 'A',
                   hint: 'splits as 1/R, not as R' });
        out.push({ label: 'Power in the cell', value: (C.I * C.I * p.rInt).toFixed(3), unit: 'W',
                   flag: C.I * C.I * p.rInt > 1 ? 'warn' : '', hint: 'I²r — wasted as heat' });
        out.push({ label: 'Power delivered', value: (C.I * C.terminal).toFixed(3), unit: 'W' });
        out.push({ label: 'Efficiency  R/(R+r)', value: (100 * C.Rext / (C.Rext + p.rInt)).toFixed(1), unit: '%' });
      } else if (p.circuit === 'wheatstone') {
        out.push({ label: 'P/Q', value: (p.P / p.Q).toFixed(4), unit: '', flag: 'accent' });
        out.push({ label: 'R/S', value: (p.Rarm / p.Sarm).toFixed(4), unit: '', flag: 'accent' });
        out.push({ label: 'Galvanometer current', value: fmt(C.Ig, 3), unit: 'A',
                   flag: Math.abs(C.Ig) < 1e-9 ? 'ok' : 'crit' });
        out.push({ label: 'V(B) − V(D)', value: C.Vbd.toFixed(5), unit: 'V' });
        out.push({ label: 'S for balance  QR/P', value: (p.Q * p.Rarm / p.P).toFixed(2), unit: 'Ω',
                   hint: 'where the null would be' });
        out.push({ label: 'Balance residual  PS − QR', value: C.balanceErr.toFixed(2), unit: 'Ω²',
                   flag: Math.abs(C.balanceErr) < 1e-9 ? 'ok' : '' });
      } else if (p.circuit === 'meter') {
        out.push({ label: 'Jockey position ℓ', value: (p.jockey * 100).toFixed(1), unit: 'cm' });
        out.push({ label: 'Null is at', value: (C.balanceLen * 100).toFixed(2), unit: 'cm', flag: 'accent',
                   hint: '100·known/(known+X)' });
        out.push({ label: 'Galvanometer current', value: fmt(C.Ig, 3), unit: 'A',
                   flag: Math.abs(C.Ig) < 1e-9 ? 'ok' : 'crit' });
        out.push({ label: 'X from the null', value: (p.Rknown * (1 - C.balanceLen) / C.balanceLen).toFixed(3),
                   unit: 'Ω', flag: 'accent', hint: 'known·(100−ℓ)/ℓ' });
        out.push({ label: 'X actually wired', value: p.Runknown.toFixed(3), unit: 'Ω', hint: 'they agree' });
        out.push({ label: 'Left arm of the wire', value: C.Rleft.toFixed(3), unit: 'Ω' });
        out.push({ label: 'Right arm of the wire', value: C.Rright.toFixed(3), unit: 'Ω' });
      } else {
        out.push({ label: 'Potential gradient k', value: C.gradient.toFixed(4), unit: 'V/m', flag: 'accent',
                   hint: 'I × R_wire over 1 m' });
        out.push({ label: 'Driver current', value: fmt(C.Idrive, 3), unit: 'A' });
        out.push({ label: 'Jockey position ℓ', value: (p.jockey * 100).toFixed(1), unit: 'cm' });
        out.push({ label: 'Null is at  ε₂/k', value: (C.balanceLen * 100).toFixed(2), unit: 'cm', flag: 'accent' });
        out.push({ label: 'Current in the test cell', value: fmt(C.Ig, 3), unit: 'A',
                   flag: Math.abs(C.Ig) < 1e-9 ? 'ok' : 'crit',
                   hint: Math.abs(C.Ig) < 1e-9 ? 'zero — so r₂ drops nothing' : 'the reading is not the emf' });
        out.push({ label: 'emf read off the wire', value: (C.gradient * p.jockey).toFixed(4), unit: 'V',
                   hint: 'k × ℓ' });
        out.push({ label: 'True emf of the test cell', value: p.emfTest.toFixed(4), unit: 'V' });
        out.push({ label: 'A voltmeter would read', value: (p.emfTest * 1000 / (1000 + p.rTest)).toFixed(4),
                   unit: 'V', flag: 'warn', hint: 'a 1 kΩ meter loads the cell' });
      }
      return out;
    },

    equation(S) {
      const p = S.p, C = S.C;
      if (p.circuit === 'network') {
        return E.v('I') + ' ' + E.op('=') + ' ' + E.frac(E.v('ε'), E.v('R') + E.op('+') + E.v('r')) +
          ' ' + E.op('=') + ' ' + E.frac(E.n(p.emf, 'V'), E.n(C.Rext + p.rInt, 'Ω')) + ' ' + E.op('=') +
          ' ' + E.n(C.I, 'A') +
          '<br>' + E.v('V') + E.sub('terminal') + ' ' + E.op('=') + ' ' + E.v('ε') + ' ' + E.op('−') +
          ' ' + E.v('Ir') + ' ' + E.op('=') + ' ' + E.n(C.terminal, 'V') + E.op('·') +
          ' the cell keeps ' + E.n(p.emf - C.terminal, 'V') + ' for itself';
      }
      if (p.circuit === 'wheatstone') {
        return E.frac(E.v('P'), E.v('Q')) + ' ' + E.op('=') + ' ' + E.frac(E.v('R'), E.v('S')) +
          E.op('·') + ' here ' + E.n(p.P / p.Q, '') + ' vs ' + E.n(p.Rarm / p.Sarm, '') +
          '<br>' + E.v('I') + E.sub('g') + ' ' + E.op('=') + ' ' + E.n(C.Ig, 'A') + ' ' +
          E.op('→') + ' ' + (Math.abs(C.Ig) < 1e-9 ? 'balanced' : 'not balanced') +
          E.op('·') + ' balance needs ' + E.v('S') + ' ' + E.op('=') + ' ' +
          E.frac(E.v('QR'), E.v('P')) + ' ' + E.op('=') + ' ' + E.n(p.Q * p.Rarm / p.P, 'Ω');
      }
      if (p.circuit === 'meter') {
        return E.frac('known', E.v('X')) + ' ' + E.op('=') + ' ' + E.frac(E.v('ℓ'), '100' + E.op('−') + E.v('ℓ')) +
          E.op('→') + ' ' + E.v('X') + ' ' + E.op('=') + ' known' + E.op('×') +
          E.frac('100' + E.op('−') + E.v('ℓ'), E.v('ℓ')) +
          '<br>null at ' + E.v('ℓ') + ' ' + E.op('=') + ' ' + E.n(C.balanceLen * 100, 'cm') +
          E.op('·') + ' giving ' + E.v('X') + ' ' + E.op('=') +
          ' ' + E.n(p.Rknown * (1 - C.balanceLen) / C.balanceLen, 'Ω');
      }
      return E.v('k') + ' ' + E.op('=') + ' ' + E.frac(E.v('ε') + E.v('R') + E.sub('wire'),
        E.v('R') + E.sub('wire') + E.op('+') + E.v('R') + E.sub('rh') + E.op('+') + E.v('r')) +
        ' ' + E.op('=') + ' ' + E.n(C.gradient, 'V/m') +
        '<br>' + E.v('ε') + '₂ ' + E.op('=') + ' ' + E.v('kℓ') + E.op('·') + ' null at ' +
        E.n(C.balanceLen * 100, 'cm') + E.op('·') + ' and at the null ' + E.v('I') + '₂ ' +
        E.op('=') + ' 0, so ' + E.v('r') + '₂ drops nothing';
    },

    eqNote: '<b>Nothing above is coded into the lab.</b> The simulation assembles the node-admittance ' +
      'matrix from the wiring and solves it; every one of those equalities is then <i>read back out</i> ' +
      'of the solution. That is why you can unbalance the bridge and the galvanometer current is still ' +
      'right, and why the potentiometer null does not move when you change the test cell\'s internal ' +
      'resistance — the solver has no idea it is supposed to.',

    problems: [
      { source: 'JEE Main pattern · a cell under load',
        q: 'A cell of emf 6.0 V and internal resistance 0.50 Ω drives a 2.0 Ω resistor in series with a parallel combination of 6.0 Ω and 3.0 Ω. Find the current drawn from the cell, in amperes.',
        params: { circuit: 'network', emf: 6, rInt: 0.5, R1: 2, R2: 6, R3: 3 },
        predict: { label: 'current from the cell', unit: 'A', tol: 0.02 },
        measure: S => S.C.I,
        working: '6.0 ∥ 3.0 = 2.0 Ω, so R = 2.0 + 2.0 = 4.0 Ω and I = ε/(R + r) = 6.0/4.5 = ' +
          '<b>1.33 A</b>. The trap is dropping r: 6.0/4.0 = 1.5 A is the answer to a question nobody asked. ' +
          'Watch the terminal voltage readout — it sits at 5.33 V, not 6 V, and the missing 0.67 V is ' +
          'exactly Ir.' },
      { source: 'JEE Main pattern · the bridge condition',
        q: 'A Wheatstone bridge has P = 10 Ω, Q = 20 Ω and R = 30 Ω. What value of S balances it?',
        params: { circuit: 'wheatstone', emf: 10, rInt: 0, P: 10, Q: 20, Rarm: 30, Sarm: 60, Rg: 50 },
        predict: { label: 'S for balance', unit: 'Ω', tol: 0.02 },
        measure: S => S.p.Q * S.p.Rarm / S.p.P,
        working: 'P/Q = R/S gives S = QR/P = 20 × 30/10 = <b>60 Ω</b>. Set it and the galvanometer ' +
          'current falls to 10⁻¹⁷ A — zero to machine precision. Note what does <b>not</b> appear in the ' +
          'condition: the emf, the internal resistance and the galvanometer resistance. A balanced bridge ' +
          'is balanced for any cell and any detector, which is the whole reason the method is accurate.' },
      { source: 'JEE Advanced pattern · the metre bridge',
        q: 'In a metre bridge the left gap holds a known 4.0 Ω and the right gap an unknown X. The balance point is found at 40.0 cm from the left end. Find X in ohms.',
        params: { circuit: 'meter', emf: 2, rInt: 0, Rknown: 4, Runknown: 6, Rwire: 5, Rg: 60, jockey: 0.40 },
        predict: { label: 'unknown resistance X', unit: 'Ω', tol: 0.02 },
        measure: S => S.p.Rknown * (1 - S.C.balanceLen) / S.C.balanceLen,
        working: 'The wire is uniform, so its two parts are in the ratio of their lengths: ' +
          'known/X = ℓ/(100 − ℓ) = 40/60. So X = 4.0 × 60/40 = <b>6.0 Ω</b>. ' +
          'The resistance of the wire itself never enters — only the ratio of the two lengths does. ' +
          'Change the wire resistance slider and watch the null stay exactly where it was.' },
      { source: 'JEE Advanced pattern · the potential gradient',
        q: 'A potentiometer wire of total resistance 10 Ω is driven by a 3.0 V cell through a 5.0 Ω rheostat, with negligible internal resistance. The wire is 1.00 m long. Find the potential gradient along it, in volts per metre.',
        params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 5, Rwire: 10, emfTest: 1.2, rTest: 0.8, Rg: 60, jockey: 0.60 },
        predict: { label: 'potential gradient k', unit: 'V/m', tol: 0.02 },
        measure: S => S.C.gradient,
        working: 'The driver current is I = 3.0/(5.0 + 10) = 0.20 A, so the drop across the whole wire ' +
          'is 0.20 × 10 = 2.0 V over 1.00 m: k = <b>2.0 V/m</b>. A cell of 1.2 V then balances at ' +
          'ℓ = 1.2/2.0 = 60 cm. Raise the rheostat and k falls — which is how you make a potentiometer ' +
          'sensitive enough to measure a small emf.' },
      { source: 'JEE Advanced pattern · why a potentiometer beats a voltmeter',
        q: 'A cell of emf 1.20 V and internal resistance 6.0 Ω is measured on the potentiometer above. What current flows through the cell at the balance point, in amperes?',
        params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 5, Rwire: 10, emfTest: 1.2, rTest: 6, Rg: 60, jockey: 0.60, autoNull: true },
        predict: { label: 'current through the test cell at balance', unit: 'A', tol: 0.05 },
        measure: S => Math.abs(S.C.Ig),
        working: '<b>Exactly zero.</b> That is the definition of the balance point, and it is the entire ' +
          'advantage of the instrument: with no current, the internal resistance drops no voltage, so the ' +
          'wire reads the <i>true emf</i> and not the terminal voltage. Change r₂ from 0.8 Ω to 6 Ω and ' +
          'the null does not move at all. A voltmeter, by contrast, must draw current to deflect, so it ' +
          'always reads low — the readout shows what a 1 kΩ meter would report.' }
    ],

    walkthrough: [
      { title: '1 · A cell is not a battery symbol',
        body: 'Watch the terminal-voltage readout while you raise the internal resistance from 0.5 Ω toward 5 Ω.',
        ask: 'The emf slider has not moved. Why does the terminal voltage fall?',
        reveal: 'Because <b>emf and terminal voltage are different quantities</b>. The emf is what the chemistry provides; the terminal voltage is what is left after the current has fought its way through the cell\'s own resistance: V = ε − Ir. A cell only shows its emf at its terminals when it is delivering <b>no current at all</b> — which is exactly the trick the potentiometer uses later.',
        params: { circuit: 'network', emf: 6, rInt: 3.0, R1: 1, R2: 3, R3: 3 } },
      { title: '2 · Current splits as 1/R, not as R',
        body: 'Look at the two parallel branch currents in the readouts, with R₂ = 6 Ω and R₃ = 3 Ω.',
        ask: 'Which branch carries more current, and in what ratio?',
        reveal: 'The <b>3 Ω branch carries twice</b> the current of the 6 Ω one. Current divides in the ratio of the <i>conductances</i>, 1/R, because both branches sit across the same potential difference. Students reliably get this backwards under exam pressure — the resistor with the bigger number gets the smaller share.',
        params: { circuit: 'network', emf: 6, rInt: 0.5, R1: 2, R2: 6, R3: 3 } },
      { title: '3 · The bridge balances on a ratio',
        body: 'Switch to the Wheatstone bridge and drag arm S until the needle stops moving.',
        ask: 'At balance, what is true of B and D?',
        reveal: 'They are at the <b>same potential</b>, so no current crosses the galvanometer — the residual reads 10⁻¹⁷ A. The condition is P/Q = R/S: a ratio of ratios. Note that the emf, the internal resistance and the galvanometer resistance are all absent from it. That independence is why a bridge measurement is far more accurate than reading a meter.',
        params: { circuit: 'wheatstone', emf: 10, rInt: 0, P: 10, Q: 20, Rarm: 30, Sarm: 60, Rg: 50 } },
      { title: '4 · Unbalance it and watch the needle',
        body: 'Pull S away from 60 Ω and watch both the needle and the sweep graph.',
        ask: 'Does the galvanometer current grow linearly as you leave the balance point?',
        reveal: 'Near the null it is very nearly linear, which is exactly what makes the instrument usable — a small imbalance gives a proportional, signed deflection so you know <b>which way to move</b>. Far from balance it flattens, because the bridge arms start to load the cell. The graph shows both regimes at once.',
        params: { circuit: 'wheatstone', emf: 10, rInt: 0, P: 10, Q: 20, Rarm: 30, Sarm: 45, Rg: 50 } },
      { title: '5 · The metre bridge is a Wheatstone made of wire',
        body: 'Switch to the metre bridge and drag the jockey along the wire until the needle dies.',
        ask: 'The wire has its own resistance. Why does its value not appear in the answer?',
        reveal: 'Because the wire is <b>uniform</b>, so its two parts are in the ratio of their <i>lengths</i>: R_left/R_right = ℓ/(100 − ℓ). Only that ratio enters the balance condition, and the resistance per centimetre cancels. Change the wire-resistance slider and watch the null stay exactly where it was — that is the cancellation happening in front of you.',
        params: { circuit: 'meter', emf: 2, rInt: 0, Rknown: 4, Runknown: 6, Rwire: 5, Rg: 60, jockey: 0.40 } },
      { title: '6 · Why the null is best found near the middle',
        body: 'Set the unknown to 18 Ω against a known 1 Ω, so the null sits near 5 cm, then try to locate it by dragging.',
        ask: 'Why do textbooks insist on choosing the known resistance so the balance lands near 50 cm?',
        reveal: 'Because the <b>fractional error is worst at the ends</b>. Near 50 cm a millimetre of jockey error changes the ratio by about 0.4%; at 5 cm the same millimetre changes it by nearly 2%. The physics is identical anywhere on the wire, but the <i>measurement</i> is not — and that is an experimental-skills mark the paper does ask for.',
        params: { circuit: 'meter', emf: 2, rInt: 0, Rknown: 1, Runknown: 18, Rwire: 5, Rg: 60, jockey: 0.053 } },
      { title: '7 · The potentiometer draws no current',
        body: 'Switch to the potentiometer and find the null, then change the test cell\'s internal resistance from 0.8 Ω to 6 Ω.',
        ask: 'The internal resistance has increased sevenfold. Why has the balance point not moved?',
        reveal: 'Because at balance the test cell carries <b>exactly zero current</b>, and a resistance carrying no current drops no voltage. The wire is therefore reading the cell\'s <i>true emf</i>, not its terminal voltage. Compare the last two readouts: the potentiometer reads 1.2000 V, and a 1 kΩ voltmeter reads low — because a voltmeter must draw current in order to deflect.',
        params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 5, Rwire: 10, emfTest: 1.2, rTest: 6, Rg: 60, jockey: 0.60, autoNull: true } },
      { title: '8 · Sensitivity is set by the gradient',
        body: 'Raise the rheostat resistance and watch the potential gradient k and the balance length together.',
        ask: 'A smaller gradient pushes the balance point further along the wire. Is that better or worse?',
        reveal: '<b>Better, up to a point.</b> A smaller k spreads the same emf over more centimetres, so a given error in reading ℓ is a smaller fractional error in ε. That is why you increase the rheostat when measuring a small emf. The limit is the wire itself: once the balance point runs past 100 cm there is no null at all, and the lab will show you the galvanometer never crossing zero.',
        params: { circuit: 'potentiometer', emf: 3, rInt: 0, Rseries: 20, Rwire: 10, emfTest: 1.2, rTest: 0.8, Rg: 60, jockey: 0.60, autoNull: true } }
    ],

    quiz: [
      { q: 'A cell of emf ε and internal resistance r drives a resistance R. The terminal voltage is:',
        options: ['ε always', 'ε − εr/(R+r)', 'ε + Ir', 'ε/R'], answer: 1,
        why: 'V = ε − Ir with I = ε/(R+r), which is ε − εr/(R+r) = εR/(R+r). It equals ε only when I = 0, i.e. on open circuit — which is precisely the condition a potentiometer arranges.' },
      { q: 'A Wheatstone bridge is balanced. The cell is now replaced by one of twice the emf. The bridge:',
        options: ['goes out of balance', 'stays balanced', 'balances at half the reading', 'depends on the galvanometer'], answer: 1,
        why: 'The balance condition P/Q = R/S contains no emf, no internal resistance and no galvanometer resistance. Doubling the driving cell doubles every potential, so B and D rise together and stay equal. Try it in the lab: the residual stays at 10⁻¹⁷ A.' },
      { q: 'In a metre bridge the balance length is 40 cm with a known 4 Ω in the left gap. The unknown is:',
        options: ['2.67 Ω', '6.0 Ω', '4.0 Ω', '10.0 Ω'], answer: 1,
        why: 'known/X = ℓ/(100 − ℓ) = 40/60, so X = 4 × 60/40 = 6 Ω. The commonest slip is inverting the ratio and getting 2.67 Ω — check it against the side the known resistance is on.' },
      { q: 'At the balance point of a potentiometer, the current drawn from the cell under test is:',
        options: ['maximum', 'zero', 'equal to the driver current', 'ε₂/r₂'], answer: 1,
        why: 'Zero — that is what balance means. With no current the internal resistance drops no voltage, so the instrument reads the true emf. This is the single most examined fact about the potentiometer.' },
      { q: 'Two resistors 6 Ω and 3 Ω are in parallel across a source. The ratio of the currents through them is:',
        options: ['2 : 1', '1 : 2', '1 : 1', '6 : 3'], answer: 1,
        why: 'Both carry the same potential difference, so I = V/R and the currents go as 1/R: 1/6 : 1/3 = 1 : 2. The 3 Ω branch takes twice as much. Reading the ratio straight off the resistances is the trap.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Equivalent resistance of a network, then I = ε/(R + r) — guaranteed marks in Mains.</li>' +
      '<li>Terminal voltage vs emf, and the power delivered I²R against the power wasted I²r.</li>' +
      '<li>Wheatstone balance P/Q = R/S, and what the condition does <b>not</b> contain.</li>' +
      '<li>Metre bridge: X = known × (100 − ℓ)/ℓ, plus the experimental-skills question about ' +
      'choosing the known resistance so the null lands near the middle.</li>' +
      '<li>Potentiometer: potential gradient k, comparing two emfs, and measuring internal resistance ' +
      'by balancing with and without a shunt across the cell.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>Current in a parallel pair divides as <b>1/R</b>, not as R. ' +
      'The larger resistor takes the smaller share. Under time pressure this gets inverted more often ' +
      'than any other step in the chapter.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>A voltmeter reads terminal voltage, a potentiometer reads ' +
      '<b>emf</b>. They differ by Ir, and they agree only in the limit of a meter that draws no current. ' +
      'If a question says "the reading of an ideal voltmeter", it is telling you to set I = 0 through the ' +
      'meter branch — not to ignore the cell\'s internal resistance elsewhere in the circuit.</div>'
  });

})(window.InsightLab);

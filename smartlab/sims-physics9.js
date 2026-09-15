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


  /* =========================================================================
     14 · RAY OPTICS — traced surface by surface, never by the lens formula

     Every ray is refracted with Snell's law at each spherical surface and
     reflected at each mirror. The image position is then found by asking
     where the emergent rays ACTUALLY cross (a least-squares crossing point),
     not by evaluating 1/v − 1/u = 1/f. The two disagree, and the difference
     is spherical aberration — which is the point of tracing at all.
     ========================================================================= */

  /* Intersection of a ray with a spherical surface whose vertex sits at x = xv
     and whose centre of curvature is at x = xv + R. R > 0 means the centre is
     to the right, i.e. the surface bulges toward −x. Returns the hit nearest
     the vertex that lies ahead of the ray. */
  function hitSphere(P, D, xv, R, aperture) {
    if (!isFinite(R) || Math.abs(R) > 1e6) {
      // a plane surface
      if (Math.abs(D[0]) < 1e-12) return null;
      const t = (xv - P[0]) / D[0];
      if (t <= 1e-9) return null;
      const z = P[1] + t * D[1];
      if (Math.abs(z) > aperture) return null;
      return { t: t, p: [xv, z], n: [1, 0] };
    }
    const cx = xv + R;
    const ox = P[0] - cx, oz = P[1];
    const b = 2 * (ox * D[0] + oz * D[1]);
    const c = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * c;                  // |D| = 1
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const cand = [(-b - sq) / 2, (-b + sq) / 2].filter(t => t > 1e-9);
    let best = null;
    cand.forEach(t => {
      const px = P[0] + t * D[0], pz = P[1] + t * D[1];
      if (Math.abs(pz) > aperture) return;
      // keep the intersection on the vertex side of the centre
      if (R > 0 ? px > cx : px < cx) return;
      if (!best || Math.abs(px - xv) < Math.abs(best.p[0] - xv)) {
        const nx = (px - cx) / R, nz = pz / R;
        best = { t: t, p: [px, pz], n: [nx, nz] };
      }
    });
    return best;
  }

  /* Trace one ray through an ordered list of surfaces.
     Each surface: { xv, R, n1, n2, aperture, mirror }
     Returns the polyline of the path plus the final ray, or null if the ray
     is blocked by an aperture or totally internally reflected. */
  function traceRay(P, D, surfaces, xEnd) {
    const path = [[P[0], P[1]]];
    let p = P.slice(), d = D.slice();
    for (let i = 0; i < surfaces.length; i++) {
      const s = surfaces[i];
      const h = hitSphere(p, d, s.xv, s.R, s.aperture);
      if (!h) return { path: path, dir: d, p: p, blocked: true };
      path.push([h.p[0], h.p[1]]);
      p = h.p;
      let nd;
      if (s.mirror) nd = SV.reflect(d, h.n);
      else nd = SV.refract(d, h.n, s.n1, s.n2);
      if (!nd) return { path: path, dir: d, p: p, tir: true };
      const L = Math.hypot(nd[0], nd[1]) || 1;
      d = [nd[0] / L, nd[1] / L];
    }
    // run on to the end of the bench
    const tEnd = Math.abs(d[0]) > 1e-9 ? (xEnd - p[0]) / d[0] : 0;
    const t = tEnd > 0 ? tEnd : 2.4;
    path.push([p[0] + t * d[0], p[1] + t * d[1]]);
    return { path: path, dir: d, p: p };
  }

  /* Where do a bundle of rays actually cross?

     The obvious answer — least squares over the perpendicular distances to
     every ray — is badly conditioned for a NARROW pencil: the position along
     the beam is barely constrained when every ray points nearly the same way,
     and a 2 mm aberration came out as a 60 mm error. So instead find the
     plane of least confusion, which is both well conditioned and the actual
     definition of a focus: write each ray's height as z_i(x) = a_i + b_i·x
     and minimise the VARIANCE of the z_i over x. With A = a − ā and B = b − b̄
     that is a one-line least squares, x = −ΣAB/ΣB², and it needs no special
     case for a virtual image — x simply comes out negative. */
  function crossingPoint(rays) {
    const a = [], b = [];
    rays.forEach(r => {
      if (!r || r.blocked || r.tir) return;
      if (Math.abs(r.dir[0]) < 1e-9) return;
      const m = r.dir[1] / r.dir[0];
      b.push(m); a.push(r.p[1] - m * r.p[0]);            // z = a + b·x
    });
    const n = a.length;
    if (n < 2) return null;
    let am = 0, bm = 0;
    for (let i = 0; i < n; i++) { am += a[i]; bm += b[i]; }
    am /= n; bm /= n;
    let sAB = 0, sBB = 0;
    for (let i = 0; i < n; i++) {
      const A = a[i] - am, B = b[i] - bm;
      sAB += A * B; sBB += B * B;
    }
    if (sBB < 1e-20) return null;                        // a genuinely parallel bundle
    const x = -sAB / sBB;
    return [x, am + bm * x, n];
  }


  /* Assemble the surfaces for whichever element is on the bench. A lens is
     always two real spherical surfaces; the focal length slider sets their
     radius through the lens-maker's equation, and everything after that is
     pure geometry. */
  function optics(S) {
    const p = S.p, ap = p.aperture / 2, n = p.nGlass;
    if (p.mode === 'cmirror' || p.mode === 'xmirror') {
      const R = (p.mode === 'cmirror' ? -1 : 1) * Math.abs(p.Rm);
      return { surf: [{ xv: 0, R: R, n1: 1, n2: 1, aperture: ap, mirror: true }],
               f: R / 2, ap: ap, mirror: true, xEnd: -3.2 };
    }
    const sgn = p.mode === 'concave' ? -1 : 1;
    const f = sgn * Math.abs(p.f);
    const R = 2 * (n - 1) * f;                        // symmetric, R1 = R, R2 = −R
    const t = Math.max(p.thick, 1e-4);
    const first = [{ xv: -t / 2, R: R, n1: 1, n2: n, aperture: ap },
                   { xv:  t / 2, R: -R, n1: n, n2: 1, aperture: ap }];
    if (p.mode !== 'combo') return { surf: first, f: f, ap: ap, xEnd: 3.2 };
    // a second lens further down the bench — the combination question
    const f2 = Math.abs(p.f2), R2 = 2 * (n - 1) * f2;
    return { surf: first.concat([
        { xv: p.sep - t / 2, R: R2, n1: 1, n2: n, aperture: ap },
        { xv: p.sep + t / 2, R: -R2, n1: n, n2: 1, aperture: ap }]),
      f: f, f2: f2, ap: ap, xEnd: 3.2, two: true };
  }

  L.register({
    id: 'rayoptics', subject: 'physics',
    name: 'The Optical Bench — Lenses, Mirrors and Real Images',
    chapter: 'Ray Optics & Optical Instruments',
    exams: ['JEE Main', 'JEE Advanced', 'NEET UG'],
    weight: 'Very high yield',
    is3D: true,
    stageHint: 'Drag to walk round the bench · drag the object along the rail · slide the screen to find focus',
    lede: 'The lens formula is never used here. Every ray is <b>refracted with Snell\'s law at each of the two ' +
      'real spherical surfaces</b>, and the image is found by asking where the emergent rays actually cross. ' +
      'Compare that with 1/v − 1/u = 1/f in the readouts: they agree beautifully for a narrow bundle and ' +
      '<b>disagree as you open the aperture</b>, because a spherical surface does not bring marginal rays to ' +
      'the same point as paraxial ones. That gap is spherical aberration, and it is the reason the formula ' +
      'is an approximation rather than a law.',

    params: { mode: 'convex', u: 0.60, f: 0.20, nGlass: 1.50, thick: 0.010, aperture: 0.050,
              hObj: 0.030, nRays: 13, Rm: 0.40, f2: 0.15, sep: 0.55,
              screenX: 0.30, principal: true, autoFocus: true },

    presets: [
      { name: 'Convex lens · real image', params: { mode: 'convex', u: 0.60, f: 0.20, aperture: 0.05, autoFocus: true } },
      { name: 'Object at 2f · image at 2f', params: { mode: 'convex', u: 0.40, f: 0.20, aperture: 0.05, autoFocus: true } },
      { name: 'Inside the focus · magnifier', params: { mode: 'convex', u: 0.12, f: 0.20, aperture: 0.018, autoFocus: true } },
      { name: 'Open the aperture · aberration', params: { mode: 'convex', u: 0.60, f: 0.20, aperture: 0.16, autoFocus: true } },
      { name: 'Concave lens · always virtual', params: { mode: 'concave', u: 0.40, f: 0.20, aperture: 0.05, autoFocus: true } },
      { name: 'Concave mirror', params: { mode: 'cmirror', u: 0.60, Rm: 0.40, aperture: 0.05, autoFocus: true } },
      { name: 'Convex mirror · always virtual', params: { mode: 'xmirror', u: 0.60, Rm: 0.40, aperture: 0.05, autoFocus: true } },
      { name: 'Two lenses in a row', params: { mode: 'combo', u: 0.60, f: 0.20, f2: 0.15, sep: 0.55, aperture: 0.0145, autoFocus: true } }
    ],

    controls: [
      { group: 'What is on the bench', items: [
        { key: 'mode', type: 'select', label: 'Element', restructure: true, options: [
          { value: 'convex', label: 'Convex lens' }, { value: 'concave', label: 'Concave lens' },
          { value: 'cmirror', label: 'Concave mirror' }, { value: 'xmirror', label: 'Convex mirror' },
          { value: 'combo', label: 'Two lenses' }] }
      ] },
      { group: 'The object', items: [
        { key: 'u', label: 'Object distance <i>u</i>', min: 0.06, max: 1.6, step: 0.005, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'hObj', label: 'Object height', min: 0.01, max: 0.08, step: 0.002, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'The lens', items: [
        { key: 'f', label: 'Focal length <i>f</i>', min: 0.06, max: 0.60, step: 0.005, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'nGlass', label: 'Refractive index <i>n</i>', min: 1.30, max: 1.90, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true },
        { key: 'thick', label: 'Lens thickness', min: 0.002, max: 0.05, step: 0.001, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'aperture', label: 'Aperture (clear diameter)', min: 0.01, max: 0.20, step: 0.002, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true }
      ] },
      { group: 'The mirror', items: [
        { key: 'Rm', label: 'Radius of curvature <i>R</i>', min: 0.12, max: 1.2, step: 0.01, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Second lens', items: [
        { key: 'f2', label: 'Focal length <i>f</i>₂', min: 0.05, max: 0.50, step: 0.005, unit: 'm',
          fmt: v => v.toFixed(3), restructure: true },
        { key: 'sep', label: 'Separation', min: 0.10, max: 1.2, step: 0.01, unit: 'm',
          fmt: v => v.toFixed(2), restructure: true }
      ] },
      { group: 'Display', items: [
        { key: 'nRays', label: 'Rays traced', min: 3, max: 41, step: 2, unit: '', fmt: v => v.toFixed(0),
          restructure: true },
        { key: 'principal', type: 'toggle', label: 'Highlight the three principal rays' },
        { key: 'autoFocus', type: 'toggle', label: 'Put the screen at the image' }
      ] }
    ],

    setup(S) {
      const p = S.p;
      const O = optics(S);
      S.O = O;
      const ap = O.ap;
      /* the tip of the object, and a fan of rays from it that fills the
         aperture — every one traced independently */
      const tip = [-p.u, p.hObj];
      const rays = [], N = Math.max(3, Math.round(p.nRays) | 1);
      for (let i = 0; i < N; i++) {
        const z = (N === 1 ? 0 : (i / (N - 1) - 0.5) * 2) * ap * 0.94;
        const dx = 0 - tip[0], dz = z - tip[1], Lr = Math.hypot(dx, dz) || 1;
        rays.push(traceRay(tip, [dx / Lr, dz / Lr], O.surf, O.xEnd));
      }
      S.rays = rays;
      S.tip = tip;

      /* where the rays ACTUALLY cross, and where each individual ray crosses
         the axis — the second of those is the aberration curve */
      const q = crossingPoint(rays);
      S.img = q ? [q[0], q[1]] : null;
      /* Longitudinal spherical aberration is defined for an AXIAL object
         point: rays from a point off the axis need not cross the axis at all
         (the one through the front focus emerges parallel to it), so measuring
         their axis crossings gives metres of nonsense. Launch a second fan
         from (−u, 0) purely for this measurement. */
      S.axisCross = [];
      const axRays = [];
      for (let i = 0; i < N; i++) {
        const z = (N === 1 ? 0 : (i / (N - 1) - 0.5) * 2) * ap * 0.94;
        if (Math.abs(z) < ap * 0.02) continue;          // the axial ray never leaves the axis
        const dx = 0 - (-p.u), dz = z, Lr = Math.hypot(dx, dz) || 1;
        const r = traceRay([-p.u, 0], [dx / Lr, dz / Lr], O.surf, O.xEnd);
        axRays.push(r);
        if (!r || r.blocked || r.tir || Math.abs(r.dir[1]) < 1e-9) continue;
        const t = -r.p[1] / r.dir[1];
        const cx = r.p[0] + t * r.dir[0];
        if (!isFinite(cx) || Math.abs(cx) > 40) continue;
        S.axisCross.push([r.path.length > 1 ? r.path[1][1] : z, cx]);
      }
      S.axRays = axRays;

      /* the textbook prediction, for comparison only — it is never used to
         draw anything */
      const f = O.f;
      S.fPred = f;
      if (O.mirror) {
        // Cartesian: object on the left is at u = −p.u, f = R/2
        S.vPred = 1 / (1 / f - 1 / (-p.u));
      } else if (O.two) {
        const v1 = 1 / (1 / Math.abs(p.f) - 1 / p.u);
        const u2 = p.sep - v1;                      // object for the second lens
        S.v1Pred = v1;
        S.vPred = u2 === 0 ? Infinity : 1 / (1 / Math.abs(p.f2) - 1 / u2);
        S.mPred = (v1 / p.u) * (S.vPred / u2);
      } else {
        S.vPred = 1 / (1 / f - 1 / p.u);
      }
      if (!O.two) S.mPred = O.mirror ? -S.vPred / (-p.u) : -S.vPred / p.u;

      S.vMeas = S.img ? (O.two ? S.img[0] - p.sep : S.img[0]) : null;
      S.mMeas = S.img ? S.img[1] / p.hObj : null;
      S.real = S.img ? (O.mirror ? S.img[0] < 0 : S.img[0] > (O.two ? p.sep : 0)) : false;

      /* the spread of individual axis crossings IS the aberration */
      if (S.axisCross.length > 2) {
        const xs = S.axisCross.map(a => a[1]);
        S.abMin = Math.min.apply(null, xs);
        S.abMax = Math.max.apply(null, xs);
        S.aberration = S.abMax - S.abMin;
      } else { S.aberration = 0; S.abMin = 0; S.abMax = 0; }

      /* A screen can only catch a REAL image. Snapping it onto a virtual one
         would park it behind the object catching nothing, which teaches the
         opposite of the thing this lab is for. */
      if (p.autoFocus) {
        if (S.real && S.img && isFinite(S.img[0])) p.screenX = clamp(S.img[0], -2.6, 2.9);
        else p.screenX = O.mirror ? -Math.max(p.u * 0.55, 0.22) : Math.max(p.u * 0.6, 0.30);
      }

      /* Fit the bench to the stage. The optics are solved in metres; the
         drawing multiplies by S.K and centres on S.xc, so an object at 6 cm
         and an object at 1.6 m both fill the frame instead of one of them
         vanishing. Scale is a DRAWING choice only — nothing upstream sees it. */
      {
        const xs = [-p.u, 0, O.two ? p.sep : 0, clamp(p.screenX, -2.6, 2.9)];
        if (S.img && isFinite(S.img[0])) xs.push(clamp(S.img[0], -2.6, 2.9));
        if (O.mirror) xs.push(O.f, 2 * O.f);
        const lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
        const span = Math.max(hi - lo, 0.25);
        S.K = clamp(2.30 / span, 0.6, 7.0);
        S.xc = (lo + hi) / 2;
      }

      if (!S.cam) {
        S.cam = Camera({ theta: -1.57, phi: 0.15, dist: 2.62, target: [0, 0, -0.06] });
        S.cam.minDist = 1.3; S.cam.maxDist = 12;
      }
    },

    step(S, dt) { S.t2 = (S.t2 || 0) + dt; },

    drawStage(S, g) {
      const ctx = g.ctx, th = g.theme, p = S.p, W = g.w, H = g.h;
      const cam = S.cam, F = R3.Frame(ctx, cam, { ambient: 0.26, floorZ: null });
      const O = S.O, ap = O.ap;
      /* DEPTH POLICY (memory §14.6): only the rail carries F.GROUND. Every
         component sorts on its own depth; rays and markers take a few
         hundredths so they sit on their parent without jumping a nearer one. */
      const K = S.K;                                   // display units per metre
      const X = x => (x - S.xc) * K;                   // metres -> display, centred
      const acc = th.phys;
      const Ocent = cam.project([0, 0, 0]);
      const away = (pt) => { const q = cam.project(pt); return (q.ok && Ocent.ok && q.x < Ocent.x) ? -1 : 1; };
      const xL = O.two ? p.sep : 0;

      /* ---------------- the rail ---------------- */
      {
        const x0 = X(-p.u) - 0.22, x1 = X(O.mirror ? 0.06 : Math.max(xL, p.screenX, 0.1)) + 0.22;
        R3.box(F, [(x0 + x1) / 2, 0, -0.62], [x1 - x0, 0.26, 0.055], '#222C44',
               { shadow: false, ambient: 0.15, bias: F.GROUND });
        const n = clamp(Math.round((x1 - x0) / 0.1), 4, 60);
        for (let i = 0; i <= n; i++) {
          const xx = x0 + (x1 - x0) * i / n, big = i % 5 === 0;
          R3.polyline(F, [[xx, 0.13, -0.5925], [xx, 0.13, -0.5925 + (big ? 0.026 : 0.014)]],
                      '#6E80A8', { alpha: big ? 0.75 : 0.4, width: 1, bias: F.GROUND });
        }
        // the optical axis
        R3.polyline(F, [[x0, 0, 0], [x1, 0, 0]], th['text-3'], { alpha: .3, width: 1, bias: F.GROUND });
      }
      const post = (xm, top) => {          // xm in metres
        const xx = X(xm);
        R3.cylinder(F, [xx, 0, -0.592], [xx, 0, top], 0.026, '#55658C',
                    { segments: 12, shadow: false, ambient: 0.28, bias: F.GROUND });
        R3.cylinder(F, [xx, 0, -0.592], [xx, 0, -0.562], 0.058, '#3B496B',
                    { segments: 14, shadow: false, ambient: 0.24, bias: F.GROUND });
      };

      /* ---------------- the object: a lit arrow ---------------- */
      {
        const ox = X(-p.u), hh = p.hObj * K;
        post(-p.u, -0.02);
        R3.cylinder(F, [ox, 0, 0], [ox, 0, hh * 0.80], 0.012, '#FFD36B',
                    { segments: 10, shadow: false, ambient: 0.6 });
        R3.arrow(F, [ox, 0, hh * 0.72], [ox, 0, hh], 0.012, '#FFD36B',
                 { head: 0.048, shadow: false, ambient: 0.85 });
        R3.callout(F, [ox, 0, hh], away([ox, 0, 0]) * 24, -22,
                   'object  h = ' + (p.hObj * 100).toFixed(1) + ' cm', '#FFD36B');
        const qo = cam.project([ox, 0, hh]);
        if (qo.ok) {
          const on = g.dragging === 'obj';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha('#FFD36B', .8);
          ctx.lineWidth = on ? 2.2 : 1.5;
          ctx.beginPath(); ctx.arc(qo.x, qo.y, 9, 0, TAU); ctx.stroke();
          ctx.restore();
          S._axU = (function () {
            const a = cam.project([X(0), 0, 0]), b = cam.project([X(1), 0, 0]);
            if (!a.ok || !b.ok) return null;
            const dx = b.x - a.x, dy = b.y - a.y, Lp = Math.hypot(dx, dy) || 1;
            return { ux: dx / Lp, uy: dy / Lp, perPx: 1 / Lp };
          })();
          g.handle(qo.x, qo.y, 14, 'obj');
        }
      }

      /* ---------------- the element ---------------- */
      if (O.mirror) {
        const R = O.surf[0].R, sgn = Math.sign(R);
        post(0, -ap * K - 0.02);
        const prof = [];
        for (let i = 0; i <= 40; i++) {
          const zm = (i / 40 - 0.5) * 2 * ap;                 // metres
          const dx = R - sgn * Math.sqrt(Math.max(R * R - zm * zm, 0));
          prof.push([X(dx), 0, zm * K]);
        }
        F.push([0, 0, 0], () => {
          const q = prof.map(v => cam.project(v));
          if (q.some(x => !x.ok)) return;
          ctx.strokeStyle = g.alpha('#BFE2F5', .95); ctx.lineWidth = 3.4;
          ctx.beginPath();
          q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.stroke();
          ctx.strokeStyle = g.alpha('#55658C', .95); ctx.lineWidth = 7;
          ctx.beginPath();
          q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.stroke();
          ctx.strokeStyle = g.alpha('#BFE2F5', .95); ctx.lineWidth = 3;
          ctx.beginPath();
          q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y));
          ctx.stroke();
        }, 0);
        R3.callout(F, [X(0), 0, ap * K], away([X(0), 0, 0]) * 26, -24,
                   (p.mode === 'cmirror' ? 'concave' : 'convex') + ' mirror  R = ' + p.Rm.toFixed(2) + ' m',
                   '#BFE2F5');
        // centre of curvature and focus, both real points on the axis
        [[R, 'C'], [R / 2, 'F']].forEach(([xm, tag]) => {
          R3.sphere(F, [X(xm), 0, 0], 0.016, th['text-3'], { shadow: false });
          R3.label(F, [X(xm), 0, -0.07], tag, th['text-2'], { size: 10 });
        });
      } else {
        const lenses = O.two ? [[0, Math.abs(p.f)], [p.sep, Math.abs(p.f2)]] : [[0, p.f]];
        lenses.forEach(([lx, lf], li) => {
          const conc = p.mode === 'concave';
          const t = Math.max(p.thick, 1e-4) * K;
          post(lx, -ap * K - 0.02);
          F.push([X(lx), 0, 0], () => {
            // build the two faces explicitly so a concave lens is a real waist
            const face = (sg) => {
              const out = [];
              for (let i = 0; i <= 34; i++) {
                const z = (i / 34 - 0.5) * 2 * ap * K;
                const Rr2 = 2 * (p.nGlass - 1) * lf * K;
                const sag = Math.sqrt(Math.max(Rr2 * Rr2 - z * z, 0)) -
                            Math.sqrt(Math.max(Rr2 * Rr2 - (ap * K) * (ap * K), 0));
                const dxs = conc ? -sag : sag;
                out.push(cam.project([X(lx) + sg * (t / 2 + dxs * 0.55), 0, z]));
              }
              return out;
            };
            const fR = face(1), fL = face(-1).reverse();
            if (fR.some(q => !q.ok) || fL.some(q => !q.ok)) return;
            ctx.save();
            ctx.beginPath();
            fR.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
            fL.forEach(q => ctx.lineTo(q.x, q.y));
            ctx.closePath();
            const qa = cam.project([X(lx), 0, ap * K]), qb = cam.project([X(lx), 0, -ap * K]);
            const gg = ctx.createLinearGradient(qa.x, qa.y, qb.x, qb.y);
            gg.addColorStop(0, 'rgba(191,226,245,.30)');
            gg.addColorStop(0.5, 'rgba(120,180,225,.14)');
            gg.addColorStop(1, 'rgba(191,226,245,.30)');
            ctx.fillStyle = gg; ctx.fill();
            ctx.strokeStyle = g.alpha('#BFE2F5', .8); ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
          }, 0);
          // the rim, to say it is a disc and not a shape drawn on the page
          const rim = [];
          for (let i = 0; i <= 44; i++) {
            const a = i / 44 * TAU;
            rim.push([X(lx), Math.cos(a) * ap * K, Math.sin(a) * ap * K]);
          }
          R3.polyline(F, rim, '#8FB6DE', { alpha: .30, width: 1.2 });
          if (li === 0)
            R3.callout(F, [X(lx), 0, ap * K], away([X(lx), 0, 0]) * 26, -26,
                       (p.mode === 'concave' ? 'concave' : 'convex') + ' lens  f = ' +
                       (lf * 100).toFixed(1) + ' cm  ·  n = ' + p.nGlass.toFixed(2), '#BFE2F5');
          // the two focal points
          [[-Math.abs(lf) * (p.mode === 'concave' ? -1 : 1), 'F'],
           [Math.abs(lf) * (p.mode === 'concave' ? -1 : 1), "F'"]].forEach(([dx, tag]) => {
            R3.sphere(F, [X(lx + dx), 0, 0], 0.014, th['text-3'], { shadow: false });
            R3.label(F, [X(lx + dx), 0, -0.065], tag, th['text-2'], { size: 9.5 });
          });
        });
      }

      /* ---------------- the rays ----------------
         Drawn straight from the traced paths. Nothing is idealised: a ray
         that misses the aperture simply stops at the rim. */
      {
        const N = S.rays.length;
        /* Stop the rays a little past whatever they were going to land on, so
           the bench is not buried under a fan running off to infinity. */
        const xStop = Math.max(p.screenX, S.img && isFinite(S.img[0]) ? S.img[0] : 0,
                               O.two ? p.sep : 0) + 0.18;
        const trim = (path) => {
          const out = [];
          for (let k = 0; k < path.length; k++) {
            const q = path[k];
            if (O.mirror ? q[0] >= -0.001 || k === 0 : q[0] <= xStop) { out.push(q); continue; }
            const pr = path[k - 1];
            if (!pr) break;
            const t = (xStop - pr[0]) / (q[0] - pr[0]);
            if (t > 0 && t <= 1) out.push([xStop, pr[1] + (q[1] - pr[1]) * t]);
            break;
          }
          return out.length > 1 ? out : path;
        };
        S.rays.forEach((r, i) => {
          if (!r) return;
          const pts = trim(r.path).map(q => [X(q[0]), 0, q[1] * K]);
          const edge = Math.abs(i - (N - 1) / 2) / ((N - 1) / 2 || 1);
          const col = r.blocked ? th.crit : r.tir ? th.warn : '#FFD36B';
          R3.polyline(F, pts, col,
                      { alpha: r.blocked ? .35 : (0.28 + 0.42 * (1 - edge * 0.6)), width: 1.3,
                        bias: -0.03 });
          // the virtual continuation, dashed backwards, when the image is virtual
          if (!S.real && S.img && !r.blocked && !r.tir) {
            const q0 = r.p, d = r.dir;
            const tb = (S.img[0] - q0[0]) / (Math.abs(d[0]) > 1e-9 ? d[0] : 1e-9);
            if (tb < 0) {
              R3.polyline(F, [[X(q0[0]), 0, q0[1] * K], [X(S.img[0]), 0, (q0[1] + tb * d[1]) * K]],
                          '#8FA4CE', { alpha: .22, width: 1, bias: -0.03 });
            }
          }
        });

        /* the three principal rays, drawn thicker — the construction a student
           is asked to draw by hand, done here by the same tracer */
        if (p.principal && !O.two) {
          const tip = S.tip, hh = p.hObj;
          const targets = [[0, hh], [0, 0], [0, -hh * 0.0]];
          const special = [];
          // parallel to the axis
          special.push(traceRay([tip[0], hh], [1, 0], O.surf, O.xEnd));
          // through the optical centre (pole for a mirror)
          {
            const dx = 0 - tip[0], dz = 0 - hh, Lr = Math.hypot(dx, dz);
            special.push(traceRay([tip[0], hh], [dx / Lr, dz / Lr], O.surf, O.xEnd));
          }
          // through the front focus, emerging parallel
          {
            const fx = O.mirror ? O.f : -Math.abs(S.fPred) * (p.mode === 'concave' ? -1 : 1);
            const dx = fx - tip[0], dz = 0 - hh, Lr = Math.hypot(dx, dz);
            if (Lr > 1e-6) special.push(traceRay([tip[0], hh], [dx / Lr, dz / Lr], O.surf, O.xEnd));
          }
          special.forEach((r, k) => {
            if (!r || r.blocked) return;
            R3.polyline(F, trim(r.path).map(q => [X(q[0]), 0, q[1] * K]),
                        ['#5AE8B0', '#5AA9FF', '#FF9ECF'][k], { alpha: .95, width: 2, bias: -0.05 });
          });
        }
      }

      /* ---------------- the image ---------------- */
      if (S.img && isFinite(S.img[0]) && Math.abs(S.img[0]) < 4) {
        const ix = X(S.img[0]), ih = S.img[1] * K;
        const col = S.real ? '#7CE0A8' : '#C9A8F0';
        R3.cylinder(F, [ix, 0, 0], [ix, 0, ih * 0.80], 0.010, col,
                    { segments: 8, shadow: false, ambient: 0.6, bias: -0.04 });
        R3.arrow(F, [ix, 0, ih * 0.72], [ix, 0, ih], 0.010, col,
                 { head: 0.042, shadow: false, ambient: 0.85, bias: -0.04 });
        R3.callout(F, [ix, 0, ih], away([ix, 0, 0]) * 24, ih > 0 ? -22 : 22,
                   (S.real ? 'REAL' : 'virtual') + ' · ' + (ih * p.hObj > 0 ? 'erect' : 'inverted') +
                   ' · m = ' + S.mMeas.toFixed(2), col);
      }

      /* ---------------- the screen ---------------- */
      {
        const sx = X(clamp(p.screenX, -2.6, 2.9));
        const hh = clamp(4.2 * Math.abs(p.hObj) * K, 0.16, 0.42);
        const inFocus = S.img && Math.abs(p.screenX - S.img[0]) < 0.006 && S.real;
        F.push([sx, 0, 0], () => {
          const c4 = [[sx, -hh, hh], [sx, hh, hh], [sx, hh, -hh], [sx, -hh, -hh]].map(v => cam.project(v));
          if (c4.some(q => !q.ok)) return;
          ctx.beginPath();
          c4.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
          ctx.closePath();
          ctx.fillStyle = g.alpha('#141D2E', .88); ctx.fill();
          ctx.strokeStyle = g.alpha(inFocus ? th.ok : '#8FA4CE', inFocus ? .9 : .5);
          ctx.lineWidth = inFocus ? 2 : 1.3; ctx.stroke();
          /* what actually lands on the screen: every ray's height where it
             crosses this plane, smeared into a blur when out of focus */
          ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
          S.rays.forEach(r => {
            if (!r || r.blocked || r.tir) return;
            const d = r.dir, q0 = r.p;
            if (Math.abs(d[0]) < 1e-9) return;
            const t = (p.screenX - q0[0]) / d[0];
            if (t < 0) return;
            const z = (q0[1] + t * d[1]) * K;
            if (Math.abs(z) > hh) return;
            const a = cam.project([sx, 0, z]);
            if (!a.ok) return;
            const gr = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 7);
            gr.addColorStop(0, g.alpha('#FFD36B', .55)); gr.addColorStop(1, g.alpha('#FFD36B', 0));
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(a.x, a.y, 7, 0, TAU); ctx.fill();
          });
          ctx.restore();
        }, 0);
        R3.label(F, [sx, 0, -hh - 0.09],
                 inFocus ? 'screen · IN FOCUS'
                         : S.real ? 'screen' : 'screen · a virtual image cannot be caught',
                 inFocus ? th.ok : S.real ? th['text-2'] : th['text-3'], { size: 9.5 });
        const qs = cam.project([sx, 0, -hh - 0.02]);
        if (qs.ok && !p.autoFocus) {
          const on = g.dragging === 'scr';
          ctx.save();
          ctx.strokeStyle = on ? th.text : g.alpha(acc, .7);
          ctx.lineWidth = on ? 2.2 : 1.5;
          ctx.beginPath(); ctx.arc(qs.x, qs.y, 8, 0, TAU); ctx.stroke();
          ctx.restore();
          g.handle(qs.x, qs.y, 15, 'scr');
        }
      }

      F.render();

      /* ---------------- the comparison panel ----------------
         The traced result and the textbook formula, side by side, with the
         gap between them named. */
      {
        const bw = Math.min(W * 0.36, 316), bh = 120, bx = 12, by = H - bh - 22;
        ctx.fillStyle = g.alpha('#0B1020', .90);
        ctx.strokeStyle = g.alpha(th.line, 1); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
        PA.lbl(ctx, bx + 10, by + 13, 'TRACED  vs  THE LENS FORMULA', th['text-3'], 'left', 8.5);
        const row = (i, k, a, b, c) => {
          PA.lbl(ctx, bx + 10, by + 30 + i * 15, k, th['text-3'], 'left', 9);
          PA.lbl(ctx, bx + bw - 86, by + 30 + i * 15, a, c || th.text, 'right', 9.5);
          PA.lbl(ctx, bx + bw - 10, by + 30 + i * 15, b, th['text-2'], 'right', 9.5);
        };
        PA.lbl(ctx, bx + bw - 86, by + 17, 'traced', g.alpha(acc, .95), 'right', 8);
        PA.lbl(ctx, bx + bw - 10, by + 17, 'formula', g.alpha(th['text-3'], .95), 'right', 8);
        const fm = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d == null ? 3 : d);
        row(0, 'image distance  v (m)', fm(S.vMeas), fm(S.vPred), acc);
        row(1, 'magnification  m', fm(S.mMeas, 3), fm(S.mPred, 3), acc);
        row(2, 'image is', S.real ? 'REAL' : 'virtual',
            (S.mMeas || 0) < 0 ? 'inverted' : 'erect', S.real ? th.ok : '#C9A8F0');
        const dv = (S.vMeas != null && isFinite(S.vPred)) ? Math.abs(S.vMeas - S.vPred) : null;
        row(3, 'they differ by', dv == null ? '—' : (dv * 1000).toFixed(1) + ' mm', '',
            dv != null && dv > 0.004 ? th.warn : th.ok);
        PA.lbl(ctx, bx + 10, by + bh - 9,
               S.aberration > 0.004
                 ? 'marginal and paraxial rays focus ' + (S.aberration * 1000).toFixed(0) +
                   ' mm apart — spherical aberration'
                 : 'narrow bundle: the formula is an excellent approximation',
               S.aberration > 0.004 ? th.warn : th.ok, 'left', 8.5);
      }

      /* ---------------- header ---------------- */
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 19px "IBM Plex Sans Condensed",sans-serif';
      ctx.fillStyle = S.img ? (S.real ? th.ok : '#C9A8F0') : th.crit;
      ctx.fillText(!S.img ? 'no image — the rays do not converge'
        : (S.real ? 'REAL image' : 'VIRTUAL image') + ' at v = ' +
          (S.vMeas * 100).toFixed(1) + ' cm, m = ' + S.mMeas.toFixed(2), 14, 8);
      ctx.font = '500 10px "IBM Plex Mono",monospace'; ctx.fillStyle = th['text-3'];
      ctx.fillText('u = ' + (p.u * 100).toFixed(1) + ' cm   ·   ' +
        (O.mirror ? 'R = ' + (p.Rm * 100).toFixed(0) + ' cm, f = R/2 = ' + (O.f * 100).toFixed(1) + ' cm'
                  : 'f = ' + (Math.abs(p.f) * 100).toFixed(1) + ' cm, n = ' + p.nGlass.toFixed(2) +
                    ', aperture ' + (p.aperture * 100).toFixed(0) + ' cm') +
        '   ·   every ray refracted at each surface', 14, 31);
      ctx.fillStyle = th['text-3'];
      ctx.fillText('the lens formula is printed for comparison and never used to draw anything', 14, 45);
    },

    onDrag(S, e) {
      const p = S.p;
      if (e.id === 'obj' && S._axU) {
        const along = e.dx * S._axU.ux + e.dy * S._axU.uy;
        p.u = clamp(p.u - along * S._axU.perPx, 0.06, 1.6);
        this.setup(S);
      } else if (e.id === 'scr' && S._axU) {
        const along = e.dx * S._axU.ux + e.dy * S._axU.uy;
        p.autoFocus = false;
        p.screenX = clamp(p.screenX + along * S._axU.perPx, -2.6, 2.9);
      }
    },

    plots: [
      { title: 'Where each ray crosses the axis — the aberration curve',
        legend: [{ c: '#3DD6F5', label: 'crossing point of that ray' },
                 { c: '#FFAE4C', label: 'the paraxial (formula) focus' }],
        draw(S, g) {
          const pts = S.axisCross.map(a => [a[0] * 100, a[1] * 100]);
          if (!pts.length) { g.Plot({ xmin: -1, xmax: 1, ymin: -1, ymax: 1, xlabel: '', ylabel: '' }).frame(); return; }
          const xs = pts.map(q => q[1]);
          const lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
          const pad = Math.max((hi - lo) * 0.25, 0.4);
          const ah = S.O.ap * 100;
          const P = g.Plot({
            xmin: -ah * 1.1, xmax: ah * 1.1, ymin: lo - pad, ymax: hi + pad,
            xlabel: 'height of the ray at the lens (cm)', ylabel: 'axis crossing (cm)',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            if (isFinite(S.vPred)) P.hline(S.vPred * 100, g.alpha(g.theme.warn, .9), [4, 3]);
            P.line(pts.slice().sort((a, b) => a[0] - b[0]), g.theme.phys, 2);
            pts.forEach(q => P.dot(q[0], q[1], 3, g.theme.phys, g.theme['ink-950']));
          });
          P.tag(-ah * 1.05, isFinite(S.vPred) ? S.vPred * 100 : 0,
                'paraxial focus  v = ' + (S.vPred * 100).toFixed(1) + ' cm', g.theme.warn, 'left', -9);
          if (S.aberration > 0.001)
            P.tag(0, lo, 'marginal rays focus ' + (S.aberration * 1000).toFixed(0) + ' mm short',
                  g.theme['text-2'], 'center', 12);
        },
        hover(S, x) {
          if (!S.axisCross.length) return null;
          let best = S.axisCross[0];
          S.axisCross.forEach(a => { if (Math.abs(a[0] * 100 - x) < Math.abs(best[0] * 100 - x)) best = a; });
          return [{ label: 'ray height', value: (best[0] * 100).toFixed(2) + ' cm' },
                  { label: 'crosses at', value: (best[1] * 100).toFixed(2) + ' cm', color: '#3DD6F5' },
                  { label: 'paraxial', value: (S.vPred * 100).toFixed(2) + ' cm' }];
        } },

      { title: 'The whole u–v curve — and why u = f has no image',
        legend: [{ c: '#3DD6F5', label: 'image distance v' }, { c: '#63729A', label: 'magnification m' }],
        draw(S, g) {
          const p = S.p, f = S.fPred, vs = [], ms = [];
          const lim = 4 * Math.abs(f);
          for (let i = 1; i <= 400; i++) {
            const u = i / 400 * 1.6;
            if (Math.abs(u - Math.abs(f)) < 0.004) { vs.push([u, NaN]); ms.push([u, NaN]); continue; }
            const v = S.O.mirror ? 1 / (1 / f - 1 / (-u)) : 1 / (1 / f - 1 / u);
            vs.push([u, clamp(v, -lim, lim)]);
            ms.push([u, clamp(S.O.mirror ? -v / (-u) : -v / u, -lim, lim)]);
          }
          const P = g.Plot({
            xmin: 0, xmax: 1.6, ymin: -lim, ymax: lim,
            xlabel: 'object distance u (m)', ylabel: 'image distance v (m)  /  magnification',
            xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
          }).frame();
          P.clip(() => {
            P.hline(0, g.alpha(g.theme['text-3'], .6), [3, 4]);
            P.vline(Math.abs(f), g.alpha(g.theme.crit, .8), [4, 3]);
            P.vline(2 * Math.abs(f), g.alpha(g.theme['text-3'], .5), [2, 5]);
            P.line(ms.filter(q => isFinite(q[1])), g.alpha(g.theme['text-3'], .95), 1.5, [4, 3]);
            P.line(vs.filter(q => isFinite(q[1])), g.theme.phys, 2.2);
            if (S.vMeas != null && isFinite(S.vMeas))
              P.dot(p.u, clamp(S.vMeas, -lim, lim), 4.5, g.theme.text, g.theme['ink-950']);
          });
          P.tag(Math.abs(f), lim * 0.8, 'u = f : rays emerge parallel, no image',
                g.theme.crit, 'left', 0);
          P.tag(2 * Math.abs(f), 0, 'u = 2f', g.theme['text-3'], 'left', -9);
        },
        hover(S, x) {
          const f = S.fPred, u = Math.max(x, 0.01);
          const v = S.O.mirror ? 1 / (1 / f - 1 / (-u)) : 1 / (1 / f - 1 / u);
          return [{ label: 'u', value: u.toFixed(3) + ' m' },
                  { label: 'v', value: isFinite(v) ? v.toFixed(3) + ' m' : '∞', color: '#3DD6F5' },
                  { label: 'm', value: (S.O.mirror ? -v / (-u) : -v / u).toFixed(3) },
                  { label: 'image', value: (S.O.mirror ? v < 0 : v > 0) ? 'real' : 'virtual' }];
        } }
    ],

    readouts(S) {
      const p = S.p, O = S.O;
      const out = [
        { label: 'Object distance u', value: (p.u * 100).toFixed(1), unit: 'cm' },
        { label: 'Focal length f', value: (O.f * 100).toFixed(2), unit: 'cm', flag: 'accent',
          hint: O.mirror ? 'R/2' : "(n−1)(1/R₁ − 1/R₂)" },
        { label: 'v — traced', value: S.vMeas == null ? '—' : (S.vMeas * 100).toFixed(2), unit: 'cm',
          flag: 'accent', hint: 'where the rays actually cross' },
        { label: 'v — lens formula', value: isFinite(S.vPred) ? (S.vPred * 100).toFixed(2) : '∞', unit: 'cm',
          hint: '1/v − 1/u = 1/f' },
        { label: 'Magnification m', value: S.mMeas == null ? '—' : S.mMeas.toFixed(3), unit: '×',
          flag: 'accent', hint: (S.mMeas || 0) < 0 ? 'negative — inverted' : 'positive — erect' },
        { label: 'Image', value: S.real ? 'real' : 'virtual', unit: '',
          flag: S.real ? 'ok' : '', hint: S.real ? 'can be caught on a screen' : 'cannot be projected' },
        { label: 'Image height', value: S.img ? (S.img[1] * 100).toFixed(2) : '—', unit: 'cm' },
        { label: 'Spherical aberration', value: (S.aberration * 1000).toFixed(1), unit: 'mm',
          flag: S.aberration > 0.004 ? 'warn' : 'ok',
          hint: 'spread of the axis crossings' }
      ];
      if (!O.mirror) {
        out.push({ label: 'Power P = 1/f', value: (1 / O.f).toFixed(2), unit: 'D',
          hint: 'dioptres, f in metres' });
        out.push({ label: 'Surface radius |R|', value: (Math.abs(2 * (p.nGlass - 1) * O.f) * 100).toFixed(1),
          unit: 'cm', hint: 'symmetric, set by n and f' });
      }
      if (O.two) {
        out.push({ label: 'First image v₁', value: (S.v1Pred * 100).toFixed(2), unit: 'cm',
          hint: 'object for the second lens' });
        out.push({ label: 'Combined power', value: (1 / Math.abs(p.f) + 1 / Math.abs(p.f2) -
          p.sep / (Math.abs(p.f) * Math.abs(p.f2))).toFixed(2), unit: 'D',
          hint: 'P₁ + P₂ − dP₁P₂' });
      }
      return out;
    },

    equation(S) {
      const p = S.p, O = S.O;
      if (O.mirror) {
        return E.frac('1', E.v('v')) + ' ' + E.op('+') + ' ' + E.frac('1', E.v('u')) + ' ' +
          E.op('=') + ' ' + E.frac('1', E.v('f')) + ' ' + E.op('=') + ' ' + E.frac('2', E.v('R')) +
          E.op('·') + ' ' + E.v('f') + ' ' + E.op('=') + ' ' + E.n(O.f * 100, 'cm') +
          '<br>traced ' + E.v('v') + ' ' + E.op('=') + ' ' + E.n(S.vMeas * 100, 'cm') +
          E.op('·') + ' formula ' + E.n(S.vPred * 100, 'cm') +
          E.op('·') + ' ' + E.v('m') + ' ' + E.op('=') + ' ' + E.n(S.mMeas, '');
      }
      return E.frac('1', E.v('f')) + ' ' + E.op('=') + ' (' + E.v('n') + E.op('−') + '1)(' +
        E.frac('1', E.v('R') + '₁') + E.op('−') + E.frac('1', E.v('R') + '₂') + ')' + E.op('·') +
        ' here ' + E.v('R') + '₁ ' + E.op('=') + ' ' + E.op('−') + E.v('R') + '₂ ' + E.op('=') + ' ' +
        E.n(Math.abs(2 * (p.nGlass - 1) * O.f) * 100, 'cm') +
        '<br>' + E.frac('1', E.v('v')) + ' ' + E.op('−') + ' ' + E.frac('1', E.v('u')) + ' ' +
        E.op('=') + ' ' + E.frac('1', E.v('f')) + E.op('→') + ' ' + E.v('v') + ' ' + E.op('=') + ' ' +
        E.n(S.vPred * 100, 'cm') + E.op(',') + ' traced ' + E.n(S.vMeas * 100, 'cm') +
        '<br>' + E.v('m') + ' ' + E.op('=') + ' ' + E.frac(E.v('v'), E.v('u')) + ' ' + E.op('=') + ' ' +
        E.n(S.mMeas, '') + E.op('·') + ' ' + E.v('P') + ' ' + E.op('=') + ' 1/' + E.v('f') + ' ' +
        E.op('=') + ' ' + E.n(1 / O.f, 'D');
    },

    eqNote: '<b>The formula is a paraxial approximation, and this lab shows you its error bar.</b> ' +
      '1/v − 1/u = 1/f is derived by assuming every angle is small enough that sin θ ≈ tan θ ≈ θ. ' +
      'The tracer makes no such assumption — it applies Snell\'s law exactly at each surface — so opening ' +
      'the aperture makes the two columns in the panel drift apart. That drift is <b>spherical aberration</b>: ' +
      'rays through the rim of the lens cross the axis <i>nearer</i> than paraxial rays do. It is why a ' +
      'camera stopped down to a small aperture gives a sharper picture, and why the lens formula is ' +
      'perfectly safe for exam problems, which are always paraxial by construction.' +
      '<br><br><b>Two things have to be small, not one.</b> Opening the aperture breaks the ' +
      'approximation through the <i>ray angle</i>; raising the object height breaks it through the ' +
      '<b>field angle</b>, and a single uncorrected lens imaging a tall object is far worse than the ' +
      'same lens imaging a short one. Set the object to 8 cm at u = 30 cm — a field angle of 15° — and ' +
      'the traced image runs centimetres short of the formula even at a tiny aperture. That is field ' +
      'curvature, and it is why a real camera lens has six elements rather than one.',

    problems: [
      { source: 'JEE Main pattern · the lens formula',
        q: 'An object is placed 30.0 cm from a convex lens of focal length 20.0 cm. Find the image distance in centimetres.',
        params: { mode: 'convex', u: 0.30, f: 0.20, aperture: 0.014, hObj: 0.012, nGlass: 1.5, thick: 0.002, autoFocus: true },
        predict: { label: 'image distance v', unit: 'cm', tol: 0.02 },
        measure: S => S.vPred * 100,
        working: '1/v − 1/u = 1/f with u = −30 cm, f = +20 cm gives 1/v = 1/20 − 1/30 = 1/60, so ' +
          'v = <b>+60 cm</b>: real, on the far side, and inverted. The magnification is m = −v/u = −2, ' +
          'so the image is twice the size and upside down. Watch the traced column agree to the ' +
          'millimetre at this narrow aperture.' },
      { source: 'JEE Main pattern · a concave lens',
        q: 'An object is 40.0 cm from a concave lens of focal length 20.0 cm. Find the image distance in centimetres (give the magnitude).',
        params: { mode: 'concave', u: 0.40, f: 0.20, aperture: 0.014, hObj: 0.012, nGlass: 1.5, thick: 0.002, autoFocus: true },
        predict: { label: '|v|', unit: 'cm', tol: 0.03 },
        measure: S => Math.abs(S.vPred * 100),
        working: 'For a concave lens f = −20 cm, so 1/v = 1/(−20) − 1/(−40) = −1/40 and v = −40/3 = ' +
          '<b>13.3 cm</b> on the same side as the object. A concave lens gives a virtual, erect, ' +
          'diminished image for <i>every</i> object position — drag the object anywhere on the rail and ' +
          'the image never becomes real.' },
      { source: 'NEET pattern · a concave mirror',
        q: 'An object is 30.0 cm in front of a concave mirror of radius of curvature 40.0 cm. Find the image distance in centimetres (magnitude).',
        params: { mode: 'cmirror', u: 0.30, Rm: 0.40, aperture: 0.014, hObj: 0.012, autoFocus: true },
        predict: { label: '|v|', unit: 'cm', tol: 0.02 },
        measure: S => Math.abs(S.vPred * 100),
        working: 'f = R/2 = 20 cm for a concave mirror. 1/v + 1/u = 1/f with u = 30 cm gives ' +
          '1/v = 1/20 − 1/30 = 1/60, so v = <b>60 cm</b> in front of the mirror: real and inverted. ' +
          'The trap is using R instead of R/2 — the mirror formula takes the focal length, and the ' +
          'focus sits halfway to the centre of curvature. Both points are marked on the axis.' },
      { source: 'JEE Advanced pattern · the lens maker',
        q: 'A symmetric biconvex lens is made of glass of refractive index 1.50 and has surfaces of radius 20.0 cm. Find its focal length in centimetres.',
        params: { mode: 'convex', u: 0.60, f: 0.20, nGlass: 1.5, aperture: 0.014, hObj: 0.012, thick: 0.002, autoFocus: true },
        predict: { label: 'focal length f', unit: 'cm', tol: 0.02 },
        measure: S => Math.abs(S.O.f) * 100,
        working: '1/f = (n − 1)(1/R₁ − 1/R₂) with R₁ = +20 cm and R₂ = −20 cm gives ' +
          '1/f = 0.50 × (1/20 + 1/20) = 1/20, so f = <b>20 cm</b>. Note R₂ is negative for the second ' +
          'surface of a biconvex lens — getting that sign wrong turns the lens into a flat plate and ' +
          'sends f to infinity. Raise the index slider and watch the surfaces flatten as f is held fixed.' },
      { source: 'JEE Advanced pattern · two lenses',
        q: 'Two thin convex lenses of focal lengths 20.0 cm and 15.0 cm are placed 55.0 cm apart. An object sits 60.0 cm before the first. Where is the final image, measured from the second lens, in centimetres?',
        params: { mode: 'combo', u: 0.60, f: 0.20, f2: 0.15, sep: 0.55, aperture: 0.040, hObj: 0.010, nGlass: 1.5, thick: 0.002, autoFocus: true },
        predict: { label: 'final image from lens 2', unit: 'cm', tol: 0.03 },
        measure: S => S.vPred * 100,
        working: 'Do them one at a time. First lens: 1/v₁ = 1/20 − 1/60 = 1/30, v₁ = 30 cm. That image ' +
          'lies 55 − 30 = 25 cm before the second lens, so it is a real object for it at u₂ = 25 cm. ' +
          'Second lens: 1/v₂ = 1/15 − 1/25 = 10/375, v₂ = <b>37.5 cm</b>. ' +
          'The whole method is: <b>the image formed by the first element is the object for the next</b>, ' +
          'every time, with its own sign.' }
    ],

    walkthrough: [
      { title: '1 · A real image is where light actually goes',
        body: 'The object sits at 60 cm and the screen has snapped to the image. Look at the screen: the rays genuinely land there and build an inverted arrow.',
        ask: 'What makes this image "real" rather than "virtual"?',
        reveal: 'Light <b>physically arrives</b> at that plane, so a screen put there catches a picture. Turn off "put the screen at the image" and drag the screen: the spot smears out either side of focus and sharpens exactly at v. A virtual image has no such plane — nothing to catch.',
        params: { mode: 'convex', u: 0.60, f: 0.20, aperture: 0.05, autoFocus: true } },
      { title: '2 · Object at 2f',
        body: 'Move the object to 40 cm, which is exactly 2f for this lens.',
        ask: 'Where does the image land, and how big is it?',
        reveal: 'At <b>2f on the other side</b>, the same size, inverted: m = −1. This is the one position where object and image swap places symmetrically, and it is the standard way an optical bench is calibrated. The u–v graph shows it as the point where the curve crosses the line v = u.',
        params: { mode: 'convex', u: 0.40, f: 0.20, aperture: 0.05, autoFocus: true } },
      { title: '3 · Cross the focus and the image flips over',
        body: 'Drag the object inside the focal length, to about 12 cm.',
        ask: 'The image has become virtual, erect and magnified. Where is it?',
        reveal: 'On the <b>same side as the object</b>, further away: v is negative. The emerging rays diverge, so they never meet — but extended backwards they appear to come from a point behind the lens. That is a magnifying glass, and it is why you must hold one closer to the object than its focal length for it to work at all.',
        params: { mode: 'convex', u: 0.12, f: 0.20, aperture: 0.018, autoFocus: true } },
      { title: '4 · The formula is an approximation',
        body: 'Put the object back at 60 cm and open the aperture from 16 cm to 44 cm. Watch the two columns in the panel, and the first graph.',
        ask: 'Why do the traced and formula values now disagree?',
        reveal: 'Because 1/v − 1/u = 1/f assumes every angle is small enough that sin θ ≈ θ. The tracer never assumes that, so rays through the <b>rim</b> of the lens cross the axis <i>nearer</i> than paraxial ones. The first graph plots exactly this: crossing point against ray height, and it bends. This is <b>spherical aberration</b>, and stopping a camera down is how photographers avoid it.',
        params: { mode: 'convex', u: 0.60, f: 0.20, aperture: 0.16, autoFocus: true } },
      { title: '5 · A concave lens can never make a real image',
        body: 'Switch to the concave lens and drag the object anywhere along the rail.',
        ask: 'Try to produce a real image. Why is it impossible?',
        reveal: 'Because a diverging lens bends every ray <b>away</b> from the axis, so the emergent bundle never converges at any distance. v stays negative for every u: the image is always virtual, erect and diminished. The u–v graph for f < 0 has no positive branch at all.',
        params: { mode: 'concave', u: 0.40, f: 0.20, aperture: 0.05, autoFocus: true } },
      { title: '6 · f = R/2, and the two points are marked',
        body: 'Switch to the concave mirror. C and F are drawn on the axis.',
        ask: 'Why is the focus halfway to the centre of curvature?',
        reveal: 'A ray parallel to the axis strikes the mirror at height h, where the surface normal points at C. The law of reflection turns it through twice the angle of incidence, and for small h that lands it at <b>half the distance to C</b>. So f = R/2 — and the commonest mistake in the chapter is to put R into the mirror formula where f belongs.',
        params: { mode: 'cmirror', u: 0.60, Rm: 0.40, aperture: 0.05, autoFocus: true } },
      { title: '7 · A convex mirror shrinks everything',
        body: 'Switch to the convex mirror and drag the object in and out.',
        ask: 'Where is the image, and why is this the mirror on a car?',
        reveal: 'Always <b>behind the mirror, virtual, erect and diminished</b>, for every object distance. A diminished image means a wide field of view packed into a small mirror — which is exactly what a wing mirror needs, and exactly why it must be stamped "objects are closer than they appear".',
        params: { mode: 'xmirror', u: 0.60, Rm: 0.40, aperture: 0.05, autoFocus: true } },
      { title: '8 · Two elements: the image of one is the object of the next',
        body: 'Switch to two lenses, 55 cm apart, with the object at 60 cm.',
        ask: 'The first lens forms its image 30 cm along, which is 25 cm before the second. What happens next?',
        reveal: 'That image becomes the <b>object for the second lens</b>, at u₂ = 25 cm, and the calculation simply repeats: 1/v₂ = 1/15 − 1/25 gives 37.5 cm. Every compound instrument — microscope, telescope, camera — is this one step applied over and over. If the first image falls <i>behind</i> the second lens, it becomes a <b>virtual object</b> with a positive u, and the same formula still works.',
        params: { mode: 'combo', u: 0.60, f: 0.20, f2: 0.15, sep: 0.55, aperture: 0.0145, autoFocus: true } }
    ],

    quiz: [
      { q: 'An object is placed at the focus of a convex lens. The image is formed:',
        options: ['at the focus on the other side', 'at infinity', 'at 2f', 'at the lens'], answer: 1,
        why: 'With u = f, 1/v = 1/f − 1/f = 0, so v → ∞: the rays emerge parallel and never meet. The u–v graph shows this as the asymptote at u = f. This is how a collimator works.' },
      { q: 'A concave lens forms, for a real object, an image that is always:',
        options: ['real and inverted', 'virtual, erect and diminished', 'real and magnified', 'virtual and magnified'], answer: 1,
        why: 'A diverging lens bends rays away from the axis, so they never converge. v is negative for every u, and |m| < 1 always. Drag the object anywhere in the lab and you cannot make a real image.' },
      { q: 'For a concave mirror of radius of curvature R, the focal length is:',
        options: ['R', 'R/2', '2R', 'R/4'], answer: 1,
        why: 'f = R/2. Reflection turns a ray through twice the angle of incidence, so a paraxial parallel ray crosses the axis halfway to the centre of curvature. Putting R into the mirror formula instead of R/2 is the single commonest error in this chapter.' },
      { q: 'A symmetric biconvex lens of glass n = 1.5 has surfaces of radius 20 cm. Its focal length is:',
        options: ['10 cm', '20 cm', '40 cm', '30 cm'], answer: 1,
        why: '1/f = (n−1)(1/R₁ − 1/R₂) = 0.5 × (1/20 − 1/(−20)) = 1/20, so f = 20 cm. The second radius is negative for a biconvex lens; treating both as positive gives infinity.' },
      { q: 'Opening the aperture of a lens while keeping everything else fixed:',
        options: ['moves the paraxial focus', 'blurs the image because rim rays focus nearer',
                  'changes the focal length', 'makes the image virtual'], answer: 1,
        why: 'The paraxial focus is unchanged — it is a property of the surfaces, not of how much of them you use. But marginal rays cross the axis nearer than paraxial ones, so the bundle no longer meets at a point. That is spherical aberration, and the first graph in this lab measures it directly.' }
    ],

    notes: '<b>Where this shows up in the paper.</b>' +
      '<ul><li>Direct substitution into 1/v − 1/u = 1/f and m = v/u, with the sign convention applied ' +
      'consistently — measure everything from the pole, positive in the direction light travels.</li>' +
      '<li>Mirror problems with f = R/2, and the standard real/virtual, erect/inverted classification.</li>' +
      '<li>The lens-maker\'s equation, including what happens when the lens is put in water: ' +
      '(n − 1) becomes (n_lens/n_medium − 1), so f grows and can even change sign.</li>' +
      '<li>Two-element combinations, where the image of the first is the object for the second, ' +
      'and P = P₁ + P₂ − dP₁P₂ for the equivalent power.</li>' +
      '<li>Magnifying glass, compound microscope and astronomical telescope: magnification and tube ' +
      'length in normal adjustment.</li></ul>' +
      '<div class="pyq"><em>Trap to avoid</em>The sign convention is not optional decoration. Distances ' +
      'are measured <b>from the pole or optical centre</b>, positive in the direction the light travels. ' +
      'A real object is therefore at negative u for a lens, and the commonest lost mark in the chapter is ' +
      'a correct calculation with one sign dropped.</div>' +
      '<div class="pyq"><em>Trap to avoid</em>For a mirror the formula is 1/v + 1/u = 1/f, with a ' +
      '<b>plus</b>. For a lens it is 1/v − 1/u = 1/f. Writing one when you mean the other is a whole ' +
      'question thrown away, and no amount of checking the arithmetic will find it.</div>'
  });

})(window.InsightLab);

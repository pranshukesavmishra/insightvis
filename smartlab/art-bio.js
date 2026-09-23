/* ============================================================
   BIOLOGY — anatomical figure library
   Textbook-accurate Canvas 2D drawings of the structures NEET
   actually asks students to recognise and label: the vertebrate
   heart, the neuron, the plasma membrane and the synapse.
   Every figure is drawn in a normalised box and scaled, so any
   lab can place one at any size.
   ============================================================ */
window.BIOART = (function () {
  'use strict';
  const TAU = Math.PI * 2;

  function parseHex(h) {
    let x = String(h).trim();
    if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
    const n = parseInt(x.slice(1), 16);
    if (!isFinite(n)) return [200, 200, 200];
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const hx2 = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  function mixHex(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    return '#' + hx2(A[0] + (B[0] - A[0]) * t) + hx2(A[1] + (B[1] - A[1]) * t) +
      hx2(A[2] + (B[2] - A[2]) * t);
  }
  function rgba(hex, a) {
    const c = parseHex(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  const OXY = '#E8455C', DEOXY = '#3D6FB4', MYO = '#8E3B46', MYO_D = '#5E2630';
  const satColour = s => mixHex(DEOXY, OXY, Math.max(0, Math.min(1, (s - 55) / 45)));

  function lbl(ctx, x, y, text, col, align, size) {
    ctx.font = '600 ' + Math.max(9, size || 9.5) + 'px "IBM Plex Mono",monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function leader(ctx, x0, y0, x1, y1, col) {
    ctx.strokeStyle = rgba(col, .55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = rgba(col, .8);
    ctx.beginPath(); ctx.arc(x0, y0, 1.8, 0, TAU); ctx.fill();
  }

  /* =========================================================================
     THE VERTEBRATE HEART
     opts: { chambers 2|3|4, sat {ra,rv,la,lv}, contraction 0..1,
             mvOpen, tvOpen, avOpen, pvOpen, labels, septum }
     ========================================================================= */
  function heart(ctx, cx, cy, s, o) {
    o = o || {};
    const n = o.chambers || 4;
    const sat = o.sat || { ra: 60, rv: 60, la: 98, lv: 98 };
    const con = o.contraction || 0;
    const labels = o.labels !== false && window.__LABELS !== false;
    const leaders = window.__LABELS === false ? false : o.leaders === undefined ? labels : o.leaders;
    const X = x => cx + x * s, Y = y => cy + y * s;

    if (n === 2) return heart2(ctx, cx, cy, s, o, sat, labels);

    /* ---------- great vessels, drawn behind the muscle ----------
       Back to front: pulmonary veins, descending aorta, pulmonary
       arteries, pulmonary trunk, aortic arch, then the cavae. Each
       vessel is stroked twice — a dark casing, then the lumen colour —
       so crossings read as tubes at depth instead of flat overlaps. */
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // A great vessel is a round tube. Sampling the path and handing it to
    // the volume renderer is what stops it reading as a coloured stripe.
    const samp = [];
    const rec = {
      moveTo: (x, y) => samp.push([x, y]),
      lineTo: (x, y) => samp.push([x, y]),
      quadraticCurveTo: (cx2, cy2, x, y) => {
        const a = samp[samp.length - 1] || [x, y];
        for (let i = 1; i <= 12; i++) {
          const t = i / 12, u = 1 - t;
          samp.push([u * u * a[0] + 2 * u * t * cx2 + t * t * x,
                     u * u * a[1] + 2 * u * t * cy2 + t * t * y]);
        }
      },
      bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
        const a = samp[samp.length - 1] || [x, y];
        for (let i = 1; i <= 16; i++) {
          const t = i / 16, u = 1 - t;
          samp.push([u*u*u*a[0] + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x,
                     u*u*u*a[1] + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*y]);
        }
      }
    };
    const tube = (w, col, path) => {
      samp.length = 0;
      const save = { moveTo: ctx.moveTo, lineTo: ctx.lineTo,
                     quadraticCurveTo: ctx.quadraticCurveTo, bezierCurveTo: ctx.bezierCurveTo };
      ctx.moveTo = rec.moveTo; ctx.lineTo = rec.lineTo;
      ctx.quadraticCurveTo = rec.quadraticCurveTo; ctx.bezierCurveTo = rec.bezierCurveTo;
      try { path(); } finally {
        ctx.moveTo = save.moveTo; ctx.lineTo = save.lineTo;
        ctx.quadraticCurveTo = save.quadraticCurveTo; ctx.bezierCurveTo = save.bezierCurveTo;
      }
      if (samp.length > 1) RX.tube(ctx, samp.slice(), s * w, col, { shadow: true });
    };

    if (o.vessels !== false) {
    /* Anterior view: the viewer's LEFT is the patient's RIGHT, so the
       venae cavae are on the left of the figure and the aortic arch
       sweeps to the right (the patient's left). Draw order is back to
       front, so the SVC correctly covers the right pulmonary artery. */

    // four pulmonary veins entering the left atrium, kept low so they
    // do not tangle with the arch
    [[-0.58, -0.50], [-0.40, -0.42], [-0.20, -0.34], [-0.02, -0.28]].forEach(([vy, ey]) => {
      tube(0.062, OXY, () => {
        ctx.moveTo(X(1.04), Y(vy));
        ctx.quadraticCurveTo(X(0.80), Y(vy), X(0.52), Y(ey));
      });
    });

    // right pulmonary artery, running behind the SVC and ascending aorta
    tube(0.072, mixHex(DEOXY, '#0A1220', .22), () => {
      ctx.moveTo(X(0.00), Y(-1.00)); ctx.lineTo(X(-0.72), Y(-0.90));
    });
    // left pulmonary artery, behind the arch
    tube(0.072, mixHex(DEOXY, '#0A1220', .22), () => {
      ctx.moveTo(X(0.02), Y(-1.00)); ctx.lineTo(X(0.60), Y(-0.94));
    });

    // descending aorta, behind the arch on the patient's left
    tube(0.110, mixHex(OXY, '#120508', .34), () => {
      ctx.moveTo(X(0.70), Y(-1.18)); ctx.lineTo(X(0.78), Y(-0.66));
    });

    // ascending aorta and the arch, out of the left ventricle
    tube(0.145, OXY, () => {
      ctx.moveTo(X(0.06), Y(-0.54));
      ctx.bezierCurveTo(X(0.10), Y(-1.16), X(0.44), Y(-1.38), X(0.70), Y(-1.18));
    });
    // brachiocephalic, left common carotid, left subclavian off the arch
    [[0.20, -1.30], [0.36, -1.36], [0.52, -1.34]].forEach(([ax, ay]) => {
      tube(0.046, OXY, () => { ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(ax + 0.04), Y(ay - 0.30)); });
    });

    // pulmonary trunk, anterior to the aortic root, crossing to its left
    tube(0.135, DEOXY, () => {
      ctx.moveTo(X(-0.08), Y(-0.52));
      ctx.quadraticCurveTo(X(-0.14), Y(-0.86), X(0.00), Y(-1.00));
    });

    // superior and inferior venae cavae into the right atrium
    tube(0.125, DEOXY, () => { ctx.moveTo(X(-0.56), Y(-1.40)); ctx.lineTo(X(-0.50), Y(-0.56)); });
    tube(0.115, DEOXY, () => {
      ctx.moveTo(X(-0.98), Y(0.66));
      ctx.quadraticCurveTo(X(-0.78), Y(0.26), X(-0.64), Y(-0.20));
    });
    }

    /* ---------- myocardium silhouette ----------
       A path function, not a one-shot path: beginPath() inside the grain
       and band loops destroys the current path, so every clip and stroke
       has to lay the silhouette down again. */
    const myoPath = () => {
      ctx.beginPath();
      ctx.moveTo(X(-0.70), Y(-0.68));
      ctx.bezierCurveTo(X(-0.98), Y(-0.34), X(-0.92), Y(0.36), X(-0.46), Y(0.74));
      ctx.bezierCurveTo(X(-0.26), Y(0.92), X(-0.02), Y(1.04), X(0.10), Y(0.92));
      ctx.bezierCurveTo(X(0.56), Y(0.60), X(0.94), Y(0.06), X(0.88), Y(-0.40));
      ctx.bezierCurveTo(X(0.84), Y(-0.62), X(0.74), Y(-0.72), X(0.54), Y(-0.74));
      ctx.closePath();
    };
    const myoV = RX.sat(MYO, 1.24);
    // The wall is a solid, not a filled outline: the volume shader gives it
    // the key, the terminator, the bounce off the shadow side and a specular
    // band, and carries the muscle grain itself.
    RX.volume(ctx, myoPath, {
      fill: MYO, r: s * 0.95, cx: X(0.02), cy: Y(0.06),
      stipple: 1.25, grain: RX.mix(myoV, '#05080F', .62),
      shadow: 0.9, gloss: 0.16, contour: 0
    });
    // cardiac muscle runs in spiral bands — drawing them is what turns a
    // silhouette into a section
    ctx.save(); myoPath(); ctx.clip();
    ctx.strokeStyle = rgba('#5E2630', .40);
    ctx.lineWidth = Math.max(0.8, s * 0.016);
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const u = k / 20;
        const px = X(-1.05 + u * 2.1);
        const py = Y(i * 0.17 + Math.sin(u * Math.PI * 1.3 + i * 0.5) * 0.16);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
    myoPath();
    ctx.strokeStyle = rgba('#2A1016', .9); ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke();

    // coronary groove and vessels — what makes it read as a heart.
    // Clipped to the silhouette so nothing trails off the muscle.
    ctx.save(); myoPath(); ctx.clip();
    ctx.strokeStyle = rgba('#C8606C', .5); ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(X(-0.82), Y(-0.20));
    ctx.bezierCurveTo(X(-0.30), Y(-0.06), X(0.34), Y(-0.10), X(0.84), Y(-0.30));
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.028);
    ctx.beginPath();
    ctx.moveTo(X(0.06), Y(-0.14));
    ctx.bezierCurveTo(X(0.02), Y(0.28), X(-0.02), Y(0.62), X(0.04), Y(0.90));
    ctx.stroke();
    ctx.restore();

    /* ---------- chamber cavities ---------- */
    const cav = (x, y, rx, ry, s0, rot) => {
      ctx.save();
      ctx.translate(X(x), Y(y)); ctx.rotate(rot || 0);
      const c = RX.sat(satColour(s0), 1.30);
      const g2 = ctx.createRadialGradient(
        -rx * s * .45, -ry * s * .48, rx * s * .05, 0, 0, rx * s * 1.15);
      g2.addColorStop(0, RX.mix(c, '#ffffff', .52));
      g2.addColorStop(.26, RX.mix(c, '#ffffff', .18));
      g2.addColorStop(.62, c);
      g2.addColorStop(1, RX.mix(c, '#120508', .52));
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU); ctx.fill();
      // a specular on the blood surface, which is what makes it read as fluid
      const sp2 = ctx.createRadialGradient(
        -rx * s * .42, -ry * s * .46, 0, -rx * s * .42, -ry * s * .46, rx * s * .55);
      sp2.addColorStop(0, 'rgba(255,255,255,.34)');
      sp2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp2;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU); ctx.fill();
      // endocardium — the glistening lining of every chamber
      ctx.strokeStyle = rgba('#F2E3C0', .40);
      ctx.lineWidth = Math.max(1.2, s * 0.020);
      ctx.stroke();
      ctx.strokeStyle = rgba('#2A1016', .7); ctx.lineWidth = Math.max(1, s * 0.014);
      ctx.beginPath(); ctx.ellipse(0, 0, rx * s * 1.04, ry * s * 1.04, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    };

    const vShrink = 1 - con * 0.30;
    if (n === 4) {
      cav(-0.42, -0.44, 0.29, 0.21, sat.ra);                       // right atrium
      cav(0.38, -0.44, 0.26, 0.19, sat.la);                        // left atrium
      cav(-0.32, 0.28, 0.29 * vShrink, 0.44 * vShrink, sat.rv, -0.14);   // right ventricle, thin-walled
      cav(0.32, 0.22, 0.24 * vShrink, 0.46 * vShrink, sat.lv, 0.10);     // left ventricle, thick-walled
      // interventricular septum — a muscular wedge, thick at the base and
      // tapering to the apex, not a drawn line
      RX.tube(ctx, RX.quadPts(X(0.02), Y(-0.16), X(0.03), Y(0.32), X(0.06), Y(0.82), 14),
              u => s * (0.075 - 0.045 * u), mixHex(MYO, '#2A1016', .30),
              { vivid: false, contour: Math.max(1, s * 0.012) });
    } else {
      cav(-0.40, -0.44, 0.26, 0.19, sat.ra);
      cav(0.36, -0.44, 0.24, 0.17, sat.la);
      // a single undivided ventricle
      cav(0.0, 0.26, 0.44 * vShrink, 0.44 * vShrink, sat.lv);
      if (o.septum) {                                              // reptilian partial septum
        RX.tube(ctx, RX.quadPts(X(0.0), Y(0.74), X(0.01), Y(0.44), X(0.02), Y(0.18), 12),
                u => s * (0.062 - 0.030 * u), mixHex(MYO, '#2A1016', .30),
                { vivid: false, contour: Math.max(1, s * 0.011) });
      }
    }

    /* ---------- valves ---------- */
    const avValve = (x, open, wide) => {
      const y = -0.20, w = wide || 0.17;
      ctx.strokeStyle = open ? '#9BE8B6' : '#F2E3C0';
      ctx.lineWidth = Math.max(1.6, s * 0.035);
      const a = open ? 1.15 : 0.18;
      ctx.beginPath();
      ctx.moveTo(X(x - w), Y(y));
      ctx.lineTo(X(x - w + w * Math.cos(a) * 0.9), Y(y + w * 1.5 * Math.sin(a)));
      ctx.moveTo(X(x + w), Y(y));
      ctx.lineTo(X(x + w - w * Math.cos(a) * 0.9), Y(y + w * 1.5 * Math.sin(a)));
      ctx.stroke();
      // chordae tendineae
      ctx.strokeStyle = rgba('#F2E3C0', .35); ctx.lineWidth = Math.max(0.8, s * 0.012);
      [-1, 1].forEach(sg => {
        ctx.beginPath();
        ctx.moveTo(X(x + sg * (w - w * Math.cos(a) * 0.9)), Y(y + w * 1.5 * Math.sin(a)));
        ctx.lineTo(X(x + sg * w * 0.5), Y(y + 0.46));
        ctx.stroke();
      });
    };
    const slValve = (x, y, open, col, rot) => {
      // the vessel lumen seen end-on. Open: the three cusps lie flat
      // against the wall and the lumen is clear. Shut: the cusps meet
      // in the middle — the three-pointed 'Mercedes' sign.
      ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(rot || 0);
      const R = s * 0.135, RY = R * 0.60;
      ctx.fillStyle = open ? 'rgba(120,232,170,.30)' : rgba('#120508', .75);
      ctx.beginPath(); ctx.ellipse(0, 0, R, RY, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = open ? '#9BE8B6' : rgba(col, .95);
      ctx.lineWidth = Math.max(1.4, s * 0.026);
      ctx.beginPath(); ctx.ellipse(0, 0, R, RY, 0, 0, TAU); ctx.stroke();
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a0 = -Math.PI / 2 + k * TAU / 3;
        ctx.beginPath();
        if (open) {                                  // cusp flattened on the wall
          ctx.ellipse(0, 0, R * 0.88, RY * 0.88, 0, a0 - 0.5, a0 + 0.5);
        } else {                                     // cusp reaching the centre
          ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * RY);
          ctx.lineTo(0, 0);
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    if (n === 4) { avValve(-0.34, o.tvOpen); avValve(0.32, o.mvOpen); }
    else { avValve(-0.34, o.tvOpen, 0.14); avValve(0.32, o.mvOpen, 0.14); }
    // on the vessel trunks, just clear of the myocardium, so they are
    // legible instead of buried behind the atria
    if (o.vessels !== false) {        // without the trunks there is nothing to seat them in
      slValve(-0.11, -0.78, o.pvOpen, '#BFD8F2', -0.22);
      slValve(0.08, -0.82, o.avOpen, '#F2C9C9', 0.06);
    }

    /* ---------- labels ---------- */
    if (labels) {
      const T = '#F2E3C0';
      lbl(ctx, X(-0.42), Y(-0.44), 'RA', T, 'center', s * 0.10);
      lbl(ctx, X(0.38), Y(-0.44), 'LA', T, 'center', s * 0.10);
      if (n === 4) {
        lbl(ctx, X(-0.32), Y(0.28), 'RV', T, 'center', s * 0.10);
        lbl(ctx, X(0.32), Y(0.22), 'LV', T, 'center', s * 0.10);
      } else lbl(ctx, X(0.0), Y(0.26), 'VENTRICLE', T, 'center', s * 0.085);
    }
    if (leaders) {
      const M = '#9AA8C6';
      leader(ctx, X(-0.46), Y(-1.30), X(-0.72), Y(-1.44), '#8FB6E8');
      lbl(ctx, X(-0.76), Y(-1.46), 'superior vena cava', '#8FB6E8', 'right', s * 0.085);
      leader(ctx, X(-0.86), Y(0.48), X(-1.04), Y(0.66), '#8FB6E8');
      lbl(ctx, X(-1.06), Y(0.68), 'inferior vena cava', '#8FB6E8', 'right', s * 0.085);
      leader(ctx, X(-0.46), Y(-1.16), X(-0.86), Y(-1.02), '#8FB6E8');
      lbl(ctx, X(-0.90), Y(-1.02), 'pulmonary artery', '#8FB6E8', 'right', s * 0.085);
      leader(ctx, X(-0.30), Y(-1.42), X(0.30), Y(-1.52), '#F2A0A8');
      lbl(ctx, X(0.34), Y(-1.54), 'aorta', '#F2A0A8', 'left', s * 0.09);
      leader(ctx, X(0.58), Y(-0.50), X(0.96), Y(-0.62), '#F2A0A8');
      lbl(ctx, X(0.99), Y(-0.64), 'pulmonary veins', '#F2A0A8', 'left', s * 0.085);
      leader(ctx, X(0.32), Y(-0.14), X(0.86), Y(0.02), M);
      lbl(ctx, X(0.89), Y(0.02), 'bicuspid (mitral) valve', M, 'left', s * 0.085);
      leader(ctx, X(-0.34), Y(-0.14), X(-0.92), Y(-0.02), M);
      lbl(ctx, X(-0.95), Y(-0.02), 'tricuspid valve', M, 'right', s * 0.085);
      if (n === 4) {
        leader(ctx, X(0.05), Y(0.52), X(0.60), Y(0.70), M);
        lbl(ctx, X(0.63), Y(0.72), 'interventricular septum', M, 'left', s * 0.085);
      }
      lbl(ctx, X(0.10), Y(1.06), 'apex', M, 'center', s * 0.085);
    }
  }

  /* ---------- the two-chambered fish heart, which is a tube ---------- */
  function heart2(ctx, cx, cy, s, o, sat, labels) {
    const X = x => cx + x * s, Y = y => cy + y * s;
    const parts = [
      { x: -0.52, y: 0.62, rx: 0.20, ry: 0.15, n: 'sinus\nvenosus', c: 58 },
      { x: -0.18, y: 0.28, rx: 0.26, ry: 0.21, n: 'atrium', c: 58 },
      { x: 0.20, y: -0.14, rx: 0.30, ry: 0.27, n: 'ventricle', c: 58 },
      { x: 0.56, y: -0.58, rx: 0.17, ry: 0.13, n: 'conus\narteriosus', c: 58 }
    ];
    // connecting tube
    ctx.strokeStyle = MYO; ctx.lineWidth = s * 0.30; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(parts[0].x), Y(parts[0].y));
    parts.forEach(p => ctx.lineTo(X(p.x), Y(p.y)));
    ctx.stroke();
    // ventral aorta to the gills
    ctx.strokeStyle = DEOXY; ctx.lineWidth = s * 0.13;
    ctx.beginPath();
    ctx.moveTo(X(0.60), Y(-0.66)); ctx.lineTo(X(0.92), Y(-1.02)); ctx.stroke();
    parts.forEach((p, i) => {
      ctx.save(); ctx.translate(X(p.x), Y(p.y));
      const c = satColour(p.c);
      const g2 = ctx.createRadialGradient(-p.rx * s * .3, -p.ry * s * .3, p.rx * s * .1, 0, 0, p.rx * s * 1.2);
      g2.addColorStop(0, mixHex(MYO, '#ffffff', .2)); g2.addColorStop(1, MYO_D);
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(0, 0, p.rx * s, p.ry * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#2A1016', .8); ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke();
      ctx.fillStyle = rgba(c, .75);
      ctx.beginPath(); ctx.ellipse(0, 0, p.rx * s * 0.62, p.ry * s * 0.62, 0, 0, TAU); ctx.fill();
      ctx.restore();
      if (labels) {
        const lines = p.n.split('\n');
        lines.forEach((ln, k) =>
          lbl(ctx, X(p.x), Y(p.y) + (k - (lines.length - 1) / 2) * s * 0.12 + s * 0.30,
            ln, '#F2E3C0', 'center', s * 0.085));
      }
    });
    if (labels && o.leaders !== false) {
      lbl(ctx, X(0.96), Y(-1.06), 'to the gills', '#8FB6E8', 'left', s * 0.09);
      lbl(ctx, X(-0.60), Y(1.00), 'blood through the heart is ALL deoxygenated',
        '#8FB6E8', 'left', s * 0.085);
    }
  }

  /* =========================================================================
     THE NEURON — soma, dendrites, axon hillock, myelin, nodes, terminals
     colourAt(u) may be supplied to paint the axon by membrane potential.
     ========================================================================= */
  function neuron(ctx, x0, x1, y, r, o) {
    o = o || {};
    const somaR = o.somaR || r * 2.6;
    const myelin = !!o.myelin;
    const nodes = o.nodes || 7;
    const colourAt = o.colourAt || (() => '#2E5F8A');
    const labels = o.labels !== false && window.__LABELS !== false;
    const axStart = x0 + somaR * 1.5;

    /* ---- dendrites: tapering lit processes, not strokes ---- */
    const DEND = '#4E86DB';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.58 + i * 0.29);
      const bx = x0 + Math.cos(a) * somaR * 0.9, by = y + Math.sin(a) * somaR * 0.9;
      const ex = x0 + Math.cos(a) * somaR * 2.6, ey = y + Math.sin(a) * somaR * 2.5;
      const pts = RX.quadPts(bx, by,
        x0 + Math.cos(a) * somaR * 1.9, y + Math.sin(a) * somaR * 1.6, ex, ey, 14);
      RX.tube(ctx, pts, t => Math.max(0.7, r * 0.42 * (1 - t * 0.5)), DEND, {});
      [-0.4, 0.4].forEach(d => {
        RX.tube(ctx, [[ex, ey],
          [ex + Math.cos(a + d) * somaR * 0.9, ey + Math.sin(a + d) * somaR * 0.9]],
          t => Math.max(0.5, r * 0.22 * (1 - t * 0.55)), DEND, {});
      });
    }

    /* ---- soma: a lit cell body carrying Nissl granules ---- */
    RX.volume(ctx, c => c.ellipse(x0, y, somaR, somaR * 0.92, 0, 0, TAU), {
      fill: '#4E86DB', r: somaR, cx: x0, cy: y, squash: 0.92,
      stipple: 1.4, grain: '#1B3A66', gloss: 0.42, shadow: 0.85,
      contour: Math.max(1.1, somaR * 0.05)
    });
    RX.ball(ctx, x0, y, somaR * 0.42, '#6A3FC0', { gloss: 0.55, shadow: true });
    ctx.fillStyle = '#1E1340';
    ctx.beginPath(); ctx.arc(x0 + somaR * .10, y - somaR * .07, somaR * 0.14, 0, TAU); ctx.fill();

    /* ---- axon hillock ---- */
    ctx.fillStyle = '#3E6E9E';
    ctx.beginPath();
    ctx.moveTo(x0 + somaR * 0.75, y - somaR * 0.55);
    ctx.quadraticCurveTo(axStart - r * 2, y - r * 1.1, axStart, y - r);
    ctx.lineTo(axStart, y + r);
    ctx.quadraticCurveTo(axStart - r * 2, y + r * 1.1, x0 + somaR * 0.75, y + somaR * 0.55);
    ctx.closePath(); ctx.fill();

    /* ---- axon ---- */
    const segs = 120;
    for (let i = 0; i < segs; i++) {
      const u = i / segs;
      const xa = axStart + u * (x1 - axStart);
      const w = (x1 - axStart) / segs + 1;
      ctx.fillStyle = colourAt(u);
      ctx.fillRect(xa, y - r, w, r * 2);
    }
    // cylindrical shading: the axon is a tube, and until this was strong
    // enough it read as a painted bar
    const cg = ctx.createLinearGradient(0, y - r, 0, y + r);
    cg.addColorStop(0, 'rgba(0,0,0,.42)');
    cg.addColorStop(.13, 'rgba(255,255,255,.30)');
    cg.addColorStop(.30, 'rgba(255,255,255,.52)');
    cg.addColorStop(.48, 'rgba(255,255,255,.10)');
    cg.addColorStop(.72, 'rgba(0,0,0,.26)');
    cg.addColorStop(1, 'rgba(0,0,0,.52)');
    ctx.fillStyle = cg; ctx.fillRect(axStart, y - r, x1 - axStart, r * 2);
    // a narrow specular running the length of the tube
    const sp = ctx.createLinearGradient(0, y - r * 0.62, 0, y - r * 0.22);
    sp.addColorStop(0, 'rgba(255,255,255,0)');
    sp.addColorStop(.5, 'rgba(255,255,255,.42)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.fillRect(axStart, y - r * 0.62, x1 - axStart, r * 0.40);
    // axolemma
    ctx.strokeStyle = 'rgba(220,235,255,.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axStart, y - r); ctx.lineTo(x1, y - r);
    ctx.moveTo(axStart, y + r); ctx.lineTo(x1, y + r);
    ctx.stroke();

    /* ---- myelin sheath with nodes of Ranvier ---- */
    if (myelin) {
      const span = x1 - axStart;
      const seg = span / nodes;
      for (let i = 0; i < nodes; i++) {
        const sx = axStart + i * seg + seg * 0.08;
        const sw = seg * 0.84;
        const mg = ctx.createLinearGradient(0, y - r * 2.1, 0, y + r * 2.1);
        mg.addColorStop(0, '#7A6234');
        mg.addColorStop(.16, '#F6E9C2');
        mg.addColorStop(.36, '#E2C98C');
        mg.addColorStop(.62, '#BFA163');
        mg.addColorStop(1, '#6E5828');
        ctx.fillStyle = mg;
        const mPath = c => {
          c.beginPath();
          if (c.roundRect) c.roundRect(sx, y - r * 2.05, sw, r * 4.1, r * 1.2);
          else c.rect(sx, y - r * 2.05, sw, r * 4.1);
        };
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = r * 0.9; ctx.shadowOffsetY = r * 0.28;
        mPath(ctx); ctx.fill();
        ctx.restore();
        mPath(ctx); ctx.fill();
        // the wrapped membrane layers that make a sheath a sheath
        ctx.save(); mPath(ctx); ctx.clip();
        ctx.strokeStyle = 'rgba(96,74,30,.35)'; ctx.lineWidth = 1;
        for (let q = 1; q <= 4; q++) {
          const inset = q * r * 0.34;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(sx + inset * 0.3, y - r * 2.05 + inset, sw - inset * 0.6, r * 4.1 - inset * 2, r * 0.9);
          else ctx.rect(sx + inset * 0.3, y - r * 2.05 + inset, sw - inset * 0.6, r * 4.1 - inset * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(52,36,8,.75)'; ctx.lineWidth = 1.2; mPath(ctx); ctx.stroke();
        // Schwann cell nucleus
        ctx.fillStyle = 'rgba(80,60,25,.75)';
        ctx.beginPath(); ctx.ellipse(sx + sw * 0.5, y - r * 1.5, sw * 0.09, r * 0.4, 0, 0, TAU); ctx.fill();
        if (labels && i === 1) {
          leader(ctx, sx + sw * 0.5, y - r * 2.05, sx + sw * 0.5, y - r * 4.6, '#E9D7A8');
          lbl(ctx, sx + sw * 0.5, y - r * 5.1, 'myelin sheath (Schwann cell)', '#E9D7A8', 'center', 9);
        }
        if (labels && i === 4) {
          const nx = sx + sw + seg * 0.08;
          leader(ctx, nx, y + r, nx, y + r * 6.0, '#9FD8FF');
          lbl(ctx, nx, y + r * 6.5, 'node of Ranvier', '#9FD8FF', 'center', 9);
        }
      }
    }

    /* ---- axon terminals: branches ending in lit synaptic knobs ---- */
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4;
      const ex = x1 + Math.cos(a) * r * 6, ey = y + Math.sin(a) * r * 6;
      RX.tube(ctx, RX.quadPts(x1, y, x1 + r * 3, y + Math.sin(a) * r * 2, ex, ey, 12),
        t => Math.max(0.7, r * 0.5 * (1 - t * 0.35)), '#4E86DB', {});
      RX.ball(ctx, ex, ey, r * 1.15, '#5A8CBE', { gloss: 0.6 });
    }

    if (labels) {
      leader(ctx, x0, y + somaR * 0.9, x0 - somaR * 0.2, y + somaR * 2.6, '#9AA8C6');
      lbl(ctx, x0 - somaR * 0.25, y + somaR * 2.9, 'cell body (soma)', '#9AA8C6', 'center', 9);
      lbl(ctx, x0 - somaR * 2.6, y - somaR * 1.9, 'dendrites', '#9AA8C6', 'center', 9);
      leader(ctx, axStart, y + r, axStart + r * 0.6, y + r * 4.4, '#9AA8C6');
      lbl(ctx, axStart + r * 0.6, y + r * 4.9, 'axon hillock', '#9AA8C6', 'center', 9);
      lbl(ctx, x1 + r * 3, y + r * 8.4, 'axon terminals', '#9AA8C6', 'center', 9);
    }
    return { axStart, axEnd: x1, y, r };
  }

  /* =========================================================================
     PHOSPHOLIPID BILAYER — two leaflets of head-and-tail lipids
     ========================================================================= */
  function bilayer(ctx, x0, x1, yMid, halfH, o) {
    o = o || {};
    const headR = Math.max(2.2, halfH * 0.14);
    const step = headR * 2.15;
    const tailLen = halfH - headR * 2;
    ctx.save();
    // hydrophobic core
    ctx.fillStyle = 'rgba(214,196,150,.10)';
    ctx.fillRect(x0, yMid - halfH + headR, x1 - x0, (halfH - headR) * 2);
    for (let x = x0 + headR; x < x1; x += step) {
      [-1, 1].forEach(sg => {
        const hy = yMid + sg * (halfH - headR);
        // head
        const hg = ctx.createRadialGradient(x - headR * .3, hy - headR * .3, headR * .1, x, hy, headR);
        hg.addColorStop(0, '#F0DFA8'); hg.addColorStop(1, '#B99A54');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(x, hy, headR, 0, TAU); ctx.fill();
        // two tails, wavy
        ctx.strokeStyle = 'rgba(214,196,150,.55)';
        ctx.lineWidth = Math.max(1, headR * 0.34);
        [-0.42, 0.42].forEach(off => {
          ctx.beginPath();
          ctx.moveTo(x + off * headR, hy - sg * headR * 0.7);
          for (let k = 1; k <= 4; k++) {
            const ty = hy - sg * (headR * 0.7 + tailLen * k / 4);
            ctx.lineTo(x + off * headR + (k % 2 ? headR * 0.34 : -headR * 0.34), ty);
          }
          ctx.stroke();
        });
      });
    }
    ctx.restore();
  }

  /* =========================================================================
     SYNAPSE — presynaptic knob, cleft, receptor-studded postsynaptic membrane
     ========================================================================= */
  function synapticKnob(ctx, cx, cy, w, h, o) {
    o = o || {};
    const AX = '#4E86BE';
    // The axon is a round tube and the bouton a solid, not a stroked line
    // and a filled outline. The shading is what makes the depth read.
    const axTop = o.axonTop == null ? cy - h * 1.90 : Math.min(o.axonTop, cy - h * 0.80);
    RX.tube(ctx, [[cx, axTop], [cx, cy - h * 0.58]], h * 0.15, AX,
            { shadow: true, contour: Math.max(1, h * 0.035) });
    const knob = c => {
      c.beginPath();
      c.moveTo(cx - w * 0.50, cy + h * 0.50);
      c.bezierCurveTo(cx - w * 0.64, cy - h * 0.56, cx + w * 0.64, cy - h * 0.56,
                      cx + w * 0.50, cy + h * 0.50);
      c.closePath();
    };
    RX.volume(ctx, knob, {
      fill: AX, r: w * 0.46, cx: cx, cy: cy + h * 0.04,
      stipple: 0.9, grain: '#173250', shadow: 0.85, gloss: 0.26,
      contour: Math.max(1, h * 0.030)
    });
    ctx.save(); knob(ctx); ctx.clip();
    // two mitochondria, each with real cristae — the terminal is the most
    // mitochondria-dense compartment of the neuron, and that is examinable
    [[-0.27, 0.04, 0.48], [0.26, -0.10, -0.34]].forEach(([mx, my, rot]) => {
      ctx.save();
      ctx.translate(cx + mx * w, cy + my * h); ctx.rotate(rot);
      const mito = c => { c.beginPath(); c.ellipse(0, 0, w * 0.135, h * 0.21, 0, 0, TAU); };
      RX.volume(ctx, mito, { fill: '#E2916F', r: h * 0.20, cx: 0, cy: 0,
                             shadow: 0.6, gloss: 0.3, contour: Math.max(1, h * 0.022) });
      ctx.save(); mito(ctx); ctx.clip();
      ctx.strokeStyle = rgba('#7A3B2A', .75); ctx.lineWidth = Math.max(0.9, h * 0.030);
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.12, i * h * 0.070);
        ctx.quadraticCurveTo(0, i * h * 0.070 + h * 0.028, w * 0.09, i * h * 0.070);
        ctx.stroke();
      }
      ctx.restore(); ctx.restore();
    });
    // smooth ER cisternae running back up the axon
    ctx.strokeStyle = rgba('#9CC4E6', .30); ctx.lineWidth = Math.max(0.8, h * 0.026);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.38 + i * w * 0.06, cy - h * 0.46);
      ctx.quadraticCurveTo(cx - w * 0.05 + i * w * 0.10, cy - h * 0.22,
                           cx + w * 0.34, cy - h * 0.40 + i * h * 0.07);
      ctx.stroke();
    }
    ctx.restore();
    return { bottom: cy + h * 0.5, left: cx - w * 0.5, right: cx + w * 0.5 };
  }

  function postsynapticMembrane(ctx, x0, x1, y, o) {
    o = o || {};
    const occ = o.occupancy == null ? 0 : o.occupancy;
    const blocked = o.blocked || 0;
    const h = o.h || 22;
    const drop = h * 1.5;
    const depth = o.depth || h * 3;
    const SARC = '#9C5A78';
    // the surface of the postsynaptic cell — a shallow dome. Receptors are
    // seated ON this curve, so none of them float off the membrane.
    const domeY = x => y + drop * Math.pow(2 * ((x - x0) / (x1 - x0)) - 1, 2);
    const path = c => {
      c.beginPath();
      c.moveTo(x0, domeY(x0));
      for (let q = 1; q <= 60; q++) { const xx = x0 + (x1 - x0) * q / 60; c.lineTo(xx, domeY(xx)); }
      c.lineTo(x1, domeY(x0) + depth);
      c.lineTo(x0, domeY(x0) + depth);
      c.closePath();
    };
    // The muscle fibre under the end plate is a lit solid with sarcoplasm
    // grain, not a flat slab with a hard edge.
    RX.volume(ctx, path, {
      fill: SARC, r: Math.max(drop + depth, (x1 - x0) * 0.22) * 0.9,
      cx: (x0 + x1) / 2, cy: y + drop * 0.5 + depth * 0.38,
      stipple: 1.1, grain: '#3A1F2C', gloss: 0.10, contour: 0
    });
    ctx.save(); path(ctx); ctx.clip();
    // myofibrils running under the end plate — this is a muscle fibre
    ctx.strokeStyle = rgba('#6E3E56', .40); ctx.lineWidth = Math.max(1, h * 0.10);
    for (let q = 0; q < 9; q++) {
      const yy = y + drop + depth * (0.30 + q * 0.085);
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const xx = x0 + (x1 - x0) * k / 40;
        const py = yy + Math.sin(k * 0.35 + q) * h * 0.06;
        k ? ctx.lineTo(xx, py) : ctx.moveTo(xx, py);
      }
      ctx.stroke();
    }
    // junctional folds — the pleats of the motor end plate, lit as grooves
    for (let q = 0; q < 26; q++) {
      const xx = x0 + (x1 - x0) * (q + 0.5) / 26;
      const top = domeY(xx) + h * 0.55, bot = domeY(xx) + h * 2.3;
      ctx.strokeStyle = rgba('#2A1620', .70); ctx.lineWidth = Math.max(1.2, h * 0.09);
      ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, bot); ctx.stroke();
      ctx.strokeStyle = rgba('#D79FB6', .30); ctx.lineWidth = Math.max(0.7, h * 0.040);
      ctx.beginPath();
      ctx.moveTo(xx + h * 0.07, top); ctx.lineTo(xx + h * 0.07, bot * 0.998); ctx.stroke();
    }
    ctx.restore();
    // the sarcolemma itself, a lit line along the crest of the dome
    const crest = [];
    for (let q = 0; q <= 60; q++) { const xx = x0 + (x1 - x0) * q / 60; crest.push([xx, domeY(xx)]); }
    RX.tube(ctx, crest, Math.max(1.2, h * 0.10), '#E7BBCD', { vivid: false });

    // receptors embedded in the membrane, standing normal to the surface
    const n = o.n || 9;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) / n * (x1 - x0);
      const yy = domeY(x);
      const isBlocked = (i / n) < blocked;
      const open = isBlocked ? 0 : occ;
      ctx.save();
      ctx.translate(x, yy);
      const dx = (x1 - x0) / 200;
      ctx.rotate(Math.atan2(domeY(x + dx) - domeY(x - dx), 2 * dx));
      // A nicotinic receptor is a five-subunit funnel through the bilayer:
      // a wide extracellular mouth, a narrow gate, a short cytoplasmic exit.
      const col = isBlocked ? '#FB7185' : mixHex('#FF6B9D', '#FFD8E6', 0.10 + 0.55 * open);
      const wR = h * 0.36, hi = h * 0.42, lo = h * 0.62;
      const funnel = c => {
        c.beginPath();
        c.moveTo(-wR, -hi);
        c.quadraticCurveTo(-wR * 0.42, -hi * 0.30, -wR * 0.34, lo * 0.30);
        c.lineTo(-wR * 0.40, lo);
        c.lineTo(wR * 0.40, lo);
        c.lineTo(wR * 0.34, lo * 0.30);
        c.quadraticCurveTo(wR * 0.42, -hi * 0.30, wR, -hi);
        c.closePath();
      };
      RX.volume(ctx, funnel, { fill: col, r: h * 0.45, cx: 0, cy: 0,
                               shadow: 0.5, gloss: 0.32,
                               contour: Math.max(1, h * 0.035) });
      // the two α-subunit ACh binding sites on the extracellular mouth
      [-1, 1].forEach(sg => RX.ball(ctx, sg * wR * 0.62, -hi * 0.72, h * 0.10,
        isBlocked ? '#FB7185' : (open > 0.15 ? '#FFE9A8' : '#8E5C74'), { rim: 0 }));
      if (!isBlocked && open > 0.15) {   // the gated pore, open in proportion
        const pw = h * 0.10 * (0.3 + 0.7 * open);
        const pg = ctx.createLinearGradient(0, -hi, 0, lo);
        pg.addColorStop(0, 'rgba(255,255,255,' + (0.30 + 0.55 * open) + ')');
        pg.addColorStop(1, 'rgba(190,225,255,' + (0.12 + 0.35 * open) + ')');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(-wR * 0.46, -hi * 0.92); ctx.lineTo(-pw, lo * 0.2);
        ctx.lineTo(pw, lo * 0.2); ctx.lineTo(wR * 0.46, -hi * 0.92);
        ctx.closePath(); ctx.fill();
      }
      if (isBlocked) {                    // curare sitting in the binding site
        RX.ball(ctx, 0, -hi * 0.95, h * 0.15, '#FF3B5C', { rim: 0 });
      }
      ctx.restore();
    }
    return { top: y, domeY: domeY, drop: drop };
  }

  /* =========================================================================
     CARDIAC MUSCLE FIBRE — branched, striated, one central nucleus per cell,
     and the intercalated discs that make the myocardium a syncytium.
     ========================================================================= */
  function myocyte(ctx, x0, x1, y, h, o) {
    o = o || {};
    const contract = o.contraction || 0;
    const hh = h * (1 + contract * 0.18);
    const body = ctx.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
    body.addColorStop(0, mixHex(MYO, '#ffffff', .26));
    body.addColorStop(.5, MYO);
    body.addColorStop(1, MYO_D);
    ctx.fillStyle = body;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y - hh / 2, x1 - x0, hh, hh * 0.22);
    else ctx.rect(x0, y - hh / 2, x1 - x0, hh);
    ctx.fill();
    ctx.strokeStyle = rgba('#2A1016', .9); ctx.lineWidth = 1.2; ctx.stroke();
    // striations — sarcomeres, which shorten as the fibre contracts
    const n = Math.max(6, Math.round((x1 - x0) / (hh * 0.30 * (1 - contract * 0.22))));
    ctx.strokeStyle = rgba('#3A161D', .55); ctx.lineWidth = Math.max(1, hh * 0.045);
    for (let i = 1; i < n; i++) {
      const px = x0 + (i / n) * (x1 - x0);
      ctx.beginPath(); ctx.moveTo(px, y - hh * 0.44); ctx.lineTo(px, y + hh * 0.44); ctx.stroke();
    }
    // intercalated discs — the step junctions between cells
    const cells = o.cells || 3;
    const discs = [];
    for (let i = 1; i < cells; i++) {
      const px = x0 + (i / cells) * (x1 - x0);
      ctx.strokeStyle = rgba('#F2E3C0', .85); ctx.lineWidth = Math.max(1.8, hh * 0.075);
      ctx.beginPath();
      ctx.moveTo(px - hh * 0.10, y - hh / 2);
      ctx.lineTo(px - hh * 0.10, y - hh * 0.12);
      ctx.lineTo(px + hh * 0.10, y - hh * 0.12);
      ctx.lineTo(px + hh * 0.10, y + hh * 0.12);
      ctx.lineTo(px - hh * 0.10, y + hh * 0.12);
      ctx.lineTo(px - hh * 0.10, y + hh / 2);
      ctx.stroke();
      discs.push(px);
    }
    // one central nucleus per cell — the mark that separates cardiac from skeletal
    for (let i = 0; i < cells; i++) {
      const px = x0 + ((i + 0.5) / cells) * (x1 - x0);
      ctx.fillStyle = rgba('#3A2A5E', .95);
      ctx.beginPath(); ctx.ellipse(px, y, hh * 0.16, hh * 0.22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba('#1E1436', .9);
      ctx.beginPath(); ctx.arc(px + hh * 0.05, y - hh * 0.04, hh * 0.07, 0, TAU); ctx.fill();
    }
    return { discs: discs, h: hh };
  }

  return { heart, heart2, myocyte, neuron, bilayer, synapticKnob, postsynapticMembrane, satColour, mixHex, rgba,
    OXY, DEOXY };
})();

/* ============================================================
   ORGANIC CHEMISTRY — structure drawing library
   Skeletal formulae, rings, curly (electron-pushing) arrows,
   Newman projections, cyclohexane chairs, tetrahedral stereo-
   centres and p-orbital lobes for MO diagrams.
   Everything draws in device pixels around a given centre, so a
   lab can place any figure at any size.
   ============================================================ */
window.ORGART = (function () {
  'use strict';
  const TAU = Math.PI * 2;

  /* ---------------- colour ---------------- */
  function parseHex(h) {
    let x = String(h == null ? '#CCCCCC' : h).trim();
    if (x[0] !== '#') return [204, 204, 204];
    if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
    const n = parseInt(x.slice(1), 16);
    if (!isFinite(n)) return [204, 204, 204];
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const hx2 = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  function mix(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    return '#' + hx2(A[0] + (B[0] - A[0]) * t) + hx2(A[1] + (B[1] - A[1]) * t) + hx2(A[2] + (B[2] - A[2]) * t);
  }
  function rgba(h, a) { const c = parseHex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* CPK-ish element colours, tuned for a dark instrument ground */
  const ELEM = {
    C: '#C9D4EA', H: '#8C9BBA', O: '#FF6B6B', N: '#5AA9FF', S: '#FFD24B',
    Cl: '#7CE0A8', Br: '#C98A4B', I: '#B07CC6', F: '#9FE8C8', P: '#FF9A4C',
    Mg: '#9BE8B6', Li: '#E0A0FF', Na: '#E0A0FF', B: '#F2A0A8'
  };
  const elemColour = e => ELEM[e] || ELEM.C;

  /* ---------------- primitives ---------------- */

  /* One bond. order 1/2/3; style 'plain' | 'wedge' | 'dash' | 'partial'.
     Double bonds are drawn offset to the inside when `toward` is given,
     which is what makes a ring read correctly. */
  function bond(ctx, x0, y0, x1, y1, o) {
    o = o || {};
    const order = o.order || 1;
    const col = o.colour || '#C9D4EA';
    const w = o.width || 2;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let nx = -uy, ny = ux;
    if (o.toward) {                                  // flip the offset inward
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if ((o.toward[0] - mx) * nx + (o.toward[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
    }
    // trim the ends back so bonds do not run under atom labels
    const t0 = o.trim0 || 0, t1 = o.trim1 || 0;
    const ax = x0 + ux * t0, ay = y0 + uy * t0;
    const bx = x1 - ux * t1, by = y1 - uy * t1;

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (o.style === 'wedge') {                        // bond coming at the viewer
      const hw = w * 1.9;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx + nx * hw, by + ny * hw);
      ctx.lineTo(bx - nx * hw, by - ny * hw);
      ctx.closePath(); ctx.fill();
      return;
    }
    if (o.style === 'dash') {                         // bond going back
      const n = 6;
      ctx.strokeStyle = col; ctx.lineWidth = w * 0.9;
      for (let i = 1; i <= n; i++) {
        const u = i / n, hw = w * 1.9 * u;
        const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
        ctx.beginPath();
        ctx.moveTo(px + nx * hw, py + ny * hw);
        ctx.lineTo(px - nx * hw, py - ny * hw);
        ctx.stroke();
      }
      return;
    }

    // a lit gradient across the bond gives it roundness without costing
    // anything at draw time
    if (o.flat !== true) {
      const bg = ctx.createLinearGradient(ax - nx * w, ay - ny * w, ax + nx * w, ay + ny * w);
      bg.addColorStop(0, mix(col, '#ffffff', .30));
      bg.addColorStop(.45, col);
      bg.addColorStop(1, mix(col, '#05080F', .35));
      ctx.strokeStyle = bg;
    } else ctx.strokeStyle = col;
    ctx.lineWidth = w;
    if (o.style === 'partial') ctx.setLineDash([w * 2.2, w * 2]);
    if (order === 1) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    } else if (order === 2) {
      const s = o.toward ? w * 2.9 : w * 1.7;
      if (o.toward) {                                 // ring-style: main line + inner line
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = mix(col, '#ffffff', .14);
        ctx.lineWidth = w * 0.92;
        ctx.beginPath();
        ctx.moveTo(ax + nx * s + ux * len * .16, ay + ny * s + uy * len * .16);
        ctx.lineTo(bx + nx * s - ux * len * .16, by + ny * s - uy * len * .16);
        ctx.stroke();
      } else {                                        // symmetric pair
        [-1, 1].forEach(sg => {
          ctx.beginPath();
          ctx.moveTo(ax + nx * s * sg, ay + ny * s * sg);
          ctx.lineTo(bx + nx * s * sg, by + ny * s * sg);
          ctx.stroke();
        });
      }
    } else {
      [-1, 0, 1].forEach(sg => {
        const s = w * 2.2 * sg;
        ctx.beginPath();
        ctx.moveTo(ax + nx * s, ay + ny * s);
        ctx.lineTo(bx + nx * s, by + ny * s);
        ctx.stroke();
      });
    }
    ctx.setLineDash([]);
  }

  /* An atom label with its element colour, a knocked-out background so
     bonds do not show through, and optional charge and lone pairs. */
  function atom(ctx, x, y, text, o) {
    o = o || {};
    if (!text) return 0;
    const size = o.size || 13;
    const el = String(text).match(/^[A-Z][a-z]?/);
    const col = o.colour || elemColour(el ? el[0] : 'C');
    ctx.font = '600 ' + size + 'px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    if (o.knockout !== false) {
      const r = Math.max(w, size) * 0.66;
      const kg = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
      const gnd = o.ground || '#05080F';
      kg.addColorStop(0, gnd); kg.addColorStop(0.72, gnd); kg.addColorStop(1, rgba(gnd, 0));
      ctx.fillStyle = kg;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, size * 0.86, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = col;
    ctx.fillText(text, x, y);
    if (o.charge) {
      const cs = size * 0.62;
      const cx = x + w / 2 + cs * 0.66, cy = y - size * 0.50;
      ctx.beginPath(); ctx.arc(cx, cy, cs * 0.72, 0, TAU);
      ctx.fillStyle = o.charge > 0 ? 'rgba(255,107,107,.22)' : 'rgba(90,169,255,.22)';
      ctx.fill();
      ctx.strokeStyle = o.charge > 0 ? '#FF6B6B' : '#5AA9FF'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = o.charge > 0 ? '#FF6B6B' : '#5AA9FF';
      ctx.font = '700 ' + cs + 'px "IBM Plex Sans", sans-serif';
      ctx.fillText(o.charge > 0 ? '+' : '−', cx, cy + cs * 0.04);
    }
    if (o.pairs) lonePairs(ctx, x, y, size * 1.05, o.pairs, col);
    return w;
  }

  function lonePairs(ctx, x, y, r, dirs, col) {
    ctx.fillStyle = col || '#C9D4EA';
    dirs.forEach(a => {
      const ang = typeof a === 'number' ? a : 0;
      const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
      const ox = -Math.sin(ang) * 2.6, oy = Math.cos(ang) * 2.6;
      ctx.beginPath(); ctx.arc(px + ox, py + oy, 1.7, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(px - ox, py - oy, 1.7, 0, TAU); ctx.fill();
    });
  }

  /* The curly arrow of a mechanism. `half` gives a fish-hook (one
     electron); otherwise a full head (an electron pair). */
  function curlyArrow(ctx, x0, y0, x1, y1, o) {
    o = o || {};
    const col = o.colour || '#FFAE4C';
    const bow = o.bow == null ? 0.42 : o.bow;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const cx = mx - dy * bow, cy = my + dx * bow;
    ctx.strokeStyle = col; ctx.lineWidth = o.width || 2;
    ctx.lineCap = 'round';
    if (o.progress != null && o.progress < 1) ctx.setLineDash([len * o.progress, len]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    // head, tangent to the curve at its end
    const tx = x1 - cx, ty = y1 - cy, tl = Math.hypot(tx, ty) || 1;
    const ang = Math.atan2(ty / tl, tx / tl);
    const h = o.head || 8;
    ctx.fillStyle = col;
    if (o.half) {                                     // fish-hook: one barb only
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(ang - 0.48), y1 - h * Math.sin(ang - 0.48));
      ctx.lineWidth = o.width || 2; ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - h * Math.cos(ang - 0.42), y1 - h * Math.sin(ang - 0.42));
      ctx.lineTo(x1 - h * Math.cos(ang + 0.42), y1 - h * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fill();
    }
  }

  /* A ring of n atoms. `aromatic` draws the delocalisation circle;
     `alt` draws Kekulé alternating double bonds instead. Returns the
     vertex coordinates so a lab can hang substituents off them. */
  function ring(ctx, cx, cy, r, n, o) {
    o = o || {};
    const rot = o.rotate == null ? -Math.PI / 2 : o.rotate;
    const col = o.colour || '#C9D4EA';
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const order = o.alt ? (i % 2 === 0 ? 2 : 1) : 1;
      bond(ctx, a[0], a[1], b[0], b[1], {
        order: order, colour: col, width: o.width || 2, toward: [cx, cy],
        trim0: o.trim ? o.trim[i] || 0 : 0, trim1: o.trim ? o.trim[(i + 1) % n] || 0 : 0
      });
    }
    if (o.aromatic) {
      ctx.strokeStyle = o.aromaticColour || rgba(col, .75);
      ctx.lineWidth = (o.width || 2) * 0.85;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, TAU); ctx.stroke();
    }
    return pts;
  }

  /* A p orbital: two lobes, shaded by phase, area scaled by the MO
     coefficient. This is what a Hückel eigenvector actually looks like. */
  function pOrbital(ctx, x, y, r, coeff, o) {
    o = o || {};
    const a = Math.abs(coeff);
    if (a < 0.02) {
      ctx.strokeStyle = 'rgba(150,165,200,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.stroke();
      return;
    }
    const POS = o.pos || '#FF6B6B', NEG = o.neg || '#5AA9FF';
    const h = r * (0.42 + 0.58 * a);                 // lobe length tracks |c|
    const w = r * (0.26 + 0.30 * a);
    const tilt = o.tilt || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    [[1, coeff > 0 ? POS : NEG], [-1, coeff > 0 ? NEG : POS]].forEach(([sg, col]) => {
      const gr = ctx.createLinearGradient(0, 0, 0, -sg * h);
      gr.addColorStop(0, rgba(col, .18));
      gr.addColorStop(1, rgba(col, .78));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-w, -sg * h * 0.55, -w * 0.72, -sg * h, 0, -sg * h);
      ctx.bezierCurveTo(w * 0.72, -sg * h, w, -sg * h * 0.55, 0, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(col, .9); ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.restore();
  }

  /* Newman projection down a C–C bond at the given dihedral (radians).
     Front atom: three bonds from the centre. Back atom: three bonds
     from the rim of the circle. */
  function newman(ctx, cx, cy, r, dihedral, o) {
    o = o || {};
    const front = o.front || ['H', 'H', 'H'];
    const back = o.back || ['H', 'H', 'H'];
    const fCol = o.frontColour || '#E7EDFB', bCol = o.backColour || '#8C9BBA';
    const size = o.size || Math.max(10, r * 0.19);

    // back atom circle
    ctx.fillStyle = o.ground || 'rgba(12,18,32,.85)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

    // rear bonds, drawn first so the circle rim crosses them
    for (let i = 0; i < 3; i++) {
      const a = dihedral - Math.PI / 2 + i * TAU / 3;
      const x = cx + Math.cos(a) * r * 1.62, y = cy + Math.sin(a) * r * 1.62;
      bond(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, x, y,
        { colour: bCol, width: o.width || 2.2, trim1: size * 0.85 });
      atom(ctx, x, y, back[i], { size: size, colour: o.backLabel || bCol, ground: o.ground || '#0B111E' });
    }
    ctx.strokeStyle = o.rim || '#6E7C9E'; ctx.lineWidth = (o.width || 2.2) * 1.1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

    // front bonds meet at the centre
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3;
      const x = cx + Math.cos(a) * r * 1.62, y = cy + Math.sin(a) * r * 1.62;
      bond(ctx, cx, cy, x, y, { colour: fCol, width: (o.width || 2.2) * 1.15, trim1: size * 0.85 });
      atom(ctx, x, y, front[i], { size: size, colour: o.frontLabel || fCol, ground: o.ground || '#0B111E' });
    }
    ctx.fillStyle = fCol;
    ctx.beginPath(); ctx.arc(cx, cy, (o.width || 2.2) * 1.3, 0, TAU); ctx.fill();
    return { r: r };
  }

  /* Cyclohexane chair. `flip` 0..1 morphs one chair through the
     half-chair/twist-boat to the other chair, and the axial and
     equatorial bonds exchange as it goes — which is the whole point. */
  function chair(ctx, cx, cy, s, o) {
    o = o || {};
    const flip = o.flip || 0;
    const col = o.colour || '#C9D4EA';
    // ring carbons: a chair is two parallel triangles offset in z.
    // Pucker amplitude collapses through the planar transition state.
    const puck = Math.cos(flip * Math.PI);            // +1 chair, 0 planar, -1 flipped
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * TAU / 6;
      const x = cx + Math.cos(a) * s;
      const y = cy + Math.sin(a) * s * 0.42 + (i % 2 ? 1 : -1) * s * 0.26 * puck;
      pts.push([x, y, (i % 2 ? 1 : -1) * puck]);
    }
    // ring bonds, back ones dimmer so the chair reads three-dimensionally
    for (let i = 0; i < 6; i++) {
      const a = pts[i], b = pts[(i + 1) % 6];
      const back = (a[1] + b[1]) / 2 < cy;
      bond(ctx, a[0], a[1], b[0], b[1],
        { colour: back ? rgba(col, .55) : col, width: back ? 2 : 2.6 });
    }
    // axial and equatorial positions
    const sub = o.substituents || [];
    const out = [];
    for (let i = 0; i < 6; i++) {
      const [x, y, up] = pts[i];
      const axL = s * 0.42, eqL = s * 0.40;
      const ax = [x, y - up * axL];                                  // axial: vertical
      const eqDir = (i % 2 ? 1 : -1) * (x < cx ? -1 : 1);
      const eq = [x + eqDir * eqL * 0.86, y + up * eqL * 0.30];      // equatorial: splayed
      out.push({ c: [x, y], axial: ax, equatorial: eq, up: up > 0 });
      const here = sub.filter(v => v.i === i);
      here.forEach(v => {
        const tgt = v.pos === 'axial' ? ax : eq;
        bond(ctx, x, y, tgt[0], tgt[1], {
          colour: v.colour || col, width: 2.2,
          style: v.wedge ? (up > 0 ? 'wedge' : 'dash') : 'plain',
          trim1: 7
        });
        atom(ctx, tgt[0], tgt[1], v.label, { size: o.size || 12, ground: o.ground || '#05080F', colour: v.colour });
      });
      if (o.showPositions) {
        [['ax', ax, '#FFAE4C'], ['eq', eq, '#5AA9FF']].forEach(([t, q, c]) => {
          if (here.length) return;
          bond(ctx, x, y, q[0], q[1], { colour: rgba(c, .45), width: 1.4 });
          ctx.fillStyle = rgba(c, .8);
          ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, TAU); ctx.fill();
        });
      }
    }
    return out;
  }

  /* A tetrahedral stereocentre: two in-plane bonds, one wedge, one
     dash, with CIP priority numerals if asked. */
  function tetrahedral(ctx, cx, cy, s, groups, o) {
    o = o || {};
    // order: [up-left in-plane, up-right in-plane, wedge down-right, dash down-left]
    const geo = [
      { a: -Math.PI * 0.82, style: 'plain' },
      { a: -Math.PI * 0.18, style: 'plain' },
      { a: Math.PI * 0.30, style: 'wedge' },
      { a: Math.PI * 0.70, style: 'dash' }
    ];
    const mirror = o.mirror ? -1 : 1;
    const out = [];
    geo.forEach((gm, i) => {
      const gp = groups[i] || { label: 'H' };
      const a = mirror === 1 ? gm.a : Math.PI - gm.a;
      const x = cx + Math.cos(a) * s, y = cy + Math.sin(a) * s;
      bond(ctx, cx, cy, x, y, {
        colour: gp.colour || '#C9D4EA', width: 2.2, style: gm.style, trim1: 9
      });
      atom(ctx, x, y, gp.label, { size: o.size || 13, ground: o.ground || '#05080F', colour: gp.colour });
      if (o.priorities && gp.priority) {
        const px = cx + Math.cos(a) * s * 1.44, py = cy + Math.sin(a) * s * 1.44;
        ctx.fillStyle = 'rgba(255,174,76,.16)';
        ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#FFAE4C'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#FFAE4C';
        ctx.font = '700 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(gp.priority), px, py);
      }
      out.push({ x: x, y: y, a: a, style: gm.style });
    });
    atom(ctx, cx, cy, o.centre || 'C', { size: (o.size || 13) * 1.05, ground: o.ground || '#05080F' });
    return out;
  }

  /* A labelled energy-profile curve through a list of stationary points
     [{x 0..1, e, label, kind:'min'|'ts'}] — the standard reaction
     coordinate diagram, drawn as a smooth spline, not straight segments. */
  function profile(ctx, x0, y0, x1, y1, pts, o) {
    o = o || {};
    const eMin = o.eMin == null ? Math.min(...pts.map(p => p.e)) : o.eMin;
    const eMax = o.eMax == null ? Math.max(...pts.map(p => p.e)) : o.eMax;
    const pad = (eMax - eMin) * 0.16 || 1;
    const X = u => x0 + u * (x1 - x0);
    const Y = e => y0 - (e - eMin + pad) / (eMax - eMin + 2 * pad) * (y0 - y1);
    ctx.strokeStyle = o.colour || '#FFAE4C';
    ctx.lineWidth = o.width || 2.4; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ax = X(a.x), ay = Y(a.e), bx = X(b.x), by = Y(b.e);
      if (!i) ctx.moveTo(ax, ay);
      ctx.bezierCurveTo(ax + (bx - ax) * .42, ay, bx - (bx - ax) * .42, by, bx, by);
    }
    ctx.stroke();
    return { X: X, Y: Y };
  }

  return {
    bond, atom, lonePairs, curlyArrow, ring, pOrbital, newman, chair,
    tetrahedral, profile, elemColour, mix, rgba, ELEM
  };
})();

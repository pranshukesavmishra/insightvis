/* ============================================================
   ZOOLOGY — anatomical and histological figure library
   The Animal Kingdom is examined on labelled diagrams: body
   wall layers, canal systems, cell types, cross sections. This
   draws them the way a zoology plate does — individual cells
   with nuclei, tissue layers named, cavities lined correctly —
   rather than as coloured blobs.
   ============================================================ */
window.ZOOART = (function () {
  'use strict';
  const TAU = Math.PI * 2;

  function parseHex(h) {
    let x = String(h == null ? '#CCCCCC' : h).trim();
    if (x[0] !== '#') return [204, 204, 204];
    if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
    const n = parseInt(x.slice(1), 16);
    return isFinite(n) ? [n >> 16 & 255, n >> 8 & 255, n & 255] : [204, 204, 204];
  }
  const h2 = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  function mix(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    return '#' + h2(A[0] + (B[0] - A[0]) * t) + h2(A[1] + (B[1] - A[1]) * t) + h2(A[2] + (B[2] - A[2]) * t);
  }
  function rgba(c, a) { const q = parseHex(c); return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + a + ')'; }

  /* Histological palette — the colours a stained section actually shows.
     Ectoderm/epidermis blue, mesoderm/muscle red, endoderm/gut amber,
     nuclei dark violet, matrix and jelly pale. */
  const C = {
    ecto: '#5A8FD8', ectoD: '#2E4F7A',
    meso: '#D9605A', mesoD: '#7E2F2C',
    endo: '#E0A54C', endoD: '#7E5A1E',
    jelly: '#9FB6D8', nucleus: '#3A2A5E', nucleolus: '#1E1436',
    spicule: '#DCE6F5', cavity: '#0A1220', ink: '#0A0E18'
  };

  function lbl(ctx, x, y, text, col, align, size, baseline) {
    ctx.font = '600 ' + Math.max(8.5, size || 9.5) + 'px "IBM Plex Mono",monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'middle';
    ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(5,8,15,.88)'; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col || '#C9D4EA';
    ctx.fillText(text, x, y);
  }
  function leader(ctx, x0, y0, x1, y1, col) {
    ctx.strokeStyle = rgba(col || '#8FA4CE', .6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = rgba(col || '#8FA4CE', .9);
    ctx.beginPath(); ctx.arc(x0, y0, 1.9, 0, TAU); ctx.fill();
  }

  /* =====================================================================
     ONE CELL, drawn as a cell: a membrane, cytoplasm shaded from a light
     source, a nucleus with a nucleolus. Everything else is built on this.
     ===================================================================== */
  function cell(ctx, x, y, rx, ry, o) {
    o = o || {};
    const base = o.colour || C.ecto;
    const rot = o.rot || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const gr = ctx.createRadialGradient(-rx * .32, -ry * .34, rx * .08, 0, 0, Math.max(rx, ry));
    gr.addColorStop(0, mix(base, '#ffffff', .34));
    gr.addColorStop(.62, base);
    gr.addColorStop(1, mix(base, C.ink, .46));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(mix(base, C.ink, .55), .95);
    ctx.lineWidth = Math.max(0.8, Math.min(rx, ry) * 0.10);
    ctx.stroke();
    if (o.nucleus !== false) {
      const nr = Math.min(rx, ry) * (o.nucleusR || 0.42);
      const nx = (o.nx || 0) * rx, ny = (o.ny || 0) * ry;
      const ng = ctx.createRadialGradient(nx - nr * .3, ny - nr * .3, nr * .1, nx, ny, nr);
      ng.addColorStop(0, mix(C.nucleus, '#ffffff', .30));
      ng.addColorStop(1, C.nucleus);
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill();
      if (nr > 2.4) {
        ctx.fillStyle = C.nucleolus;
        ctx.beginPath(); ctx.arc(nx + nr * .22, ny - nr * .16, nr * 0.32, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* A sheet of cells along a line — an epithelium. Returns the cell
     centres so a lab can hang cilia, flagella or microvilli off them. */
  function epithelium(ctx, x0, y0, x1, y1, n, o) {
    o = o || {};
    const out = [];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const cw = len / n;
    const th = o.thickness || cw * 0.9;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const px = x0 + dx * u + nx * (o.offset || 0);
      const py = y0 + dy * u + ny * (o.offset || 0);
      cell(ctx, px, py, cw * 0.46, th * 0.5, {
        colour: o.colour, rot: Math.atan2(uy, ux),
        nucleusR: o.nucleusR == null ? 0.44 : o.nucleusR,
        nx: o.nucleusOffset || 0
      });
      out.push({ x: px, y: py, nx: nx, ny: ny, ux: ux, uy: uy });
    }
    return out;
  }

  /* =====================================================================
     CHOANOCYTE — the collar cell that drives every sponge. A cell body,
     a ring of microvilli forming the collar, and one beating flagellum.
     ===================================================================== */
  function choanocyte(ctx, x, y, s, o) {
    o = o || {};
    const dir = o.dir == null ? -Math.PI / 2 : o.dir;   // where the flagellum points
    const beat = o.beat || 0;
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir + Math.PI / 2);
    // cell body
    cell(ctx, 0, s * 0.42, s * 0.40, s * 0.44, { colour: o.colour || C.endo, nucleusR: 0.40 });
    // the collar: microvilli, drawn as individual filaments
    const nv = 9;
    ctx.strokeStyle = rgba(mix(o.colour || C.endo, '#ffffff', .5), .9);
    ctx.lineWidth = Math.max(0.8, s * 0.045);
    ctx.lineCap = 'round';
    for (let i = 0; i < nv; i++) {
      const u = (i / (nv - 1)) * 2 - 1;
      ctx.beginPath();
      ctx.moveTo(u * s * 0.33, s * 0.06);
      ctx.lineTo(u * s * 0.50, -s * 0.62);
      ctx.stroke();
    }
    // the flagellum, a travelling sine wave — this is what moves the water
    ctx.strokeStyle = rgba('#FFF0C0', .95);
    ctx.lineWidth = Math.max(1, s * 0.055);
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const fy = s * 0.06 - t * s * 1.45;
      const fx = Math.sin(t * 7.2 - beat * 6.2) * s * 0.26 * t;
      i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* =====================================================================
     NEMATOCYST — the cnidarian sting, drawn as the organelle it is.
     `fire` 0 → 1 runs the discharge: the operculum opens, the coiled
     tubule everts inside out, the stylets lead, the barbs follow.
     ===================================================================== */
  function nematocyst(ctx, cx, cy, s, fire, o) {
    o = o || {};
    const f = Math.max(0, Math.min(1, fire || 0));
    const wall = o.wall || '#7FA8D8';
    ctx.save(); ctx.translate(cx, cy);

    // capsule: a thick-walled flask, under pressure
    const cw = s * 0.52, ch = s * 0.74;
    const cg = ctx.createRadialGradient(-cw * .34, -ch * .38, cw * .1, 0, 0, ch);
    cg.addColorStop(0, mix(wall, '#ffffff', .42));
    cg.addColorStop(.6, wall);
    cg.addColorStop(1, mix(wall, C.ink, .52));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(0, ch * 0.10, cw, ch, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(mix(wall, C.ink, .6), 1);
    ctx.lineWidth = Math.max(1.4, s * 0.055); ctx.stroke();

    // lumen, so the coil reads as being inside something
    ctx.fillStyle = rgba(C.cavity, .78);
    ctx.beginPath(); ctx.ellipse(0, ch * 0.12, cw * 0.80, ch * 0.82, 0, 0, TAU); ctx.fill();

    // the coiled tubule still inside, unwinding as it fires
    const turns = 3.4 * (1 - f);
    if (turns > 0.05) {
      ctx.strokeStyle = rgba('#E6F0FF', .85);
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.beginPath();
      const N = 150;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = t * turns * TAU;
        const r = cw * 0.70 * (1 - t * 0.86);
        const px = Math.cos(a) * r, py = ch * 0.12 + Math.sin(a) * r * 1.12;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }

    // operculum — the lid, hinged open by the discharge
    const lid = f * 1.15;
    ctx.save();
    ctx.translate(-cw * 0.34, -ch * 0.82);
    ctx.rotate(-lid);
    ctx.fillStyle = mix(wall, '#ffffff', .25);
    ctx.beginPath();
    ctx.ellipse(cw * 0.34, 0, cw * 0.40, ch * 0.10, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(wall, C.ink, .6), 1); ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.stroke();
    ctx.restore();

    // the everted thread, with its stylets and barbs
    if (f > 0.01) {
      const L = s * 3.4 * f;
      ctx.strokeStyle = rgba('#DCE6F5', .95);
      ctx.lineWidth = Math.max(1.2, s * 0.075);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -ch * 0.86);
      for (let i = 1; i <= 26; i++) {
        const t = i / 26;
        ctx.lineTo(Math.sin(t * 2.6) * s * 0.10, -ch * 0.86 - L * t);
      }
      ctx.stroke();
      // barbs point backwards, which is what makes it hold
      ctx.strokeStyle = rgba('#FFFFFF', .75);
      ctx.lineWidth = Math.max(0.8, s * 0.04);
      const nb = Math.max(2, Math.round(9 * f));
      for (let i = 0; i < nb; i++) {
        const t = 0.12 + (i / nb) * 0.82;
        const bx = Math.sin(t * 2.6) * s * 0.10, by = -ch * 0.86 - L * t;
        [-1, 1].forEach(sg => {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + sg * s * 0.15, by + s * 0.13);
          ctx.stroke();
        });
      }
      // the three stylets at the tip, which pierce first
      const tipY = -ch * 0.86 - L;
      ctx.fillStyle = '#FFFFFF';
      [-0.9, 0, 0.9].forEach(a => {
        ctx.save();
        ctx.translate(Math.sin(2.6) * s * 0.10, tipY); ctx.rotate(a * 0.42);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.30); ctx.lineTo(-s * 0.055, 0); ctx.lineTo(s * 0.055, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      });
    }

    // cnidocil — the trigger, a modified cilium
    ctx.strokeStyle = rgba('#9FD8FF', .95);
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(cw * 0.30, -ch * 0.78);
    ctx.quadraticCurveTo(cw * 0.72, -ch * 1.26, cw * 0.52, -ch * 1.66);
    ctx.stroke();
    ctx.restore();
    return { capsuleW: cw, capsuleH: ch };
  }

  /* =====================================================================
     BODY WALL — the layered section every diploblast/triploblast question
     is really about. Layers are drawn as real cell sheets, named in place.
     ===================================================================== */
  function bodyWall(ctx, x0, x1, yTop, layers, o) {
    o = o || {};
    let y = yTop;
    const out = [];
    layers.forEach(L => {
      const h = L.h;
      if (L.kind === 'matrix') {
        // a non-cellular jelly or matrix, with scattered wandering cells
        const g2 = ctx.createLinearGradient(0, y, 0, y + h);
        g2.addColorStop(0, rgba(L.colour || C.jelly, .30));
        g2.addColorStop(.5, rgba(L.colour || C.jelly, .16));
        g2.addColorStop(1, rgba(L.colour || C.jelly, .30));
        ctx.fillStyle = g2;
        ctx.fillRect(x0, y, x1 - x0, h);
        if (L.cells) {
          for (let i = 0; i < L.cells; i++) {
            const px = x0 + ((i + 0.5) / L.cells) * (x1 - x0) + (i % 2 ? 6 : -6);
            cell(ctx, px, y + h * (i % 2 ? 0.36 : 0.64), h * 0.20, h * 0.16,
              { colour: L.cellColour || C.meso, nucleusR: 0.46 });
          }
        }
      } else {
        const n = L.n || Math.max(4, Math.round((x1 - x0) / (h * 0.85)));
        epithelium(ctx, x0, y + h / 2, x1, y + h / 2, n,
          { colour: L.colour, thickness: h, nucleusOffset: L.nucleusOffset || 0 });
      }
      out.push({ name: L.name, y0: y, y1: y + h, mid: y + h / 2, colour: L.colour });
      y += h;
    });
    // bracket and name each layer down the left
    if (o.labels !== false) {
      out.forEach(L => {
        if (!L.name) return;
        const lx = o.labelX == null ? x0 - 10 : o.labelX;
        ctx.strokeStyle = rgba(L.colour || '#8FA4CE', .8); ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(lx + 5, L.y0 + 1); ctx.lineTo(lx, L.y0 + 1);
        ctx.lineTo(lx, L.y1 - 1); ctx.lineTo(lx + 5, L.y1 - 1);
        ctx.stroke();
        lbl(ctx, lx - 6, L.mid, L.name, L.colour || '#C9D4EA', 'right', o.size || 9.5);
      });
    }
    return out;
  }

  /* =====================================================================
     A SPICULE — the mineral skeleton that holds a sponge open.
     ===================================================================== */
  function spicule(ctx, x, y, s, rays, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.strokeStyle = rgba(C.spicule, .85);
    ctx.lineWidth = Math.max(1, s * 0.10);
    ctx.lineCap = 'round';
    const n = rays || 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * s, -Math.sin(a) * s);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* =====================================================================
     HYDRA — drawn as a longitudinal section, which is how it is examined:
     both tissue layers visible, the gastrovascular cavity open to the
     single mouth, tentacles carrying batteries of nematocysts.
     ===================================================================== */
  function hydra(ctx, cx, cyTop, h, o) {
    o = o || {};
    const w = o.width || h * 0.30;
    const t = o.t || 0;
    const nT = o.tentacles == null ? 6 : o.tentacles;
    const wall = Math.max(4, w * 0.20);
    const yBase = cyTop + h;
    const sway = a => Math.sin(t * 1.4 + a * 3.1) * 0.12;

    /* tentacles, drawn first so the hypostome overlaps their bases */
    const tips = [];
    for (let i = 0; i < nT; i++) {
      const u = nT > 1 ? i / (nT - 1) : 0.5;
      const a = -Math.PI * (0.14 + 0.72 * u) + sway(u);
      const len = h * (0.30 + 0.07 * Math.sin(i * 2.1));
      const bx = cx + Math.cos(a) * w * 0.30, by = cyTop + h * 0.035;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      const mx = bx + Math.cos(a + 0.5) * len * 0.55, my = by + Math.sin(a + 0.5) * len * 0.55;
      ctx.strokeStyle = rgba(C.ecto, .95);
      ctx.lineWidth = Math.max(2.4, w * 0.13);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      // the hollow core — tentacles of Hydra are extensions of the cavity
      ctx.strokeStyle = rgba(C.endo, .55);
      ctx.lineWidth = Math.max(0.9, w * 0.045);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      // batteries of nematocysts along the tentacle
      const nb = 5;
      for (let k = 1; k <= nb; k++) {
        const s2 = k / (nb + 0.4);
        const px = (1 - s2) * (1 - s2) * bx + 2 * (1 - s2) * s2 * mx + s2 * s2 * ex;
        const py = (1 - s2) * (1 - s2) * by + 2 * (1 - s2) * s2 * my + s2 * s2 * ey;
        ctx.fillStyle = rgba('#9FD8FF', .85);
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, w * 0.055), 0, TAU); ctx.fill();
      }
      tips.push([ex, ey]);
    }

    /* the column, as a section: two walls with the cavity between them */
    const colTop = cyTop + h * 0.06, colBot = yBase - h * 0.07;
    const rAt = y => {
      const u = (y - colTop) / (colBot - colTop);
      // narrow at the hypostome, widest about a third down, tapering to the stalk
      return w * (0.42 + 0.58 * Math.sin(Math.PI * Math.pow(u, 0.62) * 0.92));
    };
    // gastrovascular cavity
    ctx.fillStyle = rgba(C.cavity, .92);
    ctx.beginPath();
    for (let y = colTop; y <= colBot; y += 3) ctx.lineTo(cx - rAt(y) + wall, y);
    for (let y = colBot; y >= colTop; y -= 3) ctx.lineTo(cx + rAt(y) - wall, y);
    ctx.closePath(); ctx.fill();

    // the two epithelia, each a real sheet of cells
    const steps = Math.max(8, Math.round(h / 16));
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < steps; i++) {
        const y = colTop + (i + 0.5) / steps * (colBot - colTop);
        const r = rAt(y);
        // gastrodermis lines the cavity
        cell(ctx, cx + side * (r - wall * 0.72), y, wall * 0.34, (colBot - colTop) / steps * 0.46,
          { colour: C.endo, nucleusR: 0.42 });
        // epidermis faces the water
        cell(ctx, cx + side * (r - wall * 0.22), y, wall * 0.30, (colBot - colTop) / steps * 0.46,
          { colour: C.ecto, nucleusR: 0.42 });
      }
    }
    // mesoglea, the non-cellular jelly between them
    for (let side = -1; side <= 1; side += 2) {
      ctx.strokeStyle = rgba(C.jelly, .55);
      ctx.lineWidth = Math.max(1.2, wall * 0.16);
      ctx.beginPath();
      for (let y = colTop; y <= colBot; y += 3) ctx.lineTo(cx + side * (r0(y, rAt, wall)), y);
      ctx.stroke();
    }

    /* hypostome and mouth — the one opening */
    ctx.fillStyle = rgba(C.ecto, .95);
    ctx.beginPath();
    ctx.moveTo(cx - rAt(colTop), colTop + 2);
    ctx.quadraticCurveTo(cx - w * 0.30, cyTop + h * 0.005, cx - w * 0.16, cyTop);
    ctx.lineTo(cx + w * 0.16, cyTop);
    ctx.quadraticCurveTo(cx + w * 0.30, cyTop + h * 0.005, cx + rAt(colTop), colTop + 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(C.cavity, .95);
    ctx.beginPath(); ctx.ellipse(cx, cyTop + 1, w * 0.15, h * 0.014, 0, 0, TAU); ctx.fill();

    /* basal disc, which is how it sticks down */
    ctx.fillStyle = rgba(mix(C.ecto, '#ffffff', .18), .95);
    ctx.beginPath();
    ctx.ellipse(cx, yBase - h * 0.02, w * 0.62, h * 0.035, 0, 0, TAU); ctx.fill();

    return { mouth: [cx, cyTop], base: [cx, yBase], tips: tips, colTop: colTop, colBot: colBot,
             rAt: rAt, wall: wall, w: w };
  }
  function r0(y, rAt, wall) { return rAt(y) - wall * 0.48; }

  /* =====================================================================
     SPONGE CANAL SYSTEMS — ascon, sycon and leucon drawn as sections, so
     the increase in flagellated surface is visible rather than asserted.
     ===================================================================== */
  function sponge(ctx, cx, cy, h, kind, o) {
    o = o || {};
    const t = o.t || 0;
    const w = o.width || h * 0.62;
    const wall = Math.max(6, w * 0.13);
    const top = cy - h / 2, bot = cy + h / 2;
    const rAt = y => {
      const u = (y - top) / (bot - top);
      // narrow at the osculum, swelling through the middle, footed at the base
      return w * 0.5 * (0.46 + 0.54 * Math.sin(Math.PI * Math.pow(u, 0.70) * 0.88));
    };

    /* body wall */
    ctx.beginPath();
    for (let y = top; y <= bot; y += 3) ctx.lineTo(cx - rAt(y), y);
    for (let y = bot; y >= top; y -= 3) ctx.lineTo(cx + rAt(y), y);
    ctx.closePath();
    const bg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    bg.addColorStop(0, mix(C.endo, C.ink, .40));
    bg.addColorStop(.42, mix(C.endo, '#ffffff', .10));
    bg.addColorStop(1, mix(C.endo, C.ink, .52));
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = rgba(mix(C.endo, C.ink, .58), 1); ctx.lineWidth = 1.4; ctx.stroke();

    /* spongocoel — the central cavity, open at the osculum */
    const sc = kind === 'leucon' ? 0.30 : kind === 'sycon' ? 0.40 : 0.46;
    ctx.fillStyle = rgba(C.cavity, .95);
    ctx.beginPath();
    ctx.moveTo(cx, bot - h * 0.09);
    for (let y = bot - h * 0.10; y >= top + h * 0.05; y -= 3) ctx.lineTo(cx - rAt(y) * sc, y);
    for (let y = top + h * 0.05; y <= bot - h * 0.10; y += 3) ctx.lineTo(cx + rAt(y) * sc, y);
    ctx.closePath(); ctx.fill();

    /* the flagellated surface, which is what the three grades differ in */
    const chambers = [];
    if (kind === 'ascon') {
      // choanocytes line the spongocoel directly
      const n = Math.max(6, Math.round(h / 26));
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < n; i++) {
          const y = top + h * 0.10 + (i + 0.5) / n * h * 0.80;
          choanocyte(ctx, cx + side * rAt(y) * sc, y, wall * 0.62,
            { dir: side > 0 ? Math.PI : 0, beat: t + i * 0.4 });
        }
      }
    } else if (kind === 'sycon') {
      // radial canals, each lined with choanocytes
      const n = Math.max(4, Math.round(h / 40));
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < n; i++) {
          const y = top + h * 0.12 + (i + 0.5) / n * h * 0.76;
          const r0v = rAt(y) * sc, r1v = rAt(y) * 0.92;
          ctx.strokeStyle = rgba(C.cavity, .9);
          ctx.lineWidth = wall * 0.58;
          ctx.beginPath();
          ctx.moveTo(cx + side * r0v, y); ctx.lineTo(cx + side * r1v, y); ctx.stroke();
          for (let k = 0; k < 2; k++) {
            const rr = r0v + (r1v - r0v) * (0.34 + 0.40 * k);
            choanocyte(ctx, cx + side * rr, y - wall * 0.20, wall * 0.42,
              { dir: -Math.PI / 2, beat: t + i * 0.5 + k });
          }
          chambers.push([cx + side * (r0v + r1v) / 2, y]);
        }
      }
    } else {
      // leucon: many small flagellated chambers embedded in a canal mesh
      const rows = Math.max(5, Math.round(h / 34));
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < rows; i++) {
          const y = top + h * 0.11 + (i + 0.5) / rows * h * 0.78;
          const r0v = rAt(y) * sc, r1v = rAt(y) * 0.90;
          for (let k = 0; k < 2; k++) {
            const rr = r0v + (r1v - r0v) * (0.30 + 0.44 * k);
            const chR = wall * 0.78;
            ctx.fillStyle = rgba(C.cavity, .92);
            ctx.beginPath(); ctx.arc(cx + side * rr, y, chR, 0, TAU); ctx.fill();
            ctx.strokeStyle = rgba(mix(C.endo, C.ink, .4), .9); ctx.lineWidth = 1;
            ctx.stroke();
            // a ring of collar cells facing into the chamber
            for (let q = 0; q < 5; q++) {
              const a = q / 5 * TAU + 0.4;
              choanocyte(ctx, cx + side * rr + Math.cos(a) * chR * 0.62,
                y + Math.sin(a) * chR * 0.66, chR * 0.46,
                { dir: a + Math.PI, beat: t + q * 0.5 + i });
            }
            chambers.push([cx + side * rr, y]);
          }
        }
      }
    }

    /* ostia — the pores water enters through */
    const ostia = [];
    const nO = kind === 'ascon' ? 8 : kind === 'sycon' ? 12 : 16;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < nO; i++) {
        const y = top + h * 0.10 + (i + 0.5) / nO * h * 0.80;
        const x = cx + side * rAt(y);
        ctx.fillStyle = rgba(C.cavity, .9);
        ctx.beginPath(); ctx.ellipse(x, y, wall * 0.16, wall * 0.26, 0, 0, TAU); ctx.fill();
        ostia.push([x, y, side]);
      }
    }

    /* osculum — the single large exit */
    const oR = w * 0.5 * sc * 1.25;
    ctx.strokeStyle = rgba(mix(C.endo, '#ffffff', .3), .95);
    ctx.lineWidth = Math.max(2, wall * 0.30);
    ctx.beginPath(); ctx.ellipse(cx, top + h * 0.045, oR, oR * 0.32, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(C.cavity, .85);
    ctx.beginPath(); ctx.ellipse(cx, top + h * 0.045, oR * 0.86, oR * 0.24, 0, 0, TAU); ctx.fill();

    /* spicules in the wall */
    if (o.spicules !== false) {
      for (let i = 0; i < 14; i++) {
        const u = (i + 0.5) / 14;
        const y = top + h * 0.08 + u * h * 0.84;
        const side = i % 2 ? 1 : -1;
        spicule(ctx, cx + side * rAt(y) * (sc + (1 - sc) * 0.55), y, wall * 0.52,
          i % 3 === 0 ? 3 : 1, i * 0.7);
      }
    }

    return { top: top, bot: bot, rAt: rAt, sc: sc, wall: wall, ostia: ostia,
             chambers: chambers, osculum: [cx, top + h * 0.045], oR: oR };
  }

  return {
    cell, epithelium, choanocyte, nematocyst, bodyWall, spicule, hydra, sponge,
    lbl, leader, mix, rgba, C
  };
})();

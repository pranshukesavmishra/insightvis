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
    ecto: '#3E8CF5', ectoD: '#1E4C90',
    meso: '#F0554E', mesoD: '#8E2A26',
    endo: '#FFAE2E', endoD: '#8E5E12',
    jelly: '#CFE0F7', nucleus: '#6A3FC0', nucleolus: '#2E1A5E',
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
    const R = Math.max(rx, ry);
    // slight per-cell variation, keyed to position, so a sheet of cells
    // never looks stamped from one template
    const jitter = RX.hash2(Math.round(x * 0.37), Math.round(y * 0.41));
    const tint = RX.mix(base, jitter > 0.5 ? '#ffffff' : '#05080F', 0.05 + jitter * 0.07);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    RX.blob(ctx, 0, 0, rx, ry, {
      fill: tint, r: R, cx: 0, cy: 0, squash: ry / Math.max(rx, 0.001),
      ao: 0.85, rim: 0.8, stipple: o.stipple == null ? 0.9 : o.stipple,
      grain: RX.mix(base, '#05080F', 0.6),
      contour: Math.max(0.8, R * 0.075),
      contourColour: RX.rgba(RX.mix(base, '#05080F', 0.66), 0.95),
      quality: o.quality
    });
    if (o.nucleus !== false) {
      const nr = Math.min(rx, ry) * (o.nucleusR || 0.42);
      const nx = (o.nx || 0) * rx, ny = (o.ny || 0) * ry;
      // the nucleus sits in the cytoplasm, so it casts a little shadow
      RX.contact(ctx, c => c.arc(nx, ny, nr, 0, TAU), nr, 0.55);
      RX.blob(ctx, nx, ny, nr, nr, {
        fill: C.nucleus, r: nr, cx: nx, cy: ny,
        ao: 0.5, rim: 0.9, stipple: 1.4, grain: '#120A26',
        contour: Math.max(0.7, nr * 0.10),
        contourColour: RX.rgba('#160E2E', 0.95), quality: o.quality
      });
      if (nr > 2.4) {
        ctx.fillStyle = C.nucleolus;
        ctx.beginPath(); ctx.arc(nx + nr * .22, ny - nr * .16, nr * 0.30, 0, TAU); ctx.fill();
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
    const base = o.colour || C.endo;
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir + Math.PI / 2);

    // Below about nine pixels the collar and flagellum are finer than a
    // pixel; drawing them there produces noise, not detail.
    if (s < 9) {
      RX.ball(ctx, 0, s * 0.30, s * 0.42, base, { shadow: false, gloss: 0.6 });
      RX.tube(ctx, [[0, s * 0.05], [Math.sin(beat * 2) * s * 0.30, -s * 1.05]],
        Math.max(0.5, s * 0.075), '#FFE9A8', { vivid: false });
      ctx.restore();
      return;
    }

    // the collar: microvilli as lit filaments, drawn behind the cell body
    const nv = 9;
    for (let i = 0; i < nv; i++) {
      const u = (i / (nv - 1)) * 2 - 1;
      RX.tube(ctx, [[u * s * 0.33, s * 0.06], [u * s * 0.50, -s * 0.62]],
        Math.max(0.55, s * 0.035), RX.mix(base, '#ffffff', .45), { vivid: false });
    }

    // cell body, with volume
    RX.volume(ctx, c => c.ellipse(0, s * 0.42, s * 0.40, s * 0.44, 0, 0, TAU), {
      fill: base, r: s * 0.44, cx: 0, cy: s * 0.42, squash: 1.1,
      stipple: 1.2, grain: RX.mix(base, '#05080F', .55), gloss: 0.45,
      shadow: 0.7, contour: Math.max(0.8, s * 0.05)
    });
    RX.ball(ctx, -s * 0.06, s * 0.46, s * 0.15, C.nucleus, { shadow: false, gloss: 0.5 });

    // the flagellum: a travelling wave, drawn as a tapering lit filament —
    // this is the structure that moves every litre of water a sponge filters
    const wave = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      wave.push([Math.sin(t * 7.2 - beat * 6.2) * s * 0.26 * t, s * 0.06 - t * s * 1.45]);
    }
    RX.tube(ctx, wave, t => Math.max(0.5, s * 0.055 * (1 - t * 0.45)), '#FFE9A8',
      { vivid: false });
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
    const wall = o.wall || '#6E9AD0';
    ctx.save(); ctx.translate(cx, cy);

    // capsule: a thick-walled flask, under pressure
    const cw = s * 0.52, ch = s * 0.74;
    RX.volume(ctx, c => c.ellipse(0, ch * 0.10, cw, ch, 0, 0, TAU), {
      fill: wall, r: ch, cx: 0, cy: ch * 0.10, squash: cw / ch,
      stipple: 0.8, grain: RX.mix(wall, C.ink, .55), shadow: 0.9, gloss: 0.42,
      contour: Math.max(1.4, s * 0.05),
      contourColour: rgba(mix(wall, C.ink, .66), 1)
    });

    // lumen, so the coil reads as being inside something
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, ch * 0.12, cw * 0.80, ch * 0.82, 0, 0, TAU);
    ctx.fillStyle = '#060B15'; ctx.fill();
    ctx.clip();
    const lum = ctx.createRadialGradient(0, ch * 0.12, cw * 0.20, 0, ch * 0.12, cw * 0.86);
    lum.addColorStop(0, 'rgba(0,0,0,0)');
    lum.addColorStop(1, rgba(mix(wall, '#ffffff', .5), .30));
    ctx.fillStyle = lum; ctx.fillRect(-cw, -ch, cw * 2, ch * 2.2);
    ctx.restore();
    ctx.strokeStyle = rgba(mix(wall, '#ffffff', .35), .9);
    ctx.lineWidth = Math.max(1, s * 0.032);
    ctx.beginPath(); ctx.ellipse(0, ch * 0.12, cw * 0.80, ch * 0.82, 0, 0, TAU); ctx.stroke();

    // the coiled tubule still inside, unwinding as it fires
    const turns = 3.4 * (1 - f);
    if (turns > 0.05) {
      const coil = [];
      const N = 160;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = t * turns * TAU;
        const r = cw * 0.70 * (1 - t * 0.86);
        coil.push([Math.cos(a) * r, ch * 0.12 + Math.sin(a) * r * 1.12]);
      }
      RX.tube(ctx, coil, Math.max(0.9, s * 0.030), '#BFE0FF', { vivid: false });
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
    if (o.labels !== false && window.__LABELS !== false) {
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
    const n = rays || 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI;
      RX.tube(ctx,
        [[-Math.cos(a) * s, -Math.sin(a) * s], [0, 0], [Math.cos(a) * s, Math.sin(a) * s]],
        t => Math.max(0.5, s * 0.10 * (1 - Math.abs(t - 0.5) * 1.2)),
        C.spicule, { vivid: false });
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
    const wall = Math.max(7, w * 0.34);
    const yBase = cyTop + h;
    const sway = a => Math.sin(t * 1.4 + a * 3.1) * 0.12;

    /* tentacles: round lit tubes, tapering, each carrying batteries of
       cnidocytes — flat strokes were what made them read as drawn lines */
    const tips = [];
    for (let i = 0; i < nT; i++) {
      const u = nT > 1 ? i / (nT - 1) : 0.5;
      const a = -Math.PI * (0.14 + 0.72 * u) + sway(u);
      const len = h * (0.30 + 0.07 * Math.sin(i * 2.1));
      const bx = cx + Math.cos(a) * w * 0.30, by = cyTop + h * 0.035;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      const mx = bx + Math.cos(a + 0.5) * len * 0.55, my = by + Math.sin(a + 0.5) * len * 0.55;
      const pts = RX.quadPts(bx, by, mx, my, ex, ey, 20);
      const rBase = Math.max(2.6, w * 0.155);
      RX.tube(ctx, pts, t2 => rBase * (1 - t2 * 0.55), C.ecto,
        { contour: Math.max(0.8, w * 0.022), shadow: true });
      // batteries of cnidocytes, sitting proud of the surface
      const nb = 7;
      for (let k = 1; k <= nb; k++) {
        const s2 = k / (nb + 0.4);
        const idx = Math.min(pts.length - 1, Math.round(s2 * (pts.length - 1)));
        const q = pts[idx];
        const rr = rBase * (1 - s2 * 0.55);
        RX.ball(ctx, q[0], q[1] - rr * 0.30, Math.max(1.6, rr * 0.52), '#8FD8FF',
          { shadow: false, gloss: 0.85 });
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
    const cavPath = c => {
      c.moveTo(cx - rAt(colTop) + wall, colTop);
      for (let y = colTop; y <= colBot; y += 3) c.lineTo(cx - rAt(y) + wall, y);
      for (let y = colBot; y >= colTop; y -= 3) c.lineTo(cx + rAt(y) - wall, y);
      c.closePath();
    };
    ctx.save();
    ctx.beginPath(); cavPath(ctx);
    ctx.fillStyle = '#070C16'; ctx.fill();
    ctx.clip();
    // light spilling in from the mouth, and a faint sheen on the lining
    const mg = ctx.createLinearGradient(0, colTop, 0, colBot);
    mg.addColorStop(0, 'rgba(255,196,120,.22)');
    mg.addColorStop(0.35, 'rgba(255,196,120,.04)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg; ctx.fillRect(cx - w * 2, colTop, w * 4, colBot - colTop);
    ctx.strokeStyle = RX.rgba(C.endo, .30); ctx.lineWidth = 2.4;
    ctx.beginPath(); cavPath(ctx); ctx.stroke();
    ctx.restore();

    // the two epithelia, drawn as lit tissue bands. At this magnification a
    // plate shows layers, not cells; the cells live in the callout.
    const band = (inner, outer, colour, grain) => {
      const pathFn = c => {
        c.moveTo(cx - rAt(colTop) + inner, colTop);
        for (let y = colTop; y <= colBot; y += 3) c.lineTo(cx - rAt(y) + inner, y);
        for (let y = colBot; y >= colTop; y -= 3) c.lineTo(cx - rAt(y) + outer, y);
        c.closePath();
        c.moveTo(cx + rAt(colTop) - inner, colTop);
        for (let y = colTop; y <= colBot; y += 3) c.lineTo(cx + rAt(y) - inner, y);
        for (let y = colBot; y >= colTop; y -= 3) c.lineTo(cx + rAt(y) - outer, y);
        c.closePath();
      };
      const vivid = RX.sat(colour, 1.25);
      const wMax = rAt(colBot);
      const lg = ctx.createLinearGradient(cx - wMax, 0, cx + wMax, 0);
      lg.addColorStop(0, RX.mix(vivid, '#05080F', .42));
      lg.addColorStop(0.24, RX.mix(vivid, '#ffffff', .34));
      lg.addColorStop(0.46, vivid);
      lg.addColorStop(0.76, RX.mix(vivid, '#ffffff', .18));
      lg.addColorStop(1, RX.mix(vivid, '#05080F', .50));
      ctx.save();
      ctx.beginPath(); pathFn(ctx);
      ctx.fillStyle = lg; ctx.fill();
      ctx.clip();
      // tissue grain
      const nG = Math.round((colBot - colTop) * (outer - inner) * 0.055);
      for (let i = 0; i < Math.min(nG, 700); i++) {
        const yy = colTop + RX.hash2(i * 2.3, 11) * (colBot - colTop);
        const sgn = RX.hash2(i * 5.1, 19) > 0.5 ? 1 : -1;
        const xx = cx + sgn * (rAt(yy) - inner - RX.hash2(i * 7.7, 23) * (outer - inner));
        ctx.fillStyle = RX.rgba(grain, 0.10 + RX.hash2(i * 3.3, 29) * 0.22);
        ctx.beginPath(); ctx.arc(xx, yy, 0.5 + RX.hash2(i * 9.1, 31) * 1.1, 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = RX.rgba(RX.mix(vivid, '#05080F', .74), .9);
      ctx.lineWidth = 1.0;
      ctx.beginPath(); pathFn(ctx); ctx.stroke();
      ctx.restore();
      // cell boundaries, as tick marks across the band — the read at this size
      ctx.save();
      ctx.beginPath(); pathFn(ctx); ctx.clip();
      ctx.strokeStyle = RX.rgba(RX.mix(colour, '#05080F', .62), .55);
      ctx.lineWidth = 1;
      const steps2 = Math.max(10, Math.round((colBot - colTop) / 9));
      for (let i = 0; i <= steps2; i++) {
        const y = colTop + (i / steps2) * (colBot - colTop);
        [-1, 1].forEach(sg => {
          ctx.beginPath();
          ctx.moveTo(cx + sg * (rAt(y) - inner), y);
          ctx.lineTo(cx + sg * (rAt(y) - outer), y);
          ctx.stroke();
        });
      }
      ctx.restore();
    };
    band(0, wall * 0.38, C.ecto, RX.mix(C.ecto, '#05080F', .55));           // epidermis outside
    band(wall * 0.38, wall * 0.58, C.jelly, RX.mix(C.jelly, '#ffffff', .3)); // mesoglea between
    band(wall * 0.58, wall * 1.00, C.endo, RX.mix(C.endo, '#05080F', .5));   // gastrodermis inside

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
    const bodyPath = c => {
      c.moveTo(cx - rAt(top), top);
      for (let y = top; y <= bot; y += 3) c.lineTo(cx - rAt(y), y);
      for (let y = bot; y >= top; y -= 3) c.lineTo(cx + rAt(y), y);
      c.closePath();
    };
    const vividBody = RX.sat(C.endo, 1.22);
    const bg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    bg.addColorStop(0, RX.mix(vividBody, C.ink, .46));
    bg.addColorStop(.24, RX.mix(vividBody, '#ffffff', .34));
    bg.addColorStop(.48, vividBody);
    bg.addColorStop(.78, RX.mix(vividBody, '#ffffff', .12));
    bg.addColorStop(1, RX.mix(vividBody, C.ink, .56));
    ctx.save();
    ctx.beginPath(); bodyPath(ctx);
    ctx.fillStyle = bg; ctx.fill();
    ctx.clip();
    // mesohyl texture — the protein jelly the whole body is built in
    for (let i = 0; i < 520; i++) {
      const yy = top + RX.hash2(i * 2.7, 5) * (bot - top);
      const xx = cx + (RX.hash2(i * 4.1, 9) * 2 - 1) * rAt(yy);
      ctx.fillStyle = RX.rgba(RX.mix(vividBody, C.ink, .6), 0.07 + RX.hash2(i * 6.3, 13) * 0.18);
      ctx.beginPath(); ctx.arc(xx, yy, 0.5 + RX.hash2(i * 8.9, 17) * 1.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = rgba(mix(C.endo, C.ink, .62), 1); ctx.lineWidth = 1.5;
    ctx.beginPath(); bodyPath(ctx); ctx.stroke();

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

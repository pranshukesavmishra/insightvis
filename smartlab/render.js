/* ============================================================
   ILLUSTRATION RENDERER
   Everything that made the figures look flat lives here, fixed
   once: ambient occlusion where surfaces meet, a rim light on
   the lit edge, procedural tissue texture, cast shadows, and
   contours whose weight varies with the light. Every figure
   library draws its shapes through this, so one improvement
   lifts all of them.
   ============================================================ */
window.RX = (function () {
  'use strict';
  const TAU = Math.PI * 2;

  /* a light from the upper left, which is the convention every
     anatomical plate has used since the nineteenth century */
  const LIGHT = { x: -0.55, y: -0.83 };

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

  /* deterministic value noise, so texture never flickers between frames */
  function hash2(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  const canFilter = (() => {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.filter = 'blur(2px)';
      return c.filter !== 'none';
    } catch (_) { return false; }
  })();

  /* =====================================================================
     BODY — the one call that turns a path into a lit, textured solid.
     opts:
       fill      base colour, or a function(ctx) returning a fill style
       r         approximate radius, used to scale every effect
       ao        strength of the contact shadow inside the edge  (0..1)
       rim       strength of the light along the lit edge        (0..1)
       stipple   density of tissue grain                         (0..1)
       grain     colour of the grain
       contour   line weight of the outline, 0 for none
       shadow    cast-shadow strength under the whole shape      (0..1)
     ===================================================================== */
  function body(ctx, path, o) {
    o = o || {};
    const base = o.fill || '#8899AA';
    const r = o.r || 24;
    const quality = o.quality == null ? 1 : o.quality;
    // below about ten pixels there is no room for shading; fade it out
    const sz = Math.max(0, Math.min(1, (r - 4) / 14));

    /* cast shadow, so the form sits on the ground instead of floating */
    if (o.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,' + (0.42 * o.shadow) + ')';
      ctx.shadowBlur = r * 0.55;
      ctx.shadowOffsetX = -LIGHT.x * r * 0.16;
      ctx.shadowOffsetY = -LIGHT.y * r * 0.16;
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.beginPath(); path(ctx); ctx.fill();
      ctx.restore();
    }

    /* base form, lit from the upper left */
    ctx.save();
    ctx.beginPath(); path(ctx);
    if (typeof base === 'function') ctx.fillStyle = base(ctx);
    else if (o.flat) ctx.fillStyle = base;
    else {
      const b = ctx.canvas.__bbox || null;
      const cx = o.cx == null ? 0 : o.cx, cy = o.cy == null ? 0 : o.cy;
      const gr = ctx.createRadialGradient(
        cx + LIGHT.x * r * 0.45, cy + LIGHT.y * r * 0.45, r * 0.05,
        cx, cy, r * 1.25);
      gr.addColorStop(0, mix(base, '#ffffff', 0.26 + 0.24 * sz));
      gr.addColorStop(0.28, mix(base, '#ffffff', 0.08 * sz));
      gr.addColorStop(0.62, base);
      gr.addColorStop(1, mix(base, '#05080F', 0.28 + 0.34 * sz));
      ctx.fillStyle = gr;
    }
    ctx.fill();

    /* everything below is drawn inside the shape */
    ctx.clip();

    /* tissue grain — what stops a fill looking like plastic */
    if (o.stipple && quality > 0.6 && sz > 0.45) {
      const n = Math.round(r * r * 0.16 * o.stipple);
      const gcol = o.grain || mix(base, '#05080F', 0.45);
      for (let i = 0; i < Math.min(n, 900); i++) {
        const a = hash2(i * 1.7, r) * TAU;
        const rr = Math.sqrt(hash2(i * 3.1, r + 7)) * r * 1.15;
        const px = (o.cx || 0) + Math.cos(a) * rr;
        const py = (o.cy || 0) + Math.sin(a) * rr * (o.squash || 1);
        const s2 = 0.5 + hash2(i * 5.3, r + 13) * 1.1;
        ctx.fillStyle = rgba(gcol, 0.10 + hash2(i * 7.9, r + 3) * 0.22);
        ctx.beginPath(); ctx.arc(px, py, s2, 0, TAU); ctx.fill();
      }
    }

    /* ambient occlusion: a soft dark band just inside the whole edge */
    if (o.ao !== 0 && quality > 0.4) {
      const k = (o.ao == null ? 0.75 : o.ao) * sz;
      if (k > 0.02) {
      ctx.save();
      if (canFilter) ctx.filter = 'blur(' + Math.max(1.5, r * 0.22).toFixed(1) + 'px)';
      ctx.strokeStyle = rgba(mix(base, '#05080F', 0.88), 0.78 * k);
      ctx.lineWidth = r * 0.36;
      ctx.beginPath(); path(ctx); ctx.stroke();
      ctx.restore();
      ctx.filter = 'none';
      }
    }

    /* rim light on the side facing the lamp */
    if (o.rim !== 0 && quality > 0.4) {
      const k = (o.rim == null ? 0.7 : o.rim) * sz;
      if (k > 0.02) {
      ctx.save();
      ctx.translate(LIGHT.x * r * 0.09, LIGHT.y * r * 0.09);
      if (canFilter) ctx.filter = 'blur(' + Math.max(1, r * 0.07).toFixed(1) + 'px)';
      ctx.strokeStyle = rgba(mix(base, '#ffffff', 0.92), 0.80 * k);
      ctx.lineWidth = r * 0.085;
      ctx.beginPath(); path(ctx); ctx.stroke();
      ctx.restore();
      ctx.filter = 'none';
      }
    }
    ctx.restore();

    /* contour, drawn last so nothing softens it */
    if (o.contour !== 0) {
      ctx.save();
      ctx.strokeStyle = o.contourColour || rgba(mix(base, '#05080F', 0.80), 1);
      ctx.lineWidth = o.contour || Math.max(1.1, r * 0.07);
      ctx.lineJoin = 'round';
      ctx.beginPath(); path(ctx); ctx.stroke();
      ctx.restore();
    }
  }

  /* An ellipse is the shape almost every cell and cavity needs, so it
     gets a direct entry point. */
  function blob(ctx, cx, cy, rx, ry, o) {
    o = Object.assign({ cx: cx, cy: cy, r: Math.max(rx, ry), squash: ry / Math.max(rx, 0.001) }, o || {});
    body(ctx, c => c.ellipse(cx, cy, rx, ry, o.rot || 0, 0, TAU), o);
  }

  /* A contour whose weight follows the light: heavier where the edge
     turns away, which is what makes hand-drawn anatomy read as solid. */
  function contour(ctx, pts, o) {
    o = o || {};
    if (!pts || pts.length < 2) return;
    const w = o.width || 1.6, col = o.colour || 'rgba(12,16,26,.9)';
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = col;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const lit = nx * LIGHT.x + ny * LIGHT.y;          // +1 facing the light
      ctx.lineWidth = w * (1.45 - 0.75 * lit);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
  }

  /* A soft contact shadow where one structure overlaps another. */
  function contact(ctx, path, r, k) {
    ctx.save();
    if (canFilter) ctx.filter = 'blur(' + Math.max(2, r * 0.35).toFixed(1) + 'px)';
    ctx.fillStyle = 'rgba(0,0,0,' + (0.40 * (k == null ? 1 : k)) + ')';
    ctx.translate(-LIGHT.x * r * 0.22, -LIGHT.y * r * 0.22);
    ctx.beginPath(); path(ctx); ctx.fill();
    ctx.restore();
    ctx.filter = 'none';
  }

  return { body, blob, contour, contact, mix, rgba, hash2, LIGHT, canFilter };
})();

/* ============================================================
   VOLUME PASS
   Flat fills read as paper. These primitives build form the way
   a painter does: a key light, a bounce (fill) light from the
   opposite side, a specular, a terminator where the surface
   turns away, and subsurface warmth through the thin parts.
   ============================================================ */
(function (RX) {
  'use strict';
  const TAU = Math.PI * 2;
  const L = RX.LIGHT;

  /* ---- colour ---- */
  function toHSL(hex) {
    const c = RX.mix(hex, hex, 0);                 // normalise to #rrggbb
    const n = parseInt(c.slice(1), 16);
    let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function fromHSL(h, s, l) {
    const f = n => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
    };
    const q = v => ('0' + Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16)).slice(-2);
    return '#' + q(f(0)) + q(f(8)) + q(f(4));
  }
  /* push saturation without losing the hue — the "vivid" control */
  function sat(hex, k, lShift) {
    const [h, s, l] = toHSL(hex);
    return fromHSL(h, Math.max(0, Math.min(1, s * (k == null ? 1.35 : k))),
      Math.max(0, Math.min(1, l + (lShift || 0))));
  }

  /* =====================================================================
     SPHERE — a genuinely lit ball: key highlight, terminator, bounce
     light from below, specular, and a rim where it meets the dark.
     ===================================================================== */
  function ball(ctx, x, y, r, colour, o) {
    o = o || {};
    const base = o.vivid === false ? colour : sat(colour, 1.25);
    const lx = x + L.x * r * 0.42, ly = y + L.y * r * 0.42;

    if (o.shadow !== false && r > 3) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      if (RX.canFilter) ctx.filter = 'blur(' + (r * 0.35).toFixed(1) + 'px)';
      ctx.beginPath();
      ctx.ellipse(x - L.x * r * 0.30, y - L.y * r * 0.30, r * 0.96, r * 0.96, 0, 0, TAU);
      ctx.fill(); ctx.restore(); ctx.filter = 'none';
    }

    // body: bright at the key, deepening through the terminator
    const g1 = ctx.createRadialGradient(lx, ly, r * 0.04, x, y, r * 1.02);
    g1.addColorStop(0, RX.mix(base, '#ffffff', 0.62));
    g1.addColorStop(0.22, RX.mix(base, '#ffffff', 0.22));
    g1.addColorStop(0.58, base);
    g1.addColorStop(0.86, RX.mix(base, '#05080F', 0.42));
    g1.addColorStop(1, RX.mix(base, '#05080F', 0.62));
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

    // bounce light: the ground throws a little colour back up the dark side
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const g2 = ctx.createRadialGradient(
      x - L.x * r * 0.85, y - L.y * r * 0.85, r * 0.05,
      x - L.x * r * 0.85, y - L.y * r * 0.85, r * 0.95);
    g2.addColorStop(0, RX.rgba(RX.mix(base, '#ffffff', 0.45), 0.34));
    g2.addColorStop(1, RX.rgba(base, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // subsurface: warmth bleeding through the thin edge
    if (o.subsurface !== false) {
      const g3 = ctx.createRadialGradient(x, y, r * 0.60, x, y, r);
      g3.addColorStop(0, RX.rgba(RX.mix(base, '#FF9A6A', 0.5), 0));
      g3.addColorStop(1, RX.rgba(RX.mix(base, '#FF9A6A', 0.5), 0.22));
      ctx.fillStyle = g3;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    // specular
    if (o.specular !== false && r > 2.5) {
      const sp = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.34);
      sp.addColorStop(0, 'rgba(255,255,255,' + (o.gloss == null ? 0.72 : o.gloss) + ')');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp;
      ctx.beginPath(); ctx.ellipse(lx, ly, r * 0.30, r * 0.22, Math.atan2(L.y, L.x), 0, TAU);
      ctx.fill();
    }
    // rim
    if (o.rim !== false && r > 3) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      ctx.strokeStyle = RX.rgba(RX.mix(base, '#ffffff', 0.85), 0.5);
      ctx.lineWidth = Math.max(1, r * 0.10);
      ctx.beginPath();
      ctx.arc(x + L.x * r * 0.10, y + L.y * r * 0.10, r * 0.97, 0, TAU);
      ctx.stroke(); ctx.restore();
    }
  }

  /* =====================================================================
     TUBE — a round tube along a polyline. Tentacles, vessels, canals,
     axons and neurites are all this, and flat strokes are what made them
     look like drawn lines instead of structures.
     ===================================================================== */
  function tube(ctx, pts, radius, colour, o) {
    o = o || {};
    if (!pts || pts.length < 2) return;
    const base = o.vivid === false ? colour : sat(colour, 1.22);
    const rAt = typeof radius === 'function' ? radius : () => radius;
    const stroke = (wScale, col, ox, oy, cap) => {
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = cap || 'round';
      ctx.strokeStyle = col;
      ctx.translate(ox, oy);
      // width varies along the path, so stroke it segment by segment
      for (let i = 0; i < pts.length - 1; i++) {
        const r = rAt(i / (pts.length - 1));
        ctx.lineWidth = Math.max(0.4, r * 2 * wScale);
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      ctx.restore();
    };
    const r0 = rAt(0.5);
    if (o.shadow) {
      ctx.save();
      if (RX.canFilter) ctx.filter = 'blur(' + (r0 * 0.5).toFixed(1) + 'px)';
      stroke(1.0, 'rgba(0,0,0,.38)', -L.x * r0 * 0.5, -L.y * r0 * 0.5);
      ctx.restore(); ctx.filter = 'none';
    }
    stroke(1.00, RX.mix(base, '#05080F', 0.55));                       // shadowed underside
    stroke(0.86, base, L.x * r0 * 0.12, L.y * r0 * 0.12);              // body
    stroke(0.52, RX.mix(base, '#ffffff', 0.28), L.x * r0 * 0.30, L.y * r0 * 0.30);
    stroke(0.20, RX.mix(base, '#ffffff', 0.68), L.x * r0 * 0.44, L.y * r0 * 0.44);  // highlight
    if (o.contour) {
      ctx.save();
      ctx.strokeStyle = RX.rgba(RX.mix(base, '#05080F', 0.78), 0.85);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const r = rAt(i / (pts.length - 1));
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
          const px = pts[i][0] - dy / len * r * side, py = pts[i][1] + dx / len * r * side;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.lineWidth = o.contour;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* Sample a quadratic into a polyline, which is what tube() wants. */
  function quadPts(x0, y0, cx, cy, x1, y1, n) {
    const out = [];
    n = n || 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * cx + t * t * x1,
                u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    return out;
  }

  /* =====================================================================
     VOLUME — a closed form given real roundness: the flat fill is
     replaced by a lit body, a bounce, a terminator and a specular band.
     ===================================================================== */
  function volume(ctx, path, o) {
    o = o || {};
    const base = o.vivid === false ? (o.fill || '#8899AA') : sat(o.fill || '#8899AA', 1.22);
    const r = o.r || 40, cx = o.cx || 0, cy = o.cy || 0;
    if (o.shadow) {
      ctx.save();
      if (RX.canFilter) ctx.filter = 'blur(' + (r * 0.30).toFixed(1) + 'px)';
      ctx.fillStyle = 'rgba(0,0,0,' + (0.40 * o.shadow) + ')';
      ctx.translate(-L.x * r * 0.14, -L.y * r * 0.14);
      ctx.beginPath(); path(ctx); ctx.fill();
      ctx.restore(); ctx.filter = 'none';
    }
    ctx.save();
    ctx.beginPath(); path(ctx);
    const g1 = ctx.createRadialGradient(
      cx + L.x * r * 0.52, cy + L.y * r * 0.52, r * 0.05, cx, cy, r * 1.15);
    g1.addColorStop(0, RX.mix(base, '#ffffff', 0.50));
    g1.addColorStop(0.26, RX.mix(base, '#ffffff', 0.16));
    g1.addColorStop(0.62, base);
    g1.addColorStop(1, RX.mix(base, '#05080F', 0.56));
    ctx.fillStyle = g1; ctx.fill();
    ctx.clip();
    // bounce from the shadow side
    const g2 = ctx.createRadialGradient(
      cx - L.x * r * 0.95, cy - L.y * r * 0.95, r * 0.05,
      cx - L.x * r * 0.95, cy - L.y * r * 0.95, r * 1.0);
    g2.addColorStop(0, RX.rgba(RX.mix(base, '#ffffff', 0.5), 0.26));
    g2.addColorStop(1, RX.rgba(base, 0));
    ctx.fillStyle = g2; ctx.fillRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8);
    if (o.stipple) {
      const n = Math.round(r * r * 0.13 * o.stipple);
      const gcol = o.grain || RX.mix(base, '#05080F', 0.5);
      for (let i = 0; i < Math.min(n, 1100); i++) {
        const a = RX.hash2(i * 1.7, r) * TAU;
        const rr = Math.sqrt(RX.hash2(i * 3.1, r + 7)) * r * 1.2;
        ctx.fillStyle = RX.rgba(gcol, 0.08 + RX.hash2(i * 7.9, r + 3) * 0.20);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (o.squash || 1),
          0.5 + RX.hash2(i * 5.3, r + 13) * 1.2, 0, TAU);
        ctx.fill();
      }
    }
    // specular band along the lit edge
    if (o.gloss !== 0) {
      ctx.save();
      ctx.translate(L.x * r * 0.10, L.y * r * 0.10);
      if (RX.canFilter) ctx.filter = 'blur(' + Math.max(1, r * 0.08).toFixed(1) + 'px)';
      ctx.strokeStyle = 'rgba(255,255,255,' + (o.gloss == null ? 0.34 : o.gloss) + ')';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath(); path(ctx); ctx.stroke();
      ctx.restore(); ctx.filter = 'none';
    }
    ctx.restore();
    if (o.contour !== 0) {
      ctx.save();
      ctx.strokeStyle = o.contourColour || RX.rgba(RX.mix(base, '#05080F', 0.80), 1);
      ctx.lineWidth = o.contour || Math.max(1.1, r * 0.05);
      ctx.lineJoin = 'round';
      ctx.beginPath(); path(ctx); ctx.stroke();
      ctx.restore();
    }
  }

  RX.ball = ball; RX.tube = tube; RX.volume = volume;
  RX.quadPts = quadPts; RX.sat = sat; RX.toHSL = toHSL; RX.fromHSL = fromHSL;
})(window.RX);

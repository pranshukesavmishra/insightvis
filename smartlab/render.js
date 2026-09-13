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

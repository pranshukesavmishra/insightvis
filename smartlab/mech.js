/* ============================================================
   MECHANISM ENGINE
   A reaction mechanism is declared as a list of scenes. Each
   scene names its atoms, its bonds and the curly arrows that
   turn it into the next one. The engine interpolates between
   consecutive scenes, so bonds genuinely break and form, charges
   fade in and out, and the arrows draw themselves before the
   geometry that they explain starts to move.
   ============================================================ */
window.MECH = (function (O) {
  'use strict';
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const key2 = (a, b) => a < b ? a + '|' + b : b + '|' + a;

  /* ---- timing of one transition -------------------------------------
     0.00 → 0.55   the curly arrows draw themselves
     0.28 → 1.00   the geometry morphs
     A scene therefore reads before it moves, which is how a mechanism is
     explained on a board. */
  const ARROW_END = 0.55, MORPH_START = 0.28;

  function makeState(nSteps) {
    return { i: 0, u: 0, playing: true, n: nSteps, hold: 0, a: 1 };
  }

  /* Advance the player. `dwell` is the pause at each scene in seconds and
     `travel` the time spent moving between two scenes. */
  function advance(st, dt, o) {
    o = o || {};
    const travel = o.travel || 2.0, dwell = o.dwell || 1.1;
    if (!st.playing) { st.a = 1; return st; }
    // the arrows draw themselves as soon as a scene is on screen, and stay
    // drawn while the geometry they explain moves
    st.a = Math.min(1, (st.a || 0) + dt / 0.55);
    if (st.hold > 0) { st.hold -= dt; return st; }
    st.u += dt / travel;
    while (st.u >= 1) {
      st.u -= 1;
      st.i++;
      st.hold = dwell;
      st.a = 0;
      if (st.i >= st.n - 1) {
        if (o.loop === false) { st.i = st.n - 1; st.u = 0; st.playing = false; break; }
        st.i = 0; st.hold = dwell * 1.6; st.a = 0;
      }
    }
    return st;
  }

  /* ---- interpolate two scenes into a drawable frame ---- */
  function frame(steps, i, u, arrowProg) {
    const A = steps[Math.max(0, Math.min(steps.length - 1, i))];
    const B = steps[Math.max(0, Math.min(steps.length - 1, i + 1))] || A;
    const last = i >= steps.length - 1;
    const t = last ? 0 : Math.max(0, Math.min(1, (u - MORPH_START) / (1 - MORPH_START)));
    const e = ease(t);

    const atoms = {};
    const ids = new Set(Object.keys(A.atoms || {}).concat(Object.keys(B.atoms || {})));
    ids.forEach(id => {
      const a = (A.atoms || {})[id], b = (B.atoms || {})[id];
      if (a && b) {
        atoms[id] = {
          x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e),
          label: e < 0.5 ? a.label : b.label,
          colour: e < 0.5 ? a.colour : b.colour,
          charge: lerp(a.charge || 0, b.charge || 0, e),
          radical: lerp(a.radical || 0, b.radical || 0, e),
          lone: e < 0.5 ? a.lone : b.lone,
          alpha: 1, hot: (a.hot || b.hot) ? Math.max(a.hot || 0, b.hot || 0) : 0
        };
      } else if (a) {
        atoms[id] = Object.assign({}, a, { charge: a.charge || 0, alpha: 1 - e });
      } else {
        atoms[id] = Object.assign({}, b, { charge: b.charge || 0, alpha: e });
      }
    });

    const bonds = [];
    const bmap = {};
    const add = (src, which) => (src || []).forEach(bd => {
      const k = key2(bd.a, bd.b);
      bmap[k] = bmap[k] || { a: bd.a, b: bd.b, oA: 0, oB: 0, style: bd.style, colour: bd.colour, toward: bd.toward };
      bmap[k]['o' + which] = bd.order == null ? 1 : bd.order;
      if (which === 'B' && bd.style) bmap[k].styleB = bd.style;
      if (which === 'A' && bd.style) bmap[k].styleA = bd.style;
      if (bd.colour) bmap[k].colour = bd.colour;
      if (bd.toward) bmap[k].toward = bd.toward;
    });
    add(A.bonds, 'A'); add(B.bonds, 'B');
    Object.keys(bmap).forEach(k => {
      const bd = bmap[k];
      const order = lerp(bd.oA, bd.oB, e);
      if (order < 0.02) return;
      const moving = e > 0.02 && e < 0.995 && Math.abs(bd.oB - bd.oA) > 0.02;
      bonds.push({
        a: bd.a, b: bd.b, order: order,
        style: e < 0.5 ? (bd.styleA || bd.styleB) : (bd.styleB || bd.styleA),
        colour: bd.colour, toward: bd.toward,
        forming: moving && bd.oB > bd.oA, breaking: moving && bd.oB < bd.oA,
        partial: Math.abs(order - Math.round(order)) > 0.12
      });
    });

    const ap = arrowProg == null ? Math.max(0, Math.min(1, u / ARROW_END))
                                 : Math.max(0, Math.min(1, arrowProg));
    const arrows = last ? [] : (A.arrows || []).map(ar => Object.assign({}, ar, { progress: ap }));

    return {
      atoms: atoms, bonds: bonds, arrows: arrows,
      caption: (u < 0.5 || last) ? A.caption : B.caption,
      sub: (u < 0.5 || last) ? A.sub : B.sub,
      name: A.name, index: i, u: u, morph: e, last: last
    };
  }

  /* ---- resolve an arrow endpoint against the live frame ---- */
  function anchor(fr, spec, tf) {
    if (Array.isArray(spec)) return [tf.x + spec[0] * tf.s, tf.y + spec[1] * tf.s];
    if (spec.atom) {
      const a = fr.atoms[spec.atom];
      if (!a) return [tf.x, tf.y];
      return [tf.x + (a.x + (spec.dx || 0)) * tf.s, tf.y + (a.y + (spec.dy || 0)) * tf.s];
    }
    if (spec.bond) {
      const p = spec.bond.split('|');
      const a = fr.atoms[p[0]], b = fr.atoms[p[1]];
      if (!a || !b) return [tf.x, tf.y];
      const mx = (a.x + b.x) / 2 + (spec.dx || 0), my = (a.y + b.y) / 2 + (spec.dy || 0);
      return [tf.x + mx * tf.s, tf.y + my * tf.s];
    }
    return [tf.x, tf.y];
  }

  /* ---- draw one frame ---- */
  function draw(ctx, fr, tf, o) {
    o = o || {};
    const ground = o.ground || '#05080F';
    const base = o.colour || '#C9D4EA';
    const P = id => {
      const a = fr.atoms[id];
      return a ? [tf.x + a.x * tf.s, tf.y + a.y * tf.s] : [tf.x, tf.y];
    };

    /* bonds, with forming and breaking ones marked */
    fr.bonds.forEach(bd => {
      const A = P(bd.a), B = P(bd.b);
      const aa = fr.atoms[bd.a], bb = fr.atoms[bd.b];
      const alpha = Math.min(aa ? aa.alpha : 1, bb ? bb.alpha : 1);
      if (alpha < 0.02) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      const trim0 = (aa && aa.label) ? tf.s * 0.16 : 0;
      const trim1 = (bb && bb.label) ? tf.s * 0.16 : 0;
      const whole = Math.floor(bd.order + 1e-6);
      const frac = bd.order - whole;
      const w = (o.width || 2.4) * (tf.s / 60);
      // a partial bond — one being made or broken — is drawn dashed, which
      // is exactly the convention used in a transition-state drawing
      const col = bd.colour || base;
      if (whole >= 1) {
        O.bond(ctx, A[0], A[1], B[0], B[1], {
          order: Math.min(whole, 3), colour: col, width: Math.max(1.4, w),
          style: bd.style, toward: bd.toward ? [tf.x + bd.toward[0] * tf.s, tf.y + bd.toward[1] * tf.s] : null,
          trim0: trim0, trim1: trim1
        });
      }
      if (frac > 0.02) {
        // a bond that is neither making nor breaking but sits at a
        // fractional order is delocalised, and is drawn neutrally
        const fracCol = bd.forming ? (o.forming || '#4ADE80')
                      : bd.breaking ? (o.breaking || '#FB7185')
                      : (o.delocal || '#8FA4CE');
        ctx.save();
        ctx.globalAlpha = alpha * (0.55 + 0.45 * frac);
        O.bond(ctx, A[0], A[1], B[0], B[1], {
          order: 1, colour: fracCol,
          width: Math.max(1.4, w * 1.0), style: 'partial',
          toward: bd.toward ? [tf.x + bd.toward[0] * tf.s, tf.y + bd.toward[1] * tf.s] : null,
          trim0: trim0, trim1: trim1
        });
        ctx.restore();
      } else if (bd.partial) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        O.bond(ctx, A[0], A[1], B[0], B[1], {
          order: 1, colour: bd.forming ? (o.forming || '#4ADE80') : (o.breaking || '#FB7185'),
          width: Math.max(1.2, w * 0.7), style: 'partial', trim0: trim0, trim1: trim1
        });
        ctx.restore();
      }
      ctx.restore();
    });

    /* atoms */
    Object.keys(fr.atoms).forEach(id => {
      const a = fr.atoms[id];
      if (a.alpha < 0.02) return;
      if (!a.label && Math.abs(a.charge) < 0.08 && !a.radical && !a.hot) return;
      const q = P(id);
      ctx.save();
      ctx.globalAlpha = a.alpha;
      if (a.hot) {                       // the reacting centre gets a halo
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], tf.s * 0.46);
        rg.addColorStop(0, O.rgba(a.colour || '#FFAE4C', 0.40 * a.hot));
        rg.addColorStop(1, O.rgba(a.colour || '#FFAE4C', 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(q[0], q[1], tf.s * 0.46, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (a.label) {
        O.atom(ctx, q[0], q[1], a.label, {
          size: Math.max(9, tf.s * 0.22), ground: ground, colour: a.colour,
          charge: Math.abs(a.charge) > 0.45 ? Math.sign(a.charge) : 0,
          pairs: a.lone
        });
      } else if (Math.abs(a.charge) > 0.45) {
        ctx.font = '700 ' + Math.max(11, tf.s * 0.24) + 'px "IBM Plex Sans",sans-serif';
        ctx.fillStyle = a.charge > 0 ? '#FF6B6B' : '#5AA9FF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a.charge > 0 ? '+' : '−', q[0], q[1]);
      }
      // a fractional charge is a partial charge, and is written as one
      if (Math.abs(a.charge) > 0.08 && Math.abs(a.charge) <= 0.45) {
        ctx.font = '600 ' + Math.max(8, tf.s * 0.15) + 'px "IBM Plex Sans",sans-serif';
        ctx.fillStyle = a.charge > 0 ? '#FF6B6B' : '#5AA9FF';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const ox = a.x === 0 ? 0 : Math.sign(a.x) * tf.s * 0.22;
        const oy = a.y === 0 ? -tf.s * 0.22 : Math.sign(a.y) * tf.s * 0.24;
        ctx.textAlign = 'center';
        ctx.fillText(a.charge > 0 ? 'δ+' : 'δ−', q[0] + ox, q[1] + oy);
      }
      if (a.radical > 0.3) {
        ctx.fillStyle = a.colour || '#FFAE4C';
        ctx.beginPath(); ctx.arc(q[0] + tf.s * 0.17, q[1] - tf.s * 0.17, tf.s * 0.035, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });

    /* the curly arrows that explain the step */
    fr.arrows.forEach(ar => {
      if (ar.progress <= 0.01) return;
      const from = anchor(fr, ar.from, tf), to = anchor(fr, ar.to, tf);
      O.curlyArrow(ctx, from[0], from[1], to[0], to[1], {
        colour: ar.colour || (o.arrow || '#FFAE4C'),
        bow: ar.bow == null ? 0.42 : ar.bow,
        half: !!ar.half,
        width: Math.max(1.6, 2.1 * (tf.s / 60)),
        head: Math.max(6, 8 * (tf.s / 60)),
        progress: ar.progress
      });
      if (ar.label && ar.progress > 0.65) {
        const mx = (from[0] + to[0]) / 2 - (to[1] - from[1]) * (ar.bow == null ? 0.42 : ar.bow) * 0.8;
        const my = (from[1] + to[1]) / 2 + (to[0] - from[0]) * (ar.bow == null ? 0.42 : ar.bow) * 0.8;
        ctx.save();
        ctx.font = '600 ' + Math.max(8.5, tf.s * 0.15) + 'px "IBM Plex Mono",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,15,.85)';
        ctx.strokeText(ar.label, mx, my);
        ctx.fillStyle = ar.colour || (o.arrow || '#FFAE4C');
        ctx.fillText(ar.label, mx, my);
        ctx.restore();
      }
    });
  }

  /* ---- the step transport strip, drawn on the stage ---- */
  function transport(ctx, x0, x1, y, steps, st, theme, alphaFn) {
    const n = steps.length;
    const w = x1 - x0;
    ctx.save();
    ctx.strokeStyle = alphaFn(theme['line-soft'], 1); ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    const done = (st.i + (st.hold > 0 ? 0 : st.u)) / Math.max(1, n - 1);
    ctx.strokeStyle = theme.chem; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w * Math.min(1, done), y); ctx.stroke();
    const hits = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + (n > 1 ? i / (n - 1) : 0.5) * w;
      const on = i <= st.i;
      const cur = i === st.i;
      ctx.fillStyle = on ? theme.chem : alphaFn(theme['ink-700'], 1);
      ctx.beginPath(); ctx.arc(x, y, cur ? 7 : 4.6, 0, TAU); ctx.fill();
      if (cur) {
        ctx.strokeStyle = alphaFn(theme.chem, .35); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
      }
      ctx.font = '600 9px "IBM Plex Mono",monospace';
      ctx.fillStyle = cur ? theme.chem : theme['text-3'];
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(steps[i].name || String(i + 1), x, y + 14);
      hits.push({ x: x, y: y, i: i });
    }
    ctx.restore();
    return hits;
  }

  return { makeState, advance, frame, draw, transport, ease, ARROW_END };
})(window.ORGART);

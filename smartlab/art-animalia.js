/* ============================================================
   ANIMAL KINGDOM — organism art
   Hand-built Canvas 2D silhouettes, each drawn in a normalised
   [-1,1] box so any lab can place one at any size.
   ============================================================ */
window.ANIMALART = (function () {
  'use strict';
  const TAU = Math.PI * 2;

  function shade(ctx, hue, x, y, r) {
    const g = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .05, x, y, r * 1.15);
    g.addColorStop(0, mixHex(hue, '#ffffff', .5));
    g.addColorStop(.55, hue);
    g.addColorStop(1, mixHex(hue, '#06080E', .55));
    return g;
  }
  function mixHex(a, b, t) {
    const p = h => { let x = h.trim(); if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
      const n = parseInt(x.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const A = p(a), B = p(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
      Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function rgba(hex, a) {
    let x = hex.trim();
    if (x.length === 4) x = '#' + x[1] + x[1] + x[2] + x[2] + x[3] + x[3];
    const n = parseInt(x.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* Each painter draws inside a box of half-size s centred at (0,0).
     `t` is a phase in seconds for gentle idle motion.                   */
  const P = {
    /* --- Porifera: a vase sponge with ostia and an osculum --- */
    vase(ctx, s, hue, t) {
      const w = s * .62, h = s * .95;
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      ctx.moveTo(-w * .52, h);
      ctx.bezierCurveTo(-w * .95, h * .2, -w * .82, -h * .62, -w * .55, -h);
      ctx.lineTo(w * .55, -h);
      ctx.bezierCurveTo(w * .82, -h * .62, w * .95, h * .2, w * .52, h);
      ctx.closePath(); ctx.fill();
      // osculum
      ctx.fillStyle = rgba('#05080F', .85);
      ctx.beginPath(); ctx.ellipse(0, -h, w * .55, w * .2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(hue, .9); ctx.lineWidth = Math.max(1, s * .04); ctx.stroke();
      // ostia
      ctx.fillStyle = rgba('#05080F', .5);
      for (let i = 0; i < 16; i++) {
        const a = i * 2.39, rr = s * (.18 + .55 * ((i * 7) % 11) / 11);
        const px = Math.cos(a) * w * .55 * (1 - rr / s * .1);
        const py = -h * .55 + (i / 16) * h * 1.4;
        ctx.beginPath(); ctx.arc(px * .8, py, s * .035, 0, TAU); ctx.fill();
      }
      // exhalant jet
      ctx.strokeStyle = rgba('#9FD8FF', .35); ctx.lineWidth = Math.max(1, s * .03);
      for (let i = 0; i < 3; i++) {
        const u = ((t * .4 + i / 3) % 1);
        ctx.globalAlpha = (1 - u) * .6;
        ctx.beginPath();
        ctx.ellipse(0, -h - u * s * .5, w * .5 * (1 + u), w * .14 * (1 + u), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    /* --- Coelenterata: a pulsing medusa --- */
    medusa(ctx, s, hue, t) {
      const pulse = .5 + .5 * Math.sin(t * 2.2);
      const w = s * (.82 + .1 * pulse), h = s * (.52 - .06 * pulse);
      ctx.fillStyle = shade(ctx, hue, 0, -s * .2, s);
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.bezierCurveTo(-w, -h * 2.1, w, -h * 2.1, w, 0);
      ctx.bezierCurveTo(w * .6, h * .34, -w * .6, h * .34, -w, 0);
      ctx.closePath(); ctx.fill();
      // gonads (four, the classic Aurelia horseshoes)
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .55), .85);
      ctx.lineWidth = Math.max(1, s * .05);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * w * .4, -h * .75 + Math.sin(a) * h * .3, s * .17, 0, Math.PI);
        ctx.stroke();
      }
      // tentacles
      ctx.strokeStyle = rgba(hue, .8); ctx.lineWidth = Math.max(1, s * .035);
      for (let i = 0; i < 11; i++) {
        const x = -w * .92 + (i / 10) * w * 1.84;
        ctx.beginPath(); ctx.moveTo(x, h * .1);
        const sway = Math.sin(t * 1.8 + i * .7) * s * .12;
        ctx.quadraticCurveTo(x + sway, h * .55, x + sway * 1.7, h * (1.05 + .2 * pulse));
        ctx.stroke();
      }
    },

    /* --- Ctenophora: comb jelly with eight ciliary rows --- */
    ctenophore(ctx, s, hue, t) {
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath(); ctx.ellipse(0, 0, s * .55, s * .88, 0, 0, TAU); ctx.fill();
      // eight comb rows, iridescent beat
      for (let i = 0; i < 8; i++) {
        const off = (i - 3.5) / 3.5;
        const x = off * s * .46;
        ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .7), .5 + .45 * Math.abs(Math.sin(t * 3 + i)));
        ctx.lineWidth = Math.max(1, s * .045);
        ctx.beginPath();
        ctx.moveTo(x, -s * .74);
        ctx.quadraticCurveTo(x * 1.25, 0, x, s * .74);
        ctx.stroke();
      }
      // two long tentacles with colloblasts
      ctx.strokeStyle = rgba(hue, .65); ctx.lineWidth = Math.max(1, s * .03);
      [-1, 1].forEach(sg => {
        ctx.beginPath(); ctx.moveTo(sg * s * .32, s * .7);
        ctx.quadraticCurveTo(sg * s * (.7 + .2 * Math.sin(t * 1.4)), s * 1.2, sg * s * .45, s * 1.7);
        ctx.stroke();
      });
    },

    /* --- Platyhelminthes: dorsoventrally flattened planarian --- */
    flatworm(ctx, s, hue, t) {
      const wob = Math.sin(t * 1.6) * s * .05;
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      ctx.moveTo(0, -s * .95);
      ctx.bezierCurveTo(s * .46, -s * .75, s * .34 + wob, s * .25, 0, s * .95);
      ctx.bezierCurveTo(-s * .34 + wob, s * .25, -s * .46, -s * .75, 0, -s * .95);
      ctx.closePath(); ctx.fill();
      // auricles + eyespots
      ctx.fillStyle = rgba('#05080F', .8);
      ctx.beginPath(); ctx.arc(-s * .14, -s * .62, s * .06, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .14, -s * .62, s * .06, 0, TAU); ctx.fill();
      // branched gastrovascular cavity
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .5), .55);
      ctx.lineWidth = Math.max(1, s * .035);
      ctx.beginPath(); ctx.moveTo(0, -s * .35); ctx.lineTo(0, s * .55); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const y = -s * .25 + i * s * .18;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-s * .2, y + s * .08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s * .2, y + s * .08); ctx.stroke();
      }
    },

    /* --- Aschelminthes: roundworm thrashing in a C --- */
    roundworm(ctx, s, hue, t) {
      ctx.strokeStyle = shade(ctx, hue, 0, 0, s);
      ctx.lineCap = 'round';
      ctx.lineWidth = s * .2;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const x = (u - .5) * s * 1.7;
        const y = Math.sin(u * Math.PI * 1.6 + t * 2.4) * s * .42 * Math.sin(Math.PI * u);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .45), .5);
      ctx.lineWidth = Math.max(1, s * .03);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const x = (u - .5) * s * 1.7;
        const y = Math.sin(u * Math.PI * 1.6 + t * 2.4) * s * .42 * Math.sin(Math.PI * u);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    },

    /* --- Annelida: metameric earthworm --- */
    annelid(ctx, s, hue, t) {
      const N = 16;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const x = (u - .5) * s * 1.75;
        const y = Math.sin(u * 5 + t * 2) * s * .16;
        const rr = s * (.20 - .07 * Math.abs(u - .45) * 2);
        ctx.fillStyle = shade(ctx, i === 6 || i === 7 ? mixHex(hue, '#ffffff', .35) : hue, x, y, rr);
        ctx.beginPath(); ctx.ellipse(x, y, rr * .82, rr, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba('#05080F', .35); ctx.lineWidth = 1; ctx.stroke();
      }
      // prostomium
      ctx.fillStyle = mixHex(hue, '#05080F', .3);
      ctx.beginPath(); ctx.ellipse(-s * .9, Math.sin(t * 2) * s * .16, s * .08, s * .1, 0, 0, TAU); ctx.fill();
    },

    /* --- Arthropoda: insect with tagmata and jointed legs --- */
    arthropod(ctx, s, hue, t) {
      const leg = Math.sin(t * 4) * .25;
      ctx.strokeStyle = mixHex(hue, '#05080F', .25);
      ctx.lineWidth = Math.max(1.2, s * .05); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = -s * .1 + i * s * .17;
        [-1, 1].forEach(sg => {
          const ph = leg * (i % 2 ? -1 : 1) * sg;
          ctx.beginPath();
          ctx.moveTo(sg * s * .18, y);
          ctx.lineTo(sg * s * .52, y + s * .1 + ph * s * .3);
          ctx.lineTo(sg * s * .72, y + s * .42 - ph * s * .2);
          ctx.stroke();
        });
      }
      // abdomen, thorax, head
      ctx.fillStyle = shade(ctx, hue, 0, s * .4, s * .5);
      ctx.beginPath(); ctx.ellipse(0, s * .46, s * .25, s * .44, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .12), 0, 0, s * .35);
      ctx.beginPath(); ctx.ellipse(0, -s * .02, s * .23, s * .3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#05080F', .15), 0, -s * .45, s * .3);
      ctx.beginPath(); ctx.ellipse(0, -s * .48, s * .2, s * .22, 0, 0, TAU); ctx.fill();
      // compound eyes
      ctx.fillStyle = rgba('#05080F', .85);
      ctx.beginPath(); ctx.ellipse(-s * .13, -s * .52, s * .07, s * .09, .3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * .13, -s * .52, s * .07, s * .09, -.3, 0, TAU); ctx.fill();
      // antennae
      ctx.strokeStyle = mixHex(hue, '#05080F', .2); ctx.lineWidth = Math.max(1, s * .035);
      [-1, 1].forEach(sg => {
        ctx.beginPath(); ctx.moveTo(sg * s * .08, -s * .66);
        ctx.quadraticCurveTo(sg * s * .3, -s * .95, sg * s * (.42 + .05 * Math.sin(t * 3)), -s * .8);
        ctx.stroke();
      });
    },

    /* --- Mollusca: coiled snail with foot and tentacles --- */
    mollusc(ctx, s, hue, t) {
      // foot
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .3), 0, s * .5, s * .6);
      ctx.beginPath();
      ctx.moveTo(-s * .85, s * .72);
      ctx.quadraticCurveTo(-s * .9, s * .3, -s * .35, s * .3);
      ctx.lineTo(s * .6, s * .34);
      ctx.quadraticCurveTo(s * .95, s * .4, s * .8, s * .72);
      ctx.closePath(); ctx.fill();
      // head tentacles
      ctx.strokeStyle = mixHex(hue, '#ffffff', .3); ctx.lineWidth = Math.max(1, s * .045);
      [[-.62, -.2], [-.78, -.05]].forEach(([x, y], i) => {
        ctx.beginPath(); ctx.moveTo(-s * .5, s * .38);
        ctx.quadraticCurveTo(s * x, s * (y + .2 + .05 * Math.sin(t * 2 + i)), s * (x - .12), s * (y - .05));
        ctx.stroke();
      });
      // spiral shell
      ctx.strokeStyle = shade(ctx, hue, 0, 0, s * .7);
      ctx.lineWidth = s * .19; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const a = i / 90 * TAU * 2.1;
        const r = s * .09 * Math.exp(a * .215);
        const x = s * .15 + Math.cos(a + 2.2) * r, y = -s * .05 + Math.sin(a + 2.2) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    },

    /* --- Echinodermata: pentaradial starfish --- */
    starfish(ctx, s, hue, t) {
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const a = i / 180 * TAU - Math.PI / 2;
        const r = s * (.45 + .5 * Math.pow(Math.abs(Math.cos(2.5 * a)), .55));
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      // ambulacral grooves with tube feet
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .55), .7);
      ctx.lineWidth = Math.max(1, s * .035);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + k / 5 * TAU;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * s * .84, Math.sin(a) * s * .84);
        ctx.stroke();
        for (let j = 1; j <= 6; j++) {
          const rr = s * .145 * j;
          const ext = .45 + .55 * Math.sin(t * 3 - j * .8 + k * 1.2);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          const nx = -Math.sin(a), ny = Math.cos(a);
          ctx.fillStyle = rgba(mixHex(hue, '#ffffff', .8), .45 + .45 * ext);
          [-1, 1].forEach(sg => {
            ctx.beginPath();
            ctx.arc(px + nx * sg * s * .075 * ext, py + ny * sg * s * .075 * ext,
              Math.max(.8, s * .022), 0, TAU);
            ctx.fill();
          });
        }
      }
      // madreporite
      ctx.fillStyle = rgba('#ffffff', .75);
      ctx.beginPath(); ctx.arc(s * .2, -s * .2, s * .05, 0, TAU); ctx.fill();
    },

    /* --- Hemichordata: acorn worm, proboscis + collar + trunk --- */
    acornworm(ctx, s, hue, t) {
      ctx.fillStyle = shade(ctx, hue, 0, s * .3, s);
      ctx.beginPath();
      ctx.moveTo(-s * .16, -s * .1);
      ctx.quadraticCurveTo(-s * .22, s * .9 + Math.sin(t) * s * .05, -s * .05, s * .98);
      ctx.quadraticCurveTo(s * .18, s * .9, s * .14, -s * .1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .2), 0, -s * .22, s * .3);
      ctx.beginPath(); ctx.ellipse(0, -s * .2, s * .26, s * .14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .38), 0, -s * .58, s * .35);
      ctx.beginPath(); ctx.ellipse(0, -s * .56, s * .22, s * .32, 0, 0, TAU); ctx.fill();
      // gill pores on the trunk
      ctx.fillStyle = rgba('#05080F', .5);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.arc(-s * .07, s * .05 + i * s * .1, s * .022, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(s * .06, s * .05 + i * s * .1, s * .022, 0, TAU); ctx.fill();
      }
    },

    /* --- Chordata: a generic fish, used as the phylum emblem --- */
    chordate(ctx, s, hue, t) { P.bonyfish(ctx, s, hue, t); },

    /* ---------------- vertebrate classes ---------------- */
    lamprey(ctx, s, hue, t) {
      ctx.strokeStyle = shade(ctx, hue, 0, 0, s);
      ctx.lineWidth = s * .16; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, x = (u - .5) * s * 1.8;
        const y = Math.sin(u * 6 - t * 3) * s * .22 * u;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // circular sucking mouth, no jaws
      ctx.fillStyle = rgba('#05080F', .8);
      ctx.beginPath(); ctx.arc(-s * .9, 0, s * .12, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .5), .9); ctx.lineWidth = Math.max(1, s * .03);
      ctx.beginPath(); ctx.arc(-s * .9, 0, s * .12, 0, TAU); ctx.stroke();
      // seven gill slits
      ctx.fillStyle = rgba('#05080F', .55);
      for (let i = 0; i < 7; i++) {
        ctx.beginPath(); ctx.ellipse(-s * .68 + i * s * .08, 0, s * .012, s * .05, 0, 0, TAU); ctx.fill();
      }
    },
    shark(ctx, s, hue, t) {
      const sw = Math.sin(t * 2.4) * s * .1;
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      ctx.moveTo(-s * .95, 0);
      ctx.quadraticCurveTo(-s * .2, -s * .34, s * .5, -s * .16);
      ctx.lineTo(s * .95, -s * .42 + sw);
      ctx.lineTo(s * .78, 0);
      ctx.lineTo(s * .95, s * .34 + sw);
      ctx.lineTo(s * .5, s * .14);
      ctx.quadraticCurveTo(-s * .2, s * .3, -s * .95, 0);
      ctx.closePath(); ctx.fill();
      // heterocercal tail already asymmetric above; dorsal fin
      ctx.fillStyle = mixHex(hue, '#05080F', .2);
      ctx.beginPath();
      ctx.moveTo(-s * .1, -s * .3); ctx.lineTo(s * .12, -s * .72); ctx.lineTo(s * .24, -s * .26);
      ctx.closePath(); ctx.fill();
      // ventral mouth
      ctx.strokeStyle = rgba('#05080F', .75); ctx.lineWidth = Math.max(1, s * .035);
      ctx.beginPath(); ctx.arc(-s * .72, s * .08, s * .16, .2, 1.5); ctx.stroke();
      // separate gill slits, no operculum
      ctx.fillStyle = rgba('#05080F', .5);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.ellipse(-s * .42 + i * s * .08, s * .02, s * .012, s * .1, 0, 0, TAU); ctx.fill();
      }
    },
    bonyfish(ctx, s, hue, t) {
      const sw = Math.sin(t * 3) * s * .08;
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      ctx.moveTo(-s * .92, 0);
      ctx.quadraticCurveTo(-s * .1, -s * .48, s * .52, -s * .12);
      ctx.lineTo(s * .95, -s * .34 + sw);
      ctx.lineTo(s * .95, s * .34 + sw);
      ctx.lineTo(s * .52, s * .12);
      ctx.quadraticCurveTo(-s * .1, s * .48, -s * .92, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixHex(hue, '#05080F', .18);
      ctx.beginPath();
      ctx.moveTo(-s * .12, -s * .38); ctx.lineTo(s * .1, -s * .74); ctx.lineTo(s * .3, -s * .24);
      ctx.closePath(); ctx.fill();
      // operculum — the bony-fish giveaway
      ctx.strokeStyle = rgba('#05080F', .6); ctx.lineWidth = Math.max(1, s * .035);
      ctx.beginPath(); ctx.moveTo(-s * .5, -s * .22); ctx.quadraticCurveTo(-s * .4, 0, -s * .5, s * .22); ctx.stroke();
      ctx.fillStyle = rgba('#05080F', .8);
      ctx.beginPath(); ctx.arc(-s * .68, -s * .07, s * .05, 0, TAU); ctx.fill();
    },
    frog(ctx, s, hue, t) {
      const hop = Math.abs(Math.sin(t * 1.6));
      ctx.strokeStyle = mixHex(hue, '#05080F', .2); ctx.lineWidth = Math.max(1.4, s * .07);
      ctx.lineCap = 'round';
      [-1, 1].forEach(sg => {
        ctx.beginPath();
        ctx.moveTo(sg * s * .3, s * .2);
        ctx.lineTo(sg * s * (.62 + .1 * hop), s * (.1 - .2 * hop));
        ctx.lineTo(sg * s * (.78 + .08 * hop), s * .55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sg * s * .26, -s * .18);
        ctx.lineTo(sg * s * .52, s * .12);
        ctx.stroke();
      });
      ctx.fillStyle = shade(ctx, hue, 0, 0, s * .7);
      ctx.beginPath(); ctx.ellipse(0, s * .1, s * .38, s * .42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .1), 0, -s * .38, s * .4);
      ctx.beginPath(); ctx.ellipse(0, -s * .36, s * .34, s * .26, 0, 0, TAU); ctx.fill();
      // bulging eyes with lids
      [-1, 1].forEach(sg => {
        ctx.fillStyle = mixHex(hue, '#ffffff', .35);
        ctx.beginPath(); ctx.arc(sg * s * .19, -s * .56, s * .11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#05080F';
        ctx.beginPath(); ctx.arc(sg * s * .19, -s * .56, s * .05, 0, TAU); ctx.fill();
      });
    },
    lizard(ctx, s, hue, t) {
      const wig = Math.sin(t * 2.2);
      ctx.strokeStyle = mixHex(hue, '#05080F', .2); ctx.lineWidth = Math.max(1.2, s * .06);
      ctx.lineCap = 'round';
      [[-.25, -1], [-.25, 1], [.2, -1], [.2, 1]].forEach(([x, sg], i) => {
        const ph = Math.sin(t * 4 + i * 1.6) * .3;
        ctx.beginPath();
        ctx.moveTo(s * x, sg * s * .12);
        ctx.lineTo(s * (x - .12), sg * s * (.36 + ph * .2));
        ctx.lineTo(s * (x - .26), sg * s * (.5 + ph * .1));
        ctx.stroke();
      });
      ctx.fillStyle = shade(ctx, hue, 0, 0, s);
      ctx.beginPath();
      ctx.moveTo(-s * .58, 0);
      ctx.quadraticCurveTo(-s * .1, -s * .3, s * .35, -s * .12);
      ctx.quadraticCurveTo(s * .75, -s * .05, s * .95, wig * s * .25);
      ctx.quadraticCurveTo(s * .72, s * .06, s * .35, s * .12);
      ctx.quadraticCurveTo(-s * .1, s * .3, -s * .58, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .12), -s * .7, 0, s * .3);
      ctx.beginPath(); ctx.ellipse(-s * .7, 0, s * .2, s * .14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#05080F';
      ctx.beginPath(); ctx.arc(-s * .78, -s * .05, s * .035, 0, TAU); ctx.fill();
      // dry scales
      ctx.strokeStyle = rgba('#05080F', .25); ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(-s * .3 + i * s * .12, 0, s * .1, -2.4, -.7); ctx.stroke();
      }
    },
    bird(ctx, s, hue, t) {
      const flap = Math.sin(t * 4);
      ctx.fillStyle = shade(ctx, mixHex(hue, '#05080F', .12), 0, 0, s);
      // wings
      [-1, 1].forEach(sg => {
        ctx.beginPath();
        ctx.moveTo(sg * s * .12, -s * .06);
        ctx.quadraticCurveTo(sg * s * .72, -s * (.3 + .35 * flap), sg * s * .98, -s * (.05 + .5 * flap));
        ctx.quadraticCurveTo(sg * s * .6, s * (.14 - .2 * flap), sg * s * .14, s * .16);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = shade(ctx, hue, 0, 0, s * .6);
      ctx.beginPath(); ctx.ellipse(0, s * .08, s * .2, s * .34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .15), 0, -s * .35, s * .3);
      ctx.beginPath(); ctx.arc(0, -s * .34, s * .16, 0, TAU); ctx.fill();
      // beak, no teeth
      ctx.fillStyle = '#E8B64C';
      ctx.beginPath();
      ctx.moveTo(-s * .14, -s * .36); ctx.lineTo(-s * .42, -s * .3); ctx.lineTo(-s * .14, -s * .24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05080F';
      ctx.beginPath(); ctx.arc(-s * .04, -s * .4, s * .035, 0, TAU); ctx.fill();
      // tail feathers
      ctx.fillStyle = mixHex(hue, '#05080F', .2);
      ctx.beginPath();
      ctx.moveTo(-s * .1, s * .38); ctx.lineTo(0, s * .82); ctx.lineTo(s * .12, s * .38);
      ctx.closePath(); ctx.fill();
    },
    mammal(ctx, s, hue, t) {
      const dark = mixHex(hue, '#05080F', .30), mid = mixHex(hue, '#05080F', .12);
      // four jointed legs, each swinging a quarter-cycle apart — a real
      // quadruped gait, not four sticks in parallel
      const leg = (x0, phase, front) => {
        const sw = Math.sin(t * 3 + phase);
        const kneeX = x0 + sw * .10, kneeY = s * .46;
        const footX = x0 + sw * .20, footY = s * .80;
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(1.6, s * (front ? .10 : .11));
        ctx.beginPath();
        ctx.moveTo(s * x0, s * .10);
        ctx.lineTo(s * kneeX, kneeY);
        ctx.stroke();
        ctx.lineWidth = Math.max(1.3, s * .075);
        ctx.beginPath();
        ctx.moveTo(s * kneeX, kneeY); ctx.lineTo(s * footX, footY);
        ctx.stroke();
        ctx.fillStyle = mixHex(hue, '#05080F', .5);          // hoof / paw
        ctx.beginPath(); ctx.ellipse(s * footX, footY + s * .02, s * .07, s * .045, 0, 0, TAU); ctx.fill();
      };
      leg(-.30, 1.57, true); leg(-.24, 4.71, true);
      leg(.30, 0, false); leg(.36, 3.14, false);

      // body: withers, back, rump, haunch, belly, chest
      ctx.fillStyle = shade(ctx, hue, -s * .2, -s * .2, s * .8);
      ctx.beginPath();
      ctx.moveTo(-s * .46, -s * .18);                        // base of the neck
      ctx.bezierCurveTo(-s * .22, -s * .34, s * .12, -s * .32, s * .34, -s * .22);  // back
      ctx.bezierCurveTo(s * .52, -s * .16, s * .58, s * .06, s * .48, s * .22);     // rump
      ctx.bezierCurveTo(s * .34, s * .34, s * .10, s * .30, -s * .16, s * .28);     // belly
      ctx.bezierCurveTo(-s * .38, s * .26, -s * .52, s * .10, -s * .46, -s * .18);  // chest
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(dark, .8); ctx.lineWidth = Math.max(1, s * .02); ctx.stroke();

      // neck
      ctx.fillStyle = shade(ctx, mid, -s * .55, -s * .3, s * .4);
      ctx.beginPath();
      ctx.moveTo(-s * .50, -s * .22);
      ctx.quadraticCurveTo(-s * .68, -s * .38, -s * .70, -s * .50);
      ctx.lineTo(-s * .52, -s * .54);
      ctx.quadraticCurveTo(-s * .44, -s * .34, -s * .34, -s * .18);
      ctx.closePath(); ctx.fill();

      // head with muzzle and pinna
      ctx.save(); ctx.translate(-s * .70, -s * .56); ctx.rotate(-.35);
      ctx.fillStyle = shade(ctx, mixHex(hue, '#ffffff', .08), -s * .08, -s * .06, s * .26);
      ctx.beginPath(); ctx.ellipse(0, 0, s * .20, s * .145, 0, 0, TAU); ctx.fill();
      ctx.beginPath();                                      // muzzle
      ctx.ellipse(-s * .17, s * .04, s * .10, s * .075, -.15, 0, TAU); ctx.fill();
      ctx.fillStyle = mixHex(hue, '#05080F', .55);          // nose
      ctx.beginPath(); ctx.ellipse(-s * .25, s * .05, s * .035, s * .028, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = mid;                                   // external ear — a mammal marker
      ctx.beginPath();
      ctx.moveTo(s * .04, -s * .10);
      ctx.quadraticCurveTo(s * .10, -s * .34, s * .18, -s * .30);
      ctx.quadraticCurveTo(s * .16, -s * .12, s * .12, -s * .07);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05080F';                             // eye
      ctx.beginPath(); ctx.arc(-s * .05, -s * .03, s * .028, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(-s * .06, -s * .04, s * .010, 0, TAU); ctx.fill();
      ctx.restore();

      // tail with a terminal tuft
      const sway = Math.sin(t * 2.4) * s * .10;
      ctx.strokeStyle = mid; ctx.lineWidth = Math.max(1.4, s * .055); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * .50, -s * .14);
      ctx.quadraticCurveTo(s * .76, -s * .06 + sway, s * .84, s * .22 + sway);
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(s * .85, s * .28 + sway, s * .05, s * .09, .3, 0, TAU); ctx.fill();

      // hair — the defining mammalian character
      ctx.strokeStyle = rgba(mixHex(hue, '#ffffff', .45), .40); ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const u = i / 15;
        const x = -s * .44 + u * s * .78;
        const y = -s * .30 - Math.sin(u * Math.PI) * s * .035;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * .02, y - s * .07); ctx.stroke();
      }
    }
  };

  function draw(ctx, shape, x, y, size, hue, t, alpha) {
    const fn = P[shape] || P.vase;
    ctx.save();
    ctx.translate(x, y);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    fn(ctx, size, hue || '#8899AA', t || 0);
    ctx.restore();
  }

  return { draw, shapes: P, mixHex, rgba };
})();

/* ============================================================
   DEPTH PASS — extra controls, second graphs and self-check
   quizzes bolted onto the six original experiments.
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, fmt, E } = L;

  /* The old depth patches for LORENTZ and YDSE have been removed: both labs
     were rebuilt as 3D benches with the medium, the thin plate, the unequal
     slits, the scaling plots and the quizzes native to the lab itself. The
     patches were not merely redundant — the YDSE one reused the key `mu`,
     which now belongs to the plate over slit 1. */

  /* ---------------------------------------------------------------
     3 · ORBITALS — show the signed radial function itself
     --------------------------------------------------------------- */
  L.extend('orbitals', {
    addPlots: [{
      title: 'The radial function R(r) itself — a node is where it crosses zero',
      legend: [{ c: '#FFAE4C', label: 'R(r), signed' }, { c: '#5AA9FF', label: 'R(r) < 0' }],
      draw(S, g) {
        const pts = S.grid.map(a => [a[0], a[2]]);
        let mx = 0;
        pts.forEach(q => { mx = Math.max(mx, Math.abs(q[1])); });
        mx = mx || 1;
        const P = g.Plot({
          xmin: 0, xmax: S.rmax, ymin: -1.15, ymax: 1.15,
          xlabel: 'r (Bohr radii a₀)', ylabel: 'R(r) normalised',
          xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
        }).frame();
        P.clip(() => {
          P.hline(0, g.alpha(g.theme['text-3'], .8), [2, 4]);
          const norm = pts.map(q => [q[0], q[1] / mx]);
          const pos = norm.map(q => [q[0], Math.max(0, q[1])]);
          const neg = norm.map(q => [q[0], Math.min(0, q[1])]);
          P.area(pos, 0, g.alpha(g.theme.chem, .16));
          P.area(neg, 0, g.alpha('#5AA9FF', .16));
          P.line(norm, g.theme.chem, 2);
          S.nodeR.forEach(rn => {
            P.vline(rn, g.alpha(g.theme.text, .75), [3, 3]);
            P.tag(rn, 0.9, 'node', g.theme.text, 'left', 0);
          });
        });
        P.tag(S.rmax * 0.55, -1.0, S.nodeR.length + ' radial node' +
          (S.nodeR.length === 1 ? '' : 's') + '  =  n − l − 1', g.theme['text-2'], 'left', 0);
      },
      hover(S, x) {
        const i = clamp(Math.round(x / S.rmax * (S.grid.length - 1)), 0, S.grid.length - 1);
        const r = S.grid[i];
        return [{ label: 'r', value: r[0].toFixed(2) + ' a₀' },
                { label: 'R(r)', value: r[2].toExponential(2), color: '#FFAE4C' },
                { label: '4πr²R²', value: r[1].toExponential(2) },
                { label: 'sign of ψ', value: r[2] >= 0 ? 'positive' : 'negative' }];
      }
    }],
    quiz: [
      { q: 'The number of radial nodes in a 4d orbital is:',
        options: ['0', '1', '2', '3'], answer: 1,
        why: 'Radial nodes = n − l − 1. For 4d, n = 4 and l = 2, so 4 − 2 − 1 = 1.' },
      { q: 'Which orbital has two angular nodes and one radial node?',
        options: ['3p', '4d', '3d', '4p'], answer: 1,
        why: 'Angular nodes = l, so two means l = 2 (a d orbital). Radial nodes = n − l − 1 = 1 requires n = 4. That is 4d.' },
      { q: 'For a hydrogen atom, which of the following orbitals has the lowest energy?',
        options: ['3s', '3p', '3d', 'all three are equal'], answer: 3,
        why: 'In a one-electron atom the energy depends only on n. The 3s, 3p and 3d orbitals are degenerate. The (n + l) rule applies only to multi-electron atoms.' },
      { q: 'The most probable distance of the electron from the nucleus in a 1s orbital of hydrogen is:',
        options: ['0', 'a₀ (52.9 pm)', '2a₀', 'infinite'], answer: 1,
        why: 'The radial probability 4πr²|R|² peaks at exactly one Bohr radius — the probability density is highest at the nucleus, but the available volume there is vanishingly small.' }
    ]
  });

  /* ---------------------------------------------------------------
     4 · SN1/SN2 — the decisive kinetics experiment
     --------------------------------------------------------------- */
  L.extend('substitution', {
    addPlots: [{
      title: 'The experiment that assigns the mechanism — rate against [Nu⁻]',
      legend: [{ c: '#FFAE4C', label: 'SN2 (rises with [Nu⁻])' },
               { c: '#63729A', label: 'SN1 (flat — [Nu⁻] absent)' }],
      draw(S, g) {
        const RT = 8.314e-3 * S.p.T;
        const k2u = Math.exp(-S.Ea2 / RT);
        const k1 = Math.exp(-S.Ea1 / RT);
        const ref = Math.max(k2u * 2, k1, 1e-300);
        const l2 = [], l1 = [];
        for (let i = 0; i <= 80; i++) {
          const c = 0.05 + i / 80 * 1.95;
          l2.push([c, k2u * c / ref]); l1.push([c, k1 / ref]);
        }
        const P = g.Plot({
          xmin: 0, xmax: 2, ymin: 0, ymax: 1.15,
          xlabel: '[Nu⁻] (M)', ylabel: 'relative rate',
          xfmt: v => v.toFixed(1), yfmt: v => v.toFixed(1)
        }).frame();
        P.clip(() => {
          P.line(l1, g.alpha(g.theme['text-3'], .95), 2, [5, 4]);
          P.line(l2, g.theme.chem, 2.4);
          P.vline(S.p.conc, g.alpha(g.theme.text, .55), [3, 3]);
          P.dot(S.p.conc, k2u * S.p.conc / ref, 4.5, g.theme.chem, g.theme['ink-950']);
          P.dot(S.p.conc, k1 / ref, 4.5, g.theme['text-3'], g.theme['ink-950']);
        });
        P.tag(1.5, k1 / ref, 'SN1 — horizontal line', g.theme['text-2'], 'right', -9);
        P.tag(0.1, 0.06, 'SN2 — straight line through the origin', g.theme.chem, 'left', -9);
      },
      hover(S, x) {
        const RT = 8.314e-3 * S.p.T;
        const k2u = Math.exp(-S.Ea2 / RT), k1 = Math.exp(-S.Ea1 / RT);
        const ref = Math.max(k2u * 2, k1, 1e-300);
        const c = clamp(x, 0, 2);
        return [{ label: '[Nu⁻]', value: c.toFixed(2) + ' M' },
                { label: 'SN2 rate', value: (k2u * c / ref).toFixed(3), color: '#FFAE4C' },
                { label: 'SN1 rate', value: (k1 / ref).toFixed(3), color: '#63729A' },
                { label: 'doubling [Nu⁻]', value: 'doubles SN2 only' }];
      }
    }],
    quiz: [
      { q: 'Doubling the concentration of the nucleophile doubles the reaction rate. The mechanism is:',
        options: ['SN1', 'SN2', 'E1', 'either SN1 or SN2'], answer: 1,
        why: 'A second-order rate law, rate = k[RX][Nu], means both partners are in the slow step — that is SN2. SN1 rate depends only on [RX].' },
      { q: 'An optically pure secondary halide reacts to give a completely racemic product. This indicates:',
        options: ['SN2 with inversion', 'SN1 through a planar carbocation',
                  'E2 elimination', 'no reaction occurred'], answer: 1,
        why: 'A planar sp² carbocation can be attacked equally from either face, producing both configurations in roughly equal amounts.' },
      { q: 'The order of SN2 reactivity for alkyl halides is:',
        options: ['3° > 2° > 1° > CH₃', 'CH₃ > 1° > 2° > 3°', '2° > 3° > 1° > CH₃', 'all react equally'], answer: 1,
        why: 'SN2 needs backside access to the carbon. The fewer and smaller the substituents, the easier that is — so methyl is fastest and tertiary is effectively unreactive.' },
      { q: 'Polar aprotic solvents such as DMSO speed up SN2 reactions because they:',
        options: ['stabilise the carbocation', 'leave the nucleophile poorly solvated and highly reactive',
                  'increase the temperature', 'protonate the leaving group'], answer: 1,
        why: 'With no O—H or N—H hydrogens, an aprotic solvent cannot hydrogen-bond to the anion. The "naked" nucleophile is far more reactive.' }
    ]
  });

  /* ---------------------------------------------------------------
     5 · ACTION POTENTIAL — the gating variables themselves
     --------------------------------------------------------------- */
  L.extend('actionpotential', {
    wrapSetup(S) { S.gate = []; },
    wrapStep(S) {
      if (!S.gate) S.gate = [];
      S.gate.push([S.tms, S.m[S.rec], S.h[S.rec], S.n[S.rec]]);
      while (S.gate.length > 2 && S.gate[0][0] < S.tms - 45) S.gate.shift();
    },
    addPlots: [{
      title: 'The three gating variables — m opens fast, h shuts sodium off, n is slow',
      legend: [{ c: '#FFC24B', label: 'm — Na⁺ activation' },
               { c: '#C98A2E', label: 'h — Na⁺ inactivation' },
               { c: '#5AA9FF', label: 'n — K⁺ activation' }],
      draw(S, g) {
        if (!S.gate || !S.gate.length) return;
        const t1 = Math.max(45, S.tms);
        const P = g.Plot({
          xmin: t1 - 45, xmax: t1, ymin: 0, ymax: 1.05,
          xlabel: 'time (ms)', ylabel: 'fraction open',
          xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(1)
        }).frame();
        P.clip(() => {
          P.line(S.gate.map(r => [r[0], r[1]]), '#FFC24B', 2);
          P.line(S.gate.map(r => [r[0], r[2]]), '#C98A2E', 2, [5, 3]);
          P.line(S.gate.map(r => [r[0], r[3]]), '#5AA9FF', 2);
        });
        P.tag(P.cfg.xmin, 0.97, 'h starts high and collapses during the spike — that is the refractory period',
          g.theme['text-3'], 'left', 0);
      },
      hover(S, x) {
        if (!S.gate || !S.gate.length) return null;
        const r = S.gate.reduce((b, q) => Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b, S.gate[0]);
        return [{ label: 'time', value: r[0].toFixed(1) + ' ms' },
                { label: 'm', value: r[1].toFixed(3), color: '#FFC24B' },
                { label: 'h', value: r[2].toFixed(3), color: '#C98A2E' },
                { label: 'n', value: r[3].toFixed(3), color: '#5AA9FF' },
                { label: 'm³h', value: (Math.pow(r[1], 3) * r[2]).toFixed(4) }];
      }
    }],
    quiz: [
      { q: 'During the rising phase of an action potential, the membrane is most permeable to:',
        options: ['K⁺', 'Na⁺', 'Cl⁻', 'Ca²⁺'], answer: 1,
        why: 'Voltage-gated Na⁺ channels open explosively, and sodium influx drives the membrane potential towards E_Na = +50 mV.' },
      { q: 'The absolute refractory period exists because:',
        options: ['the Na⁺/K⁺ pump is exhausted', 'Na⁺ channels are inactivated and cannot reopen',
                  'K⁺ channels are closed', 'the stimulus is too weak'], answer: 1,
        why: 'The h gate has shut. Until it recovers, no stimulus of any strength can reopen the sodium channels, so no second spike is possible.' },
      { q: 'Increasing the stimulus strength well above threshold changes:',
        options: ['the amplitude of the action potential', 'the frequency of action potentials',
                  'the resting potential', 'the equilibrium potential of Na⁺'], answer: 1,
        why: 'The all-or-none law fixes the amplitude. A stronger stimulus is encoded as a higher firing frequency, not a bigger spike.' },
      { q: 'Hyperpolarisation (the undershoot) after an action potential occurs because:',
        options: ['Na⁺ channels reopen', 'K⁺ channels remain open past the point of repolarisation',
                  'Cl⁻ floods in', 'the pump stops working'], answer: 1,
        why: 'The slow K⁺ channels stay open, so extra K⁺ keeps leaving and the potential is dragged towards E_K = −77 mV.' }
    ]
  });

})(window.InsightLab);

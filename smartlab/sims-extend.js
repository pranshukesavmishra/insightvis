/* ============================================================
   DEPTH PASS — extra controls, second graphs and self-check
   quizzes bolted onto the six original experiments.
   ============================================================ */
(function (L) {
  'use strict';
  const { clamp, fmt, E } = L;

  /* ---------------------------------------------------------------
     1 · LORENTZ FORCE — how r and T scale with B, plus a quiz
     --------------------------------------------------------------- */
  L.extend('lorentz', {
    addPlots: [{
      title: 'Scaling law — both r and T fall as 1/B, so the frequency rises',
      legend: [{ c: '#3DD6F5', label: 'r / r(at 0.12 T)' }, { c: '#4ADE80', label: 'T / T(at 0.12 T)' }],
      draw(S, g) {
        const Bref = 0.12;
        const rRef = S.vperp0 * S.m / (Math.abs(S.q) * Bref);
        const tRef = L.TAU * S.m / (Math.abs(S.q) * Bref);
        const rs = [], ts = [];
        for (let i = 0; i <= 120; i++) {
          const B = 0.02 + i / 120 * 0.48;
          rs.push([B, (S.vperp0 * S.m / (Math.abs(S.q) * B)) / rRef]);
          ts.push([B, (L.TAU * S.m / (Math.abs(S.q) * B)) / tRef]);
        }
        const P = g.Plot({
          xmin: 0.02, xmax: 0.5, ymin: 0, ymax: 6.5,
          xlabel: 'magnetic field B (T)', ylabel: 'ratio to value at 0.12 T',
          xfmt: v => v.toFixed(2), yfmt: v => v.toFixed(0)
        }).frame();
        P.clip(() => {
          P.line(ts, g.theme.ok, 2.4);
          P.line(rs, g.theme.phys, 2, [5, 3]);
          P.vline(S.p.B, g.alpha(g.theme.text, .6), [3, 3]);
          P.dot(S.p.B, (S.rc / rRef), 4.5, g.theme.text, g.theme['ink-950']);
          P.hline(1, g.alpha(g.theme['text-3'], .5), [2, 5]);
        });
        P.tag(S.p.B, S.rc / rRef, 'your setting', g.theme.text, 'left', -10);
      },
      hover(S, x) {
        const B = clamp(x, 0.02, 0.5);
        const r = S.vperp0 * S.m / (Math.abs(S.q) * B);
        const T = L.TAU * S.m / (Math.abs(S.q) * B);
        return [{ label: 'B', value: B.toFixed(3) + ' T' },
                { label: 'radius', value: (r * 1000).toFixed(2) + ' mm', color: '#3DD6F5' },
                { label: 'period', value: fmt(T, 3) + ' s', color: '#4ADE80' },
                { label: 'frequency', value: fmt(1 / T, 3) + ' Hz' }];
      }
    }],
    quiz: [
      { q: 'A proton moving perpendicular to a uniform magnetic field follows a circular path. If its speed is doubled, the time period of revolution:',
        options: ['doubles', 'halves', 'stays the same', 'quadruples'], answer: 2,
        why: 'T = 2πm/qB contains no v. Doubling the speed doubles the radius so the particle covers twice the distance at twice the speed — same time.' },
      { q: 'A charged particle enters a uniform magnetic field at 30° to the field direction. Its path is:',
        options: ['a straight line', 'a circle', 'a helix', 'a parabola'], answer: 2,
        why: 'The perpendicular component circles while the parallel component drifts along the field untouched — the sum of the two is a helix.' },
      { q: 'In a velocity selector with E ⊥ B, particles passing undeflected have speed:',
        options: ['E·B', 'E/B', 'B/E', '√(E/B)'], answer: 1,
        why: 'Setting the electric force qE equal to the magnetic force qvB gives v = E/B, independent of both charge and mass.' },
      { q: 'The work done by a magnetic force on a moving charge over one full circle is:',
        options: ['zero', 'positive', 'negative', 'depends on the field strength'], answer: 0,
        why: 'The force is always perpendicular to the velocity, so F⃗·d⃗s = 0 at every instant. Kinetic energy never changes.' }
    ]
  });

  /* ---------------------------------------------------------------
     2 · YDSE — immerse the apparatus in a medium
     --------------------------------------------------------------- */
  L.extend('ydse', {
    params: { mu: 1.0 },
    addControlGroups: [{
      group: 'Medium', items: [
        { key: 'mu', label: 'Refractive index <i>μ</i>', min: 1.0, max: 1.7, step: 0.01, unit: '',
          fmt: v => v.toFixed(2), restructure: true }
      ]
    }],
    addPresets: [
      { name: 'Immersed in water (μ = 1.33)', params: { mu: 1.33, lam: 589, d: 0.25, a: 0.08, D: 1.2, mode: 'double' } }
    ],
    wrapSetup(S) {
      const p = S.p;
      const mu = p.mu || 1;
      S.mu = mu;
      S.lamVac = p.lam * 1e-9;
      S.lam = S.lamVac / mu;                       // wavelength inside the medium
      S.beta = S.lam * p.D / S.d;
      S.env1 = S.lam * p.D / S.a;
      S.yRange = p.mode === 'single'
        ? Math.max(2.6 * S.env1, 4e-3)
        : Math.max(5 * S.beta, 1.5 * S.env1);
    },
    addReadouts(S) {
      const mu = S.mu || 1;
      return [
        { label: 'λ inside medium', value: (S.lam * 1e9).toFixed(1), unit: 'nm',
          flag: mu > 1.001 ? 'warn' : '', hint: mu > 1.001 ? 'λ_vac / μ' : 'in vacuum' },
        { label: 'Fringe shrink factor', value: (1 / mu).toFixed(3), unit: '×',
          hint: mu > 1.001 ? 'every fringe narrows by μ' : 'no medium' }
      ];
    },
    quiz: [
      { q: 'A Young\'s double slit apparatus is completely immersed in water (μ = 1.33). The fringe width:',
        options: ['increases 1.33 times', 'decreases to 1/1.33 of its value',
                  'stays the same', 'becomes zero'], answer: 1,
        why: 'The wavelength inside the medium is λ/μ, and β = λD/d, so every fringe narrows by exactly the refractive index.' },
      { q: 'In a double-slit experiment d = 3a. Which interference maxima are missing?',
        options: ['1st, 2nd, 3rd', '3rd, 6th, 9th', '2nd, 4th, 6th', 'none are missing'], answer: 1,
        why: 'A maximum vanishes when it coincides with a diffraction minimum. With d/a = 3 that happens at orders n = 3, 6, 9 …' },
      { q: 'Two coherent sources each of intensity I₀ interfere. The intensity at a bright fringe is:',
        options: ['2I₀', '4I₀', 'I₀', '√2 I₀'], answer: 1,
        why: 'Amplitudes add, and intensity goes as amplitude squared: (A + A)² = 4A², so 4I₀.' },
      { q: 'White light is used in a double-slit experiment. The central fringe is:',
        options: ['violet', 'red', 'white', 'invisible'], answer: 2,
        why: 'At the centre the path difference is zero for every wavelength, so all colours are in phase and recombine into white.' }
    ]
  });

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

  /* ---------------------------------------------------------------
     6 · CARDIAC CYCLE — build the Frank–Starling curve by experiment
     --------------------------------------------------------------- */
  L.extend('cardiac', {
    wrapSetup(S) { S.fs = []; S.fsLast = -1; },
    wrapStep(S) {
      if (!S.fs) { S.fs = []; S.fsLast = -1; }
      if (S.edv !== S.fsLast && S.edv > 0 && S.esv < 999) {
        S.fsLast = S.edv;
        const sv = Math.max(S.edv - S.esv, 0);
        S.fs.push([S.edv, sv, S.p.emax]);
        if (S.fs.length > 160) S.fs.shift();
      }
    },
    addPlots: [{
      title: 'Frank–Starling — sweep the preload slider and the curve draws itself',
      legend: [{ c: '#FF6B9D', label: 'beats recorded' }, { c: '#63729A', label: 'current beat' }],
      draw(S, g) {
        const P = g.Plot({
          xmin: 40, xmax: 190, ymin: 0, ymax: 130,
          xlabel: 'end-diastolic volume — preload (mL)', ylabel: 'stroke volume (mL)',
          xfmt: v => v.toFixed(0), yfmt: v => v.toFixed(0)
        }).frame();
        P.clip(() => {
          (S.fs || []).forEach(q => P.dot(q[0], q[1], 2.6, g.alpha(g.theme.bio, .5)));
          const sv = Math.max(S.edv - S.esv, 0);
          P.dot(S.edv, sv, 5, g.theme.text, g.theme['ink-950']);
        });
        P.tag(46, 120, (S.fs || []).length + ' beats recorded — drag preload to extend the curve',
          g.theme['text-3'], 'left', 0);
        P.tag(S.edv, Math.max(S.edv - S.esv, 0), 'now', g.theme.text, 'left', -10);
      },
      hover(S, x) {
        return [{ label: 'EDV', value: x.toFixed(0) + ' mL' },
                { label: 'current SV', value: Math.max(S.edv - S.esv, 0).toFixed(0) + ' mL', color: '#FF6B9D' },
                { label: 'current EF', value: (S.edv > 0 ? (S.edv - S.esv) / S.edv * 100 : 0).toFixed(0) + ' %' },
                { label: 'beats recorded', value: String((S.fs || []).length) }];
      }
    }],
    quiz: [
      { q: 'Stroke volume is 70 mL and heart rate is 72 bpm. Cardiac output is:',
        options: ['about 5.0 L/min', 'about 0.5 L/min', 'about 50 L/min', 'about 1.4 L/min'], answer: 0,
        why: 'CO = SV × HR = 70 × 72 = 5040 mL/min ≈ 5 L/min — the standard resting value worth memorising.' },
      { q: 'If EDV is 120 mL and ESV is 50 mL, the ejection fraction is:',
        options: ['42%', '58%', '70%', '120%'], answer: 1,
        why: 'SV = 120 − 50 = 70 mL, so EF = 70/120 = 58%. Normal is roughly 55–70%.' },
      { q: 'During isovolumetric ventricular contraction:',
        options: ['both AV and semilunar valves are open', 'both are closed',
                  'only the AV valves are open', 'only the semilunar valves are open'], answer: 1,
        why: 'With both sets of valves shut, no blood can enter or leave, so pressure rises steeply at constant volume.' },
      { q: 'The first heart sound "lubb" is produced by:',
        options: ['closure of the semilunar valves', 'closure of the atrioventricular valves',
                  'opening of the AV valves', 'atrial contraction'], answer: 1,
        why: 'The AV (mitral and tricuspid) valves snap shut at the start of ventricular systole. The semilunar valves closing at the end of systole give the second sound, "dupp".' }
    ]
  });

})(window.InsightLab);

// Synthesizes the soundtrack for sumbong-flow: a music bed plus sound effects placed on cues.json
// (exported from the timeline by `node docs/video/render.mjs --cues-only`). No samples, no dependencies.
//   node docs/video/sound.mjs   -> docs/video/sumbong-flow-audio.wav (48 kHz, 16-bit stereo, 90 s)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000, DUR = 90, N = SR * DUR, TAU = Math.PI * 2;
const cues = JSON.parse(readFileSync(path.join(here, "cues.json"), "utf8"));
// The timeline is authored over 83 s and played back stretched to 90 s; section times below are in timeline seconds.
const K = 90 / 83, at = (x) => x * K;

const bus = () => [new Float32Array(N), new Float32Array(N)];
const music = bus(), sfx = bus(), send = new Float32Array(N); // send = mono reverb input
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Write a generated mono signal fn(tLocal, i) for `dur` seconds at `t0` into a stereo bus.
function put(b, t0, dur, fn, { gain = 1, pan = 0, rev = 0 } = {}) {
  const s0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < len; i++) {
    const j = s0 + i; if (j < 0) continue; if (j >= N) break;
    const v = fn(i / SR, i);
    b[0][j] += v * gl; b[1][j] += v * gr;
    if (rev) send[j] += v * gain * rev;
  }
}
// RBJ biquad, coefficients recomputed only when asked (for sweeps call set() per sample block).
function biquad(type, f, q = 0.707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (fc, qq = q) => {
    const w = TAU * clamp(fc, 20, SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * qq), a0 = 1 + al;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // band-pass
    b0 /= a0; b1 /= a0; b2 /= a0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
  };
  set(f);
  const run = (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  run.set = set; return run;
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));
const bell = (f, d = 3) => (t) => env(t, 0.002, d) * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 6) + 0.15 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 12));

/* ================= MUSIC (96 BPM, bars of 2.5 s from 7.0 s) ================= */
const BEAT = 60 / 96, BAR = BEAT * 4, T0 = at(6.95), END = at(77.0);
const REPORTER = at(13), VOLUNTEER = at(41), BOARD = at(52);
// I – V/7 – vi – IV in C: [bass, pad notes...]
const CHORDS = [[36, 60, 64, 67, 71, 74], [43, 59, 62, 67, 69, 74], [45, 60, 64, 69, 71, 76], [41, 60, 65, 69, 72, 76]];
const chordAt = (t) => CHORDS[Math.floor((t - T0) / BAR) % 4];

// Pad: detuned saw-ish stacks, rendered per chord segment with overlapping fades, then a time-varying low-pass.
const pad = new Float32Array(N);
function padNote(t0, dur, m, g) {
  const f = mtof(m), s0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const det = [f * 0.9965, f * 1.0035], ph = [rnd() * TAU, rnd() * TAU];
  for (let i = 0; i < len; i++) {
    const j = s0 + i; if (j >= N) break; if (j < 0) continue;
    const t = i / SR, e = Math.min(1, t / 0.8) * Math.min(1, (dur - t) / 0.9);
    let v = 0;
    for (let o = 0; o < 2; o++) { const p = TAU * det[o] * t + ph[o]; for (let k = 1; k <= 6; k++) v += Math.sin(k * p) / k; }
    pad[j] += v * e * g;
  }
}
[[57, 0.05], [60, 0.04], [64, 0.035], [45, 0.05]].forEach(([m, g]) => padNote(0, T0 + 0.4, m, g));   // hook: A minor, low
for (let t = T0; t < END + BAR; t += BAR) {
  const c = chordAt(t), last = t + BAR > END;
  const dur = last ? 90 - t : BAR + 0.9;
  c.slice(1, 5).forEach((m) => padNote(t - 0.3, dur, last ? [60, 64, 67, 71][c.slice(1, 5).indexOf(m)] : m, 0.032));
  if (last) { padNote(t - 0.3, dur, 48, 0.04); break; }
}
{ // filter: dark in the hook, opens on the brand, brighter for the Volunteer half, closes at the end
  const lp = biquad("lp", 400, 0.8);
  for (let j = 0; j < N; j++) {
    const t = j / SR;
    if (j % 64 === 0) lp.set(t < T0 - 0.1 ? 380 + t * 40 : t < VOLUNTEER ? 1500 : t < END ? 2100 : 2100 - (t - END) * 220);
    const v = lp(pad[j]);
    music[0][j] += v; music[1][j] += v; send[j] += v * 0.35;
  }
}
// Hook heartbeat + riser into the brand reveal
for (let t = 0.6; t < T0 - 1.0; t += 1.25) put(music, t, 0.5, (x) => Math.sin(TAU * (50 + 40 * Math.exp(-x * 25)) * x) * env(x, 0.005, 9), { gain: 0.35 });
const RISE = 2.35, R0 = T0 - RISE;
{ const bp = biquad("bp", 400, 2.5); put(music, R0, RISE, (x, i) => { if (i % 32 === 0) bp.set(400 + Math.pow(x / RISE, 2) * 6000, 2.5); return bp(noise()) * Math.pow(x / RISE, 2.2); }, { gain: 0.5, rev: 0.4 }); }
put(music, R0, RISE, (x) => Math.sin(TAU * (220 * x + 300 * x * x / RISE)) * Math.pow(x / RISE, 3) * 0.6, { gain: 0.12 });

// Pluck arpeggio (8ths from the Reporter section, quarters during the brand)
function pluck(t, m, g, pan) {
  const f = mtof(m);
  put(music, t, 0.9, (x) => env(x, 0.003, 6.5) * (Math.sin(TAU * f * x) + 0.45 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 10) + 0.2 * Math.sin(TAU * 3 * f * x) * Math.exp(-x * 16)), { gain: g, pan, rev: 0.5 });
}
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
for (let t = T0, n = 0; t < END - 0.01; t += BEAT / 2, n++) {
  const c = chordAt(t), notes = c.slice(1).map((m) => m + 12);
  if (t < REPORTER && n % 2) continue;
  const bright = t >= VOLUNTEER && Math.floor((t - T0) / (BAR * 4)) % 2 === 1 ? 12 : 0;
  pluck(t, notes[ARP[n % 8]] + (n % 8 === 7 ? bright : 0), t < REPORTER ? 0.06 : 0.075, n % 2 ? 0.35 : -0.35);
}
// Bass on beats 1 and 3 from the Reporter section
for (let t = T0 + Math.ceil((REPORTER - T0) / (BEAT * 2)) * BEAT * 2; t < END; t += BEAT * 2) {
  const f = mtof(chordAt(t)[0]);
  put(music, t, BEAT * 1.9, (x) => Math.tanh(1.6 * (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x))) * Math.min(1, x / 0.01) * Math.min(1, (BEAT * 1.9 - x) / 0.08) * (0.65 + 0.35 * Math.exp(-x * 6)), { gain: 0.16 });
}
// Drums: soft kick (half-time for the Reporter, every beat for Volunteers), hats from the Volunteer section, claps from the board
const bStart = T0 + Math.ceil((REPORTER - T0) / BEAT) * BEAT;
for (let t = bStart, n = 0; t < END - 0.05; t += BEAT, n++) {
  if (t < VOLUNTEER && n % 2) continue;
  put(music, t, 0.4, (x) => Math.sin(TAU * (46 * x + (95 / 32) * (1 - Math.exp(-x * 32)))) * env(x, 0.002, 8.5) + noise() * Math.exp(-x * 400) * 0.3, { gain: t < VOLUNTEER ? 0.28 : 0.32 });
  if (t >= VOLUNTEER) { const hp = biquad("hp", 7500, 0.9); put(music, t + BEAT / 2, 0.08, (x) => hp(noise()) * Math.exp(-x * 55), { gain: 0.07, pan: 0.25 }); }
  if (t >= BOARD && n % 2 === 1) {
    const bp = biquad("bp", 1600, 1.2);
    put(music, t, 0.25, (x) => bp(noise()) * (x < 0.01 ? 1 : x < 0.02 ? 0.4 : 1) * Math.exp(-x * 22), { gain: 0.12, pan: -0.1, rev: 0.4 });
  }
}

/* ================= SOUND EFFECTS ================= */
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
function sweepNoise(t, dur, f0, f1, f2, gain, pan = 0, q = 0.9, rev = 0.15) {
  const bp = biquad("bp", f0, q);
  put(sfx, t, dur, (x, i) => {
    const k = x / dur;
    if (i % 32 === 0) bp.set(k < 0.5 ? f0 + (f1 - f0) * (k * 2) : f1 + (f2 - f1) * ((k - 0.5) * 2), q);
    return bp(noise()) * Math.pow(Math.sin(Math.PI * k), 2);
  }, { gain, pan, rev });
}
const FX = {
  tap: (c) => { put(sfx, c.t, 0.05, (x) => Math.sin(TAU * 1700 * x) * Math.exp(-x * 90) + noise() * Math.exp(-x * 900) * 0.4, { gain: 0.22, pan: 0.2 }); },
  key: (c) => { const f = 2600 + rnd() * 1800, bp = biquad("bp", f, 3); put(sfx, c.t, 0.025, (x) => bp(noise()) * Math.exp(-x * 260), { gain: 0.32, pan: 0.25 }); },
  swish: (c) => sweepNoise(c.t, [0.35, 0.3, 1.6][c.p] ?? 0.35, 700, 2600, 900, 0.22 * c.v, 0.1),
  swipe: (c) => sweepNoise(c.t - 0.05, 0.38, 900, 3200, 1200, 0.16, c.p ? 0.15 : 0.25),
  whoosh: (c) => {
    const big = c.p === 1, d = big ? 1.0 : 0.65;
    sweepNoise(c.t - d * 0.45, d, 250, big ? 2400 : 3000, 300, big ? 0.55 : 0.35, 0, 0.7, 0.25);
    if (big) put(sfx, c.t - 0.2, 0.9, (x) => Math.sin(TAU * (70 - 25 * x) * x) * Math.sin(Math.PI * x / 0.9), { gain: 0.15 });
  },
  pindrop: (c) => {
    put(sfx, c.t - 0.12, 0.12, (x) => Math.sin(TAU * (1500 - 9000 * x) * x) * Math.sin(Math.PI * x / 0.12) * 0.5, { gain: 0.12 });
    put(sfx, c.t, 0.25, (x) => Math.sin(TAU * (130 + 200 * Math.exp(-x * 40)) * x) * env(x, 0.002, 18), { gain: 0.35 });
    put(sfx, c.t, 1.2, bell(mtof(PENTA[c.p % PENTA.length] - 12), 4), { gain: 0.14, pan: (c.p % 3 - 1) * 0.4, rev: 0.6 });
  },
  pop: (c) => { const f = 620 + (c.p % 5) * 90; put(sfx, c.t, 0.12, (x) => Math.sin(TAU * (f * x + 2200 * x * x)) * env(x, 0.003, 32), { gain: 0.2, pan: 0.1, rev: 0.15 }); },
  blip: (c) => { put(sfx, c.t, 0.09, (x) => Math.sin(TAU * 1975 * x) * env(x, 0.002, 45) + 0.5 * Math.sin(TAU * 2637 * x) * env(Math.max(0, x - 0.035), 0.002, 50) * (x > 0.035), { gain: 0.12, pan: 0.45, rev: 0.3 }); },
  tick: (c) => { const f = mtof(84 + [0, 2, 4, 7, 9][c.p % 5]); put(sfx, c.t, 0.2, (x) => (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * f * 2 * x)) * env(x, 0.002, 28), { gain: 0.16, pan: 0.2, rev: 0.3 }); },
  sparkle: (c) => { [88, 91, 95, 98, 100].forEach((m, i) => put(sfx, c.t + i * 0.04, 0.9, bell(mtof(m), 5), { gain: 0.08, pan: 0.2 + i * 0.05, rev: 0.6 })); FX.pop({ ...c, p: 3 }); },
  success: (c) => { (c.p ? [79, 84, 88] : [72, 76, 79, 84]).forEach((m, i) => put(sfx, c.t + i * 0.075, 1.8, bell(mtof(m + 12), 2.4), { gain: 0.1, pan: 0.15, rev: 0.7 })); },
  status: (c) => { const ns = [[72, 79], [76, 83], [79, 86], [84, 91]][c.p]; ns.forEach((m, i) => put(sfx, c.t + i * 0.09, 1.6, bell(mtof(m), 2.6), { gain: 0.13, pan: 0.6, rev: 0.6 })); },
  notify: (c) => { [88, 93].forEach((m, i) => put(sfx, c.t + i * 0.13, 1.0, bell(mtof(m), 4), { gain: 0.13, pan: 0.5, rev: 0.4 })); },
  pixel: (c) => { for (let i = 0; i < 16; i++) { const f = 300 + rnd() * 1500, t = c.t + i * 0.04 + rnd() * 0.01; put(sfx, t, 0.03, (x) => Math.sign(Math.sin(TAU * f * x)) * (1 - x / 0.03), { gain: 0.05, pan: rnd() * 0.8 - 0.2 }); } },
  count: (c) => { const f = 900 + c.p * 32; put(sfx, c.t, 0.03, (x) => Math.sin(TAU * f * x) * env(x, 0.001, 120), { gain: 0.09, pan: 0.15 }); },
  paper: (c) => sweepNoise(c.t, 0.24, 1800, 5200, 2200, 0.1, 0.1 + (c.p % 3) * 0.1, 1.4, 0.1),
  stamp: (c) => {
    put(sfx, c.t, 0.5, (x) => Math.sin(TAU * (55 + 90 * Math.exp(-x * 30)) * x) * env(x, 0.001, 11), { gain: 0.75 });
    const lp = biquad("lp", 900, 0.7); put(sfx, c.t, 0.12, (x) => lp(noise()) * Math.exp(-x * 40), { gain: 0.6, rev: 0.3 });
    put(sfx, c.t, 0.05, (x) => Math.sin(TAU * 420 * x) * Math.exp(-x * 120), { gain: 0.25 });
  },
  toast: (c) => { put(sfx, c.t, 0.25, (x) => Math.sin(TAU * (520 * x + 900 * x * x)) * env(x, 0.004, 18), { gain: 0.14, rev: 0.3 }); },
  lift: (c) => { put(sfx, c.t, 0.25, (x) => Math.sin(TAU * (500 * x + 800 * x * x)) * Math.sin(Math.PI * x / 0.25), { gain: 0.1, pan: 0.3, rev: 0.3 }); sweepNoise(c.t + 0.25, 1.4, 600, 2000, 700, 0.12, -0.1, 0.8, 0.2); },
  land: (c) => { put(sfx, c.t, 0.2, (x) => Math.sin(TAU * (160 + 120 * Math.exp(-x * 40)) * x) * env(x, 0.002, 22), { gain: 0.3 }); FX.pop({ ...c, p: 4 }); },
  send: (c) => { sweepNoise(c.t - 0.05, 0.5, 500, 5000, 6000, 0.22, 0.3, 0.8, 0.3); put(sfx, c.t + 0.4, 1.0, bell(mtof(91), 4), { gain: 0.1, pan: 0.4, rev: 0.6 }); },
  hit: (c) => { put(sfx, c.t, 1.6, (x) => Math.sin(TAU * (42 + 30 * Math.exp(-x * 12)) * x) * env(x, 0.003, 3), { gain: 0.45 }); sweepNoise(c.t - 0.35, 0.5, 300, 1500, 200, 0.18, 0, 0.7, 0.4); },
  shimmer: (c) => { [84, 88, 91, 96].forEach((m, i) => put(sfx, c.t + i * 0.06, 2.2, bell(mtof(m), 1.8), { gain: 0.06, pan: i % 2 ? 0.4 : -0.4, rev: 0.8 })); },
  rise: (c) => { put(sfx, c.t, 1.8, (x) => Math.sin(TAU * (300 * x + 260 * x * x)) * Math.pow(x / 1.8, 2) * (1 - Math.pow(x / 1.8, 8)), { gain: 0.06, rev: 0.5 }); },
  impact: (c) => {
    const end = c.p === 1;
    put(sfx, c.t, 2.5, (x) => Math.sin(TAU * (38 + 50 * Math.exp(-x * 14)) * x) * env(x, 0.002, 2.2), { gain: 0.7 });
    const lp = biquad("lp", 2400, 0.7); put(sfx, c.t, 0.6, (x) => lp(noise()) * Math.exp(-x * 9), { gain: 0.3, rev: 0.9 });
    (end ? [60, 64, 67, 71, 74, 79] : [72, 79, 84]).forEach((m, i) => put(sfx, c.t + i * 0.03, end ? 2.7 : 3.5, bell(mtof(m), end ? 1.2 : 1.4), { gain: end ? 0.08 : 0.09, pan: (i % 2 ? 0.3 : -0.3), rev: 0.8 }));
  },
};
for (const c of cues) { if (!FX[c.type]) throw new Error("no sound for cue type " + c.type); FX[c.type](c); }

/* ================= REVERB (Freeverb-style) + MIX ================= */
function reverb(input, spread) {
  const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => Math.round((d + spread) * SR / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round((d + spread) * SR / 44100));
  const cb = combs.map((d) => ({ b: new Float32Array(d), i: 0, s: 0 })), ab = aps.map((d) => ({ b: new Float32Array(d), i: 0 }));
  const fb = 0.86, damp = 0.25;
  for (let j = 0; j < N; j++) {
    const x = input[j] * 0.015; let y = 0;
    for (const c of cb) { const o = c.b[c.i]; c.s = o * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * fb; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of ab) { const o = a.b[a.i]; const v = -y + o; a.b[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.b.length; y = v; }
    out[j] = y;
  }
  return out;
}
const rl = reverb(send, 0), rr = reverb(send, 23);
const L = new Float32Array(N), R = new Float32Array(N);
for (let j = 0; j < N; j++) {
  const t = j / SR, fade = Math.min(1, t / 0.05) * Math.min(1, (DUR - t) / 1.2);
  L[j] = (music[0][j] * 0.6 + sfx[0][j] + rl[j] * 0.9) * fade;
  R[j] = (music[1][j] * 0.6 + sfx[1][j] + rr[j] * 0.9) * fade;
}
let peak = 0; for (let j = 0; j < N; j++) peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j]));
const norm = 0.89 / peak;
const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(N * 4, 40);
for (let j = 0; j < N; j++) {
  const soft = (v) => Math.tanh(v * norm * 1.1) / Math.tanh(1.1);
  wav.writeInt16LE(Math.round(clamp(soft(L[j]), -1, 1) * 32767), 44 + j * 4);
  wav.writeInt16LE(Math.round(clamp(soft(R[j]), -1, 1) * 32767), 46 + j * 4);
}
writeFileSync(path.join(here, "sumbong-flow-audio.wav"), wav);
console.log(`wrote sumbong-flow-audio.wav · ${cues.length} cues · peak ${peak.toFixed(2)} → normalized`);

// The games' sound kit: tones and hiss made in the browser as they're wanted, like Key Jam's (src/effects/synth.js),
// so there are no sound files. Blocks (./blocks/sound.js) and 2048 (./2048/sound.js) build their sounds from it.
// Nothing sounds until wake() has run from a key press or a tap: a browser only lets a page make sound once its
// visitor has done something.

/**
 * What wake() makes: a context, where the sounds go, a second of noise and the pulse waves.
 * @type {{ ctx: AudioContext, out: GainNode, noise: AudioBuffer, pulse: Record<number, PeriodicWave> } | null}
 */
export let kit = null;
export const hz = (note) => 440 * 2 ** ((note - 69) / 12);

/** Everything plays through one squeeze, so sounds that meet, or a sound over the music, never crackle. */
function makeKit(ctx) {
  const squeeze = ctx.createDynamicsCompressor();
  squeeze.threshold.value = -12;
  squeeze.knee.value = 10;
  squeeze.ratio.value = 5;
  squeeze.attack.value = 0.002;
  squeeze.release.value = 0.2;
  const out = ctx.createGain();
  out.gain.value = 0.6;
  out.connect(squeeze).connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  // Pulse waves of different widths: the hollow, reedy tones of old game consoles.
  const pulse = {};
  for (const duty of [0.125, 0.25, 0.5]) {
    const real = new Float32Array(40);
    for (let k = 1; k < 40; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulse[duty] = ctx.createPeriodicWave(real, new Float32Array(40));
  }
  return { ctx, out, noise, pulse };
}

/** Gets the sound going, from a key press or a tap. Does nothing where the browser has no sound to give. */
export function wake() {
  if (!kit) {
    const Sound = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Sound) return;
    kit = makeKit(new Sound());
  }
  if (kit.ctx.state === 'suspended') kit.ctx.resume();
}

/** A tone that swells in `attack` seconds and fades out over `decay`; `to` is a pitch it slides to. */
export function voice(k, at, { wave = 'sine', duty, f, to, slide, peak = 0.2, attack = 0.004, decay = 0.1, lowpass }) {
  const osc = k.ctx.createOscillator();
  if (duty) osc.setPeriodicWave(k.pulse[duty]);
  else osc.type = wave;
  osc.frequency.setValueAtTime(f, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + (slide ?? attack + decay));
  const gain = k.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  connect(k, osc, gain, lowpass);
  osc.start(at);
  osc.stop(at + attack + decay + 0.03);
}

/** A note that holds for its length, then lets go: for the tunes, where a fading pluck would cut melodies short. */
export function held(k, at, { wave = 'sine', duty, f, peak = 0.1, length = 0.2, attack = 0.005, release = 0.05, sustain = 0.75, lowpass }) {
  const osc = k.ctx.createOscillator();
  if (duty) osc.setPeriodicWave(k.pulse[duty]);
  else osc.type = wave;
  osc.frequency.setValueAtTime(f, at);
  const level = Math.max(0.0002, peak * sustain);
  const settle = at + Math.min(Math.max(length * 0.6, attack + 0.002), attack + 0.08);
  const end = Math.max(settle, at + length);
  const gain = k.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(level, settle);
  gain.gain.setValueAtTime(level, end);
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release);
  connect(k, osc, gain, lowpass);
  osc.start(at);
  osc.stop(end + release + 0.02);
}

function connect(k, source, gain, lowpass) {
  if (lowpass) {
    const filter = k.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    source.connect(filter).connect(gain).connect(k.out);
  } else {
    source.connect(gain).connect(k.out);
  }
}

/** Hiss through a filter: a highpass leaves a cymbal's fizz, a bandpass a snare's rattle, a lowpass a thump. */
export function hiss(k, at, { type = 'bandpass', f = 2000, to, q = 1, peak = 0.2, attack = 0.003, decay = 0.05 }) {
  const source = k.ctx.createBufferSource();
  source.buffer = k.noise;
  const filter = k.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(f, at);
  filter.Q.value = q;
  if (to) filter.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
  const gain = k.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  source.connect(filter).connect(gain).connect(k.out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + attack + decay + 0.03);
}

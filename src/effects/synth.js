// The sounds Key Jam plays, all made in the browser as they're wanted: tones and hiss, each shaped by a quick swell
// and a fade. No recordings. Nothing sounds until wake() has been called from a key press or a tap: a browser only
// lets a page make sound once its visitor has done something.

/** @type {AudioContext | null} */
let audio = null;
/** @type {GainNode} Everything plays into this. */
let out;
/** @type {AudioBuffer} A second of hiss, for drums. */
let noise;

/** Gets the sound going. Call it from a key press or a tap. False where the browser has no sound to give. */
export function wake() {
  if (!audio) {
    const Sound = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Sound) return false;
    audio = new Sound();
    // Many keys at once are squeezed back down, so mashing the keyboard doesn't crackle.
    const squeeze = audio.createDynamicsCompressor();
    out = audio.createGain();
    out.gain.value = 0.5;
    out.connect(squeeze).connect(audio.destination);
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume();
  return true;
}

/** A swell to `peak` in a few thousandths of a second, then a fade to nothing over `fade` seconds. */
function shaped(at, peak, fade) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.004 + fade);
  gain.connect(out);
  return gain;
}
/** A tone of one wave shape; `slideTo`, when given, is the pitch it slides to as it fades. */
function tone(wave, pitch, at, peak, fade, slideTo) {
  const osc = audio.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(pitch, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + fade);
  osc.connect(shaped(at, peak, fade));
  osc.start(at);
  osc.stop(at + fade + 0.05);
}
/** Hiss through a filter: 'highpass' leaves a cymbal's fizz, 'bandpass' a clap or a snare's rattle. */
function hiss(at, peak, fade, filter, pitch) {
  const source = audio.createBufferSource();
  source.buffer = noise;
  const through = audio.createBiquadFilter();
  through.type = filter;
  through.frequency.value = pitch;
  source.connect(through).connect(shaped(at, peak, fade));
  source.start(at);
  source.stop(at + fade + 0.05);
}

/** A note's number (60 is middle C, each step a semitone) to its pitch. */
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

/** The melody's voices. */
const VOICES = {
  wood: (at, note) => {
    tone('triangle', hz(note), at, 0.5, 0.42);
    tone('sine', hz(note + 12), at, 0.12, 0.2);
  },
  bell: (at, note) => {
    tone('sine', hz(note), at, 0.4, 1.1);
    // A bell's ring comes from a second tone that isn't a neat multiple of the first.
    tone('sine', hz(note) * 2.76, at, 0.13, 0.6);
  },
  chip: (at, note) => tone('square', hz(note), at, 0.15, 0.22),
};

const DRUMS = {
  kick: (at) => tone('sine', 150, at, 1, 0.32, 42),
  snare: (at) => {
    hiss(at, 0.7, 0.16, 'bandpass', 1900);
    tone('triangle', 190, at, 0.5, 0.1, 120);
  },
  hat: (at) => hiss(at, 0.35, 0.05, 'highpass', 7000),
  open: (at) => hiss(at, 0.3, 0.28, 'highpass', 6000),
  clap: (at) => {
    // Several hands, not quite together.
    for (const late of [0, 0.012, 0.026]) hiss(at + late, 0.5, 0.025, 'bandpass', 1300);
    hiss(at + 0.038, 0.5, 0.14, 'bandpass', 1300);
  },
  tom: (at) => tone('sine', 210, at, 0.9, 0.28, 95),
  zap: (at) => tone('sawtooth', 1400, at, 0.22, 0.2, 110),
};

/**
 * The sets Space moves through: the note the scale starts on, its ten notes as steps up from there (five-note
 * scales, in which any keys played together sound fine), and the melody's voice.
 */
export const SETS = [
  { root: 60, steps: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21], voice: 'wood' },
  { root: 57, steps: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22], voice: 'bell' },
  { root: 62, steps: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21], voice: 'chip' },
];

/** Every kind of sound a key can ask for. */
export const KINDS = ['note', 'bass', 'high', 'chord', 'run', ...Object.keys(DRUMS)];

/**
 * Plays a sound now. `kind` is a drum's name, or one of: 'note', the nth note of the set's scale; 'bass', the same
 * note low down; 'high', a bell an octave up; 'chord', three notes of the scale from the nth, strummed; 'run', a
 * quick climb up the scale.
 * @param {string} kind @param {number} n @param {number} set
 */
export function play(kind, n, set) {
  if (!audio) return;
  const at = audio.currentTime;
  const { root, steps, voice } = SETS[set];
  if (kind === 'note') {
    VOICES[voice](at, root + steps[n]);
  } else if (kind === 'bass') {
    // An octave down for small speakers to carry, and two down for the ones that can.
    tone('triangle', hz(root - 12 + steps[n]), at, 0.7, 0.5);
    tone('sine', hz(root - 24 + steps[n]), at, 0.5, 0.5);
  } else if (kind === 'high') {
    VOICES.bell(at, root + 12 + steps[n]);
  } else if (kind === 'chord') {
    [0, 2, 4].forEach((up, i) => VOICES[voice](at + i * 0.03, root + steps[n + up]));
  } else if (kind === 'run') {
    [0, 2, 4, 5, 7, 9].forEach((step, i) => VOICES.bell(at + i * 0.055, root + 12 + steps[step]));
  } else {
    DRUMS[kind]?.(at);
  }
}

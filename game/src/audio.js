// Synthesised sound, no audio files: a WebAudio engine hum that follows the
// throttle, wind that rises with speed, and short chimes for rings, beacons,
// landings and crashes. Everything starts on the first user gesture, so the
// browser's autoplay rules are never fought.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windSource = null;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();

      // Looping filtered noise for the wind.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, when = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    /** Call on the first gesture; safe to call again. */
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },

    /** Continuous engine + wind levels, called every frame while flying. */
    update(throttle, speed, airborne) {
      if (!ctx || !started) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + throttle * 68 + speed * 0.12, t, 0.08);
      engineGain.gain.setTargetAtTime(airborne ? 0.03 + throttle * 0.05 : 0.015 + throttle * 0.03, t, 0.1);
      windGain.gain.setTargetAtTime(airborne ? Math.min(0.09, speed * 0.0006) : 0, t, 0.15);
    },

    ring() {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.4, 'sine', 0.12, 0.07);
    },
    beacon() {
      tone(523, 0.3, 'triangle', 0.16);
      tone(784, 0.35, 'triangle', 0.14, 0.09);
      tone(1046, 0.4, 'sine', 0.1, 0.18);
    },
    landing() {
      tone(392, 0.25, 'triangle', 0.16);
      tone(523, 0.25, 'triangle', 0.16, 0.12);
      tone(659, 0.5, 'triangle', 0.16, 0.24);
    },
    crash() {
      if (!ctx) return;
      const length = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      source.connect(gain).connect(ctx.destination);
      source.start();
      tone(90, 0.5, 'sawtooth', 0.2);
    },
    click() {
      tone(660, 0.08, 'square', 0.06);
    },
  };
}

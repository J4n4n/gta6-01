// Every sound is synthesised with WebAudio: no audio files, no network.
// The context starts on the first user gesture (browsers demand that).
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
  }
  function isMuted() {
    return muted;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* sound is never fatal */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch { /* sound is never fatal */ }
  }

  function engine(speed01, driving) {
    if (!ctx || !engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
  }

  function siren(on) {
    if (!ctx || !sirenOsc) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    if (on) {
      const t = ctx.currentTime;
      sirenOsc.frequency.setValueAtTime(660, t);
      sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.45);
      sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
    }
  }

  function punch() { noiseBurst(0.09, 0.35, 500); blip(120, 0.09, 'sine', 0.3, 60); }
  function shot() { noiseBurst(0.12, 0.4, 2400); blip(220, 0.08, 'square', 0.18, 70); }
  function crash() { noiseBurst(0.25, 0.4, 700); }
  function pickup() { blip(660, 0.09, 'sine', 0.22); setTimeout(() => blip(990, 0.12, 'sine', 0.22), 90); }
  function click() { blip(800, 0.05, 'sine', 0.12); }
  function busted() { blip(330, 0.25, 'sawtooth', 0.2, 110); setTimeout(() => blip(220, 0.4, 'sawtooth', 0.2, 82), 240); }
  function missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110));
  }

  // A quiet bassline loop: A minor, eight steps, with a soft hat tick.
  const BASS = [55, 0, 55, 65.4, 49, 0, 58.3, 65.4];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (note) blip(note, 0.22, 'triangle', 0.1);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
    }, 240);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    unlock, setMuted, isMuted, engine, siren, punch, shot, crash, pickup,
    click, busted, missionDone, startMusic, stopMusic,
  };
}

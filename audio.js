/* ===================== Dino Island — synthesized audio engine ===================== */
/* Everything here is generated live with the Web Audio API — no audio files. */

const AudioEngine = (() => {
  const MUTE_KEY = 'dinoIslandMuted';
  const VOLUME = 0.6;

  let ctx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let ambience = null; // { roomId, nodes: [...], cleanup: fn|null }
  let muted = false;

  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : VOLUME;
    masterGain.connect(ctx.destination);
  }

  function init() {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function isMuted() { return muted; }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
    if (masterGain) masterGain.gain.value = m ? 0 : VOLUME;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const size = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function playFootstep() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650 + Math.random() * 250;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t);
    src.stop(t + 0.1);
  }

  function playBlip(freq, dur, type, vol) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playUIBlip() { playBlip(600 + Math.random() * 60, 0.05, 'square', 0.08); }
  function playTalkBlip() { playBlip(820 + Math.random() * 180, 0.03, 'sine', 0.06); }

  function playSeagull() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  function stopAmbience() {
    if (!ambience) return;
    ambience.nodes.forEach(n => { try { n.stop(); } catch (e) {} });
    if (ambience.cleanup) ambience.cleanup();
    ambience = null;
  }

  function startAmbience(roomId) {
    stopAmbience();
    if (!ctx) return;

    if (roomId === 'dock') {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer();
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      src.start();
      lfo.start();

      let timer;
      const scheduleSeagull = () => {
        timer = setTimeout(() => {
          playSeagull();
          scheduleSeagull();
        }, 4000 + Math.random() * 6000);
      };
      scheduleSeagull();

      ambience = { roomId, nodes: [src, lfo], cleanup: () => clearTimeout(timer) };
      return;
    }

    if (roomId === 'interior') {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer();
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.value = 0.018;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      src.start();
      ambience = { roomId, nodes: [src], cleanup: null };
      return;
    }

    if (roomId === 'bunker') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 68;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start();
      ambience = { roomId, nodes: [osc], cleanup: null };
      return;
    }
  }

  return { init, isMuted, toggleMute, playFootstep, playUIBlip, playTalkBlip, startAmbience, stopAmbience };
})();

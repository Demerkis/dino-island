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

  function playRoar() {
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.9);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(150, t + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 1.0);

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 500;
    noiseFilter.Q.value = 1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.linearRampToValueAtTime(0.15, t + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSrc.start(t);
    noiseSrc.stop(t + 0.8);
  }

  /* ===== music: a tiny note sequencer, layered quietly under the ambience above ===== */

  const NOTE_FREQ = {
    A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
    A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
  };

  // Each theme: beatMs = duration of one beat unit; notes = [noteName|null, beats][].
  const THEMES = {
    title: {
      beatMs: 230, type: 'triangle', gain: 0.09,
      notes: [
        ['C4',1],['E4',1],['G4',1],['E4',1],['A4',1],['G4',1],['E4',1],['D4',1],
        ['C4',1],['E4',1],['G4',1],['A4',1],['G4',1],['E4',1],['D4',1],[null,1],
      ],
    },
    dock: {
      beatMs: 260, type: 'triangle', gain: 0.05,
      notes: [['C4',1],['E4',1],['G4',1],['E4',1],['A4',1],['G4',1],['E4',1],[null,1]],
    },
    interior: {
      beatMs: 400, type: 'sine', gain: 0.035,
      notes: [['E4',2],[null,1],['D4',2],[null,1],['C4',2],[null,2]],
    },
    bunker: {
      beatMs: 520, type: 'sawtooth', gain: 0.03,
      notes: [['A3',4],[null,2],['C4',1],[null,1],['A3',2],[null,4]],
    },
    cages: {
      beatMs: 420, type: 'sawtooth', gain: 0.045,
      notes: [['A3',2],['C4',1],[null,1],['A3',2],['B3',1],[null,1],['A3',2],[null,2]],
    },
  };

  let musicGain = null;
  let musicTimer = null;
  let currentThemeId = null;

  function ensureMusicGain() {
    if (!musicGain) {
      musicGain = ctx.createGain();
      musicGain.gain.value = 1;
      musicGain.connect(masterGain);
    }
  }

  function scheduleNote(freq, startTime, durSec, type, gainVal) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const attack = Math.min(0.05, durSec * 0.2);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + attack);
    gain.gain.setValueAtTime(gainVal, Math.max(startTime + attack, startTime + durSec - Math.min(0.15, durSec * 0.3)));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durSec);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(startTime);
    osc.stop(startTime + durSec + 0.02);
  }

  function playThemeOnce(theme, startTime) {
    let t = startTime;
    theme.notes.forEach(([note, beats]) => {
      const dur = beats * theme.beatMs / 1000;
      if (note) scheduleNote(NOTE_FREQ[note], t, dur * 0.92, theme.type, theme.gain);
      t += dur;
    });
    return t - startTime;
  }

  function stopMusic() {
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    currentThemeId = null;
  }

  function playMusic(themeId) {
    if (!ctx || themeId === currentThemeId) return;
    stopMusic();
    const theme = THEMES[themeId];
    if (!theme) return;
    ensureMusicGain();
    currentThemeId = themeId;
    const loop = () => {
      const dur = playThemeOnce(theme, ctx.currentTime + 0.05);
      musicTimer = setTimeout(loop, dur * 1000);
    };
    loop();
  }

  return {
    init, isMuted, toggleMute, playFootstep, playUIBlip, playTalkBlip, playRoar,
    startAmbience, stopAmbience, playMusic, stopMusic,
  };
})();

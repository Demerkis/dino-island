/* ===================== Dino Island — engine ===================== */

let lang = 'en';
try { lang = localStorage.getItem('dinoIslandLang') || 'en'; } catch (e) {}

function t(en, fr) { return lang === 'fr' ? fr : en; }

const state = {
  currentRoomId: null,
  items: [],
  flags: {},
  selectedVerb: null,
  selectedItem: null,
  pos: { x: 0, y: 0 },
  facing: 'right',
  busy: false,
  dialogueOpen: false,
  gameOver: false,
  introPlaying: false,
  lastMessage: '',
};

let roomBgEl, hotspotsEl, characterEl, charInnerEl, textEl, verbsEl, inventoryEl, fadeEl, dialogueEl, roomEl, stageEl;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* ===================== Geometry helpers ===================== */

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function clampToPolygon(pt, poly) {
  if (pointInPolygon(pt, poly)) return pt;
  let best = null, bestDist = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = closestPointOnSegment(pt, a, b);
    const d = (c.x - pt.x) ** 2 + (c.y - pt.y) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/* ===================== State mutators (called from data.js handlers) ===================== */

function addItem(state, itemId) {
  if (!state.items.includes(itemId)) state.items.push(itemId);
  renderInventory();
  renderRoom();
}

function removeItem(state, itemId) {
  state.items = state.items.filter(i => i !== itemId);
  renderInventory();
  renderRoom();
}

function goToRoom(state, roomId, arrivalPoint) {
  if (state.currentRoomId === roomId) return '';
  fadeEl.classList.add('active');
  setTimeout(() => {
    state.currentRoomId = roomId;
    const room = ROOMS[roomId];
    state.pos = arrivalPoint ? { ...arrivalPoint } : { ...room.entryPoint };
    state.facing = 'right';
    state.selectedVerb = null;
    state.selectedItem = null;
    renderVerbs();
    renderRoom();
    updateCharacterPosition();
    AudioEngine.startAmbience(roomId);
    AudioEngine.playMusic(roomId);
    if (roomId === 'cages') {
      AudioEngine.playRoar();
      triggerShake();
    }
    saveGame();
    setTimeout(() => fadeEl.classList.remove('active'), 30);
  }, 260);
  return '';
}

function openDialogue(state) {
  state.dialogueOpen = true;
  renderDialogue();
  return '';
}

function closeDialogue() {
  state.dialogueOpen = false;
  dialogueEl.classList.add('hidden');
}

function renderDialogue() {
  const topics = SCIENTIST_TOPICS.filter(topic => topic.condition(state));
  dialogueEl.classList.remove('hidden');
  dialogueEl.innerHTML = '';

  const portraits = document.createElement('div');
  portraits.className = 'dlg-portraits';
  portraits.innerHTML = `
    <div class="dlg-portrait player">${PORTRAITS.player}</div>
    <div class="dlg-portrait npc">${PORTRAITS.scientist}</div>
  `;
  dialogueEl.appendChild(portraits);

  const topicsWrap = document.createElement('div');
  topicsWrap.className = 'dlg-topics';
  topics.forEach(topic => {
    const btn = document.createElement('button');
    btn.className = 'dlg-topic';
    btn.textContent = topic.label();
    btn.addEventListener('click', () => {
      AudioEngine.playUIBlip();
      const response = topic.respond(state);
      setText(response);
      renderInventory();
      renderDialogue();
      animateTalkingPortrait(response);
      saveGame();
    });
    topicsWrap.appendChild(btn);
  });
  const bye = document.createElement('button');
  bye.className = 'dlg-topic dlg-bye';
  bye.textContent = t('Goodbye.', 'Au revoir.');
  bye.addEventListener('click', () => { AudioEngine.playUIBlip(); closeDialogue(); });
  topicsWrap.appendChild(bye);
  dialogueEl.appendChild(topicsWrap);
}

function animateTalkingPortrait(msg) {
  const portrait = dialogueEl.querySelector('.dlg-portrait.npc');
  if (!portrait) return;
  portrait.classList.add('talking');
  setTimeout(() => portrait.classList.remove('talking'), msg.length * 16 + 120);
}

/* ===================== Rendering ===================== */

let textGen = 0;
let textRevealing = false;

function setText(msg) {
  if (!msg) return;
  state.lastMessage = msg;
  const myGen = ++textGen;
  textEl.textContent = '';
  textRevealing = true;
  let i = 0;
  function tick() {
    if (myGen !== textGen) return;
    if (i >= msg.length) { textRevealing = false; return; }
    textEl.textContent += msg[i];
    i++;
    if (i % 2 === 0) AudioEngine.playTalkBlip();
    setTimeout(tick, 16);
  }
  tick();
}

function skipTextReveal() {
  if (!textRevealing || state.introPlaying) return;
  textEl.textContent = state.lastMessage;
  textRevealing = false;
  textGen++;
}

function showHover(msg) {
  textGen++;
  textRevealing = false;
  textEl.textContent = msg;
}

function restoreText() {
  textGen++;
  textRevealing = false;
  textEl.textContent = state.lastMessage || ' ';
}

function verbLabelFor(key) {
  const v = VERBS.find(v => v.key === key);
  return v ? t(v.en, v.fr) : t('Look at', 'Regarder');
}

function renderVerbs() {
  verbsEl.innerHTML = '';
  VERBS.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'verb-btn';
    btn.textContent = t(v.en, v.fr);
    if (state.selectedVerb === v.key) btn.classList.add('active');
    btn.addEventListener('click', () => onVerbClick(v.key));
    verbsEl.appendChild(btn);
  });
}

/* Hover previews use mousemove delegation (not mouseenter/mouseleave per element):
   renderRoom/renderInventory rebuild elements on every state change, and a stationary
   cursor left resting on a just-clicked hotspot would otherwise re-trigger mouseenter
   on the freshly recreated node and clobber the just-set result text. mousemove only
   fires on real pointer movement, so a DOM rebuild under a still cursor is a no-op. */
let hotspotHoverMap = new Map();
let inventoryHoverMap = new Map();
let hoveredEl = null;

function renderInventory() {
  inventoryEl.innerHTML = '';
  inventoryHoverMap = new Map();
  state.items.forEach(itemId => {
    const item = ITEMS[itemId];
    const el = document.createElement('div');
    el.className = 'inv-item';
    if (state.selectedItem === itemId) el.classList.add('active');
    el.innerHTML = item.icon;
    el.title = item.name();
    el.addEventListener('click', () => onItemClick(itemId));
    inventoryEl.appendChild(el);
    inventoryHoverMap.set(el, item.name());
  });
}

function renderRoom() {
  const room = ROOMS[state.currentRoomId];
  roomBgEl.innerHTML = room.background(state);

  hotspotsEl.innerHTML = '';
  hotspotHoverMap = new Map();
  room.hotspots.forEach(h => {
    if (h.visible && !h.visible(state)) return;
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.style.left = (h.rect.x / ROOM_W * 100) + '%';
    el.style.top = (h.rect.y / ROOM_H * 100) + '%';
    el.style.width = (h.rect.w / ROOM_W * 100) + '%';
    el.style.height = (h.rect.h / ROOM_H * 100) + '%';
    el.addEventListener('click', () => onHotspotClick(h));
    hotspotsEl.appendChild(el);
    hotspotHoverMap.set(el, h);
  });
}

function setupHoverDelegation() {
  document.addEventListener('mousemove', (evt) => {
    const hotspotEl = evt.target.closest('.hotspot');
    const invEl = evt.target.closest('.inv-item');
    let el = null, text = null;
    if (hotspotEl && hotspotHoverMap.has(hotspotEl)) {
      const h = hotspotHoverMap.get(hotspotEl);
      const verbLabel = state.selectedItem
        ? t(`Use ${ITEMS[state.selectedItem].name()} with`, `Utiliser ${ITEMS[state.selectedItem].name()} avec`)
        : verbLabelFor(state.selectedVerb);
      el = hotspotEl;
      text = `${verbLabel} ${h.name()}`;
    } else if (invEl && inventoryHoverMap.has(invEl)) {
      el = invEl;
      text = inventoryHoverMap.get(invEl);
    }
    if (el) {
      hoveredEl = el;
      showHover(text);
    } else if (hoveredEl) {
      hoveredEl = null;
      restoreText();
    }
  });
}

function updateCharacterPosition() {
  characterEl.style.transform = `translate(${state.pos.x - 22}px, ${state.pos.y - 84}px)`;
  charInnerEl.style.transform = state.facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
}

/* ===================== Movement ===================== */

function walkTo(target) {
  return new Promise(resolve => {
    const poly = ROOMS[state.currentRoomId].walkableArea;
    const dest = clampToPolygon(target, poly);
    const start = { ...state.pos };
    const dx = dest.x - start.x, dy = dest.y - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) { resolve(); return; }
    state.facing = dx < 0 ? 'left' : 'right';
    characterEl.classList.add('walking');
    const speed = 260;
    const duration = Math.max(150, (dist / speed) * 1000);
    const startTime = performance.now();
    let lastStepSound = 0;
    state.busy = true;
    function step() {
      const now = performance.now();
      const t = Math.min(1, (now - startTime) / duration);
      state.pos = { x: start.x + dx * t, y: start.y + dy * t };
      updateCharacterPosition();
      if (now - lastStepSound > 260) {
        AudioEngine.playFootstep();
        lastStepSound = now;
      }
      if (t < 1) {
        setTimeout(step, 16);
      } else {
        characterEl.classList.remove('walking');
        state.busy = false;
        resolve();
      }
    }
    step();
  });
}

/* ===================== Input handling ===================== */

function onVerbClick(key) {
  if (state.gameOver || state.introPlaying) return;
  AudioEngine.playUIBlip();
  state.selectedVerb = (state.selectedVerb === key) ? null : key;
  state.selectedItem = null;
  renderVerbs();
  renderInventory();
}

function onItemClick(itemId) {
  if (state.gameOver || state.dialogueOpen || state.introPlaying) return;

  // An item is already pending and a different item was clicked: combine them,
  // regardless of which verb (if any) is currently active.
  if (state.selectedItem && state.selectedItem !== itemId) {
    tryCombine(state.selectedItem, itemId);
    return;
  }

  const verbKey = state.selectedVerb;

  if (verbKey === 'use' || verbKey === 'give') {
    AudioEngine.playUIBlip();
    state.selectedItem = (state.selectedItem === itemId) ? null : itemId;
    renderVerbs();
    renderInventory();
    if (state.selectedItem) {
      const name = ITEMS[state.selectedItem].name();
      setText(verbKey === 'give'
        ? t(`Give the ${name} to whom?`, `Donner ${name} à qui ?`)
        : t(`${name}. Use it on something.`, `${name}. À utiliser sur quelque chose.`));
    }
    return;
  }

  // No verb, or any verb other than Use/Give: default to Look at, matching how
  // hotspots already behave when nothing is selected.
  const item = ITEMS[itemId];
  if (!verbKey || verbKey === 'look') {
    if (item.look === 'READ_NOTE') {
      state.flags.knowsCode = true;
      setText(t("A hasty scrawl: '7-2-9-4. Don't forget it this time. —M' Huh. Handy.",
                "Une note griffonnée à la hâte : « 7-2-9-4. Ne pas l'oublier cette fois. —M ». Tiens, pratique."));
      saveGame();
    } else {
      setText(item.look());
    }
  } else {
    setText(fallback(verbKey));
  }
  state.selectedVerb = null;
  renderVerbs();
}

function tryCombine(itemA, itemB) {
  const combo = COMBOS.find(c =>
    (c.pair[0] === itemA && c.pair[1] === itemB) || (c.pair[0] === itemB && c.pair[1] === itemA));
  if (combo) {
    removeItem(state, itemA);
    removeItem(state, itemB);
    addItem(state, combo.result);
    setText(combo.text());
  } else {
    setText(t("Those two don't go together.", "Ces deux objets ne vont pas ensemble."));
  }
  state.selectedItem = null;
  state.selectedVerb = null;
  renderVerbs();
  renderInventory();
  saveGame();
}

async function onHotspotClick(hotspot) {
  if (state.busy || state.gameOver || state.dialogueOpen || state.introPlaying) return;

  const usingItem = state.selectedItem;
  const verb = state.selectedVerb;

  await walkTo(hotspot.interactionPoint);
  if (state.gameOver) return;

  let result;
  if (usingItem) {
    if (verb === 'give') {
      result = hotspot.actions.give ? hotspot.actions.give(state, usingItem) : fallback('give');
    } else {
      result = hotspot.actions.use ? hotspot.actions.use(state, usingItem) : fallback('use');
    }
  } else if (verb) {
    const handler = hotspot.actions[verb];
    result = handler ? handler(state, null) : fallback(verb);
  } else if (hotspot.isExit && hotspot.actions.go) {
    result = hotspot.actions.go(state);
  } else {
    result = hotspot.actions.look ? hotspot.actions.look(state) : fallback('look');
  }

  state.selectedVerb = null;
  state.selectedItem = null;
  renderVerbs();
  renderInventory();

  if (result === 'ENDING') {
    playEnding();
  } else {
    renderRoom();
    if (result) setText(result);
    saveGame();
  }
}

function onGroundClick(evt) {
  if (state.busy || state.gameOver || state.dialogueOpen || state.introPlaying) return;
  if (evt.target.closest('.hotspot')) return;
  if (state.selectedVerb || state.selectedItem) {
    state.selectedVerb = null;
    state.selectedItem = null;
    renderVerbs();
    renderInventory();
    return;
  }
  const rect = roomEl.getBoundingClientRect();
  const x = (evt.clientX - rect.left) / rect.width * ROOM_W;
  const y = (evt.clientY - rect.top) / rect.height * ROOM_H;
  walkTo({ x, y });
}

/* ===================== Ending ===================== */

function playEnding() {
  state.gameOver = true;
  clearSave();
  AudioEngine.stopAmbience();
  AudioEngine.stopMusic();
  setText(t("The door hangs open. Whatever Specimen 07's neighbor was, it isn't in there anymore.",
            "La porte est grande ouverte. Quoi qu'ait été le voisin du Spécimen 07, il n'est plus là."));
  const overlay = document.createElement('div');
  overlay.id = 'ending-overlay';
  overlay.innerHTML = `
    <div class="ending-glow"></div>
    <h1>${t('TO BE CONTINUED...', 'À SUIVRE...')}</h1>
    <p>${t("Bent steel. An empty cage. And somewhere in the dark beyond the blast door, something that's been loose for who knows how long.<br>Whatever happens next, that's the problem now.",
           "De l'acier tordu. Une cage vide. Et quelque part dans le noir, au-delà de la porte blindée, quelque chose est en liberté depuis on ne sait combien de temps.<br>Quoi qu'il arrive ensuite, c'est désormais le problème.")}</p>
    <button id="btn-play-again" class="title-btn">${t('Play Again', 'Rejouer')}</button>
  `;
  document.getElementById('game').appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 20);
  overlay.querySelector('#btn-play-again').addEventListener('click', () => {
    AudioEngine.playUIBlip();
    restartGame();
  });
}

function restartGame() {
  const overlay = document.getElementById('ending-overlay');
  if (overlay) overlay.remove();

  state.items = [];
  state.flags = {};
  state.selectedVerb = null;
  state.selectedItem = null;
  state.dialogueOpen = false;
  state.gameOver = false;
  state.busy = false;
  state.introPlaying = false;
  closeDialogue();

  document.getElementById('btn-continue').classList.add('hidden');
  applyChrome();
  document.getElementById('title-screen').classList.remove('hidden');
}

/* ===================== Save / load ===================== */

const SAVE_KEY = 'dinoIslandSave';

let saveToastTimer = null;

function showSavedToast() {
  const toast = document.getElementById('save-toast');
  if (!toast) return;
  toast.classList.add('show');
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => toast.classList.remove('show'), 900);
}

function saveGame() {
  if (state.gameOver) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      currentRoomId: state.currentRoomId,
      items: state.items,
      flags: state.flags,
    }));
    showSavedToast();
  } catch (e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

/* ===================== Chrome (title/ending/mute/toast static text) ===================== */

function applyChrome() {
  const tagline = document.querySelector('#title-screen .tagline');
  if (tagline) tagline.textContent = t('A point-and-click prototype', 'Un prototype point-and-click');
  const startBtn = document.getElementById('btn-start');
  const continueBtn = document.getElementById('btn-continue');
  if (startBtn) startBtn.textContent = loadGame() ? t('New Game', 'Nouvelle partie') : t('Start', 'Commencer');
  if (continueBtn) continueBtn.textContent = t('Continue', 'Continuer');
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.title = t('Mute/unmute', 'Son actif/coupé');
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.title = t('Switch language', 'Changer de langue');
  const toast = document.getElementById('save-toast');
  if (toast) toast.textContent = t('Saved', 'Enregistré');
}

/* ===================== Init ===================== */

function setupMuteButton() {
  const btn = document.getElementById('mute-btn');
  function refresh() { btn.textContent = AudioEngine.isMuted() ? '🔇' : '🔊'; }
  refresh();
  btn.addEventListener('click', () => { AudioEngine.toggleMute(); refresh(); });
}

function setupLangButton() {
  const btn = document.getElementById('lang-btn');
  function refresh() { btn.textContent = lang === 'fr' ? 'EN' : 'FR'; }
  refresh();
  btn.addEventListener('click', () => {
    lang = lang === 'fr' ? 'en' : 'fr';
    try { localStorage.setItem('dinoIslandLang', lang); } catch (e) {}
    refresh();
    applyChrome();
    renderVerbs();
    renderInventory();
    if (state.currentRoomId) renderRoom();
    if (state.dialogueOpen) renderDialogue();
  });
}

/* One-time DOM wiring — must run exactly once per page load, even though a game can be
   (re)started multiple times via Play Again / New Game. */
function setupOnce() {
  stageEl = document.getElementById('stage');
  roomEl = document.getElementById('room');
  roomBgEl = document.getElementById('room-bg');
  hotspotsEl = document.getElementById('hotspots');
  characterEl = document.getElementById('character');
  charInnerEl = document.getElementById('char-inner');
  textEl = document.getElementById('textline-content');
  verbsEl = document.getElementById('verbs');
  inventoryEl = document.getElementById('inventory');
  fadeEl = document.getElementById('fade');
  dialogueEl = document.getElementById('dialogue-panel');

  roomEl.addEventListener('click', onGroundClick);
  setupHoverDelegation();
  setupMuteButton();
  setupLangButton();
  document.getElementById('textline').addEventListener('click', skipTextReveal);
  applyChrome();
}

function triggerShake() {
  stageEl.classList.add('shake');
  setTimeout(() => stageEl.classList.remove('shake'), 450);
}

/* Non-interactive boat-arrival opening, played once at the start of a brand-new game
   (never on Continue). Not skippable. */
async function playIntro() {
  state.introPlaying = true;
  characterEl.style.visibility = 'hidden';
  renderRoom();
  await sleep(2300);
  characterEl.style.visibility = 'visible';
  state.pos = { x: 100, y: 400 };
  state.facing = 'right';
  updateCharacterPosition();
  await walkTo({ ...ROOMS.dock.entryPoint });
  state.introPlaying = false;
  setText(t("The dock creaks underfoot. Not exactly the tropical paradise the brochure promised.",
            "Le ponton craque sous mes pas. Pas vraiment le paradis tropical promis par la brochure."));
  saveGame();
}

/* Runs every time a game session begins (fresh Start, Continue, or Play Again → Start). */
function startGame(save) {
  if (save) {
    state.currentRoomId = save.currentRoomId;
    state.items = save.items || [];
    state.flags = save.flags || {};
  } else {
    state.currentRoomId = START_ROOM;
  }
  state.pos = { ...ROOMS[state.currentRoomId].entryPoint };

  renderVerbs();
  renderInventory();
  renderRoom();
  updateCharacterPosition();
  AudioEngine.startAmbience(state.currentRoomId);
  AudioEngine.playMusic(state.currentRoomId);

  if (save) {
    setText(t("Right, where was I...", "Bon, où en étais-je..."));
  } else {
    playIntro();
  }
}

function beginGame(save) {
  AudioEngine.init();
  AudioEngine.playMusic('title');
  if (!save) clearSave();
  setTimeout(() => {
    document.getElementById('title-screen').classList.add('hidden');
    startGame(save);
  }, 1100);
}

function initTitleScreen() {
  setupOnce();
  const continueBtn = document.getElementById('btn-continue');
  const startBtn = document.getElementById('btn-start');
  if (loadGame()) {
    continueBtn.classList.remove('hidden');
  }
  applyChrome();
  continueBtn.addEventListener('click', () => beginGame(loadGame()));
  startBtn.addEventListener('click', () => beginGame(null));
}

document.addEventListener('DOMContentLoaded', initTitleScreen);

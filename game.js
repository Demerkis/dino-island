/* ===================== Dino Island — engine ===================== */

const VERB_KEYS = {
  'Open': 'open', 'Close': 'close', 'Pick up': 'pickup', 'Look at': 'look',
  'Talk to': 'talk', 'Push': 'push', 'Pull': 'pull', 'Use': 'use', 'Give': 'give',
};

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
  lastMessage: '',
};

let roomBgEl, hotspotsEl, characterEl, charInnerEl, textEl, verbsEl, inventoryEl, fadeEl, dialogueEl, roomEl, stageEl;

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

function goToRoom(state, roomId) {
  if (state.currentRoomId === roomId) return '';
  fadeEl.classList.add('active');
  setTimeout(() => {
    state.currentRoomId = roomId;
    const room = ROOMS[roomId];
    state.pos = { ...room.entryPoint };
    state.facing = 'right';
    state.selectedVerb = null;
    state.selectedItem = null;
    renderVerbs();
    renderRoom();
    updateCharacterPosition();
    AudioEngine.startAmbience(roomId);
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
  const topics = SCIENTIST_TOPICS.filter(t => t.condition(state));
  dialogueEl.classList.remove('hidden');
  dialogueEl.innerHTML = '';
  topics.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'dlg-topic';
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      AudioEngine.playUIBlip();
      const response = t.respond(state);
      setText(response);
      renderInventory();
      renderDialogue();
      saveGame();
    });
    dialogueEl.appendChild(btn);
  });
  const bye = document.createElement('button');
  bye.className = 'dlg-topic dlg-bye';
  bye.textContent = 'Goodbye.';
  bye.addEventListener('click', () => { AudioEngine.playUIBlip(); closeDialogue(); });
  dialogueEl.appendChild(bye);
}

/* ===================== Rendering ===================== */

let textGen = 0;

function setText(msg) {
  if (!msg) return;
  state.lastMessage = msg;
  const myGen = ++textGen;
  textEl.textContent = '';
  let i = 0;
  function tick() {
    if (myGen !== textGen) return;
    if (i >= msg.length) return;
    textEl.textContent += msg[i];
    i++;
    if (i % 2 === 0) AudioEngine.playTalkBlip();
    setTimeout(tick, 16);
  }
  tick();
}

function showHover(msg) {
  textGen++;
  textEl.textContent = msg;
}

function restoreText() {
  textGen++;
  textEl.textContent = state.lastMessage || ' ';
}

function renderVerbs() {
  verbsEl.innerHTML = '';
  VERBS.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'verb-btn';
    btn.textContent = v;
    btn.dataset.verb = v;
    if (state.selectedVerb === v) btn.classList.add('active');
    btn.addEventListener('click', () => onVerbClick(v));
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
    el.title = item.name;
    el.addEventListener('click', () => onItemClick(itemId));
    inventoryEl.appendChild(el);
    inventoryHoverMap.set(el, item.name);
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
      const verbLabel = state.selectedItem ? `Use ${ITEMS[state.selectedItem].name} with` : (state.selectedVerb || 'Look at');
      el = hotspotEl;
      text = `${verbLabel} ${h.name}`;
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

function onVerbClick(verb) {
  if (state.gameOver) return;
  AudioEngine.playUIBlip();
  state.selectedVerb = (state.selectedVerb === verb) ? null : verb;
  state.selectedItem = null;
  renderVerbs();
  renderInventory();
}

function onItemClick(itemId) {
  if (state.gameOver || state.dialogueOpen) return;

  const verbKey = state.selectedVerb ? VERB_KEYS[state.selectedVerb] : null;

  if (verbKey === 'look') {
    const item = ITEMS[itemId];
    if (item.look === 'READ_NOTE') {
      state.flags.knowsCode = true;
      setText("A hasty scrawl: '7-2-9-4. Don't forget it this time. —M' Huh. Handy.");
      saveGame();
    } else {
      setText(item.look);
    }
    state.selectedVerb = null;
    renderVerbs();
    return;
  }

  if (verbKey === 'give') {
    setText("Give it to... myself? That seems unnecessary.");
    state.selectedVerb = null;
    renderVerbs();
    return;
  }

  if (verbKey && verbKey !== 'use') {
    setText(fallback(verbKey));
    state.selectedVerb = null;
    renderVerbs();
    return;
  }

  // 'use' verb pending, or free item-select for combine
  if (state.selectedItem && state.selectedItem !== itemId) {
    tryCombine(state.selectedItem, itemId);
    return;
  }

  AudioEngine.playUIBlip();
  state.selectedItem = (state.selectedItem === itemId) ? null : itemId;
  state.selectedVerb = null;
  renderVerbs();
  renderInventory();
  if (state.selectedItem) setText(`${ITEMS[state.selectedItem].name}. Use it on something.`);
}

function tryCombine(itemA, itemB) {
  const combo = COMBOS.find(c =>
    (c.pair[0] === itemA && c.pair[1] === itemB) || (c.pair[0] === itemB && c.pair[1] === itemA));
  if (combo) {
    removeItem(state, itemA);
    removeItem(state, itemB);
    addItem(state, combo.result);
    setText(combo.text);
  } else {
    setText("Those two don't go together.");
  }
  state.selectedItem = null;
  state.selectedVerb = null;
  renderVerbs();
  renderInventory();
  saveGame();
}

async function onHotspotClick(hotspot) {
  if (state.busy || state.gameOver || state.dialogueOpen) return;

  const usingItem = state.selectedItem;
  const verb = state.selectedVerb;

  await walkTo(hotspot.interactionPoint);
  if (state.gameOver) return;

  let result;
  if (usingItem) {
    if (VERB_KEYS[verb] === 'give') {
      result = hotspot.actions.give ? hotspot.actions.give(state, usingItem) : fallback('give');
    } else {
      result = hotspot.actions.use ? hotspot.actions.use(state, usingItem) : fallback('use');
    }
  } else if (verb) {
    const key = VERB_KEYS[verb];
    const handler = hotspot.actions[key];
    result = handler ? handler(state, null) : fallback(key);
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
    if (result) setText(result);
    saveGame();
  }
}

function onGroundClick(evt) {
  if (state.busy || state.gameOver || state.dialogueOpen) return;
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
  setText("The power cell locks into place. The console shudders awake.");
  const overlay = document.createElement('div');
  overlay.id = 'ending-overlay';
  overlay.innerHTML = `
    <div class="ending-glow"></div>
    <h1>TO BE CONTINUED...</h1>
    <p>The console screen flickers, and for just a moment, it shows something that shouldn't exist.<br>Something with teeth. Something from a very, very long time ago.</p>
    <button id="btn-play-again" class="title-btn">Play Again</button>
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
  closeDialogue();

  const continueBtn = document.getElementById('btn-continue');
  const startBtn = document.getElementById('btn-start');
  continueBtn.classList.add('hidden');
  startBtn.textContent = 'Start';
  document.getElementById('title-screen').classList.remove('hidden');
}

/* ===================== Save / load ===================== */

const SAVE_KEY = 'dinoIslandSave';

function saveGame() {
  if (state.gameOver) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      currentRoomId: state.currentRoomId,
      items: state.items,
      flags: state.flags,
    }));
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

/* ===================== Init ===================== */

function setupMuteButton() {
  const btn = document.getElementById('mute-btn');
  function refresh() { btn.textContent = AudioEngine.isMuted() ? '🔇' : '🔊'; }
  refresh();
  btn.addEventListener('click', () => { AudioEngine.toggleMute(); refresh(); });
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
  setText(save
    ? "Right, where was I..."
    : "The dock creaks underfoot. Not exactly the tropical paradise the brochure promised.");
}

function beginGame(save) {
  AudioEngine.init();
  if (!save) clearSave();
  document.getElementById('title-screen').classList.add('hidden');
  startGame(save);
}

function initTitleScreen() {
  setupOnce();
  const continueBtn = document.getElementById('btn-continue');
  const startBtn = document.getElementById('btn-start');
  if (loadGame()) {
    continueBtn.classList.remove('hidden');
    startBtn.textContent = 'New Game';
  }
  continueBtn.addEventListener('click', () => beginGame(loadGame()));
  startBtn.addEventListener('click', () => beginGame(null));
}

document.addEventListener('DOMContentLoaded', initTitleScreen);

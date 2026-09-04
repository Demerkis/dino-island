/* ===================== Dino Island — content data ===================== */
/* Loaded as a plain <script> (no fetch/JSON — this runs from file://). */

const ROOM_W = 800;
const ROOM_H = 450;
const START_ROOM = 'dock';

const VERBS = ['Open', 'Close', 'Pick up', 'Look at', 'Talk to', 'Push', 'Pull', 'Use', 'Give'];

/* Generic snarky fallback lines when a hotspot has no specific handler for a verb. */
const DEFAULT_RESPONSES = {
  open: ["It doesn't open. It doesn't even pretend to.", "Nope. Not a door, not a lid, not opening."],
  close: ["It's not open, so... no.", "Already about as closed as it gets."],
  pickup: ["That's not coming with me.", "I'll leave that where it is, thanks."],
  look: ["Nothing special about it.", "Just your average island scenery."],
  talk: ["It's not much of a conversationalist.", "Talking to that would be a very one-sided chat."],
  push: ["It doesn't budge.", "Pushing achieves absolutely nothing."],
  pull: ["It doesn't budge that way either.", "I pull. Nothing happens. Riveting."],
  use: ["I can't think of a use for that.", "That's not really a 'use' kind of object."],
  give: ["I don't think that's a gift anyone wants.", "There's no one here to give that to."],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fallback(verbKey) { return pick(DEFAULT_RESPONSES[verbKey]); }

/* ===================== Items ===================== */

const ITEMS = {
  key: {
    id: 'key', name: 'Brass Key',
    icon: `<svg viewBox="0 0 40 40"><circle cx="14" cy="20" r="8" fill="none" stroke="#e8c15a" stroke-width="4"/><rect x="20" y="17" width="16" height="6" fill="#e8c15a"/><rect x="28" y="23" width="4" height="6" fill="#e8c15a"/><rect x="34" y="23" width="4" height="8" fill="#e8c15a"/></svg>`,
    look: "A small brass key. Slightly warm, like it's been in someone's pocket all day. Because it has.",
  },
  crank: {
    id: 'crank', name: 'Crank Handle',
    icon: `<svg viewBox="0 0 40 40"><rect x="8" y="18" width="24" height="5" rx="2" fill="#8a8f98"/><circle cx="30" cy="12" r="6" fill="none" stroke="#8a8f98" stroke-width="4"/><rect x="6" y="16" width="6" height="9" rx="2" fill="#5b5f66"/></svg>`,
    look: "A hand crank, the kind that powers things too cheap to have a proper battery.",
  },
  battery: {
    id: 'battery', name: 'Old Battery',
    icon: `<svg viewBox="0 0 40 40"><rect x="8" y="12" width="20" height="18" rx="2" fill="#4d8a5a"/><rect x="28" y="17" width="5" height="8" fill="#333"/><text x="18" y="24" font-size="9" fill="#eaffea" text-anchor="middle">+</text></svg>`,
    look: "A chunky old battery. Probably still has a little juice in it. Optimistically.",
  },
  note: {
    id: 'note', name: 'Scrap of Paper',
    icon: `<svg viewBox="0 0 40 40"><rect x="8" y="6" width="24" height="30" fill="#f2e8c9" stroke="#c9b877" stroke-width="1"/><line x1="12" y1="14" x2="28" y2="14" stroke="#8a7d4e" stroke-width="1.5"/><line x1="12" y1="20" x2="28" y2="20" stroke="#8a7d4e" stroke-width="1.5"/><line x1="12" y1="26" x2="22" y2="26" stroke="#8a7d4e" stroke-width="1.5"/></svg>`,
    look: "READ_NOTE",
  },
  powercell: {
    id: 'powercell', name: 'Power Cell',
    icon: `<svg viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" rx="4" fill="#3a6ea5"/><circle cx="20" cy="20" r="7" fill="#bfe4ff"/><circle cx="20" cy="20" r="3" fill="#3a6ea5"/></svg>`,
    look: "The crank and battery, jury-rigged together with more hope than engineering. It hums faintly.",
  },
};

/* Combine rules: order-independent pair of item ids -> result. */
const COMBOS = [
  {
    pair: ['crank', 'battery'],
    result: 'powercell',
    text: "A little creative bodging turns the crank and the battery into something that might actually generate power.",
  },
];

/* ===================== Dialogue: the Scientist ===================== */

const SCIENTIST_TOPICS = [
  {
    id: 'who',
    label: "Who are you, exactly?",
    condition: () => true,
    respond(state) {
      return "\"Dr. Osei. I run this station. Or I did, before the funding dried up and it started running me.\"";
    },
  },
  {
    id: 'place',
    label: "What is this place?",
    condition: () => true,
    respond(state) {
      state.flags.askedAboutPlace = true;
      return "\"Officially, a marine research outpost. Unofficially, I've stopped asking what Command actually wants from here.\"";
    },
  },
  {
    id: 'shed',
    label: "What's in the shed?",
    condition: (state) => !state.flags.hasKey,
    respond(state) {
      state.flags.askedAboutShed = true;
      return "\"Equipment. Old equipment, mostly. It's locked for a reason, and the reason is liability.\"";
    },
  },
  {
    id: 'askKey',
    label: "Can I get the key to the shed?",
    condition: (state) => state.flags.askedAboutShed && !state.flags.hasKey,
    respond(state) {
      state.flags.hasKey = true;
      addItem(state, 'key');
      return "She studies you for a long moment, then tosses you a brass key. \"Fine. Try not to break anything that isn't already broken.\"";
    },
  },
  {
    id: 'gotKey',
    label: "Thanks again for the key.",
    condition: (state) => state.flags.hasKey,
    respond(state) {
      return "\"Just bring it back in one piece. The key, I mean. I've given up on the shed.\"";
    },
  },
];

/* ===================== Rooms ===================== */

const ROOMS = {

  /* ---------------- The Dock ---------------- */
  dock: {
    id: 'dock',
    name: 'The Dock',
    walkableArea: [
      { x: 40, y: 340 }, { x: 760, y: 340 }, { x: 760, y: 420 }, { x: 40, y: 420 },
    ],
    entryPoint: { x: 120, y: 390 },
    background(state) {
      const shedOpen = !!state.flags.shedOpen;
      return `
        <svg viewBox="0 0 ${ROOM_W} ${ROOM_H}" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="skyDock" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#bfe6f7"/>
              <stop offset="100%" stop-color="#eaf7ea"/>
            </linearGradient>
            <linearGradient id="seaDock" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4f9dbf"/>
              <stop offset="100%" stop-color="#2e6f8f"/>
            </linearGradient>
            <linearGradient id="woodDock" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#9c7248"/>
              <stop offset="100%" stop-color="#7a5636"/>
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="${ROOM_W}" height="260" fill="url(#skyDock)"/>
          <circle cx="680" cy="70" r="42" fill="#fff6d8" opacity="0.9"/>
          <rect x="0" y="230" width="${ROOM_W}" height="150" fill="url(#seaDock)"/>
          ${[0,1,2,3,4].map(i => `<path d="M ${20+i*170} 300 q 30 -10 60 0" stroke="#eaf7f7" stroke-width="3" fill="none" opacity="0.5"/>`).join('')}

          <!-- dock planks -->
          <rect x="20" y="330" width="740" height="100" fill="url(#woodDock)"/>
          ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i => `<rect x="${20+i*64}" y="330" width="4" height="100" fill="#5c3f24" opacity="0.5"/>`).join('')}
          <rect x="20" y="330" width="740" height="6" fill="#c79a63"/>

          <!-- boat -->
          <g transform="translate(60,300)">
            <path d="M0 40 Q40 60 100 40 L90 20 L10 20 Z" fill="#7a3b2e"/>
            <rect x="35" y="-10" width="6" height="32" fill="#4a2c1c"/>
            <path d="M41 -8 L70 6 L41 14 Z" fill="#e8ddc7"/>
          </g>

          <!-- shed -->
          <g transform="translate(600,220)">
            <rect x="0" y="30" width="140" height="100" fill="#7d6a52"/>
            <polygon points="-10,30 150,30 70,-20" fill="#5a4a37"/>
            ${shedOpen
              ? `<rect x="50" y="60" width="50" height="70" fill="#1c1712"/>`
              : `<rect x="50" y="60" width="50" height="70" fill="#4a3a28" stroke="#2c2216" stroke-width="3"/>
                 <circle cx="90" cy="96" r="3" fill="#e8c15a"/>`}
          </g>

          <!-- crate -->
          <g transform="translate(340,360)">
            <rect x="0" y="0" width="60" height="46" fill="#a9824f" stroke="#6b4e2c" stroke-width="3"/>
            <line x1="0" y1="0" x2="60" y2="46" stroke="#6b4e2c" stroke-width="2"/>
            <line x1="60" y1="0" x2="0" y2="46" stroke="#6b4e2c" stroke-width="2"/>
          </g>

          <!-- seagull -->
          <path d="M 430 90 Q 445 78 460 90 Q 445 84 430 90" stroke="#555" stroke-width="3" fill="none"/>

          ${!state.items.includes('crank') && shedOpen ? `
          <g transform="translate(665,270)">
            <rect x="0" y="0" width="20" height="4" rx="2" fill="#8a8f98"/>
            <circle cx="18" cy="-4" r="5" fill="none" stroke="#8a8f98" stroke-width="3"/>
          </g>` : ''}
        </svg>
      `;
    },
    hotspots: [
      {
        id: 'crate', name: 'Crate', rect: { x: 330, y: 350, w: 80, h: 60 },
        interactionPoint: { x: 340, y: 400 },
        actions: {
          look: () => "A wooden crate. Stamped 'FRAGILE' in three languages and one crayon.",
          open: () => "Just packing peanuts and quiet regret. Someone ordered a lot of packing peanuts.",
          push: () => "It scrapes an inch and you decide that's good enough.",
          pull: () => "It scrapes back the same inch. Riveting stuff.",
        },
      },
      {
        id: 'boat', name: 'Boat', rect: { x: 50, y: 280, w: 140, h: 80 },
        interactionPoint: { x: 150, y: 360 },
        actions: {
          look: () => "A small motorboat, tied up and going nowhere fast. The engine looks like it gave up years ago.",
          use: () => "Without fuel or a working engine, this thing isn't taking me anywhere.",
          pull: () => "The rope holds firm. The boat, less enthusiastically.",
        },
      },
      {
        id: 'shed', name: 'Shed Door', rect: { x: 630, y: 280, w: 60, h: 80 },
        interactionPoint: { x: 640, y: 400 },
        actions: {
          look: (state) => state.flags.shedOpen ? "The shed door hangs open, dark inside." : "A padlocked shed door. Someone really doesn't want visitors.",
          open: (state) => {
            if (state.flags.shedOpen) return "It's already open.";
            if (!state.flags.hasKey) return "Locked tight. I'd need a key.";
            state.flags.shedOpen = true;
            return "The brass key turns with a satisfying clunk. The shed's open.";
          },
          close: (state) => {
            if (!state.flags.shedOpen) return "It's already closed.";
            state.flags.shedOpen = false;
            return "I close the shed door. Old habits.";
          },
          pull: () => "It's locked. Pulling harder doesn't count as a strategy.",
        },
      },
      {
        id: 'crank', name: 'Crank Handle', rect: { x: 655, y: 260, w: 40, h: 30 },
        interactionPoint: { x: 660, y: 350 },
        visible: (state) => state.flags.shedOpen && !state.items.includes('crank'),
        actions: {
          look: () => "A hand crank, propped in the corner of the shed.",
          pickup: (state) => { addItem(state, 'crank'); return "I grab the crank handle. Never know when hand-cranked power will save the day."; },
        },
      },
      {
        id: 'toInterior', name: 'Path to the Station', rect: { x: 730, y: 340, w: 60, h: 90 },
        interactionPoint: { x: 745, y: 400 },
        actions: {
          look: () => "A gravel path leads up to the station building.",
          use: (state) => goToRoom(state, 'interior'),
          open: (state) => goToRoom(state, 'interior'),
        },
      },
    ],
  },

  /* ---------------- Station Interior ---------------- */
  interior: {
    id: 'interior',
    name: 'Station Interior',
    walkableArea: [
      { x: 40, y: 330 }, { x: 760, y: 330 }, { x: 760, y: 420 }, { x: 40, y: 420 },
    ],
    entryPoint: { x: 700, y: 390 },
    background(state) {
      const cabOpen = !!state.flags.cabinetOpen;
      return `
        <svg viewBox="0 0 ${ROOM_W} ${ROOM_H}" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wallInt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e7d9b8"/>
              <stop offset="100%" stop-color="#cdbb92"/>
            </linearGradient>
            <linearGradient id="floorInt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#8a6a45"/>
              <stop offset="100%" stop-color="#6b4f30"/>
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="${ROOM_W}" height="330" fill="url(#wallInt)"/>
          <rect x="0" y="330" width="${ROOM_W}" height="120" fill="url(#floorInt)"/>
          ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i => `<rect x="${i*68}" y="330" width="3" height="120" fill="#4a3520" opacity="0.5"/>`).join('')}

          <!-- window -->
          <rect x="580" y="60" width="150" height="110" fill="#bfe6f7" stroke="#5a4a37" stroke-width="8"/>
          <line x1="655" y1="60" x2="655" y2="170" stroke="#5a4a37" stroke-width="6"/>
          <line x1="580" y1="115" x2="730" y2="115" stroke="#5a4a37" stroke-width="6"/>
          <circle cx="700" cy="90" r="16" fill="#fff6d8" opacity="0.85"/>

          <!-- desk -->
          <g transform="translate(60,270)">
            <rect x="0" y="30" width="150" height="12" fill="#5a4028"/>
            <rect x="6" y="42" width="12" height="60" fill="#4a3320"/>
            <rect x="132" y="42" width="12" height="60" fill="#4a3320"/>
            <rect x="20" y="10" width="60" height="20" fill="#f2e8c9" stroke="#c9b877" stroke-width="1"/>
          </g>

          <!-- cabinet -->
          <g transform="translate(420,240)">
            <rect x="0" y="0" width="90" height="120" fill="#7d6a52" stroke="#4a3320" stroke-width="3"/>
            ${cabOpen
              ? `<rect x="6" y="6" width="78" height="108" fill="#241c12"/>`
              : `<line x1="45" y1="0" x2="45" y2="120" stroke="#4a3320" stroke-width="3"/>
                 <circle cx="52" cy="60" r="3" fill="#e8c15a"/>
                 <circle cx="38" cy="60" r="3" fill="#e8c15a"/>`}
          </g>

          <!-- scientist -->
          <g transform="translate(270,300)">
            <ellipse cx="20" cy="118" rx="26" ry="8" fill="#000" opacity="0.15"/>
            <rect x="4" y="60" width="32" height="55" rx="8" fill="#e3ddd2"/>
            <circle cx="20" cy="40" r="18" fill="#c99a72"/>
            <path d="M2 36 Q20 8 38 36 Q38 20 20 18 Q2 20 2 36" fill="#3a3a3a"/>
            <rect x="0" y="60" width="10" height="40" fill="#e3ddd2"/>
            <rect x="30" y="60" width="10" height="40" fill="#e3ddd2"/>
            <rect x="6" y="112" width="10" height="18" fill="#3a3a3a"/>
            <rect x="24" y="112" width="10" height="18" fill="#3a3a3a"/>
          </g>
        </svg>
      `;
    },
    hotspots: [
      {
        id: 'scientist', name: 'Dr. Osei', rect: { x: 265, y: 300, w: 60, h: 120 }, isNpc: true,
        interactionPoint: { x: 330, y: 400 },
        actions: {
          look: () => "Dr. Osei. She has the exact expression of someone who has answered too many questions today.",
          talk: (state) => openDialogue(state),
          push: () => "She raises an eyebrow. I decide against a repeat performance.",
          give: (state, itemId) => {
            if (itemId === 'note') return "\"That's your note. I have plenty of my own, thanks.\"";
            return "\"I don't want that. Nice try, though.\"";
          },
        },
      },
      {
        id: 'cabinet', name: 'Cabinet', rect: { x: 415, y: 230, w: 100, h: 130 },
        interactionPoint: { x: 460, y: 390 },
        actions: {
          look: (state) => state.flags.cabinetOpen ? "The cabinet stands open and thoroughly looted. By me." : "A locked storage cabinet. Standard-issue and stubborn.",
          open: (state) => {
            if (state.flags.cabinetOpen) return "It's already open.";
            if (!state.flags.hasKey) return "Locked. This place really loves its locks.";
            state.flags.cabinetOpen = true;
            let msg = "The key works here too. Inside: an old battery and a scrap of paper.";
            if (!state.items.includes('battery')) addItem(state, 'battery');
            if (!state.items.includes('note')) addItem(state, 'note');
            return msg;
          },
          close: (state) => {
            if (!state.flags.cabinetOpen) return "It's already closed.";
            state.flags.cabinetOpen = false;
            return "I swing the cabinet shut.";
          },
        },
      },
      {
        id: 'desk', name: 'Desk', rect: { x: 60, y: 260, w: 150, h: 60 },
        interactionPoint: { x: 130, y: 390 },
        actions: {
          look: () => "A cluttered desk covered in charts of the surrounding waters. And coffee rings. Mostly coffee rings.",
        },
      },
      {
        id: 'window', name: 'Window', rect: { x: 580, y: 60, w: 150, h: 110 },
        interactionPoint: { x: 655, y: 390 },
        actions: {
          look: () => "Through the window: open ocean, and somewhere past the horizon, a lot of unanswered questions.",
        },
      },
      {
        id: 'toDock', name: 'Door to the Dock', rect: { x: 730, y: 330, w: 60, h: 90 },
        interactionPoint: { x: 745, y: 400 },
        actions: {
          look: () => "The gravel path back down to the dock.",
          use: (state) => goToRoom(state, 'dock'),
          open: (state) => goToRoom(state, 'dock'),
        },
      },
      {
        id: 'bunkerDoor', name: 'Bunker Hatch', rect: { x: 20, y: 340, w: 40, h: 80 },
        interactionPoint: { x: 55, y: 400 },
        actions: {
          look: (state) => state.flags.knowsCode ? "A reinforced hatch with a keypad. I know the code now." : "A reinforced hatch with a keypad. It's not opening without a code.",
          open: (state) => {
            if (!state.flags.knowsCode) return "There's a keypad here, but I don't know the code. Yet.";
            return goToRoom(state, 'bunker');
          },
        },
      },
    ],
  },

  /* ---------------- Cliffside Bunker ---------------- */
  bunker: {
    id: 'bunker',
    name: 'Cliffside Bunker',
    walkableArea: [
      { x: 60, y: 330 }, { x: 740, y: 330 }, { x: 740, y: 420 }, { x: 60, y: 420 },
    ],
    entryPoint: { x: 100, y: 390 },
    background(state) {
      const powered = !!state.flags.consolePowered;
      return `
        <svg viewBox="0 0 ${ROOM_W} ${ROOM_H}" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wallBnk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#26343a"/>
              <stop offset="100%" stop-color="#16201f"/>
            </linearGradient>
            <linearGradient id="floorBnk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2b2b2b"/>
              <stop offset="100%" stop-color="#181818"/>
            </linearGradient>
            <radialGradient id="glowBnk" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${powered ? '#8fffe0' : '#3a5a55'}" stop-opacity="0.9"/>
              <stop offset="100%" stop-color="${powered ? '#8fffe0' : '#3a5a55'}" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="${ROOM_W}" height="330" fill="url(#wallBnk)"/>
          <rect x="0" y="330" width="${ROOM_W}" height="120" fill="url(#floorBnk)"/>

          <!-- rock cracks -->
          <path d="M0 0 L60 120 L20 200" stroke="#0d1414" stroke-width="4" fill="none" opacity="0.6"/>
          <path d="M800 40 L740 140 L780 260" stroke="#0d1414" stroke-width="4" fill="none" opacity="0.6"/>

          <!-- console -->
          <g transform="translate(330,220)">
            <ellipse cx="70" cy="215" rx="140" ry="30" fill="url(#glowBnk)"/>
            <rect x="0" y="60" width="140" height="90" fill="#3a4650" stroke="#20282e" stroke-width="4"/>
            <rect x="10" y="20" width="120" height="50" fill="#20282e" stroke="#10161a" stroke-width="3"/>
            ${powered
              ? `<circle cx="35" cy="45" r="6" fill="#8fffe0"><animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite"/></circle>
                 <circle cx="70" cy="45" r="6" fill="#8fe0ff"><animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite"/></circle>
                 <circle cx="105" cy="45" r="6" fill="#c9ff8f"><animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite"/></circle>`
              : `<circle cx="35" cy="45" r="6" fill="#2c3a38"/>
                 <circle cx="70" cy="45" r="6" fill="#2c3a38"/>
                 <circle cx="105" cy="45" r="6" fill="#2c3a38"/>`}
            <rect x="20" y="85" width="30" height="20" fill="${powered ? '#8fffe0' : '#232323'}" opacity="0.8"/>
            <circle cx="110" cy="95" r="14" fill="${powered ? '#c9ff8f' : '#232323'}" opacity="0.8"/>
          </g>
        </svg>
      `;
    },
    hotspots: [
      {
        id: 'console', name: 'Console', rect: { x: 330, y: 250, w: 140, h: 100 },
        interactionPoint: { x: 400, y: 390 },
        actions: {
          look: (state) => state.flags.consolePowered
            ? "The console hums with a low, steady power. Whatever this thing does, it's ready to do it."
            : "A dusty console, missing something. There's an obvious empty socket where a power source should go.",
          use: (state, itemId) => {
            if (state.flags.consolePowered) return "It's already running. Best not to poke it further.";
            if (itemId === 'powercell') {
              state.flags.consolePowered = true;
              removeItem(state, 'powercell');
              return "ENDING";
            }
            if (itemId) return "That doesn't fit the socket. Close, but no.";
            return "It needs power. An empty socket stares back at me expectantly.";
          },
        },
      },
      {
        id: 'toInteriorFromBunker', name: 'Hatch', rect: { x: 20, y: 340, w: 50, h: 80 },
        interactionPoint: { x: 60, y: 400 },
        actions: {
          look: () => "The hatch back up to the station.",
          use: (state) => goToRoom(state, 'interior'),
          open: (state) => goToRoom(state, 'interior'),
        },
      },
    ],
  },
};

/* ===================== State helper functions (used by data above) ===================== */
/* Implemented in game.js — declared here via reference only (loaded after data.js). */

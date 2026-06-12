const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const blankEl = { textContent: "", innerHTML: "", disabled: false, appendChild() {} };
const $ = id => document.getElementById(id) || blankEl;

const ui = {
  wave: $("wave"),
  gold: $("gold"),
  lives: $("lives"),
  countdown: $("countdown"),
  slotCost: $("slotCost"),
  playerGold: $("playerGold"),
  spinBtn: $("spinBtn"),
  mergeBtn: $("mergeBtn"),
  reels: [...document.querySelectorAll(".reel")],
  inventory: $("inventory"),
  bagCount: $("bagCount"),
  towerPool: $("towerPool"),
  toast: $("toast"),
};

const TILE = 64;
const COLS = 15;
const ROWS = 10;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const SIDE_W = 360;
const MAX_BAG = 30;
const SLOT_COST = 15;
const START_GOLD = 50;
const START_LIVES = 20;
const WAVE_COUNTDOWN = 10;
const MAX_LEVEL = 5;
const ENEMY_BALANCE_MULT = .8;

function levelDamage(level) {
  return 1 + (level - 1) * .7;
}

function makeRoute() {
  for (let attempt = 0; attempt < 160; attempt++) {
    const startFromLeft = Math.random() < .65;
    let c = startFromLeft ? 0 : Math.floor(rand(1, COLS * .35));
    let r = startFromLeft ? Math.floor(rand(1, ROWS - 2)) : 0;
    const path = [{ c, r }];
    const seen = new Set([cellKey(c, r)]);
    let guard = 0;

    while (guard++ < 90 && c < COLS - 1 && r < ROWS - 1) {
      const moves = [];
      if (c < COLS - 1) moves.push({ dc: 1, dr: 0, weight: 4 });
      if (r < ROWS - 1) moves.push({ dc: 0, dr: 1, weight: 2.4 });
      if (r > 1) moves.push({ dc: 0, dr: -1, weight: .9 });
      if (c > 1 && path.length > 18) moves.push({ dc: -1, dr: 0, weight: .45 });

      const move = weightedMove(moves);
      const nc = c + move.dc;
      const nr = r + move.dr;
      const key = cellKey(nc, nr);
      if (seen.has(key)) continue;
      c = nc;
      r = nr;
      seen.add(key);
      path.push({ c, r });
      if (path.length >= 24 && (c === COLS - 1 || r === ROWS - 1)) break;
    }

    if (path.length >= 24 && path.length <= 35 && (c === COLS - 1 || r === ROWS - 1)) {
      return path.map(p => ({ ...p, x: p.c * TILE + TILE / 2, y: p.r * TILE + TILE / 2 }));
    }
  }
  return [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [6, 5],
    [6, 6], [6, 7], [7, 7], [8, 7], [8, 6], [9, 6], [10, 6], [10, 5],
    [10, 4], [11, 4], [12, 4], [12, 5], [13, 5], [14, 5],
  ].map(([cc, rr]) => ({ c: cc, r: rr, x: cc * TILE + TILE / 2, y: rr * TILE + TILE / 2 }));
}

function weightedMove(moves) {
  const total = moves.reduce((sum, move) => sum + move.weight, 0);
  let pickValue = Math.random() * total;
  for (const move of moves) {
    pickValue -= move.weight;
    if (pickValue <= 0) return move;
  }
  return moves[0];
}

const towers = {
  arrow: { name: "箭樓", mark: "箭", color: "#3d8bd9", unlock: 1, damage: 1, rate: 1, splash: 0, range: 3, note: "單體攻擊", sprite: "tower-lv1" },
  stone: { name: "投石塔", mark: "石", color: "#8a7058", unlock: 1, damage: 1, rate: .8, splash: 2, range: 3, note: "目標周圍 2 格", sprite: "tower-lv2" },
  ice: { name: "冰塔", mark: "冰", color: "#67c7ef", unlock: 2, damage: .5, rate: .6, splash: 4, range: 2, note: "緩速 2 秒", sprite: "tower-lv3" },
  poison: { name: "毒素塔", mark: "毒", color: "#55a84f", unlock: 3, damage: .8, rate: 1, splash: 0, range: 3, note: "三發毒彈", sprite: "tower-lv4" },
  fire: { name: "火焰塔", mark: "火", color: "#e56b35", unlock: 4, damage: 1.7, rate: 1.725, splash: 2, range: 1.1, note: "近距 2 格範圍", sprite: "tower-lv5" },
  laser: { name: "雷射塔", mark: "雷", color: "#b04be3", unlock: 5, damage: 2, rate: 8, splash: 0, range: 2.5, note: "高速鎖定", sprite: "tower-lv6" },
};

const slotTables = {
  1: { arrow: 55, stone: 45 },
  2: { arrow: 40, stone: 35, ice: 25 },
  3: { arrow: 32, stone: 30, ice: 20, poison: 18 },
  4: { arrow: 28, stone: 27, ice: 20, poison: 15, fire: 10 },
  5: { arrow: 25, stone: 25, ice: 18, poison: 15, fire: 10, laser: 7 },
};

const enemies = {
  goblin: { name: "新7小兵", color: "#75ba61", hp: 14, speed: 1.7, reward: 2, leak: 1, sprite: "mascot-7.png" },
  skeleton: { name: "星寶士兵", color: "#efe6d2", hp: 22, speed: 1.3, reward: 3, leak: 1, sprite: "mascot-star.png" },
  boar: { name: "新豬快攻", color: "#b56b42", hp: 20, speed: 2.1, reward: 3, leak: 1, sprite: "mascot-pig.png" },
  troll: { name: "新栗壯壯", color: "#8f75bd", hp: 63, speed: .8, reward: 6, leak: 2, sprite: "mascot-chestnut.png" },
  knight: { name: "新橘騎士", color: "#465168", hp: 98, speed: 1.1, reward: 8, leak: 3, sprite: "mascot-orange.png" },
  boss: { name: "新菟編 Boss", color: "#d9516a", hp: 350, speed: .7, reward: 25, leak: 10, sprite: "mascot-rabbit.png", boss: true },
  finalBoss: { name: "新橘栗 Final Boss", color: "#d9516a", hp: 1120, speed: .65, reward: 50, leak: 10, sprite: "mascot-orange-chestnut.png", boss: true },
};

const sprites = {};
for (const file of ["mascot-7.png", "mascot-star.png", "mascot-pig.png", "mascot-chestnut.png", "mascot-orange.png", "mascot-rabbit.png", "mascot-orange-chestnut.png"]) {
  const img = new Image();
  img.src = `assets/${file}`;
  sprites[file] = img;
}

const bgSprites = [];
for (const file of ["bg-1.png", "bgt-2.png", "bg-3.png"]) {
  const img = new Image();
  img.src = `assets/bg/${file}`;
  bgSprites.push(img);
}

const towerSprites = {};
for (const base of ["tower-lv1", "tower-lv2", "tower-lv3", "tower-lv4", "tower-lv5", "tower-lv6"]) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const img = new Image();
    img.src = `assets/tower/${base}.${ext}`;
    towerSprites[`${base}.${ext}`] = img;
  }
}

function towerImage(def) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const img = towerSprites[`${def.sprite}.${ext}`];
    if (img && img.complete && img.naturalWidth > 0) return img;
  }
  return null;
}

function towerIconPath(def) {
  return `assets/tower-icon/${def.sprite}-icon.png`;
}

function drawImageContain(img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageCover(img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

const waves = [
  null,
  { count: 12, hp: 1.0, pool: ["goblin"] },
  { count: 16, hp: 1.2, pool: ["goblin", "skeleton"] },
  { count: 20, hp: 1.5, pool: ["goblin", "skeleton", "boar"] },
  { count: 24, hp: 1.8, pool: ["skeleton", "boar", "troll"] },
  { count: 28, hp: 2.2, pool: ["goblin", "skeleton", "boar", "troll"], bossAt: "last", bossHp: .6 },
  { count: 32, hp: 2.7, pool: ["skeleton", "boar", "troll", "knight"] },
  { count: 36, hp: 3.3, pool: ["goblin", "boar", "troll", "knight"] },
  { count: 42, hp: 4.0, pool: ["skeleton", "troll", "knight"], bossAt: "middle", bossHp: .8 },
  { count: 48, hp: 5.0, pool: ["goblin", "skeleton", "boar", "boar", "boar", "troll", "knight"] },
  { count: 55, hp: 6.2, pool: ["goblin", "skeleton", "boar", "troll", "knight"], bossAt: "last", finalBoss: true },
];

const state = {
  wave: 1,
  gold: START_GOLD,
  lives: START_LIVES,
  countdown: WAVE_COUNTDOWN,
  phase: "countdown",
  bag: Array(MAX_BAG).fill(null),
  towers: [],
  mobs: [],
  shots: [],
  fx: [],
  numbers: [],
  jackpot: null,
  spinning: false,
  spawnIndex: 0,
  spawnTimer: 0,
  selectedBag: null,
  selectedTower: null,
  route: [],
  routeSet: new Set(),
  bg: null,
  camera: { x: 0, y: 0, zoom: 1 },
  pointer: { down: false, dragging: false, x: 0, y: 0, startX: 0, startY: 0 },
  id: 1,
  last: performance.now(),
  audio: null,
  toastTimer: 0,
};

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.dpr = dpr;
  const sideWidth = w > 760 ? SIDE_W : 0;
  const playW = Math.max(420, w - sideWidth);
  state.camera.zoom = Math.min(playW / WORLD_W, h / WORLD_H) * .94;
  state.camera.x = (playW / state.camera.zoom - WORLD_W) / 2;
  state.camera.y = (h / state.camera.zoom - WORLD_H) / 2;
  state.camera.ready = true;
}

function screenSize() {
  return { w: canvas.width / (state.dpr || 1), h: canvas.height / (state.dpr || 1) };
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / state.camera.zoom - state.camera.x,
    y: (clientY - rect.top) / state.camera.zoom - state.camera.y,
  };
}

function applyCamera() {
  const dpr = state.dpr || 1;
  ctx.setTransform(dpr * state.camera.zoom, 0, 0, dpr * state.camera.zoom, dpr * state.camera.x * state.camera.zoom, dpr * state.camera.y * state.camera.zoom);
}

function resetTransform() {
  const dpr = state.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setNewRoute() {
  state.route = makeRoute();
  state.routeSet = new Set(state.route.map(p => cellKey(p.c, p.r)));
}

function pickBackground() {
  state.bg = pick(bgSprites);
}

function restartGame() {
  state.wave = 1;
  state.gold = START_GOLD;
  state.lives = START_LIVES;
  state.countdown = WAVE_COUNTDOWN;
  state.phase = "countdown";
  state.bag = Array(MAX_BAG).fill(null);
  state.towers = [];
  state.mobs = [];
  state.shots = [];
  state.fx = [];
  state.numbers = [];
  state.jackpot = null;
  state.spawnIndex = 0;
  state.spawnTimer = 0;
  state.selectedBag = null;
  state.selectedTower = null;
  pickBackground();
  setNewRoute();
  renderBag();
  toast("新路線已生成，第 1 關倒數開始");
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function cellKey(c, r) {
  return `${c},${r}`;
}

function getSlotTable() {
  return slotTables[Math.min(state.wave, 5)];
}

function currentSlotCost() {
  return Math.round((15 * (1.2 ** (state.wave - 1))) / 5) * 5;
}

function unlockedTowerIds() {
  return Object.keys(getSlotTable());
}

function rollTower() {
  const table = getSlotTable();
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [id, weight] of Object.entries(table)) {
    r -= weight;
    if (r <= 0) return id;
  }
  return Object.keys(table)[0];
}

function emptySlots() {
  return state.bag.filter(item => !item).length;
}

function addBagItem(id, level = 1) {
  const index = state.bag.findIndex(item => !item);
  if (index < 0) return false;
  state.bag[index] = { id, level };
  return true;
}

function ensureAudio() {
  if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio.state === "suspended") state.audio.resume();
}

function sound(type) {
  if (!state.audio) return;
  const now = state.audio.currentTime;
  const playTone = (freq, start, len, wave = "sine", volume = .055) => {
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.frequency.setValueAtTime(freq, start);
    osc.type = wave;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + len);
    osc.connect(gain);
    gain.connect(state.audio.destination);
    osc.start(start);
    osc.stop(start + len);
  };
  const tones = {
    spin: [420, .08],
    place: [620, .07],
    merge: [780, .11],
    hit: [260, .035],
    wave: [520, .12],
    sell: [330, .08],
    jackpot: [980, .18],
    rare: [1240, .24],
    tick: [360, .035],
    stop: [560, .06],
  };
  const [freq, len] = tones[type] || tones.hit;
  if (type === "jackpot" || type === "rare") {
    const seq = type === "rare" ? [740, 980, 1240, 1480] : [620, 820, 1040];
    seq.forEach((tone, i) => playTone(tone, now + i * .055, len, "triangle", .075));
    return;
  }
  playTone(freq, now, len, type === "hit" ? "square" : "sine");
}

function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1900);
}

function jackpot(id, level) {
  const rare = id === "laser";
  const text = rare ? "超稀有三連！獲得 LV3 雷射塔！" : "三連！獲得 LV2 塔樓！";
  state.jackpot = {
    text,
    color: rare ? "#d98cff" : "#ffd166",
    life: 1.55,
    max: 1.55,
  };
  ui.reels.forEach(reel => reel.classList.add(rare ? "rare-win" : "jackpot-win"));
  setTimeout(() => ui.reels.forEach(reel => reel.classList.remove("rare-win", "jackpot-win")), 900);
  sound(rare ? "rare" : "jackpot");
  toast(text);
  for (let i = 0; i < 42; i++) burst(rand(130, WORLD_W - 130), rand(80, 250), rare ? "#d98cff" : "#ffd166", 1);
}

function updateUI() {
  ui.wave.textContent = state.wave;
  ui.gold.textContent = state.gold;
  ui.lives.textContent = state.lives;
  ui.countdown.textContent = state.phase === "countdown" ? Math.ceil(state.countdown) : "戰鬥";
  ui.slotCost.textContent = `${currentSlotCost()} 金 / 次`;
  ui.playerGold.textContent = `${state.gold} 金`;
  ui.spinBtn.disabled = state.phase === "won" || state.phase === "lost";
  ui.bagCount.textContent = `${MAX_BAG - emptySlots()} / ${MAX_BAG}`;
  renderPool();
}

function renderPool() {
  ui.towerPool.innerHTML = "";
  for (const id of unlockedTowerIds()) {
    const t = towers[id];
    const row = document.createElement("div");
    row.className = "tower-row";
    const imagePath = towerIconPath(t);
    row.innerHTML = `
      <div class="mini" style="background:${t.color}"><img src="${imagePath}" onerror="this.remove(); this.parentElement.textContent='${t.mark}'" alt=""></div>
      <div><strong>${t.name}</strong><small>攻 ${t.damage} / 速 ${t.rate} / 擴 ${t.splash} / 程 ${t.range} / LV5攻x${levelDamage(MAX_LEVEL).toFixed(1)}</small></div>
      <small>${getSlotTable()[id]}%</small>
    `;
    ui.towerPool.appendChild(row);
  }
}

function renderBag() {
  ui.inventory.innerHTML = "";
  state.bag.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = `cell${item ? " filled" : ""}`;
    cell.dataset.index = index;
    if (item) {
      const t = towers[item.id];
      cell.draggable = true;
      cell.title = `${t.name} LV${item.level}`;
      cell.innerHTML = `<div class="icon" style="background:${t.color}"><img src="${towerIconPath(t)}" onerror="this.remove(); this.parentElement.textContent='${t.mark}'" alt=""></div><div class="lv">LV${item.level}</div>`;
    }
    ui.inventory.appendChild(cell);
  });
  updateUI();
}

function spin() {
  ensureAudio();
  if (state.spinning) return;
  const cost = currentSlotCost();
  if (emptySlots() < 1) return toast("道具欄已滿");
  if (state.gold < cost) return toast("金幣不足");
  const result = [rollTower(), rollTower(), rollTower()];
  const tripleId = result.every(id => id === result[0]) ? result[0] : null;
  const neededSlots = tripleId ? 1 : 3;
  if (emptySlots() < neededSlots) return toast("道具欄已滿");
  state.gold -= cost;
  state.spinning = true;
  animateSlot(result, () => {
    if (tripleId) {
      const rewardLevel = tripleId === "laser" ? 3 : 2;
      addBagItem(tripleId, rewardLevel);
      jackpot(tripleId, rewardLevel);
    } else {
      result.forEach(id => addBagItem(id));
      sound("spin");
    }
    state.spinning = false;
    renderBag();
  });
  updateUI();
}

function animateSlot(result, done) {
  const ids = unlockedTowerIds();
  let stopped = 0;
  ui.reels.forEach((reel, reelIndex) => {
    reel.classList.add("spin");
    let ticks = 0;
    const maxTicks = 12 + reelIndex * 8;
    const timer = setInterval(() => {
      const id = ticks >= maxTicks ? result[reelIndex] : pick(ids);
      const t = towers[id];
      reel.innerHTML = `<img src="${towerIconPath(t)}" onerror="this.remove(); this.parentElement.textContent='${t.mark}'" alt="">`;
      reel.style.background = t.color;
      reel.style.color = "#fff";
      sound(ticks >= maxTicks ? "stop" : "tick");
      ticks += 1;
      if (ticks > maxTicks) {
        clearInterval(timer);
        reel.classList.remove("spin");
        stopped += 1;
        if (stopped === ui.reels.length) done();
      }
    }, 52 + reelIndex * 10);
  });
}

function autoMerge() {
  ensureAudio();
  let changed = false;
  let mergedOnce = false;
  do {
    changed = false;
    for (let i = 0; i < state.bag.length; i++) {
      const a = state.bag[i];
      if (!a || a.level >= MAX_LEVEL) continue;
      const j = state.bag.findIndex((b, idx) => idx > i && b && b.id === a.id && b.level === a.level);
      if (j >= 0) {
        state.bag[i] = { id: a.id, level: a.level + 1 };
        state.bag[j] = null;
        changed = true;
        mergedOnce = true;
      }
    }
  } while (changed);
  compactBag();
  renderBag();
  if (mergedOnce) {
    sound("merge");
    toast("一鍵合成完成");
  } else {
    toast("沒有可合成的塔");
  }
}

function compactBag() {
  const items = state.bag.filter(Boolean);
  state.bag = [...items, ...Array(MAX_BAG - items.length).fill(null)];
}

function inventoryIndex(e) {
  const cell = e.target.closest(".cell");
  return cell ? Number(cell.dataset.index) : null;
}

ui.inventory.addEventListener("click", e => {
  const index = inventoryIndex(e);
  if (index === null || !state.bag[index]) return;
  state.selectedBag = index;
  state.selectedTower = null;
  updateUI();
  toast(`選取 ${towers[state.bag[index].id].name}，點地圖空格放置`);
});

ui.inventory.addEventListener("dragstart", e => {
  const index = inventoryIndex(e);
  if (index === null || !state.bag[index]) return;
  e.dataTransfer.setData("text/plain", String(index));
});

ui.inventory.addEventListener("dragover", e => {
  const index = inventoryIndex(e);
  if (index === null) return;
  e.preventDefault();
  e.target.closest(".cell").classList.add("drag-over");
});

ui.inventory.addEventListener("dragleave", e => {
  const cell = e.target.closest(".cell");
  if (cell) cell.classList.remove("drag-over");
});

ui.inventory.addEventListener("drop", e => {
  e.preventDefault();
  const to = inventoryIndex(e);
  const from = Number(e.dataTransfer.getData("text/plain"));
  [...ui.inventory.children].forEach(cell => cell.classList.remove("drag-over"));
  if (to === null || Number.isNaN(from) || from === to) return;
  const a = state.bag[from];
  const b = state.bag[to];
  if (!a) return;
  if (!b) {
    state.bag[to] = a;
    state.bag[from] = null;
  } else if (a.id === b.id && a.level === b.level && b.level < MAX_LEVEL) {
    state.bag[to] = { id: b.id, level: b.level + 1 };
    state.bag[from] = null;
    ensureAudio();
    sound("merge");
    toast(`${towers[b.id].name} 合成 LV${b.level + 1}`);
  } else {
    toast(`只能合成同塔同 LV，最高 LV${MAX_LEVEL}`);
  }
  compactBag();
  renderBag();
});

canvas.addEventListener("dragover", e => e.preventDefault());

canvas.addEventListener("drop", e => {
  e.preventDefault();
  const index = Number(e.dataTransfer.getData("text/plain"));
  const p = screenToWorld(e.clientX, e.clientY);
  buildTower(index, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
});

canvas.addEventListener("wheel", e => e.preventDefault(), { passive: false });

canvas.addEventListener("click", e => {
  ensureAudio();
  if (tryRestartButton(e.clientX, e.clientY)) return;
  const p = screenToWorld(e.clientX, e.clientY);
  if (trySellButton(p.x, p.y)) return;
  const c = Math.floor(p.x / TILE);
  const r = Math.floor(p.y / TILE);
  const towerIndex = state.towers.findIndex(t => t.c === c && t.r === r);
  if (towerIndex >= 0) {
    state.selectedTower = towerIndex;
    state.selectedBag = null;
    updateUI();
    return;
  }
  if (state.selectedBag !== null) buildTower(state.selectedBag, c, r);
  else {
    state.selectedTower = null;
    updateUI();
  }
});

function buildTower(index, c, r) {
  const item = state.bag[index];
  if (!item) return;
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const existingIndex = state.towers.findIndex(t => t.c === c && t.r === r);
  if (existingIndex >= 0) return mergeBagIntoPlacedTower(index, existingIndex);
  if (state.routeSet.has(cellKey(c, r))) return toast("路線格不能蓋塔");
  state.towers.push({ id: item.id, level: item.level, c, r, cooldown: 0, targetId: null, beam: 0 });
  state.bag[index] = null;
  state.selectedBag = null;
  compactBag();
  renderBag();
  sound("place");
  toast(`${towers[item.id].name} LV${item.level} 已放置`);
}

function mergeBagIntoPlacedTower(bagIndex, towerIndex) {
  const item = state.bag[bagIndex];
  const tower = state.towers[towerIndex];
  if (!item || !tower) return;
  if (item.id !== tower.id || item.level !== tower.level) {
    toast("地圖合成需要同塔同 LV");
    return;
  }
  if (tower.level >= MAX_LEVEL) {
    toast(`塔樓最高 LV${MAX_LEVEL}`);
    return;
  }
  tower.level += 1;
  tower.cooldown = 0;
  state.bag[bagIndex] = null;
  state.selectedBag = null;
  state.selectedTower = towerIndex;
  compactBag();
  renderBag();
  sound("merge");
  burst(tower.c * TILE + TILE / 2, tower.r * TILE + TILE / 2, "#ffd166", 18);
  toast(`${towers[tower.id].name} 升級到 LV${tower.level}`);
}

function sellSelectedTower() {
  ensureAudio();
  const t = state.towers[state.selectedTower];
  if (!t) return;
  const refund = Math.round(currentSlotCost() * .5 * t.level);
  state.gold += refund;
  state.towers.splice(state.selectedTower, 1);
  state.selectedTower = null;
  sound("sell");
  toast(`出售成功，獲得 ${refund} 金`);
  updateUI();
}

function sellButtonRect() {
  const t = state.towers[state.selectedTower];
  if (!t) return null;
  const x = Math.min(WORLD_W - 106, Math.max(6, t.c * TILE + TILE / 2 - 48));
  const y = Math.min(WORLD_H - 46, Math.max(6, t.r * TILE + TILE / 2 - 68));
  return { x, y, w: 96, h: 36 };
}

function trySellButton(x, y) {
  const rect = sellButtonRect();
  if (!rect) return false;
  const inside = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  if (!inside) return false;
  sellSelectedTower();
  return true;
}

function restartButtonRect() {
  if (state.phase !== "won" && state.phase !== "lost") return null;
  const size = screenSize();
  return { x: size.w / 2 - 82, y: size.h / 2 + 58, w: 164, h: 44 };
}

function tryRestartButton(clientX, clientY) {
  const rect = restartButtonRect();
  if (!rect) return false;
  const canvasRect = canvas.getBoundingClientRect();
  const x = clientX - canvasRect.left;
  const y = clientY - canvasRect.top;
  const inside = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  if (!inside) return false;
  restartGame();
  return true;
}

function beginWave() {
  state.phase = "battle";
  state.spawnIndex = 0;
  state.spawnTimer = 0;
  sound("wave");
  toast(`第 ${state.wave} 關開始`);
  updateUI();
}

function finishWave() {
  if (state.wave >= 10) {
    state.phase = "won";
    toast("第 10 關完成，全破");
  } else {
    state.wave += 1;
    state.gold += 15 + state.wave * 5;
    state.phase = "countdown";
    state.countdown = WAVE_COUNTDOWN;
    toast(`進入第 ${state.wave} 關，塔樓保留`);
  }
  updateUI();
}

function spawnKind() {
  const config = waves[state.wave];
  if (config.finalBoss && state.spawnIndex === config.count - 1) return "boss";
  if (config.bossAt === "last" && state.spawnIndex === config.count - 1) return "boss";
  if (config.bossAt === "middle" && state.spawnIndex === Math.floor(config.count / 2)) return "boss";
  return pick(config.pool);
}

function spawnEnemy() {
  const config = waves[state.wave];
  const kindId = spawnKind();
  const isFinal = config.finalBoss && state.spawnIndex === config.count - 1;
  const def = isFinal ? enemies.finalBoss : enemies[kindId];
  const bossScale = kindId === "boss" ? (config.bossHp || 1) : 1;
  const hp = isFinal ? Math.round(1120 * ENEMY_BALANCE_MULT) : Math.round(def.hp * config.hp * bossScale * ENEMY_BALANCE_MULT);
  const start = state.route[0];
  state.mobs.push({
    uid: state.id++,
    kind: kindId,
    name: def.name,
    color: def.color,
    hp,
    maxHp: hp,
    speed: (isFinal ? .65 : def.speed) * 44 * ENEMY_BALANCE_MULT,
    reward: isFinal ? 50 : def.reward,
    leak: def.leak,
    boss: kindId === "boss",
    sprite: def.sprite,
    path: 0,
    x: start.x,
    y: start.y,
    slow: 0,
    poison: 0,
    poisonDps: 0,
    dead: false,
  });
}

function update(dt) {
  if (state.phase === "countdown") {
    state.countdown -= dt;
    if (state.countdown <= 0) beginWave();
  }
  if (state.phase === "battle") {
    state.spawnTimer -= dt;
    const interval = Math.max(.34, .92 - state.wave * .045);
    if (state.spawnIndex < waves[state.wave].count && state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnIndex += 1;
      state.spawnTimer = interval;
    }
    if (state.spawnIndex >= waves[state.wave].count && state.mobs.length === 0) finishWave();
  }

  updateMobs(dt);
  updateTowers(dt);
  updateShots(dt);
  updateFx(dt);
  updateUI();
}

function updateMobs(dt) {
  for (const mob of state.mobs) {
    if (mob.poison > 0) {
      mob.poison -= dt;
      const bossReduce = mob.boss ? .4 : 1;
      mob.hp -= mob.maxHp * mob.poisonDps * bossReduce * dt;
      addNumber(mob.x, mob.y - 24, Math.ceil(mob.maxHp * mob.poisonDps * bossReduce * dt), "#55a84f");
    }
    if (mob.slow > 0) mob.slow -= dt;
    if (mob.hp <= 0) {
      killMob(mob);
      continue;
    }

    const next = state.route[mob.path + 1];
    if (!next) {
      mob.dead = true;
      state.lives -= mob.leak;
      if (state.lives <= 0) {
        state.lives = 0;
        state.phase = "lost";
        toast("生命歸零，遊戲失敗");
      }
      continue;
    }
    const dx = next.x - mob.x;
    const dy = next.y - mob.y;
    const dist = Math.hypot(dx, dy) || 1;
    const bossReduce = mob.boss ? .4 : 1;
    const slowMul = mob.slow > 0 ? 1 - (.5 * bossReduce) : 1;
    const move = mob.speed * slowMul * dt;
    if (move >= dist) {
      mob.x = next.x;
      mob.y = next.y;
      mob.path += 1;
    } else {
      mob.x += dx / dist * move;
      mob.y += dy / dist * move;
    }
  }
  state.mobs = state.mobs.filter(m => !m.dead);
}

function killMob(mob) {
  if (mob.dead) return;
  mob.dead = true;
  state.gold += mob.reward;
  burst(mob.x, mob.y, "#ffd166", 8);
  addNumber(mob.x, mob.y - 30, `+${mob.reward}`, "#e8a728");
}

function updateTowers(dt) {
  for (const tower of state.towers) {
    const def = towers[tower.id];
    tower.cooldown -= dt;
    if (tower.beam > 0) tower.beam -= dt;
    const range = def.range * TILE;

    let target = null;
    if (tower.id === "laser" && tower.targetId) {
      target = state.mobs.find(m => m.uid === tower.targetId && distTower(m, tower) <= range);
    }
    if (!target) {
      target = frontMob(tower, range);
      tower.targetId = target ? target.uid : null;
    }
    if (!target || tower.cooldown > 0) continue;

    const rate = def.rate;
    const damage = def.damage * levelDamage(tower.level);
    if (tower.id === "laser") {
      hitMob(target, damage, tower.id);
      tower.beam = .12;
    } else if (tower.id === "poison") {
      const targets = frontMobs(tower, range, 3);
      targets.forEach((m, i) => shoot(tower, m, damage, i - 1));
    } else {
      shoot(tower, target, damage, 0);
    }
    tower.cooldown = 1 / rate;
  }
}

function distTower(mob, tower) {
  return Math.hypot(mob.x - (tower.c * TILE + TILE / 2), mob.y - (tower.r * TILE + TILE / 2));
}

function frontMob(tower, range) {
  return frontMobs(tower, range, 1)[0] || null;
}

function frontMobs(tower, range, count) {
  return state.mobs
    .filter(m => distTower(m, tower) <= range)
    .sort((a, b) => b.path - a.path || a.hp - b.hp)
    .slice(0, count);
}

function shoot(tower, target, damage, curve) {
  const def = towers[tower.id];
  const x = tower.c * TILE + TILE / 2;
  const y = tower.r * TILE + TILE / 2;
  const angle = Math.atan2(target.y - y, target.x - x) + curve * .12;
  state.shots.push({
    x,
    y,
    vx: Math.cos(angle) * 430,
    vy: Math.sin(angle) * 430,
    target: target.uid,
    tower: tower.id,
    damage,
    splash: tower.id === "stone" || tower.id === "fire" ? def.splash * TILE : def.splash * TILE * .32,
    color: def.color,
    life: 1.25,
  });
}

function updateShots(dt) {
  for (const shot of state.shots) {
    shot.life -= dt;
    const target = state.mobs.find(m => m.uid === shot.target);
    if (target) {
      const dx = target.x - shot.x;
      const dy = target.y - shot.y;
      const d = Math.hypot(dx, dy) || 1;
      shot.vx = dx / d * 460;
      shot.vy = dy / d * 460;
      if (d <= 14) {
        impact(shot, target);
        shot.life = 0;
        continue;
      }
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  state.shots = state.shots.filter(s => s.life > 0);
}

function impact(shot, target) {
  if (shot.splash > 0) {
    state.mobs.forEach(m => {
      if (Math.hypot(m.x - target.x, m.y - target.y) <= shot.splash) hitMob(m, shot.damage, shot.tower);
    });
    burst(target.x, target.y, shot.color, 10);
  } else {
    hitMob(target, shot.damage, shot.tower);
    burst(target.x, target.y, shot.color, 4);
  }
  sound("hit");
}

function hitMob(mob, damage, towerId) {
  mob.hp -= damage;
  if (towerId === "ice") mob.slow = 2;
  if (towerId === "poison") {
    mob.poison = 3;
    mob.poisonDps = .05;
  }
  addNumber(mob.x, mob.y - 22, Math.ceil(damage), towers[towerId].color);
  if (mob.hp <= 0) killMob(mob);
}

function addNumber(x, y, text, color) {
  state.numbers.push({ x, y, text: String(text), color, life: .7 });
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(45, 140);
    state.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: rand(.22, .5) });
  }
}

function updateFx(dt) {
  if (state.jackpot) {
    state.jackpot.life -= dt;
    if (state.jackpot.life <= 0) state.jackpot = null;
  }
  state.fx.forEach(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  state.fx = state.fx.filter(p => p.life > 0);
  state.numbers.forEach(n => {
    n.life -= dt;
    n.y -= 32 * dt;
  });
  state.numbers = state.numbers.filter(n => n.life > 0);
}

function draw() {
  resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  applyCamera();
  drawMap();
  drawTowers();
  drawMobs();
  drawShots();
  drawFx();
  resetTransform();
  drawHud();
  drawJackpot();
}

function drawBackground() {
  const size = screenSize();
  const bg = state.bg;
  if (bg && bg.complete && bg.naturalWidth > 0) {
    drawImageCover(bg, 0, 0, size.w, size.h);
  } else {
    ctx.fillStyle = "#d8edf3";
    ctx.fillRect(0, 0, size.w, size.h);
  }
}

function drawMap() {
  ctx.fillStyle = "#cfe9c8";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;
      ctx.fillStyle = (c + r) % 2 ? "#c5e5bd" : "#d7efcf";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "rgba(48,91,80,.09)";
      ctx.strokeRect(x, y, TILE, TILE);
    }
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#c79658";
  ctx.lineWidth = 42;
  ctx.beginPath();
  state.route.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();
  ctx.strokeStyle = "#f1cf87";
  ctx.lineWidth = 24;
  ctx.stroke();
  drawGate(state.route[0].x, state.route[0].y, "#2f7d65", "始");
  drawGate(state.route[state.route.length - 1].x, state.route[state.route.length - 1].y, "#c45e30", "終");
}

function drawGate(x, y, color, text) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 20, 40, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Microsoft JhengHei, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
}

function drawTowers() {
  state.towers.forEach((tower, index) => {
    const def = towers[tower.id];
    const x = tower.c * TILE + TILE / 2;
    const y = tower.r * TILE + TILE / 2;
    if (index === state.selectedTower) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, def.range * TILE, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.14)";
    ctx.beginPath();
    ctx.ellipse(x, y + 17, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    const img = towerImage(def);
    if (img) {
      drawImageContain(img, x - 50, y - 62, 100, 108);
    } else {
      ctx.beginPath();
      ctx.roundRect(x - 21, y - 26, 42, 46, 10);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "900 18px Microsoft JhengHei, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.mark, x, y - 4);
    }
    ctx.fillStyle = "#263f39";
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 10, 32, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "900 11px Arial";
    ctx.fillText(`L${tower.level}`, x + 19, y + 19);
    if (tower.level >= MAX_LEVEL) drawStar(x, y - 39, 9);
    if (tower.id === "laser" && tower.beam > 0) {
      const target = state.mobs.find(m => m.uid === tower.targetId);
      if (target) {
        ctx.strokeStyle = "rgba(176,75,227,.8)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    }
  });
  drawSellButton();
}

function drawStar(x, y, radius) {
  ctx.save();
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = "#9b5a16";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? radius : radius * .48;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSellButton() {
  const rect = sellButtonRect();
  const t = state.towers[state.selectedTower];
  if (!rect || !t || state.phase === "won" || state.phase === "lost") return;
  const refund = Math.round(currentSlotCost() * .5 * t.level);
  ctx.fillStyle = "#c45e30";
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = "#fff3d6";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "900 15px Microsoft JhengHei, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`賣掉 +${refund}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawMobs() {
  state.mobs.forEach(m => {
    const size = m.boss ? 34 : m.kind === "troll" || m.kind === "knight" ? 28 : 23;
    ctx.fillStyle = "rgba(0,0,0,.14)";
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + size * .8, size, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const img = sprites[m.sprite];
    if (img && img.complete && img.naturalWidth > 0) {
      const w = size * (m.boss ? 2.25 : 2);
      const h = size * (m.boss ? 2.25 : 2);
      drawImageContain(img, m.x - w / 2, m.y - h / 2, w, h);
    } else {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.roundRect(m.x - size, m.y - size, size * 2, size * 2, 12);
      ctx.fill();
    }
    if (m.boss) drawSkull(m.x, m.y - size * .78, size * .62);
    if (m.slow > 0) {
      ctx.strokeStyle = "#67c7ef";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (m.poison > 0) {
      ctx.fillStyle = "rgba(85,168,79,.45)";
      ctx.beginPath();
      ctx.arc(m.x + size * .75, m.y - size * .65, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const w = m.boss ? 58 : 42;
    ctx.fillStyle = "#263f39";
    ctx.fillRect(m.x - w / 2, m.y - size - 12, w, 5);
    ctx.fillStyle = "#f05252";
    ctx.fillRect(m.x - w / 2, m.y - size - 12, w * Math.max(0, m.hp / m.maxHp), 5);
  });
}

function drawSkull(x, y, size) {
  const s = size * .62;
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.arc(x, y - s * .2, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - s * .55, y + s * .2, s * 1.1, s * .55);
  ctx.fillStyle = "#263f39";
  ctx.beginPath();
  ctx.arc(x - s * .32, y - s * .18, s * .18, 0, Math.PI * 2);
  ctx.arc(x + s * .32, y - s * .18, s * .18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - s * .08, y + s * .04, s * .16, s * .2);
  ctx.fillRect(x - s * .32, y + s * .38, s * .16, s * .22);
  ctx.fillRect(x - s * .08, y + s * .38, s * .16, s * .22);
  ctx.fillRect(x + s * .16, y + s * .38, s * .16, s * .22);
}

function drawShots() {
  state.shots.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.tower === "stone" ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFx() {
  state.fx.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  state.numbers.forEach(n => {
    ctx.globalAlpha = Math.max(0, n.life / .7);
    ctx.fillStyle = n.color;
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(n.text, n.x, n.y);
    ctx.globalAlpha = 1;
  });
}

function drawHud() {
  const size = screenSize();
  ctx.fillStyle = "#254239";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "900 18px Microsoft JhengHei, Arial";
  ctx.fillText(`第 ${state.wave} 關 / 10`, 20, 30);
  ctx.font = "800 18px Microsoft JhengHei, Arial";
  const status = state.phase === "countdown" ? `倒數 ${Math.ceil(state.countdown)} 秒` : `敵人 ${state.spawnIndex}/${waves[state.wave]?.count || 0}`;
  ctx.fillText(status, 20, 58);

  drawHpPanel(size.w - 238, 14);

  if (state.phase === "won" || state.phase === "lost") {
    ctx.fillStyle = "rgba(33,49,44,.78)";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#fff";
    ctx.font = "900 54px Microsoft JhengHei, Arial";
    ctx.textAlign = "center";
    ctx.fillText(state.phase === "won" ? "全破" : "遊戲失敗", size.w / 2, size.h / 2 - 12);
    ctx.font = "700 20px Microsoft JhengHei, Arial";
    ctx.fillText(state.phase === "won" ? "Slot Tower Defense 完成" : "防線被突破", size.w / 2, size.h / 2 + 34);
    const rect = restartButtonRect();
    ctx.fillStyle = "#2f7d65";
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();
    ctx.strokeStyle = "#fff3d6";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "900 18px Microsoft JhengHei, Arial";
    ctx.fillText("再來一局", size.w / 2, rect.y + rect.h / 2 + 1);
  }
}

function drawHpPanel(x, y) {
  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.beginPath();
  ctx.roundRect(x, y, 224, 76, 8);
  ctx.fill();
  ctx.fillStyle = "#254239";
  ctx.font = "900 18px Microsoft JhengHei, Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`HP：${state.lives}/${START_LIVES}`, x + 12, y + 22);
  const dotSize = 8;
  for (let i = 0; i < START_LIVES; i++) {
    const col = i % 10;
    const row = Math.floor(i / 10);
    ctx.fillStyle = i < state.lives ? "#e44848" : "#b8b8b8";
    ctx.beginPath();
    ctx.arc(x + 18 + col * 20, y + 45 + row * 17, dotSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawJackpot() {
  if (!state.jackpot) return;
  const size = screenSize();
  const p = state.jackpot.life / state.jackpot.max;
  const shakeX = Math.sin(performance.now() * .05) * 5 * p;
  const shakeY = Math.cos(performance.now() * .043) * 3 * p;
  ctx.save();
  ctx.globalAlpha = Math.min(.55, p);
  ctx.fillStyle = state.jackpot.color;
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.globalAlpha = 1;
  ctx.translate(shakeX, shakeY);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  ctx.roundRect(size.w / 2 - 260, 92, 520, 76, 12);
  ctx.fill();
  ctx.strokeStyle = state.jackpot.color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#254239";
  ctx.font = "900 28px Microsoft JhengHei, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.jackpot.text, size.w / 2, 131);
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(.05, (now - state.last) / 1000);
  state.last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
    return this;
  };
}

ui.spinBtn.addEventListener("click", spin);
ui.mergeBtn.addEventListener("click", autoMerge);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
pickBackground();
setNewRoute();
renderBag();
toast("第 1 關倒數開始");
requestAnimationFrame(loop);

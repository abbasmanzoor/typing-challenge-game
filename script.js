/* ================= CONFIG & STATE ================= */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const BUBBLE_CFG = {
  easy:   { missLimit: 6, speed: 60,  spawn: 1100, startBubbles: 5, rampEvery: 20 },
  medium: { missLimit: 6, speed: 85,  spawn: 900,  startBubbles: 6, rampEvery: 15 },
  hard:   { missLimit: 6, speed: 110, spawn: 750,  startBubbles: 7, rampEvery: 12 }
};

const MAGNET_CFG = {
  easy:   { goal: 15, timePerTarget: 3000, multiplier: 1   },
  medium: { goal: 20, timePerTarget: 2200, multiplier: 1.5 },
  hard:   { goal: 25, timePerTarget: 1500, multiplier: 2   }
};

const KEY_SETS = {
  home:    ['A', 'S', 'D', 'F', 'J', 'K', 'L'],
  homeTop: ['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','J','K','L'],
  all:     ALPHABET.slice()
};

const POINTS = { bubbleHit: 10, bubbleWrong: -5, magnetHit: 10, magnetWrong: -3 };

const state = { screen: 'home', difficulty: 'easy', lastMode: null };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ================= BACKGROUND MANAGER ================= */
/* Aapki files ke exact naam */
const BG_IMAGES = {
  home: "assets/bg-home.png",
  bubbles: "assets/bg-bubbles.png",
  keymagnet: "assets/card-bg-magnet.png",
  results: "assets/how its work.png" /* Result screen ka background */
};

function setBackground(screenName) {
  if (BG_IMAGES[screenName]) {
    document.body.style.backgroundImage = `url('${BG_IMAGES[screenName]}')`;
  }
}

/* ================= SCREEN MANAGER ================= */
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = $('#screen-' + name);
  if (el) el.classList.add('active');
  state.screen = name;
  setBackground(name);
  if (document.activeElement) document.activeElement.blur();
}

function flash(el, type, text) {
  if (!el) return;
  const isStatic = el.classList.contains('feedback-static');
  const base = isStatic ? 'feedback feedback-static' : 'feedback';
  const defaults = { correct: '✓ Good!', wrong: '✗ Wrong', miss: 'Missed!' };
  
  el.textContent = text || defaults[type] || '';
  el.className = `${base} show ${type}`;
  
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = base; }, 500);
}

/* ================= MODE A: BUBBLES ================= */
const bGame = {
  running: false, rafId: null, lastTs: 0, bubbles: [], uid: 0,
  missLimit: 6, misses: 0, hits: 0, wrong: 0, score: 0, elapsed: 0,
  spawnAcc: 0, level: 0, speedMul: 1, maxBubbles: 5, spawnInterval: 1100, baseSpeed: 60
};

function startBubbles() {
  stopBubbles(); resetBubbles();
  const cfg = BUBBLE_CFG[state.difficulty];
  bGame.missLimit = cfg.missLimit; bGame.baseSpeed = cfg.speed;
  bGame.spawnInterval = cfg.spawn; bGame.maxBubbles = cfg.startBubbles;
  bGame.running = true;

  $('#bubble-area').querySelectorAll('.bubble').forEach(b => b.remove());
  $('#bub-diff').textContent = state.difficulty.toUpperCase();
  updateBubHUD(); showScreen('bubbles');

  while (bGame.bubbles.length < 5) spawnBubble();
  bGame.lastTs = 0;
  bGame.rafId = requestAnimationFrame(bubbleLoop);
}

function resetBubbles() {
  bGame.bubbles.forEach(b => b.el.remove());
  Object.assign(bGame, { bubbles: [], misses: 0, hits: 0, wrong: 0, score: 0, elapsed: 0, spawnAcc: 0, level: 0, speedMul: 1 });
  updateBubHUD();
}

function stopBubbles() {
  bGame.running = false;
  if (bGame.rafId !== null) { cancelAnimationFrame(bGame.rafId); bGame.rafId = null; }
}

function updateBubHUD() {
  $('#bub-score').textContent = bGame.score;
  $('#bub-misses').textContent = bGame.misses;
  $('#bub-lives').textContent = Math.max(0, bGame.missLimit - bGame.misses);
  $('#bub-level').textContent = bGame.level + 1;
}

function spawnBubble() {
  const area = $('#bubble-area');
  const W = area.clientWidth;
  const size = W < 480 ? 55 : 75;
  const taken = new Set(bGame.bubbles.map(b => b.letter));
  const pool = ALPHABET.filter(l => !taken.has(l));
  if (!pool.length) return;
  
  const letter = pool[Math.floor(Math.random() * pool.length)];
  const el = document.createElement('div');
  el.className = 'bubble'; el.textContent = letter;
  el.style.width = el.style.height = size + 'px';
  el.style.left = Math.random() * Math.max(0, W - size - 20) + 10 + 'px';
  
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!bGame.running) return;
    const bObj = bGame.bubbles.find(b => b.el === el);
    if (bObj) {
      popBubbleObj(bObj);
      flash($('#bubble-feedback'), 'correct', `+${POINTS.bubbleHit}`);
      updateBubHUD();
    }
  });

  area.appendChild(el);

  bGame.bubbles.push({
    id: ++bGame.uid, letter, el, size, y: -size,
    speed: bGame.baseSpeed * bGame.speedMul * (0.9 + Math.random() * 0.25)
  });
}

function popBubbleObj(target) {
  target.el.classList.add('pop');
  setTimeout(() => { if(target.el && target.el.parentNode) target.el.remove(); }, 250);
  bGame.bubbles = bGame.bubbles.filter(x => x.id !== target.id);
  bGame.hits++; 
  bGame.score += POINTS.bubbleHit;
}

function bubbleLoop(ts) {
  if (!bGame.running) return;
  if (!bGame.lastTs) bGame.lastTs = ts;
  let dt = (ts - bGame.lastTs) / 1000;
  bGame.lastTs = ts;
  dt = Math.min(dt, 0.1); 
  bGame.elapsed += dt;

  const cfg = BUBBLE_CFG[state.difficulty];
  const lvl = Math.floor(bGame.elapsed / cfg.rampEvery);
  if (lvl > bGame.level) {
    bGame.level = lvl;
    bGame.speedMul = Math.min(1 + lvl * 0.18, 3);
    bGame.maxBubbles = Math.min(cfg.startBubbles + lvl, 10);
    bGame.spawnInterval = Math.max(380, cfg.spawn - lvl * 90);
    flash($('#bubble-feedback'), 'correct', `⚡ Level ${lvl + 1}!`);
  }

  bGame.spawnAcc += dt * 1000;
  if (bGame.bubbles.length < 5) { spawnBubble(); bGame.spawnAcc = 0; }
  else if (bGame.spawnAcc >= bGame.spawnInterval && bGame.bubbles.length < bGame.maxBubbles) {
    spawnBubble(); bGame.spawnAcc = 0;
  }

  const H = $('#bubble-area').clientHeight;
  for (let i = bGame.bubbles.length - 1; i >= 0; i--) {
    const b = bGame.bubbles[i];
    b.y += b.speed * dt;
    if (b.y + b.size >= H) {
      b.el.remove(); bGame.bubbles.splice(i, 1);
      bGame.misses++; flash($('#bubble-feedback'), 'miss');
      updateBubHUD();
      if (bGame.misses >= bGame.missLimit) { endBubbles(); return; }
      continue;
    }
    b.el.style.bottom = b.y + 'px';
  }
  updateBubHUD();
  bGame.rafId = requestAnimationFrame(bubbleLoop);
}

function handleBubbleKey(e) {
  const ch = e.key.toUpperCase();
  if (!/^[A-Z]$/.test(ch)) return;
  e.preventDefault();
  processBubbleInput(ch);
}

function processBubbleInput(ch) {
  const matches = bGame.bubbles.filter(b => b.letter === ch);
  if (matches.length) {
    const target = matches.reduce((a, b) => (a.y > b.y ? a : b));
    popBubbleObj(target);
    flash($('#bubble-feedback'), 'correct', `+${POINTS.bubbleHit}`);
  } else {
    bGame.wrong++; 
    bGame.score = Math.max(0, bGame.score + POINTS.bubbleWrong);
    flash($('#bubble-feedback'), 'wrong', `${POINTS.bubbleWrong}`);
  }
  updateBubHUD();
}

function endBubbles() {
  stopBubbles();
  const total = bGame.hits + bGame.wrong;
  const acc = total ? Math.round((bGame.hits / total) * 100) : 0;
  showResults('bubbles', 'Game Over', 'Bubbles top tak pohanch gaye', bGame.score, [
    ['Difficulty', state.difficulty.toUpperCase()],
    ['Bubbles Popped', bGame.hits],
    ['Misses', bGame.misses],
    ['Wrong Keys', bGame.wrong],
    ['Accuracy', acc + '%'],
    ['Survived', Math.floor(bGame.elapsed) + 's']
  ]);
}

/* ================= MODE B: KEYMAGNET ================= */
const mGame = {
  running: false, target: null, targetShownAt: 0, correct: 0, wrong: 0, timeouts: 0,
  score: 0, times: [], goal: 15, timePerTarget: 3000, multiplier: 1,
  keys: KEY_SETS.home, timerId: null, nextId: null
};

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function buildKeyboard() {
  const kb = $('#keyboard');
  if (!kb) return; kb.innerHTML = '';
  KEY_ROWS.forEach(row => {
    const rowEl = document.createElement('div'); rowEl.className = 'kb-row';
    row.split('').forEach(ch => {
      const k = document.createElement('div');
      k.className = 'kb-key'; k.dataset.key = ch; k.textContent = ch;
      
      k.addEventListener('click', () => {
        if (!mGame.running) return;
        processMagnetInput(ch);
      });

      rowEl.appendChild(k);
    });
    kb.appendChild(rowEl);
  });
}

function startMagnet() {
  stopMagnet(); resetMagnet();
  const cfg = MAGNET_CFG[state.difficulty];
  mGame.goal = cfg.goal; mGame.timePerTarget = cfg.timePerTarget; mGame.multiplier = cfg.multiplier;
  mGame.keys = KEY_SETS[$('#mag-keyset').value];
  mGame.running = true;

  applyKeyHighlight(); updateMagHUD(); showScreen('keymagnet');
  $('#magnet-target').textContent = '-'; nextTarget();
}

function resetMagnet() {
  Object.assign(mGame, { correct: 0, wrong: 0, timeouts: 0, score: 0, times: [], target: null });
  if ($('#magnet-bar')) { $('#magnet-bar').style.width = '100%'; $('#magnet-bar').classList.remove('low'); }
  updateMagHUD();
}

function stopMagnet() {
  mGame.running = false;
  if (mGame.timerId !== null) { clearInterval(mGame.timerId); mGame.timerId = null; }
  if (mGame.nextId !== null) { clearTimeout(mGame.nextId); mGame.nextId = null; }
}

function applyKeyHighlight() {
  const active = new Set(mGame.keys);
  $$('.kb-key').forEach(k => k.classList.toggle('dim', !active.has(k.dataset.key)));
}

function updateMagHUD() {
  const att = mGame.correct + mGame.wrong + mGame.timeouts;
  const acc = att ? Math.round((mGame.correct / att) * 100) : 100;
  $('#mag-score').textContent = mGame.score;
  $('#mag-correct').textContent = mGame.correct;
  $('#mag-wrong').textContent = mGame.wrong + mGame.timeouts;
  $('#mag-acc').textContent = acc + '%';
  $('#mag-progress').textContent = `${mGame.correct + mGame.timeouts} / ${mGame.goal}`;
}

function nextTarget() {
  if (!mGame.running) return;
  if (mGame.correct + mGame.timeouts >= mGame.goal) { endMagnet(); return; }

  const pool = mGame.keys.filter(k => k !== mGame.target);
  if (!pool.length) return;
  mGame.target = pool[Math.floor(Math.random() * pool.length)];
  mGame.targetShownAt = performance.now();

  $('#magnet-target').textContent = mGame.target;
  $$('.kb-key').forEach(k => k.classList.toggle('target', k.dataset.key === mGame.target));
  updateMagHUD();
  startTargetTimer();
}

function startTargetTimer() {
  if (mGame.timerId !== null) clearInterval(mGame.timerId);
  const start = performance.now();
  const bar = $('#magnet-bar');
  if (bar) { bar.style.width = '100%'; bar.classList.remove('low'); }

  mGame.timerId = setInterval(() => {
    if (!mGame.running) return;
    const left = mGame.timePerTarget - (performance.now() - start);
    const pct = Math.max(0, (left / mGame.timePerTarget) * 100);

    if (bar) { bar.style.width = pct + '%'; bar.classList.toggle('low', pct < 30); }

    if (left <= 0) {
      clearInterval(mGame.timerId); mGame.timerId = null;
      mGame.timeouts++; mGame.target = null;
      flash($('#magnet-feedback'), 'wrong', '⏱ Time up!');
      updateMagHUD();
      mGame.nextId = setTimeout(nextTarget, 350);
    }
  }, 50);
}

function handleMagnetKey(e) {
  const ch = e.key.toUpperCase();
  if (!/^[A-Z]$/.test(ch) || !mGame.target) return;
  e.preventDefault();
  processMagnetInput(ch);
}

function processMagnetInput(ch) {
  if (!mGame.running || !mGame.target) return;

  if (ch === mGame.target) {
    const rt = performance.now() - mGame.targetShownAt;
    mGame.times.push(rt);
    mGame.correct++;
    const pts = Math.round(POINTS.magnetHit * mGame.multiplier);
    mGame.score += pts;

    clearInterval(mGame.timerId); mGame.timerId = null;
    mGame.target = null; 

    const k = document.querySelector(`.kb-key[data-key="${ch}"]`);
    if (k) { k.classList.add('correct'); setTimeout(() => k.classList.remove('correct'), 200); }
    
    flash($('#magnet-feedback'), 'correct', `+${pts}`);
    updateMagHUD();
    mGame.nextId = setTimeout(nextTarget, 250);
  } else {
    mGame.wrong++; mGame.score = Math.max(0, mGame.score + POINTS.magnetWrong);
    const k = document.querySelector(`.kb-key[data-key="${ch}"]`);
    if (k) { k.classList.add('wrong'); setTimeout(() => k.classList.remove('wrong'), 200); }
    
    flash($('#magnet-feedback'), 'wrong', '✗ Wrong key');
    updateMagHUD();
  }
}

function endMagnet() {
  stopMagnet();
  const att = mGame.correct + mGame.wrong + mGame.timeouts;
  const acc = att ? Math.round((mGame.correct / att) * 100) : 0;
  const avg = mGame.times.length ? Math.round(mGame.times.reduce((a, b) => a + b, 0) / mGame.times.length) : 0;
  
  showResults('keymagnet', 'Challenge Complete!', `${mGame.correct} targets cleared`, mGame.score, [
    ['Difficulty', state.difficulty.toUpperCase()],
    ['Correct', mGame.correct],
    ['Wrong', mGame.wrong],
    ['Timeouts', mGame.timeouts],
    ['Accuracy', acc + '%'],
    ['Avg Response', avg + ' ms']
  ]);
}

/* ================= RESULTS ================= */
function showResults(mode, title, sub, score, stats) {
  state.lastMode = mode;
  $('#res-title').textContent = title;
  $('#res-subtitle').textContent = sub;
  $('#res-score').textContent = score;
  
  const box = $('#res-stats'); box.innerHTML = '';
  stats.forEach(([label, val]) => {
    const div = document.createElement('div'); div.className = 'stat-row';
    div.innerHTML = `<span>${label}</span><strong>${val}</strong>`;
    box.appendChild(div);
  });
  showScreen('results');
}

/* ================= GLOBAL KEYDOWN ================= */
document.addEventListener('keydown', (e) => {
  if (state.screen === 'bubbles' && bGame.running) handleBubbleKey(e);
  else if (state.screen === 'keymagnet' && mGame.running) handleMagnetKey(e);
});

/* ================= INITIALIZATION ================= */
document.addEventListener('DOMContentLoaded', () => {
  buildKeyboard();

  $$('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.difficulty;
    });
  });

  $$('[data-start]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.start === 'bubbles') startBubbles();
      else startMagnet();
    });
  });

  $('#bub-restart').addEventListener('click', startBubbles);
  $('#bub-reset').addEventListener('click', () => { stopBubbles(); resetBubbles(); $('#bubble-area').querySelectorAll('.bubble').forEach(b => b.remove()); });
  $('#bub-home').addEventListener('click', () => { stopBubbles(); resetBubbles(); showScreen('home'); });

  $('#mag-restart').addEventListener('click', startMagnet);
  $('#mag-reset').addEventListener('click', () => { stopMagnet(); resetMagnet(); $('#magnet-target').textContent = '-'; });
  $('#mag-home').addEventListener('click', () => { stopMagnet(); resetMagnet(); showScreen('home'); });

  $('#mag-keyset').addEventListener('change', () => {
    mGame.keys = KEY_SETS[$('#mag-keyset').value];
    applyKeyHighlight();
    if (mGame.running) { mGame.target = null; clearInterval(mGame.timerId); nextTarget(); }
  });

  $('#res-again').addEventListener('click', () => {
    if (state.lastMode === 'bubbles') startBubbles();
    else startMagnet();
  });
  $('#res-home').addEventListener('click', () => {
    stopBubbles(); stopMagnet(); showScreen('home');
  });

  showScreen('home');
});
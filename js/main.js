/*
ไฟล์: main.js
หน้าที่: bootstrap, loading screen, game loop
*/

window.G = {
  scene:null, camera:null, renderer:null,
  state:'menu',
  waveNumber:0, money:200, lives:20, score:0,
  paused:false, waveActive:false,
  mapSize:'medium',
  cameraMode:'god',
  selectedTowerType:null, selectedTower:null,
  clock:null,
};

let _camInited = false;

// ── Loading screen ──────────────────────────────
// ใช้ requestAnimationFrame เพื่อให้แน่ใจว่า browser render loading screen ก่อน
function _runLoader(onDone) {
  const bar = document.getElementById('loadBar');
  const pct = document.getElementById('loadPct');
  const tip = document.getElementById('loadTip');
  if (tip && window.I18n) tip.textContent = I18n.t('loading_tip');

  // รอ 2 frames ก่อนเริ่ม เพื่อให้ browser paint loading screen ออกมาก่อน
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _animateLoader(bar, pct, 0, onDone);
    });
  });
}

function _animateLoader(bar, pct, step, onDone) {
  const targets = [10, 25, 42, 58, 75, 88, 100];
  if (step >= targets.length) {
    setTimeout(onDone, 400);
    return;
  }
  const p = targets[step];
  _setLoad(bar, pct, p);
  const delay = 80 + Math.random() * 180;
  setTimeout(() => _animateLoader(bar, pct, step + 1, onDone), delay);
}

function _setLoad(bar, pct, p) {
  if (bar) bar.style.width = p + '%';
  if (pct) pct.textContent = p + '%';
}

function _hideLoader() {
  const el = document.getElementById('loadingScreen');
  if (!el) return;
  el.style.transition = 'opacity 0.45s';
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 500);
}

// ── initGame ────────────────────────────────────
window.initGame = function(mapSize) {
  if (window._animId) { cancelAnimationFrame(window._animId); window._animId=null; }

  Object.assign(G, {
    state:'playing', waveNumber:0, money:200, lives:20, score:0,
    paused:false, waveActive:false,
    mapSize:mapSize||'medium', cameraMode:'god',
    selectedTowerType:null, selectedTower:null,
    clock:new THREE.Clock(true),
  });

  const sys = SceneSystem.init();
  G.scene=sys.scene; G.camera=sys.camera; G.renderer=sys.renderer;

  MapSystem.build(G.mapSize);

  if (!_camInited) {
    CameraSystem.init();
    InputSystem.init();
    _camInited = true;
  } else {
    CameraSystem.reset();
  }

  EnemyManager.clearAll();
  TowerManager.clearAll();
  ProjectileManager.clearAll();
  EffectsSystem.clearAll();
  WaveSystem.init();
  UISystem.reset();

  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOver').classList.add('hidden');

  setTimeout(() => UISystem.showMessage(I18n.t('msg_place_towers'), 0x00dc8c, 3.5), 400);
  _animate();
};

// ── Game loop ───────────────────────────────────
function _animate() {
  window._animId = requestAnimationFrame(_animate);
  const dt = G.clock ? Math.min(G.clock.getDelta(), 0.05) : 0.016;

  if (G.state === 'playing' && !G.paused) {
    WaveSystem.update(dt);
    EnemyManager.update(dt);
    TowerManager.update(dt);
    ProjectileManager.update(dt);
    EffectsSystem.update(dt);
  }

  CameraSystem.update(dt);
  UISystem.update();
  SceneSystem.render();
}

// ── DOM ready ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Init settings + language
  GameSettings.load();
  I18n.apply();

  // Setup UI events (once)
  UISystem.setupEvents();

  // Map buttons
  document.querySelectorAll('.mbtn').forEach(btn =>
    btn.addEventListener('click', () => initGame(btn.dataset.size))
  );

  // Restart
  document.getElementById('btnRestart').addEventListener('click', () => {
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
  });

  // Loading screen
  _runLoader(_hideLoader);
});

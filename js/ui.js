/*
ไฟล์: ui.js
หน้าที่: จัดการ UI DOM ทั้งหมด
- setupEvents() — event listeners ครั้งเดียว
- reset()       — reset visual state ทุก game
- update()      — เรียกทุกเฟรม
- Settings modal, Language switching
*/

window.UISystem = (() => {
  'use strict';

  let _eventsReady = false;
  let _msgTimer = null;
  const $ = id => document.getElementById(id);

  // ── setupEvents — ONE TIME ─────────────────────
  function setupEvents() {
    if (_eventsReady) return;
    _eventsReady = true;

    // Camera toggle
    $('btnCam').addEventListener('click', () => {
      if (G.state !== 'playing') return;
      CameraSystem.toggleMode();
    });

    // Wave start
    $('btnWave').addEventListener('click', () => {
      if (G.state !== 'playing') return;
      WaveSystem.startWave();
    });

    // Pause
    $('btnPause').addEventListener('click', () => {
      if (G.state !== 'playing' && G.state !== 'paused') return;
      G.paused = !G.paused;
      $('btnPause').textContent = G.paused ? I18n.t('btn_resume') : I18n.t('btn_pause');
      if (G.paused) showMessage(I18n.t('msg_paused'), 0xffa000, 9999);
      else hideMessage();
    });

    // Settings open
    $('btnSettings').addEventListener('click', () => _openSettings());
    $('btnSettingsClose').addEventListener('click', () => _closeSettings());
    $('btnSettingsApply').addEventListener('click', () => _closeSettings());

    // Tower slots
    document.querySelectorAll('.tslot[data-type]').forEach(slot => {
      slot.addEventListener('click', () => {
        if (G.state !== 'playing' || G.paused) return;
        if (G.cameraMode !== 'god') {
          showMessage(I18n.t('msg_need_god_mode'), 0xff8800, 1.4); return;
        }
        const type = slot.dataset.type;
        const cfg  = TowerManager.configs()[type]; if (!cfg) return;
        if (!Economy.canAfford(cfg.cost)) {
          showMessage(I18n.t('msg_no_gold'), 0xff3355, 1.2);
          SoundSystem.play('error'); return;
        }
        G.selectedTowerType = G.selectedTowerType === type ? null : type;
        if (!G.selectedTowerType) TowerManager.hideGhost();
        TowerManager.deselectTower();
        updateTowerBar();
      });
    });

    $('cancelSlot').addEventListener('click', () => {
      G.selectedTowerType = null;
      TowerManager.hideGhost();
      updateTowerBar();
    });

    // Tower info
    $('btnUpgrade').addEventListener('click', () => TowerManager.upgradeSel());
    $('btnSell').addEventListener('click', ()    => TowerManager.sellSel());
    $('btnClose').addEventListener('click', ()   => TowerManager.deselectTower());

    // Settings controls
    $('sfxVolume').addEventListener('input', e => {
      GameSettings.set('sfxVolume', parseFloat(e.target.value));
      SoundSystem.play('place');
    });
    $('screenShake').addEventListener('change', e => {
      GameSettings.set('screenShake', e.target.checked);
    });

    // Language buttons (all .lang-btn)
    document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        GameSettings.set('language', btn.dataset.lang);
        I18n.setLang(btn.dataset.lang);
        _updateLangBtns();
        applyLang();
      });
    });

    // Restart / map buttons wired in main.js
  }

  // ── Settings modal ─────────────────────────────
  function _openSettings() {
    // Sync UI with current values
    $('sfxVolume').value   = GameSettings.get('sfxVolume');
    $('screenShake').checked = GameSettings.get('screenShake');
    _updateLangBtns();
    $('settingsModal').classList.remove('hidden');
  }
  function _closeSettings() {
    $('settingsModal').classList.add('hidden');
  }
  function _updateLangBtns() {
    const cur = I18n.getLang();
    document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === cur);
    });
  }

  // ── reset — each new game ──────────────────────
  function reset() {
    G.selectedTowerType = null;
    if (window.TowerManager) TowerManager.hideGhost && TowerManager.hideGhost();
    updateTowerBar();
    hideTowerInfo();
    hideMessage();
    $('settingsModal').classList.add('hidden');
    applyLang();
    const btn = $('btnWave');
    btn.textContent = I18n.t('btn_start');
    btn.classList.add('pulse');
    $('btnPause').textContent = I18n.t('btn_pause');
  }

  // ── applyLang — refresh all i18n ──────────────
  function applyLang() {
    I18n.apply();
    // Dynamic elements that need special handling
    const btn = $('btnWave');
    if (btn) {
      if (G.waveActive) btn.textContent = I18n.t('btn_wave_active');
      else btn.textContent = G.waveNumber > 0 ? I18n.t('btn_next') : I18n.t('btn_start');
    }
    const btnCam = $('btnCam');
    if (btnCam) btnCam.textContent = I18n.t(G.cameraMode === 'god' ? 'btn_roam' : 'btn_god');
    const notice = $('roamNotice');
    if (notice && !notice.classList.contains('hidden')) notice.textContent = I18n.t('roam_notice');
    _updateLangBtns();
  }

  // ── update — every frame ───────────────────────
  function update() {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    $('sWave').textContent  = G.waveNumber;
    $('sMoney').textContent = G.money;
    $('sLives').textContent = G.lives;
    updateTowerBar();

    // Cursor hint
    document.body.classList.toggle('placing', !!G.selectedTowerType && G.cameraMode === 'god');
    document.body.classList.toggle('roam',    G.cameraMode === 'roam');

    // Refresh tower info if open
    const sel = TowerManager.getSelected();
    if (sel && sel.alive) _refreshTowerInfo(sel);
  }

  function updateTowerBar() {
    const cfgs = TowerManager.configs();
    document.querySelectorAll('.tslot[data-type]').forEach(slot => {
      const cfg = cfgs[slot.dataset.type]; if (!cfg) return;
      slot.classList.toggle('selected',    G.selectedTowerType === slot.dataset.type);
      slot.classList.toggle('cant-afford', !Economy.canAfford(cfg.cost));
    });
    $('cancelSlot').style.display = G.selectedTowerType ? 'flex' : 'none';
  }

  // ── Tower info ─────────────────────────────────
  function showTowerInfo(tower) {
    $('towerInfo').classList.remove('hidden');
    _refreshTowerInfo(tower);
  }
  function _refreshTowerInfo(tower) {
    $('tiTitle').textContent = tower.cfg.name.toUpperCase();
    $('tiLvl').textContent   = `LV${tower.level + 1}`;
    $('tiStats').innerHTML   = tower.getStatsHTML();
    const upgBtn = $('btnUpgrade');
    if (tower.level >= 2) {
      upgBtn.textContent = I18n.t('max_level'); upgBtn.disabled = true;
    } else {
      const cost = tower.cfg.upgCost[tower.level];
      upgBtn.textContent = `⬆ ${I18n.t('upgrade')} ${cost}g`;
      upgBtn.disabled = !Economy.canAfford(cost);
    }
    $('btnSell').textContent = `💰 ${I18n.t('sell')}`;
  }
  function hideTowerInfo() { $('towerInfo').classList.add('hidden'); }

  // ── Messages ───────────────────────────────────
  function showMessage(text, color = 0x00dc8c, dur = 2.0) {
    const el = $('msgBox'); if (!el) return;
    const hex = '#'+color.toString(16).padStart(6,'0');
    el.textContent = text;
    el.style.color = hex; el.style.textShadow = `0 0 30px ${hex}`;
    el.classList.add('show');
    if (_msgTimer) clearTimeout(_msgTimer);
    if (dur < 999) _msgTimer = setTimeout(hideMessage, dur * 1000);
  }
  function hideMessage() {
    const el = $('msgBox'); if (el) el.classList.remove('show');
    _msgTimer = null;
  }

  // ── Stat flash ─────────────────────────────────
  function flashStat(id, danger = false) {
    const el = $(id); if (!el) return;
    el.style.background = danger ? 'rgba(240,48,80,0.3)' : 'rgba(0,220,140,0.2)';
    setTimeout(() => { el.style.background = ''; }, 320);
  }

  // ── Game Over ──────────────────────────────────
  function showGameOver(won) {
    $('gameOver').classList.remove('hidden');
    const title = $('goTitle');
    title.textContent = won ? I18n.t('victory') : I18n.t('game_over');
    title.style.color = won ? '#00dc8c' : '#f03050';
    $('goMsg').textContent = won
      ? I18n.t('win_msg', G.score)
      : I18n.t('lose_msg', G.waveNumber, G.score);
    $('btnRestart').textContent = I18n.t('play_again');
  }

  return {
    setupEvents, reset, update, applyLang,
    showTowerInfo, hideTowerInfo,
    showMessage, hideMessage,
    flashStat, showGameOver,
    updateTowerBar,
    init: reset,
  };
})();

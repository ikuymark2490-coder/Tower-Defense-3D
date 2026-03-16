/*
ไฟล์: wave.js
หน้าที่: ระบบ Wave — spawn, queue, boss, wave clear
- buildWave(): สร้าง spawn queue
- auto-next wave หลัง wave clear
- Boss ทุก 5 wave
*/

window.WaveSystem = (() => {
  'use strict';

  const SPAWN_GAP  = 1.5;  // sec ระหว่าง spawn
  const WAVE_DELAY = 5.0;  // sec หลัง wave clear ก่อน auto-next

  let _queue      = [];
  let _spawnTimer = 0;
  let _waveTimer  = 0;
  let _autoNext   = false;
  let _maxWaves   = 10;
  let _cleared    = false;

  function init() {
    _queue.length   = 0;
    _spawnTimer     = 0;
    _waveTimer      = 0;
    _autoNext       = false;
    _cleared        = false;
    _maxWaves = G.mapSize === 'small' ? 5 : G.mapSize === 'large' ? Infinity : 10;
  }

  function _buildQueue(n) {
    const q = [];
    const isBoss = n % 5 === 0;

    const basicCnt = Math.min(4 + n * 2, 32);
    const fastCnt  = n >= 2 ? Math.floor(n * 1.4) : 0;
    const tankCnt  = n >= 3 ? Math.floor(n * 0.7) : 0;

    for (let i = 0; i < basicCnt; i++) q.push('basic');
    for (let i = 0; i < fastCnt;  i++) {
      const idx = Math.floor(Math.random() * (q.length + 1));
      q.splice(idx, 0, 'fast');
    }
    for (let i = 0; i < tankCnt; i++) q.push('tank');
    if (isBoss) q.push('boss');
    return q;
  }

  function startWave() {
    if (G.waveActive || G.state !== 'playing') return;
    if (_maxWaves !== Infinity && G.waveNumber >= _maxWaves) return;

    G.waveNumber++;
    G.waveActive = true;
    _cleared     = false;
    _autoNext    = false;
    _waveTimer   = 0;
    _queue       = _buildQueue(G.waveNumber);
    _spawnTimer  = 0;

    const isBoss = G.waveNumber % 5 === 0;
    UISystem.showMessage(
      isBoss ? I18n.t('msg_boss_wave', G.waveNumber) : (I18n.t('msg_wave')+' '+G.waveNumber),
      isBoss ? 0xff3355 : 0x00ffa0,
      2.2
    );
    SoundSystem.play('wave_start');
    if (isBoss) EffectsSystem.screenShake(0.6, 0.3);

    const btn = document.getElementById('btnWave');
    btn.textContent = '⏳ WAVE';
    btn.classList.remove('pulse');
  }

  function update(dt) {
    if (!G.waveActive) {
      if (_autoNext && !_cleared === false) {
        _waveTimer += dt;
        if (_waveTimer >= WAVE_DELAY) { _autoNext = false; startWave(); }
      }
      return;
    }

    // Spawn from queue
    if (_queue.length > 0) {
      _spawnTimer += dt;
      if (_spawnTimer >= SPAWN_GAP) {
        _spawnTimer -= SPAWN_GAP;
        EnemyManager.spawn(_queue.shift());
      }
    }

    // Wave clear check
    if (_queue.length === 0 && EnemyManager.getCount() === 0) {
      _onWaveCleared();
    }
  }

  function _onWaveCleared() {
    if (_cleared) return;
    _cleared     = true;
    G.waveActive = false;

    const bonus = 20 + G.waveNumber * 6;
    Economy.addMoney(bonus);
    SoundSystem.play('wave_clear');
    UISystem.showMessage(I18n.t('msg_wave_clear', G.waveNumber, bonus), 0x00ffa0, 2.8);

    if (_maxWaves !== Infinity && G.waveNumber >= _maxWaves) {
      setTimeout(() => {
        if (G.state === 'playing') { G.state = 'gameover'; UISystem.showGameOver(true); }
      }, 3000);
      return;
    }

    const btn = document.getElementById('btnWave');
    btn.textContent = '▶ NEXT';
    btn.classList.add('pulse');

    _autoNext  = true;
    _waveTimer = 0;
  }

  return { init, startWave, update };
})();

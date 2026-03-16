/*
ไฟล์: economy.js
หน้าที่: ระบบเศรษฐกิจ — เงินและชีวิต
- addMoney / spendMoney / canAfford
- loseLife — หักชีวิต, ตรวจ game over
*/

window.Economy = (() => {
  'use strict';

  function addMoney(n) {
    G.money += n;
    UISystem.flashStat('statMoney');
  }

  function spendMoney(n) {
    if (G.money < n) return false;
    G.money -= n;
    UISystem.flashStat('statMoney');
    return true;
  }

  function canAfford(n) { return G.money >= n; }

  function loseLife(n = 1) {
    G.lives = Math.max(0, G.lives - n);
    UISystem.flashStat('statLives', true);
    EffectsSystem.screenShake(0.7, 0.35);
    SoundSystem.play('life_lost');
    if (G.lives <= 0 && G.state === 'playing') {
      G.state = 'gameover';
      setTimeout(() => UISystem.showGameOver(false), 600);
    }
  }

  return { addMoney, spendMoney, canAfford, loseLife };
})();

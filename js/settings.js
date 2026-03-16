/*
ไฟล์: settings.js
หน้าที่: ระบบตั้งค่าเกม — บันทึก/โหลดจาก localStorage
- sfxVolume: 0-1
- screenShake: true/false
- language: en/th
*/

window.GameSettings = (() => {
  'use strict';

  const KEY = 'td3d_settings';

  const defaults = {
    sfxVolume:   0.7,
    screenShake: true,
    language:    'th',
  };

  let S = { ...defaults };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      S = { ...defaults, ...saved };
    } catch(e) { S = { ...defaults }; }
    _apply();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {}
  }

  function get(key) { return S[key]; }

  function set(key, val) {
    S[key] = val;
    save();
    _apply();
  }

  function _apply() {
    // Apply language
    if (window.I18n) I18n.setLang(S.language);
    // Apply volume
    if (window.SoundSystem) SoundSystem.setEnabled(S.sfxVolume > 0);
  }

  return { load, save, get, set, defaults };
})();

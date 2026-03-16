/*
ไฟล์: lang/i18n.js
หน้าที่: ระบบภาษา — โหลด, สลับ, แปล
- ตั้ง html[lang] เพื่อให้ CSS :lang() ทำงาน
- fallback ไปหา EN ถ้าไม่มี key
*/
window.I18n = (() => {
  'use strict';

  // Default เป็น TH เสมอ (ผู้เล่นไทย)
  let _lang = localStorage.getItem('td3d_lang') || 'th';

  const _data = () => _lang === 'th' ? window.LANG_TH : window.LANG_EN;

  function t(key, ...args) {
    let str = _data()[key] || window.LANG_EN[key] || key;
    args.forEach(a => { str = str.replace('%d', a).replace('%s', a); });
    return str;
  }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('td3d_lang', lang);
    document.documentElement.lang = lang;
    _applyAll();
  }

  function getLang() { return _lang; }

  function _applyAll() {
    document.documentElement.lang = _lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    if (window.UISystem && UISystem.applyLang) UISystem.applyLang();
  }

  function apply() { _applyAll(); }

  return { t, setLang, getLang, apply };
})();

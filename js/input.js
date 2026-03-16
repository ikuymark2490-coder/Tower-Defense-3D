/*
ไฟล์: input.js
หน้าที่: redirect input ไปที่ CameraSystem
(Camera system จัดการ input ทั้งหมดโดยตรงแล้ว)
- init() เรียกจาก main เมื่อเริ่มเกม
*/

window.InputSystem = (() => {
  'use strict';

  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;
    // CameraSystem.init() จัดการ event listeners ทั้งหมดแล้ว
    // เพิ่ม placement ghost tracking
    document.getElementById('c').addEventListener('mousemove', _onGhostMove, { passive: true });
    document.getElementById('c').addEventListener('touchmove', _onGhostTouch, { passive: true });
  }

  function _onGhostMove(e) {
    if (G.cameraMode !== 'god' || !G.selectedTowerType) return;
    const hit = CameraSystem.getGroundPoint(e.clientX, e.clientY);
    if (hit) TowerManager.updateGhost(hit);
  }

  function _onGhostTouch(e) {
    if (G.cameraMode !== 'god' || !G.selectedTowerType || !e.touches[0]) return;
    const t = e.touches[0];
    const hit = CameraSystem.getGroundPoint(t.clientX, t.clientY);
    if (hit) TowerManager.updateGhost(hit);
  }

  return { init };
})();

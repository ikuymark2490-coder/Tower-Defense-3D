/*
ไฟล์: path.js
หน้าที่: กำหนด Waypoints และระบบ Path สำหรับศัตรูเดิน
- ชุด waypoints ของเส้นทางศัตรู
- ตรวจสอบระยะทางจาก path (ก่อนวาง tower)
- คำนวณความยาว path ทั้งหมด
*/

window.PathSystem = (() => {
  'use strict';

  // ── Path waypoints (world coordinates, y = ground) ──────────
  // เส้นทางเป็น S-curve ซับซ้อน สำหรับ medium map (ปรับ scale ตาม mapSize)
  const BASE_WP = [
    [  0,  0.5, -24 ],  // 0 — Spawn point (top)
    [  0,  0.5, -10 ],  // 1
    [ 14,  0.5, -10 ],  // 2 — turn right
    [ 14,  0.5,   2 ],  // 3
    [ -4,  0.5,   2 ],  // 4 — turn left
    [ -4,  0.5,  14 ],  // 5
    [  8,  0.5,  14 ],  // 6 — turn right
    [  8,  0.5,  25 ],  // 7 — End (base)
  ];

  let waypoints = [];

  function build(mapSize) {
    // Scale offsets by map size
    const scale = mapSize === 'small' ? 0.72 : mapSize === 'large' ? 1.3 : 1.0;
    waypoints = BASE_WP.map(([x, y, z]) =>
      new THREE.Vector3(x * scale, y, z * scale)
    );
  }

  // ── Distance from point to line segment ──────────────────────
  function _distPtSeg(p, a, b) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(p, a);
    const t  = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
    const proj = new THREE.Vector3().copy(a).addScaledVector(ab, t);
    // Only XZ distance
    const dx = p.x - proj.x;
    const dz = p.z - proj.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // ── Is position too close to path? ───────────────────────────
  function isTooClose(pos, minDist) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (_distPtSeg(pos, waypoints[i], waypoints[i + 1]) < minDist) return true;
    }
    return false;
  }

  // ── Total path length ─────────────────────────────────────────
  function getTotalLength() {
    let len = 0;
    for (let i = 0; i < waypoints.length - 1; i++)
      len += waypoints[i].distanceTo(waypoints[i + 1]);
    return len;
  }

  // ── Get spawn position (start of path) ───────────────────────
  function getSpawnPos() {
    return waypoints[0] ? waypoints[0].clone() : new THREE.Vector3();
  }

  // ── Get end position ──────────────────────────────────────────
  function getEndPos() {
    return waypoints.length > 0
      ? waypoints[waypoints.length - 1].clone()
      : new THREE.Vector3();
  }

  return {
    build,
    get waypoints() { return waypoints; },
    isTooClose,
    getTotalLength,
    getSpawnPos,
    getEndPos,
  };
})();

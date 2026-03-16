/*
ไฟล์: tower.js
หน้าที่: ระบบ Tower ทั้งหมด
- TowerManager: วาง/ลบ/เลือก tower
- Tower class: damage, range, fireRate, upgrade, sell
- Ghost preview เมื่อกำลังเลือก tower
- Range ring indicator
*/

window.TowerManager = (() => {
  'use strict';

  const CONFIGS = {
    gun: {
      name: 'Gun Tower',
      cost: 50, sellVal: 30,
      damage:   [22, 38, 58],
      range:    [8,  9.5, 11.5],
      fireRate: [1.4, 2.0, 2.8],
      speed: 16,
      color: 0x4488ff, accent: 0x88ccff,
      upgCost: [80, 150],
    },
    slow: {
      name: 'Slow Tower',
      cost: 70, sellVal: 42,
      damage:   [8, 14, 20],
      range:    [7, 8.5, 10],
      fireRate: [0.7, 1.0, 1.3],
      speed: 10,
      color: 0x44ddff, accent: 0x88ffff,
      slow: [0.45, 0.35, 0.25], slowDur: 2.2,
      upgCost: [100, 180],
    },
    cannon: {
      name: 'Cannon',
      cost: 120, sellVal: 72,
      damage:   [70, 115, 165],
      range:    [9, 10.5, 12.5],
      fireRate: [0.38, 0.55, 0.75],
      speed: 11,
      color: 0xff5533, accent: 0xff8844,
      splash: [3.0, 3.8, 5.0],
      upgCost: [150, 260],
    },
  };

  const PATH_CLEAR = 3.4;
  const TOWER_CLEAR = 2.4;
  const MAP_HALF = 27;

  const _towers = [];
  let _selected = null;
  let _ringMesh = null;
  let _ghost    = null;  // placement preview
  let _ghostType = null;

  const _ray = new THREE.Raycaster();

  // ── Ghost (placement preview) ─────────────────
  function _makeGhostMesh(type) {
    const cfg = CONFIGS[type];
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.45, wireframe: false });
    const g   = new THREE.Group();

    // Simple box body
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.9), mat));
    // Range ring
    const rMat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(cfg.range[0] - 0.06, cfg.range[0], 40), rMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.6;
    ring.name = 'ghostRing';
    g.add(ring);
    return g;
  }

  function showGhost(type) {
    hideGhost();
    if (!G.scene) return;
    _ghostType = type;
    _ghost = _makeGhostMesh(type);
    _ghost.name = '__ghost__';
    G.scene.add(_ghost);
  }

  function updateGhost(pos) {
    if (!_ghost || !G.selectedTowerType) return;
    if (_ghostType !== G.selectedTowerType) showGhost(G.selectedTowerType);
    if (!_ghost) return;

    const snappedX = Math.round(pos.x);
    const snappedZ = Math.round(pos.z);
    _ghost.position.set(snappedX, 1.0, snappedZ);

    const ok = canPlace(G.selectedTowerType, new THREE.Vector3(snappedX, 0, snappedZ)).ok;
    _ghost.children.forEach(c => {
      if (c.material) c.material.color.setHex(ok ? CONFIGS[G.selectedTowerType].color : 0xff2244);
    });
  }

  function hideGhost() {
    if (_ghost && G.scene) G.scene.remove(_ghost);
    _ghost = null; _ghostType = null;
  }

  // ── Tower mesh builder ────────────────────────
  function _buildMesh(type, level) {
    const cfg    = CONFIGS[type];
    const s      = 1 + level * 0.12;
    const group  = new THREE.Group();
    const baseMat  = new THREE.MeshLambertMaterial({ color: 0x334455 });
    const bodyMat  = new THREE.MeshLambertMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.18 });
    const accMat   = new THREE.MeshLambertMaterial({ color: cfg.accent });

    // Platform
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.35, 8), baseMat);
    base.castShadow = true;
    group.add(base);

    if (type === 'gun') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.2 * s, 8), bodyMat);
      body.position.y = 0.78; body.castShadow = true;
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.25, 6), accMat);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.62, 1.5 * s, 0);
      barrel.name = 'barrel';
      group.add(barrel);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: cfg.accent }));
      cap.position.set(0, 1.5 * s, 0);
      group.add(cap);
    } else if (type === 'slow') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 1.5 * s, 6), bodyMat);
      body.position.y = 0.93; body.castShadow = true;
      group.add(body);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 * s, 0), accMat);
        crystal.position.set(Math.cos(a) * 0.42, 1.9 * s, Math.sin(a) * 0.42);
        group.add(crystal);
      }
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 6), new THREE.MeshBasicMaterial({ color: cfg.accent }));
      orb.position.set(0, 1.9 * s, 0);
      group.add(orb);
    } else { // cannon
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.64, 1.05 * s, 8), bodyMat);
      body.position.y = 0.7; body.castShadow = true;
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 1.6, 8), accMat);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.78, 1.22 * s, 0);
      barrel.name = 'barrel';
      group.add(barrel);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.22, 8), bodyMat);
      muzzle.rotation.z = Math.PI / 2;
      muzzle.position.set(1.5, 1.22 * s, 0);
      group.add(muzzle);
    }

    // Level pips
    for (let i = 0; i < level; i++) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
      pip.position.set(-0.36 + i * 0.38, 0.28, 0.95);
      group.add(pip);
    }

    return group;
  }

  function _makeRingMesh(range) {
    const geo  = new THREE.RingGeometry(range - 0.06, range, 44);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthTest: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    ring.renderOrder = 2;
    return ring;
  }

  // ── Tower class ───────────────────────────────
  class Tower {
    constructor(type, pos) {
      this.type  = type;
      this.level = 0;
      this.pos   = pos.clone(); this.pos.y = 0;
      this.fireCooldown = 0;
      this.alive = true;
      this._rebuild();
    }
    _rebuild() {
      if (this.mesh) G.scene.remove(this.mesh);
      this.mesh = _buildMesh(this.type, this.level);
      this.mesh.position.copy(this.pos);
      G.scene.add(this.mesh);
    }
    get cfg()      { return CONFIGS[this.type]; }
    get damage()   { return this.cfg.damage[this.level]; }
    get range()    { return this.cfg.range[this.level]; }
    get fireRate() { return this.cfg.fireRate[this.level]; }
    update(dt) {
      if (!this.alive) return;
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      if (this.fireCooldown > 0) return;
      const t = EnemyManager.getNearest(this.pos, this.range);
      if (!t) return;
      this._fire(t);
      this.fireCooldown = 1 / this.fireRate;
    }
    _fire(target) {
      const origin = this.mesh.position.clone();
      origin.y += this.level * 0.12 + 1.6;
      const dx = target.pos.x - this.pos.x;
      const dz = target.pos.z - this.pos.z;
      this.mesh.rotation.y = -Math.atan2(dz, dx) - Math.PI / 2;
      const mFlash = origin.clone();
      mFlash.x += Math.cos(-this.mesh.rotation.y - Math.PI / 2) * 1.4;
      mFlash.z += Math.sin(-this.mesh.rotation.y - Math.PI / 2) * 1.4;
      EffectsSystem.muzzleFlash(mFlash, this.cfg.accent);
      SoundSystem.play('shoot_' + this.type);
      const opts = {};
      if (this.cfg.slow)   { opts.slow = this.cfg.slow[this.level]; opts.slowDur = this.cfg.slowDur; }
      if (this.cfg.splash) { opts.splash = this.cfg.splash[this.level]; }
      ProjectileManager.create(this.type, origin, target, this.damage, this.cfg.speed, opts);
    }
    upgrade() {
      if (this.level >= 2) return false;
      const cost = this.cfg.upgCost[this.level];
      if (!Economy.spendMoney(cost)) return false;
      this.level++;
      const oldPos = this.pos.clone();
      this._rebuild();
      this.mesh.position.copy(oldPos);
      SoundSystem.play('upgrade');
      UISystem.showMessage(I18n.t('msg_upgraded', this.level+1), 0x00c8ff);
      return true;
    }
    sell() {
      const val = Math.floor(this.cfg.sellVal * (1 + this.level * 0.4));
      Economy.addMoney(val);
      G.scene.remove(this.mesh);
      this.mesh.traverse(c => { if (c.isMesh) c.geometry.dispose(); });
      this.alive = false;
      EffectsSystem.explosion(this.pos.clone(), 0xffdd00, 0.8);
      SoundSystem.play('sell');
      UISystem.showMessage(I18n.t('msg_sold', val), 0xffbb00);
    }
    getStatsHTML() {
      const c    = this.cfg;
      const sell = Math.floor(c.sellVal * (1 + this.level * 0.4));
      const upg  = c.upgCost[this.level];
      return `${I18n.t("stat_dmg")} <span>${this.damage}</span> &nbsp; ${I18n.t("stat_rng")} <span>${this.range}</span> &nbsp; ${I18n.t("stat_rps")} <span>${this.fireRate.toFixed(1)}</span><br>${I18n.t("sell_label")} <span>${sell}g</span> &nbsp; ${upg ? I18n.t("upg_label")+' <span>'+upg+'g</span>' : '<span style="color:#0fa">'+I18n.t("max_level")+'</span>'}`;
    }
  }

  // ── Placement validation ──────────────────────
  function canPlace(type, pos) {
    if (!pos) return { ok: false };
    if (!CONFIGS[type]) return { ok: false, reason: 'Unknown type' };
    if (!Economy.canAfford(CONFIGS[type].cost)) return { ok: false, reason: I18n.t('msg_not_enough_gold') };
    if (PathSystem.isTooClose(pos, PATH_CLEAR)) return { ok: false, reason: I18n.t('msg_too_close_path') };
    for (const t of _towers) {
      if (!t.alive) continue;
      const dx = t.pos.x - pos.x, dz = t.pos.z - pos.z;
      if (Math.sqrt(dx*dx+dz*dz) < TOWER_CLEAR) return { ok: false, reason: I18n.t('msg_too_close_tower') };
    }
    if (Math.abs(pos.x) > MAP_HALF || Math.abs(pos.z) > MAP_HALF) return { ok: false, reason: I18n.t('msg_out_of_bounds') };
    return { ok: true };
  }

  // ── Place ─────────────────────────────────────
  function place(type, pos) {
    const snapped = new THREE.Vector3(Math.round(pos.x), 0, Math.round(pos.z));
    const check   = canPlace(type, snapped);
    if (!check.ok) {
      UISystem.showMessage(check.reason || I18n.t('msg_cant_place'), 0xff3355, 1.2);
      SoundSystem.play('error');
      return null;
    }
    Economy.spendMoney(CONFIGS[type].cost);
    const tower = new Tower(type, snapped);
    _towers.push(tower);
    SoundSystem.play('place');
    UISystem.showMessage(I18n.t('msg_placed', CONFIGS[type].name), 0x00ffa0, 1.0);
    G.selectedTowerType = null;
    hideGhost();
    UISystem.updateTowerBar();
    return tower;
  }

  // ── Select ────────────────────────────────────
  function trySelectAt(cx, cy) {
    if (!G.camera) return;
    const mouse = new THREE.Vector2((cx/window.innerWidth)*2-1, -(cy/window.innerHeight)*2+1);
    _ray.setFromCamera(mouse, G.camera);
    for (const tower of _towers) {
      if (!tower.alive) continue;
      const objs = [];
      tower.mesh.traverse(c => { if (c.isMesh) objs.push(c); });
      if (_ray.intersectObjects(objs).length > 0) { selectTower(tower); return; }
    }
    deselectTower();
  }

  function selectTower(tower) {
    deselectTower();
    _selected = tower;
    G.selectedTower = tower;
    _ringMesh = _makeRingMesh(tower.range);
    _ringMesh.position.copy(tower.pos);
    G.scene.add(_ringMesh);
    UISystem.showTowerInfo(tower);
  }

  function deselectTower() {
    if (_ringMesh) { G.scene.remove(_ringMesh); _ringMesh.geometry.dispose(); _ringMesh = null; }
    _selected = null;
    G.selectedTower = null;
    UISystem.hideTowerInfo();
  }

  // ── Update ────────────────────────────────────
  function update(dt) {
    if (_ringMesh && _selected && _selected.alive) _ringMesh.position.copy(_selected.pos);

    // Show/hide ghost based on selection state
    if (G.selectedTowerType) {
      if (_ghostType !== G.selectedTowerType) showGhost(G.selectedTowerType);
    } else {
      hideGhost();
    }

    for (let i = _towers.length - 1; i >= 0; i--) {
      if (!_towers[i].alive) { _towers.splice(i, 1); continue; }
      _towers[i].update(dt);
    }
  }

  function clearAll() {
    for (const t of _towers) {
      if (G.scene) G.scene.remove(t.mesh);
      t.mesh.traverse(c => { if (c.isMesh) c.geometry.dispose(); });
    }
    _towers.length = 0;
    deselectTower();
    hideGhost();
  }

  function upgradeSel() { if (_selected) { _selected.upgrade(); if(_selected.alive) selectTower(_selected); } }
  function sellSel()    { if (_selected) { _selected.sell(); deselectTower(); } }
  function getSelected(){ return _selected; }
  function getAll()     { return _towers; }
  function configs()    { return CONFIGS; }

  return { place, trySelectAt, selectTower, deselectTower, updateGhost, showGhost, hideGhost, update, clearAll, upgradeSel, sellSel, getSelected, getAll, configs, canPlace };
})();

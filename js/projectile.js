/*
ไฟล์: projectile.js
หน้าที่: ระบบกระสุน
- บินหา target
- splash damage (cannon)
- slow effect (slow tower)
- hit effects
*/

window.ProjectileManager = (() => {
  'use strict';

  const _list = [];

  const _geoCache = {};
  function _geo(type) {
    if (!_geoCache[type]) {
      if (type === 'gun')    _geoCache[type] = new THREE.SphereGeometry(0.12, 5, 5);
      else if (type === 'slow') _geoCache[type] = new THREE.OctahedronGeometry(0.2, 0);
      else                   _geoCache[type] = new THREE.SphereGeometry(0.28, 6, 6);
    }
    return _geoCache[type];
  }

  const COLORS = { gun: 0xffff44, slow: 0x88ffff, cannon: 0xff8822 };

  class Projectile {
    constructor(towerType, origin, target, dmg, speed, opts) {
      this.towerType = towerType;
      this.target    = target;
      this.dmg       = dmg;
      this.speed     = speed;
      this.opts      = opts || {};
      this.alive     = true;

      const color = COLORS[towerType] || 0xffffff;
      const mat   = new THREE.MeshBasicMaterial({ color });
      this.mesh   = new THREE.Mesh(_geo(towerType), mat);
      this.mesh.position.copy(origin);
      G.scene.add(this.mesh);
    }

    update(dt) {
      if (!this.alive) return;
      const tPos = this.target.alive
        ? new THREE.Vector3(this.target.pos.x, this.target.pos.y + this.target.cfg.scale * 0.6, this.target.pos.z)
        : this.mesh.position.clone();

      const dx = tPos.x - this.mesh.position.x;
      const dy = tPos.y - this.mesh.position.y;
      const dz = tPos.z - this.mesh.position.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < 0.5 + this.speed * dt * 1.1) { this._hit(tPos); return; }

      const s = this.speed * dt / dist;
      this.mesh.position.x += dx * s;
      this.mesh.position.y += dy * s;
      this.mesh.position.z += dz * s;
      this.mesh.rotation.x += 7 * dt;
      this.mesh.rotation.y += 4 * dt;
    }

    _hit(pos) {
      this.alive = false;
      G.scene.remove(this.mesh);
      this.mesh.material.dispose();

      if (this.towerType === 'cannon' && this.opts.splash > 0) {
        EffectsSystem.explosion(pos, COLORS.cannon, 1.5);
        EffectsSystem.screenShake(0.28, 0.12);
        const victims = EnemyManager.getInRange(pos, this.opts.splash);
        for (const e of victims) e.takeDamage(this.dmg);
      } else {
        EffectsSystem.hitSpark(pos, COLORS[this.towerType] || 0xffffff);
        if (this.target.alive)
          this.target.takeDamage(this.dmg, this.opts.slow, this.opts.slowDur);
      }
    }
  }

  function create(type, origin, target, dmg, speed, opts) {
    const p = new Projectile(type, origin, target, dmg, speed, opts);
    _list.push(p);
  }

  function update(dt) {
    for (let i = _list.length - 1; i >= 0; i--) {
      if (!_list[i].alive) { _list.splice(i, 1); continue; }
      _list[i].update(dt);
    }
  }

  function clearAll() {
    for (const p of _list) { G.scene.remove(p.mesh); p.mesh.material.dispose(); }
    _list.length = 0;
  }

  return { create, update, clearAll };
})();

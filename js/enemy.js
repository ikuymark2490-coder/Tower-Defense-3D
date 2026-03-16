/*
ไฟล์: enemy.js
หน้าที่: ระบบศัตรู — AI, HP, HP Bar, ความตาย
- เดินตาม Path waypoints
- HP Bar 3D billboard
- slow effect, takeDamage
- reward + particle เมื่อตาย
*/

window.EnemyManager = (() => {
  'use strict';

  const TYPES = {
    basic:  { hp: 100,  speed: 3.5, reward: 10,  color: 0x44ff88, emissive: 0x003311, scale: 0.58, name: 'Grunt'   },
    fast:   { hp: 65,   speed: 7.2, reward: 15,  color: 0xffee44, emissive: 0x332200, scale: 0.44, name: 'Speeder' },
    tank:   { hp: 400,  speed: 1.9, reward: 35,  color: 0xaaaaaa, emissive: 0x111111, scale: 0.85, name: 'Tank'    },
    boss:   { hp: 3000, speed: 1.4, reward: 260, color: 0xff2244, emissive: 0x440011, scale: 1.75, name: 'BOSS'    },
  };

  const _enemies = [];

  // ── Mesh builder ──────────────────────────────
  function _buildMesh(type) {
    const cfg = TYPES[type];
    const s   = cfg.scale;
    const g   = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: cfg.color, emissive: cfg.emissive });
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.2, s), bodyMat);
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.38, 7, 6),
      new THREE.MeshLambertMaterial({ color: cfg.color }));
    head.position.y = s * 0.88;
    head.castShadow = true;
    g.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    for (const ex of [-0.11 * s, 0.11 * s]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 4, 4), eyeMat);
      eye.position.set(ex, s * 0.95, s * 0.32);
      g.add(eye);
    }

    if (type === 'boss') {
      const crownMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.55, 4), crownMat);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * s * 0.38, s * 1.35, Math.sin(a) * s * 0.38);
        g.add(spike);
      }
    }
    if (type === 'tank') {
      const shMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const sh = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, s * 0.85, s * 0.08), shMat);
        sh.position.set(Math.cos(a) * s * 0.65, 0, Math.sin(a) * s * 0.65);
        sh.rotation.y = a;
        g.add(sh);
      }
    }
    if (type === 'fast') {
      // Wing fins
      const finMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 });
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(s * 0.22, s * 0.6, 3), finMat);
        fin.rotation.z = side * Math.PI / 2;
        fin.position.set(side * s * 0.55, 0.05, 0);
        g.add(fin);
      }
    }

    return g;
  }

  // ── HP Bar ────────────────────────────────────
  function _buildHPBar() {
    const g = new THREE.Group();
    const bg   = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false, transparent: true, opacity: 0.8 }));
    bg.renderOrder = 998;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x00ff44, depthTest: false, transparent: true, opacity: 0.9 }));
    fill.position.z = 0.01; fill.renderOrder = 999;
    g.add(bg); g.add(fill);
    return g;
  }

  // ── Enemy class ───────────────────────────────
  class Enemy {
    constructor(type) {
      this.type     = type;
      this.cfg      = TYPES[type] || TYPES.basic;
      this.hp       = this.cfg.hp;
      this.maxHp    = this.cfg.hp;
      this.speed    = this.cfg.speed;
      this.alive    = true;
      this.reached  = false;
      this.wpIdx    = 1;
      this.pos      = PathSystem.getSpawnPos();
      this.slowFactor = 1;
      this.slowTimer  = 0;
      this._bob       = Math.random() * Math.PI * 2;

      this.mesh = _buildMesh(type);
      this.mesh.position.copy(this.pos);
      G.scene.add(this.mesh);

      this.hpBar = _buildHPBar();
      G.scene.add(this.hpBar);
    }

    update(dt) {
      if (!this.alive) return;
      this._bob += dt * (3.5 + this.speed * 0.3);

      if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }

      const spd = this.speed * this.slowFactor;
      const wp  = PathSystem.waypoints;

      while (this.wpIdx < wp.length) {
        const target = wp[this.wpIdx];
        const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        const move = spd * dt;
        if (move >= dist) {
          this.pos.x = target.x; this.pos.z = target.z;
          this.wpIdx++;
          if (this.wpIdx >= wp.length) {
            this.reached = true; this.alive = false;
            this._remove();
            Economy.loseLife(1);
            return;
          }
        } else {
          const nx = dx / dist, nz = dz / dist;
          this.pos.x += nx * move; this.pos.z += nz * move;
          this.mesh.rotation.y = -Math.atan2(nz, nx) + Math.PI / 2;
          break;
        }
      }

      this.mesh.position.set(this.pos.x, this.pos.y + Math.sin(this._bob) * 0.055, this.pos.z);
      this.hpBar.position.set(this.pos.x, this.pos.y + this.cfg.scale * 1.65 + 0.85, this.pos.z);
      if (G.camera) this.hpBar.quaternion.copy(G.camera.quaternion);

      const pct  = this.hp / this.maxHp;
      const fill = this.hpBar.children[1];
      fill.scale.x = Math.max(0.001, pct);
      fill.position.x = (pct - 1) * 0.65;
      fill.material.color.setHSL(pct * 0.33, 1, 0.5);
    }

    takeDamage(amount, slowFactor, slowDuration) {
      if (!this.alive) return;
      this.hp -= amount;
      if (slowFactor !== undefined && slowFactor < 1) {
        this.slowFactor = Math.min(this.slowFactor, slowFactor);
        this.slowTimer  = Math.max(this.slowTimer, slowDuration || 2);
      }
      if (this.hp <= 0) {
        this.hp = 0; this.alive = false;
        G.score  = (G.score || 0) + this.cfg.reward;
        Economy.addMoney(this.cfg.reward);
        EffectsSystem.explosion(this.mesh.position.clone(), this.cfg.color, this.cfg.scale);
        SoundSystem.play(this.type === 'boss' ? 'boss_die' : 'enemy_die');
        if (this.type === 'boss') EffectsSystem.screenShake(2.0, 0.9);
        this._remove();
      }
    }

    _remove() {
      G.scene.remove(this.mesh);
      G.scene.remove(this.hpBar);
      this.mesh.traverse(c => { if (c.isMesh) { c.geometry.dispose(); } });
    }
  }

  // ── Public API ────────────────────────────────
  function spawn(type) {
    const e = new Enemy(type || 'basic');
    _enemies.push(e);
    return e;
  }

  function update(dt) {
    for (let i = _enemies.length - 1; i >= 0; i--) {
      if (_enemies[i].alive) _enemies[i].update(dt);
      else _enemies.splice(i, 1);
    }
  }

  function getNearest(pos, range) {
    let nearest = null, minD2 = range * range;
    for (const e of _enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d2 = dx*dx + dz*dz;
      if (d2 < minD2) { minD2 = d2; nearest = e; }
    }
    return nearest;
  }

  function getInRange(pos, range) {
    const r2 = range * range;
    return _enemies.filter(e => {
      if (!e.alive) return false;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      return dx*dx + dz*dz <= r2;
    });
  }

  function clearAll() {
    for (const e of _enemies) { if (e.alive) e._remove(); }
    _enemies.length = 0;
  }

  function getCount() { return _enemies.filter(e => e.alive).length; }
  function getAll()   { return _enemies; }

  return { spawn, update, getNearest, getInRange, clearAll, getCount, getAll };
})();

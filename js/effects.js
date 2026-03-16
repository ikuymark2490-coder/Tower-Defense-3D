/*
ไฟล์: effects.js
หน้าที่: เอฟเฟกต์ภาพ — Particles, Explosion, Muzzle Flash, Screen Shake
- particle explosion เมื่อศัตรูตาย
- muzzle flash เมื่อยิงกระสุน
- hit spark เมื่อกระสุนชน
- screen shake สำหรับ boss
*/

window.EffectsSystem = (() => {
  'use strict';

  const particles = []; // active particle groups
  let shakeIntensity = 0;
  let shakeDuration  = 0;
  const _shakeOffset = new THREE.Vector3();

  // Reusable material cache
  const MATS = {};
  function _getMat(color) {
    if (!MATS[color]) {
      MATS[color] = new THREE.MeshBasicMaterial({ color, transparent: true });
    }
    return MATS[color];
  }

  // ── Explosion ──────────────────────────────────
  function explosion(pos, color = 0xff8800, scale = 1.0) {
    const count  = Math.floor(10 + scale * 8);
    const group  = { meshes: [], timers: [] };

    for (let i = 0; i < count; i++) {
      const size = (0.1 + Math.random() * 0.25) * scale;
      const geo  = Math.random() < 0.5
        ? new THREE.BoxGeometry(size, size, size)
        : new THREE.SphereGeometry(size * 0.6, 4, 4);
      const mat  = _getMat(color).clone(); // need own opacity
      mat.transparent = true;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.position.y += 0.5 * scale;

      // Random velocity
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.5;
      const spd   = (1.5 + Math.random() * 3.0) * scale;
      mesh.userData.vel = new THREE.Vector3(
        spd * Math.sin(phi) * Math.cos(theta),
        spd * (0.5 + Math.random()),
        spd * Math.sin(phi) * Math.sin(theta)
      );
      mesh.userData.spin = (Math.random() - 0.5) * 8;
      mesh.userData.life = 0;
      mesh.userData.maxLife = 0.4 + Math.random() * 0.4;

      G.scene.add(mesh);
      group.meshes.push(mesh);
    }

    // Ring flash
    const ringGeo = new THREE.RingGeometry(0, 0.6 * scale, 12);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.y += 0.1;
    ring.rotation.x = -Math.PI / 2;
    ring.userData.vel = new THREE.Vector3(0, 0, 0);
    ring.userData.life = 0;
    ring.userData.maxLife = 0.25;
    ring.userData.isRing = true;
    ring.userData.scale = scale;
    G.scene.add(ring);
    group.meshes.push(ring);

    particles.push(group);
  }

  // ── Muzzle flash ───────────────────────────────
  function muzzleFlash(pos, color = 0xffff88) {
    const geo  = new THREE.SphereGeometry(0.22, 5, 5);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData.vel = new THREE.Vector3(0, 0.5, 0);
    mesh.userData.life = 0;
    mesh.userData.maxLife = 0.12;
    mesh.userData.isFlash = true;

    G.scene.add(mesh);
    particles.push({ meshes: [mesh] });
  }

  // ── Hit spark ──────────────────────────────────
  function hitSpark(pos, color = 0xffffff) {
    for (let i = 0; i < 6; i++) {
      const geo  = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      const spd = 2 + Math.random() * 3;
      const a   = Math.random() * Math.PI * 2;
      mesh.userData.vel = new THREE.Vector3(
        spd * Math.cos(a),
        spd * (0.5 + Math.random()),
        spd * Math.sin(a)
      );
      mesh.userData.life    = 0;
      mesh.userData.maxLife = 0.2 + Math.random() * 0.15;
      G.scene.add(mesh);
      particles.push({ meshes: [mesh] });
    }
  }

  // ── Slow ice effect ────────────────────────────
  function slowEffect(pos) {
    for (let i = 0; i < 5; i++) {
      const geo  = new THREE.OctahedronGeometry(0.15 + Math.random() * 0.1, 0);
      const mat  = new THREE.MeshBasicMaterial({ color: 0x88ffff, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random();
      mesh.userData.vel = new THREE.Vector3(spd * Math.cos(a), spd, spd * Math.sin(a));
      mesh.userData.life    = 0;
      mesh.userData.maxLife = 0.35;
      G.scene.add(mesh);
      particles.push({ meshes: [mesh] });
    }
  }

  // ── Screen shake ───────────────────────────────
  function screenShake(intensity = 1.0, duration = 0.4) {
    if (window.GameSettings && !GameSettings.get("screenShake")) return;
    shakeIntensity = intensity;
    shakeDuration  = duration;
  }

  // ── Update all particles ───────────────────────
  function update(dt) {
    // Screen shake
    if (shakeDuration > 0) {
      shakeDuration -= dt;
      const s = shakeIntensity * (shakeDuration / 0.4);
      _shakeOffset.set(
        (Math.random() - 0.5) * s * 0.6,
        (Math.random() - 0.5) * s * 0.3,
        (Math.random() - 0.5) * s * 0.4
      );
      G.camera.position.add(_shakeOffset);
    }

    // Particle groups
    for (let g = particles.length - 1; g >= 0; g--) {
      const group = particles[g];
      let allDead = true;

      for (let m = group.meshes.length - 1; m >= 0; m--) {
        const mesh = group.meshes[m];
        mesh.userData.life += dt;
        const t = mesh.userData.life / mesh.userData.maxLife;

        if (t >= 1) {
          G.scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          group.meshes.splice(m, 1);
          continue;
        }

        allDead = false;

        // Physics
        if (mesh.userData.vel) {
          mesh.position.addScaledVector(mesh.userData.vel, dt);
          mesh.userData.vel.y -= 6 * dt; // gravity
          mesh.position.y = Math.max(0.05, mesh.position.y);
        }

        if (mesh.userData.spin) mesh.rotation.z += mesh.userData.spin * dt;

        // Ring expand
        if (mesh.userData.isRing) {
          const rs = 1 + t * 5 * mesh.userData.scale;
          mesh.scale.setScalar(rs);
        }

        // Opacity fade
        if (mesh.material.transparent) {
          mesh.material.opacity = Math.max(0, 1 - t);
        }
      }

      if (allDead) particles.splice(g, 1);
    }
  }

  function clearAll() {
    for (const group of particles) {
      for (const mesh of group.meshes) {
        G.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    particles.length = 0;
  }

  return {
    explosion,
    muzzleFlash,
    hitSpark,
    slowEffect,
    screenShake,
    update,
    clearAll,
  };
})();

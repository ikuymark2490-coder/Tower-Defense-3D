/*
ไฟล์: map.js
หน้าที่: สร้างแมพ 3D — พื้น, ถนน, ต้นไม้, markers
- พื้นเขียวครอบคลุมทั้งโลก (ใหญ่มาก)
- ถนนตาม waypoints
- ต้นไม้, หิน
- จุด Spawn / Base
*/

window.MapSystem = (() => {
  'use strict';

  const OBJECTS = [];

  function build(mapSize) {
    OBJECTS.length = 0;
    PathSystem.build(mapSize);
    _buildGround();
    _buildRoad();
    _buildDecorations();
    _buildMarkers();
    _buildBase();
  }

  // ── BIG ground — ปกคลุมทั้งโลก ────────────────
  function _buildGround() {
    const sc = G.scene;

    // Layer 1: ไกลมาก — สีเขียวเข้ม flat
    const farGeo = new THREE.PlaneGeometry(500, 500, 2, 2);
    const farMat = new THREE.MeshLambertMaterial({ color: 0x173012 });
    const farMesh = new THREE.Mesh(farGeo, farMat);
    farMesh.rotation.x = -Math.PI / 2;
    farMesh.position.y = -0.01;
    farMesh.receiveShadow = false;
    sc.add(farMesh);
    OBJECTS.push(farMesh);

    // Layer 2: พื้นที่เล่นหลัก — มีรายละเอียด
    const sz  = 100;
    const seg = 30;
    const geo = new THREE.PlaneGeometry(sz, sz, seg, seg);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (!PathSystem.isTooClose(new THREE.Vector3(x, 0, z), 5))
        pos.setY(i, (Math.random() - 0.5) * 0.07);
    }
    geo.computeVertexNormals();
    const mat  = new THREE.MeshLambertMaterial({ color: 0x1e3d18 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x  = -Math.PI / 2;
    mesh.position.y  = 0.01;
    mesh.receiveShadow = true;
    sc.add(mesh);
    OBJECTS.push(mesh);

    // Grid overlay (subtle)
    const grid = new THREE.GridHelper(100, 50, 0x1a3020, 0x1a3020);
    grid.position.y = 0.15;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    sc.add(grid);
    OBJECTS.push(grid);
  }

  // ── Road segments ──────────────────────────────
  function _buildRoad() {
    const sc  = G.scene;
    const wp  = PathSystem.waypoints;
    if (wp.length < 2) return;
    const rW  = 3.8;
    const roadMat  = new THREE.MeshLambertMaterial({ color: 0x4a3828 });
    const edgeMat  = new THREE.MeshLambertMaterial({ color: 0x2a1e12 });
    const dashMat  = new THREE.MeshBasicMaterial({ color: 0xffeeaa });

    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.sqrt(dx*dx + dz*dz);
      const isH = Math.abs(dz) < 0.1;
      const mx = (a.x+b.x)/2, mz = (a.z+b.z)/2;

      // Edge (wider, underneath)
      const eW = isH ? len + rW : rW + 0.5;
      const eD = isH ? rW + 0.5 : len + rW;
      const eM = new THREE.Mesh(new THREE.BoxGeometry(eW, 0.12, eD), edgeMat);
      eM.position.set(mx, 0.06, mz); eM.receiveShadow = true;
      sc.add(eM); OBJECTS.push(eM);

      // Road surface
      const sW = isH ? len + rW*0.9 : rW*0.9;
      const sD = isH ? rW*0.9 : len + rW*0.9;
      const sM = new THREE.Mesh(new THREE.BoxGeometry(sW, 0.15, sD), roadMat);
      sM.position.set(mx, 0.12, mz); sM.receiveShadow = true;
      sc.add(sM); OBJECTS.push(sM);

      // Dashes
      const dCount = Math.floor(len / 3.2);
      for (let d = 0; d < dCount; d++) {
        const tt = (d + 0.5) / dCount;
        const px = a.x + dx * tt, pz = a.z + dz * tt;
        const dG = isH ? new THREE.BoxGeometry(1.1, 0.02, 0.12) : new THREE.BoxGeometry(0.12, 0.02, 1.1);
        const dM = new THREE.Mesh(dG, dashMat);
        dM.position.set(px, 0.27, pz);
        sc.add(dM); OBJECTS.push(dM);
      }
    }
  }

  // ── Trees & rocks ──────────────────────────────
  function _buildDecorations() {
    const sc = G.scene;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e10 });
    const rockMat  = new THREE.MeshLambertMaterial({ color: 0x55504a });
    const foliages = [0x1a5c18, 0x236b20, 0x0e4a14, 0x2d7a28].map(c =>
      new THREE.MeshLambertMaterial({ color: c }));

    let s = 42; const rng = () => { s=(s*1664525+1013904223)>>>0; return s/0xffffffff; };

    for (let i = 0; i < 80; i++) {
      let x, z, tries = 0;
      do {
        x = (rng()-0.5)*90; z = (rng()-0.5)*90; tries++;
      } while (PathSystem.isTooClose(new THREE.Vector3(x,0,z), 5.5) && tries < 50);
      if (tries >= 50) continue;

      if (rng() < 0.18) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35+rng()*0.55,0), rockMat);
        r.position.set(x, 0.3, z); r.rotation.y = rng()*Math.PI*2;
        r.castShadow = true; sc.add(r); OBJECTS.push(r); continue;
      }

      const tH = 0.7+rng()*0.9;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.16,tH,5), trunkMat);
      trunk.position.set(x, tH/2, z); trunk.castShadow = true;
      sc.add(trunk); OBJECTS.push(trunk);

      const layers = 1+Math.floor(rng()*3);
      for (let l = 0; l < layers; l++) {
        const fH = 1.1+rng()*1.4, fR = Math.max(0.2, 0.55+rng()*0.55-l*0.1);
        const f  = new THREE.Mesh(new THREE.ConeGeometry(fR,fH,6), foliages[Math.floor(rng()*foliages.length)]);
        f.position.set(x, tH+fH/2*(0.45+l*0.35), z); f.castShadow = true;
        sc.add(f); OBJECTS.push(f);
      }
    }
  }

  // ── Spawn marker ───────────────────────────────
  function _buildMarkers() {
    const sc = G.scene;
    const sp = PathSystem.waypoints[0]; if (!sp) return;
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const pole    = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,3.5,6), poleMat);
    pole.position.set(sp.x+2, 1.75, sp.z);
    sc.add(pole); OBJECTS.push(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.7,0.05),
      new THREE.MeshLambertMaterial({ color: 0x00ff88 }));
    flag.position.set(sp.x+2.65, 3.3, sp.z);
    sc.add(flag); OBJECTS.push(flag);
  }

  // ── Castle / Base at end ───────────────────────
  function _buildBase() {
    const sc = G.scene;
    const ep = PathSystem.getEndPos();
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x7a4428 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x993322 });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6a5840 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4,3,4), baseMat);
    body.position.set(ep.x,1.5,ep.z); body.castShadow = true; sc.add(body); OBJECTS.push(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9,2.2,4), roofMat);
    roof.position.set(ep.x,4,ep.z); roof.rotation.y = Math.PI/4;
    sc.add(roof); OBJECTS.push(roof);

    [[-1.9,-1.9],[1.9,-1.9],[-1.9,1.9],[1.9,1.9]].forEach(([cx,cz]) => {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,3.8,6), wallMat);
      tw.position.set(ep.x+cx,1.9,ep.z+cz); tw.castShadow = true;
      sc.add(tw); OBJECTS.push(tw);
    });

    // Glow orb
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4,8,8),
      new THREE.MeshBasicMaterial({ color: 0xff3355 }));
    glow.position.set(ep.x,3.8,ep.z);
    sc.add(glow); OBJECTS.push(glow);
  }

  function clear() {
    for (const o of OBJECTS) {
      G.scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Array.isArray(o.material)) o.material.dispose();
    }
    OBJECTS.length = 0;
  }

  return { build, clear };
})();

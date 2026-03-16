/*
ไฟล์: scene.js
หน้าที่: ตั้งค่า Three.js — Renderer, Scene, Camera, Lights
- สร้าง WebGLRenderer เพียงครั้งเดียว
- init() ล้าง scene และสร้างใหม่แต่ละเกม
- จัดการ window resize
*/

window.SceneSystem = (() => {
  'use strict';

  let renderer = null;
  let scene    = null;
  let camera   = null;

  function _initRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('c'),
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0a1628);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    window.addEventListener('resize', _onResize);
  }

  function init() {
    _initRenderer();

    // ── Clear old scene ──────────────────────────
    if (scene) {
      scene.traverse(obj => {
        if (!obj.isMesh) return;
        obj.geometry && obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose && m.dispose());
        }
      });
      while (scene.children.length) scene.remove(scene.children[0]);
    } else {
      scene = new THREE.Scene();
    }
    scene.fog = new THREE.FogExp2(0x0d1f38, 0.011);

    // ── Camera ───────────────────────────────────
    if (!camera) {
      camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    }
    camera.position.set(4, 48, 30);
    camera.lookAt(4, 0, 0);

    // ── Lights ───────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223355, 1.0));

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(20, 55, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -45; sc.right = sc.top = 45;
    sc.near = 0.5; sc.far = 180;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x4488aa, 0.5);
    fill.position.set(-15, 20, -20);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(0x3366cc, 0x1a4422, 0.6));

    // ── Sky + Stars ──────────────────────────────
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(130, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0x060e18, side: THREE.BackSide })
    ));
    _buildStars();

    return { renderer, scene, camera };
  }

  function _buildStars() {
    const pos = [];
    let s = 7777;
    const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
    for (let i = 0; i < 600; i++) {
      const theta = rng() * Math.PI * 2;
      const phi   = Math.acos(2 * rng() - 1);
      if (Math.cos(phi) < -0.05) continue;
      const r = 105 + rng() * 18;
      pos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true })));
  }

  function _onResize() {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function render() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  return {
    init, render,
    get renderer() { return renderer; },
    get scene()    { return scene;    },
    get camera()   { return camera;   },
  };
})();

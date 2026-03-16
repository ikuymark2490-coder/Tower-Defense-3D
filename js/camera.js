/*
ไฟล์: camera.js
หน้าที่: กล้องสองโหมด
- GOD MODE   : มุมนกบิน, drag หมุนได้ด้วย, scroll zoom
- ROAM MODE  : Roblox orbit
- reset()    : เรียกทุกครั้งที่เริ่มเกมใหม่
*/

window.CameraSystem = (() => {
  'use strict';

  const S = {
    mode: 'god',
    // Shared orbit angles
    theta: -0.2, phi: 0.72, radius: 34,
    target: new THREE.Vector3(4, 0, 0),
    // God-specific zoom height multiplier
    godZoom: 1.0,
    dragging: false, prevX: 0, prevY: 0,
    pinchDist: 0,
    transiting: false, transitT: 0,
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  };

  // God view params
  const GOD_PHI    = 0.52;   // fixed tilt (steeper = more top-down)
  const GOD_R_BASE = 48;     // base radius (zoom distance)

  const _tmp = new THREE.Vector3(), _lp = new THREE.Vector3(), _ll = new THREE.Vector3();

  function init() {
    reset();
    const el = document.getElementById('c');
    el.addEventListener('mousedown',   _md, { passive: false });
    el.addEventListener('mousemove',   _mm, { passive: true  });
    el.addEventListener('mouseup',     _mu, { passive: true  });
    el.addEventListener('mouseleave',  _mu, { passive: true  });
    el.addEventListener('wheel',       _wh, { passive: false });
    el.addEventListener('touchstart',  _ts, { passive: false });
    el.addEventListener('touchmove',   _tm, { passive: false });
    el.addEventListener('touchend',    _te, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  function reset() {
    S.mode     = 'god';
    S.theta    = -0.2;
    S.phi      = GOD_PHI;
    S.radius   = GOD_R_BASE;
    S.godZoom  = 1.0;
    S.target.set(4, 0, 0);
    S.dragging   = false;
    S.transiting = false;
    G.cameraMode = 'god';
    _applyIndicator();
    _applyGod();
  }

  function toggleMode() {
    const next = S.mode === 'god' ? 'roam' : 'god';
    S.mode = next;
    G.cameraMode = next;
    if (next === 'roam') {
      S.phi    = 0.82;
      S.radius = 34;
    } else {
      S.phi    = GOD_PHI;
      S.radius = GOD_R_BASE * S.godZoom;
    }
    _startTransit();
    _applyIndicator();
    if (next !== 'god') {
      G.selectedTowerType = null;
      if (window.UISystem)  UISystem.updateTowerBar();
      if (window.TowerManager) TowerManager.deselectTower();
    }
  }

  function _applyIndicator() {
    const isGod = S.mode === 'god';
    const el = document.getElementById('camIndicator');
    if (el) el.setAttribute('data-i18n', isGod ? 'god_view' : 'roam_view');
    if (el && window.I18n) el.textContent = I18n.t(isGod ? 'god_view' : 'roam_view');
    const btn = document.getElementById('btnCam');
    if (btn && window.I18n) btn.textContent = I18n.t(isGod ? 'btn_roam' : 'btn_god');
    const notice = document.getElementById('roamNotice');
    if (notice) {
      notice.classList.toggle('hidden', isGod);
      if (!isGod && window.I18n) notice.textContent = I18n.t('roam_notice');
    }
  }

  function update(dt) {
    if (!G.camera) return;
    if (S.transiting) {
      S.transitT = Math.min(1, S.transitT + dt * 2.8);
      const t = _ease(S.transitT);
      _getOrbitPos(_lp);
      _ll.copy(S.target);
      G.camera.position.lerpVectors(S.fromPos, _lp, t);
      G.camera.lookAt(new THREE.Vector3().lerpVectors(S.fromLook, _ll, t));
      if (S.transitT >= 1) S.transiting = false;
      return;
    }
    _getOrbitPos(G.camera.position);
    G.camera.lookAt(S.target);
  }

  // ── Both modes use orbit, god mode has fixed phi ──
  function _getOrbitPos(out) {
    const { radius, theta, phi, target } = S;
    out.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
  }

  function _applyGod() {
    if (!G.camera) return;
    _getOrbitPos(G.camera.position);
    G.camera.lookAt(S.target);
  }

  function _startTransit() {
    S.fromPos.copy(G.camera.position);
    G.camera.getWorldDirection(_tmp);
    S.fromLook.copy(G.camera.position).addScaledVector(_tmp, 20);
    S.transitT = 0; S.transiting = true;
  }
  function _ease(t) { return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

  // ── Input ─────────────────────────────────────
  let _pd0 = {x:0,y:0}, _moved = false;
  const CT = 8;

  function _md(e) {
    e.preventDefault();
    _pd0.x=e.clientX; _pd0.y=e.clientY; _moved=false;
    S.dragging=true; S.prevX=e.clientX; S.prevY=e.clientY;
  }
  function _mm(e) {
    const dx=e.clientX-_pd0.x, dy=e.clientY-_pd0.y;
    if(Math.sqrt(dx*dx+dy*dy)>CT) _moved=true;
    if(!S.dragging) return;
    _drag(e.clientX-S.prevX, e.clientY-S.prevY);
    S.prevX=e.clientX; S.prevY=e.clientY;
  }
  function _mu(e) {
    if(!_moved && e.type==='mouseup') _click(e.clientX, e.clientY);
    S.dragging=false;
  }
  function _wh(e) { e.preventDefault(); _zoom(e.deltaY); }

  function _ts(e) {
    e.preventDefault();
    if(e.touches.length===1){
      const t=e.touches[0];
      _pd0.x=t.clientX; _pd0.y=t.clientY; _moved=false;
      S.dragging=true; S.prevX=t.clientX; S.prevY=t.clientY;
    } else if(e.touches.length===2){
      S.dragging=false; S.pinchDist=_pinch(e.touches);
    }
  }
  function _tm(e) {
    e.preventDefault();
    if(e.touches.length===1){
      const t=e.touches[0];
      const dx=t.clientX-_pd0.x,dy=t.clientY-_pd0.y;
      if(Math.sqrt(dx*dx+dy*dy)>CT) _moved=true;
      if(!S.dragging) return;
      _drag(t.clientX-S.prevX, t.clientY-S.prevY);
      S.prevX=t.clientX; S.prevY=t.clientY;
    } else if(e.touches.length===2){
      const d=_pinch(e.touches);
      _zoom((S.pinchDist-d)*1.6); S.pinchDist=d;
    }
  }
  function _te(e) {
    e.preventDefault(); S.dragging=false;
    if(!_moved && e.changedTouches.length===1 && e.touches.length===0)
      _click(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
  function _pinch(t) {
    const dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  function _drag(dx, dy) {
    if (S.mode === 'roam') {
      S.theta -= dx * 0.007;
      S.phi    = Math.max(0.1, Math.min(Math.PI*0.44, S.phi + dy*0.006));
    } else {
      // God mode: horizontal drag = rotate (theta), vertical drag = tilt (pan target)
      S.theta -= dx * 0.007;
      // Pan target along the orbit plane
      const cos = Math.cos(S.theta), sin = Math.sin(S.theta);
      S.target.x += (-cos * dx * 0.0 + sin * dy * 0.055);
      S.target.z += (-sin * dx * 0.0 + cos * dy * 0.055) * -1;
      // Also allow dragging left/right to pan
      S.target.x += cos * dx * 0.055 * -1;
      S.target.z += sin * dx * 0.055;
    }
  }

  function _zoom(delta) {
    if (S.mode === 'roam') {
      S.radius = Math.max(5, Math.min(60, S.radius + delta * 0.04));
    } else {
      S.radius = Math.max(18, Math.min(80, S.radius + delta * 0.04));
      S.godZoom = S.radius / GOD_R_BASE;
    }
  }

  // ── Click → tower place/select ────────────────
  const _ray  = new THREE.Raycaster();
  const _gPln = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

  function _click(cx, cy) {
    if(!G.camera || G.state!=='playing' || G.paused) return;
    const el = document.elementFromPoint(cx,cy);
    if(el && el.id !== 'c') return;
    if(G.cameraMode !== 'god') return;
    const hit = getGroundPoint(cx, cy);
    if(G.selectedTowerType) { if(hit) TowerManager.place(G.selectedTowerType, hit); }
    else TowerManager.trySelectAt(cx, cy);
  }

  function getGroundPoint(cx, cy) {
    if(!G.camera) return null;
    const m = new THREE.Vector2((cx/window.innerWidth)*2-1, -(cy/window.innerHeight)*2+1);
    _ray.setFromCamera(m, G.camera);
    const hit = new THREE.Vector3();
    return _ray.ray.intersectPlane(_gPln, hit) ? hit : null;
  }

  return { init, reset, update, toggleMode, getGroundPoint, get mode(){ return S.mode; } };
})();

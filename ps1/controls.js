/* PS1版：Roblox/Minecraft風の入力（PC・タッチ共通）
 * カメラ角はGに保存し、モード変更や画面遷移で必ず操作を解放する。
 * WebGL/ゲームロジックとは分離してある。 */
'use strict';
const ModernControls = (() => {
  let bound = false, joyPointer = null, lookPointer = null, dragMouse = false;
  let lastX = 0, lastY = 0;
  const sensitivity = .005;
  function supported() { return G.mode === 'modern' && G.state === 'play'; }
  function rotate(dx, dy) {
    if (!supported()) return;
    G.camYaw = (G.camYaw + clamp(dx, -140, 140) * sensitivity) % TAU;
    G.camPitch = clamp(G.camPitch + clamp(dy, -140, 140) * .0035, .10, .80);
  }
  function stick(dx, dy, size) {
    const radius = Math.max(22, size * .38);
    const length = Math.hypot(dx, dy);
    const k = Math.min(1, radius / Math.max(1, length));
    const nx = (dx * k) / radius, ny = (dy * k) / radius;
    // ハードウェアジョイスティックのデッドゾーンと同じように微小なブレを無視
    G.touch.joyX = Math.abs(nx) < .12 ? 0 : nx;
    G.touch.joyY = Math.abs(ny) < .12 ? 0 : ny;
    const knob = $('joyKnob');
    if (knob) knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    return { x: G.touch.joyX, y: G.touch.joyY };
  }
  function zeroStick() {
    G.touch.joyX = 0; G.touch.joyY = 0;
    const knob = $('joyKnob');
    if (knob) knob.style.transform = '';
  }
  function release() {
    joyPointer = null; lookPointer = null; dragMouse = false;
    zeroStick();
    if (document.pointerLockElement === $('gl') && document.exitPointerLock)
      document.exitPointerLock();
  }
  function bind() {
    if (bound) return; bound = true;
    const joy = $('joystick'), look = $('lookZone'), canvas = $('gl');
    joy.addEventListener('pointerdown', e => {
      if (!supported() || joyPointer !== null) return;
      e.preventDefault(); joyPointer = e.pointerId;
      if (joy.setPointerCapture) joy.setPointerCapture(e.pointerId);
      const r = joy.getBoundingClientRect();
      stick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
    });
    joy.addEventListener('pointermove', e => {
      if (e.pointerId !== joyPointer) return;
      e.preventDefault();
      const r = joy.getBoundingClientRect();
      stick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
    });
    const joyUp = e => { if (e.pointerId === joyPointer) { joyPointer = null; zeroStick(); } };
    for (const type of ['pointerup','pointercancel','lostpointercapture']) joy.addEventListener(type, joyUp);

    look.addEventListener('pointerdown', e => {
      if (!supported() || lookPointer !== null) return;
      e.preventDefault(); lookPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      if (look.setPointerCapture) look.setPointerCapture(e.pointerId);
    });
    look.addEventListener('pointermove', e => {
      if (e.pointerId !== lookPointer || !supported()) return;
      e.preventDefault();
      rotate(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    });
    const lookUp = e => { if (e.pointerId === lookPointer) lookPointer = null; };
    for (const type of ['pointerup','pointercancel','lostpointercapture']) look.addEventListener(type, lookUp);

    // PC: 画面をクリックするとMinecraft式マウスルック。未対応ならドラッグ方式へ。
    canvas.addEventListener('pointerdown', e => {
      if (!supported() || e.pointerType !== 'mouse') return;
      if (e.button !== 0 && e.button !== 2) return;
      dragMouse = true; lastX = e.clientX; lastY = e.clientY;
      if (e.button === 0 && canvas.requestPointerLock) {
        try {
          const r = canvas.requestPointerLock();
          if (r && r.catch) r.catch(() => {});
        } catch (_) {}
      }
    });
    document.addEventListener('pointermove', e => {
      if (!supported()) return;
      if (document.pointerLockElement === canvas) rotate(e.movementX || 0,e.movementY || 0);
      else if (dragMouse && e.pointerType === 'mouse') {
        rotate(e.clientX - lastX,e.clientY - lastY);
        lastX=e.clientX;lastY=e.clientY;
      }
    });
    document.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') dragMouse = false; });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) dragMouse = false; });
    addEventListener('blur', () => { release(); });
  }
  return { bind,rotate,stick,zeroStick,release };
})();

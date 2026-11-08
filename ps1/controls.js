/* PS1版：固定カメラ＋仮想スティック
 * 方向入力だけを提供する。右スワイプやマウスで視点を回さない。
 * 旧クラシック（タンク）操作はロジック側に残す。
 */
'use strict';
const ModernControls = (() => {
  let bound = false;
  let joyPointer = null;
  function supported() { return G.mode === 'modern' && G.state === 'play'; }
  function stick(dx, dy, size) {
    const radius = Math.max(22, size * .38);
    const length = Math.hypot(dx, dy);
    const factor = Math.min(1, radius / Math.max(1, length));
    const x = dx * factor / radius, y = dy * factor / radius;
    G.touch.joyX = Math.abs(x) < .12 ? 0 : x;
    G.touch.joyY = Math.abs(y) < .12 ? 0 : y;
    const knob = $('joyKnob');
    if (knob) knob.style.transform = 'translate(' + (dx * factor) + 'px,' + (dy * factor) + 'px)';
    return { x: G.touch.joyX, y: G.touch.joyY };
  }
  function zeroStick() {
    G.touch.joyX = 0;
    G.touch.joyY = 0;
    const knob = $('joyKnob');
    if (knob) knob.style.transform = '';
  }
  function release() {
    joyPointer = null;
    zeroStick();
    // 旧バージョンからページを遷移してもポインタを拘束しない
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }
  function bind() {
    if (bound) return;
    bound = true;
    const joy = $('joystick');
    joy.addEventListener('pointerdown', e => {
      if (!supported() || joyPointer !== null) return;
      e.preventDefault();
      joyPointer = e.pointerId;
      if (joy.setPointerCapture) joy.setPointerCapture(e.pointerId);
      const r = joy.getBoundingClientRect();
      stick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
    });
    joy.addEventListener('pointermove', e => {
      if (e.pointerId !== joyPointer || !supported()) return;
      e.preventDefault();
      const r = joy.getBoundingClientRect();
      stick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
    });
    const end = e => {
      if (e.pointerId === joyPointer) {
        joyPointer = null;
        zeroStick();
      }
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      joy.addEventListener(type, end);
    addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  }
  return { bind, stick, zeroStick, release };
})();

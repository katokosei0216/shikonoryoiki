/*
 * 嗜好の領域：ホーム限定の隠し演出
 * 嗜好の領域 x3 -> 全ボタン虹色
 * お酒 x3       -> 全ボタン回転（0.95秒/周）
 * タバコ x3     -> 全ボタンDVD反射移動（毎秒450〜650px）
 * どれも同じ場所をもう3回押すと解除。三機能同時発動可能。
 */
(() => {
  'use strict';
  if (!document.body.classList.contains('home-body')) return;
  // 同じスクリプトが二度読み込まれてもクリックイベントを重複登録しない。
  if (window.__shikoHomeEffectsInstalled) return;
  window.__shikoHomeEffectsInstalled = true;

  const body = document.body;
  const header = document.getElementById('siteHeader');
  const alcohol = document.querySelector('.alcohol-section .section-label');
  const tobacco = document.querySelector('.tobacco-section .section-label');
  if (!alcohol || !tobacco) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selector = [
    '.alcohol-grid > .preference-card',
    '.tobacco-grid > .paper-card-container',
    '.tobacco-grid > .preference-card',
    '.bottom-navigation > .bottom-panel',
  ].join(', ');
  const registered = new Set();
  let moving = false;
  let frames = [];
  let animationId = null;
  let prevFrame = 0;

  function addTarget(node) {
    if (registered.has(node)) return;
    registered.add(node);
    node.classList.add('secret-motion-target');
    // 紙たばこの透明ドナルドボタンがある場合は、コンテナを回して
    // 発光はその中の紙たばこカードにだけ適用する。
    const surface = node.matches('.paper-card-container')
      ? node.querySelector('.preference-card')
      : node;
    if (surface) surface.classList.add('secret-rainbow-surface');
    if (moving && !reduceMotion.matches) fly(node);
  }

  function scanTargets() {
    document.querySelectorAll(selector).forEach(addTarget);
    const userButton = header?.querySelector('.header-user .login-button');
    if (userButton) addTarget(userButton);
  }

  // タイトルは共通JSで後から挿入されるため、イベントを親に委譲する。
  const recent = new Map();
  function triple(key, toggle) {
    const now = performance.now();
    const state = recent.get(key) || {count: 0, last: -9999};
    state.count = now - state.last < 1000 ? state.count + 1 : 1;
    state.last = now;
    if (state.count >= 3) {
      state.count = 0;
      state.last = -9999;
      toggle();
    }
    recent.set(key, state);
  }
  function setPressed(el, enabled) { el.setAttribute('aria-pressed', String(enabled)); }
  function makeTrigger(node, label) {
    node.classList.add('home-secret-trigger');
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', label);
    setPressed(node, false);
  }

  function toggleRainbow() {
    const on = body.classList.toggle('secret-rainbow');
    const title = header?.querySelector('.header-title-text');
    if (title) setPressed(title, on);
  }
  function toggleSpin() {
    scanTargets();
    const on = body.classList.toggle('secret-spinning');
    setPressed(alcohol, on);
    if (moving) clampFrames();
  }

  // 細長い角度のまま真っすぐ移動し、端に当たったら反射する。
  function velocityFor(index) {
    const angle = ((24 + Math.random() * 36) + (index % 4) * 90) * Math.PI / 180;
    const speed = 450 + (index % 5) * 40 + Math.random() * 40;
    return { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) };
  }

  function boundary(item) {
    const diagonal = Math.hypot(item.w, item.h);
    const rotating = body.classList.contains('secret-spinning');
    const mx = Math.max(item.isPaperWrapper ? 90 : 5,
      rotating ? (diagonal - item.w) / 2 + 6 : 5);
    const my = Math.max(5, rotating ? (diagonal - item.h) / 2 + 6 : 5);
    const minX = Math.min(mx, Math.max(0, (innerWidth - item.w) / 2));
    const minY = Math.min(my, Math.max(0, (innerHeight - item.h) / 2));
    return {
      minX, minY,
      maxX: Math.max(minX, innerWidth - item.w - mx),
      maxY: Math.max(minY, innerHeight - item.h - my),
    };
  }
  function place(item) {
    item.el.style.translate = `${item.x.toFixed(2)}px ${item.y.toFixed(2)}px`;
  }
  function clampFrames() {
    for (const item of frames) {
      const b = boundary(item);
      item.x = Math.max(b.minX, Math.min(b.maxX, item.x));
      item.y = Math.max(b.minY, Math.min(b.maxY, item.y));
      place(item);
    }
  }
  function fly(el) {
    if (frames.some(item => item.el === el)) return;
    const rect = el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 1 || h < 1) return;

    const parent = el.parentNode;
    if (!parent) return;
    const placeholder = document.createElement('span');
    placeholder.className = 'home-secret-placeholder';
    placeholder.style.display = getComputedStyle(el).display === 'inline' ? 'inline-block' : 'block';
    placeholder.style.width = `${w}px`;
    placeholder.style.height = `${h}px`;
    parent.insertBefore(placeholder, el);

    const originalStyle = el.getAttribute('style');
    // アニメーション中の要素を別親へ移動すると、Chromium が以前の描画座標を
    // キャッシュする場合があるため、一度停止して移動後に再起動する。
    el.style.setProperty('animation', 'none', 'important');
    void el.offsetWidth;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.classList.add('home-secret-flyer');
    body.appendChild(el);

    const vector = velocityFor(frames.length);
    const item = {
      el, placeholder, originalStyle,
      w, h, isPaperWrapper: el.classList.contains('paper-card-container'),
      x: rect.left + (rect.width - w) / 2,
      y: rect.top + (rect.height - h) / 2,
      ...vector,
    };
    frames.push(item);
    clampFrames();
    void el.offsetWidth;
    if (originalStyle && /(?:^|;)\s*animation\s*:/.test(originalStyle)) {
      // 元からインライン指定されていた animation があれば戻す。
      const temp = document.createElement('div');
      temp.setAttribute('style', originalStyle);
      el.style.setProperty('animation', temp.style.getPropertyValue('animation'), temp.style.getPropertyPriority('animation'));
    } else {
      el.style.removeProperty('animation');
    }
  }
  function animate(time) {
    if (!moving) return;
    const delta = prevFrame ? Math.min((time - prevFrame) / 1000, .045) : 0;
    prevFrame = time;
    for (const item of frames) {
      const b = boundary(item);
      item.x += item.vx * delta;
      item.y += item.vy * delta;
      if (item.x < b.minX) { item.x = b.minX + (b.minX - item.x); item.vx = Math.abs(item.vx); }
      if (item.x > b.maxX) { item.x = b.maxX - (item.x - b.maxX); item.vx = -Math.abs(item.vx); }
      if (item.y < b.minY) { item.y = b.minY + (b.minY - item.y); item.vy = Math.abs(item.vy); }
      if (item.y > b.maxY) { item.y = b.maxY - (item.y - b.maxY); item.vy = -Math.abs(item.vy); }
      item.x = Math.max(b.minX, Math.min(b.maxX, item.x));
      item.y = Math.max(b.minY, Math.min(b.maxY, item.y));
      place(item);
    }
    animationId = requestAnimationFrame(animate);
  }
  function stopMoving() {
    if (!moving) return;
    moving = false;
    cancelAnimationFrame(animationId);
    animationId = null;
    prevFrame = 0;
    for (const item of frames) {
      if (item.placeholder.parentNode) {
        item.placeholder.parentNode.insertBefore(item.el, item.placeholder);
        item.placeholder.remove();
      }
      item.el.classList.remove('home-secret-flyer');
      if (item.originalStyle === null) item.el.removeAttribute('style');
      else item.el.setAttribute('style', item.originalStyle);
    }
    frames = [];
    body.classList.remove('secret-moving');
    setPressed(tobacco, false);
  }
  function toggleMove() {
    if (moving) { stopMoving(); return; }
    moving = true;
    body.classList.add('secret-moving');
    setPressed(tobacco, true);
    scanTargets();
    if (!reduceMotion.matches) {
      for (const el of [...registered]) if (el.isConnected) fly(el);
      prevFrame = 0;
      animationId = requestAnimationFrame(animate);
    }
  }

  makeTrigger(alcohol, 'お酒：3回クリックで全ボタンの回転を切り替え');
  makeTrigger(tobacco, 'タバコ：3回クリックで全ボタンの高速DVD風移動を切り替え');
  alcohol.addEventListener('click', () => triple('spin', toggleSpin));
  tobacco.addEventListener('click', () => triple('move', toggleMove));
  for (const node of [alcohol, tobacco]) {
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        node.click();
      }
    });
  }
  function prepareTitle() {
    const title = header?.querySelector('.header-title-text');
    if (title && !title.classList.contains('home-secret-trigger')) {
      makeTrigger(title, '嗜好の領域：3回クリックで全ボタンの虹色発光を切り替え');
      setPressed(title, body.classList.contains('secret-rainbow'));
    }
  }
  header?.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.header-title-text')) {
      triple('rainbow', toggleRainbow);
    }
  });
  header?.addEventListener('keydown', event => {
    const title = event.target instanceof Element && event.target.closest('.header-title-text');
    if (title && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      title.click();
    }
  });
  const observer = header && new MutationObserver(() => {
    scanTargets();
    prepareTitle();
  });
  observer?.observe(header, {childList: true, subtree: true});
  window.addEventListener('resize', clampFrames);
  reduceMotion.addEventListener?.('change', () => {
    if (moving) stopMoving();
  });
  window.addEventListener('pagehide', stopMoving);
  scanTargets();
  prepareTitle();
})();

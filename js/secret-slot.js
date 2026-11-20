/*
 * 嗜好の領域 / 秘密のスロットゲーム
 * ログアウト直下の透明な領域を3回クリックすると表示される。
 * 実際のお金・商品・外部決済には一切関係のない無料ゲーム。
 */
(() => {
  'use strict';
  if (window.shikoOpenSecretSlot) return;

  const STORAGE_KEY = 'shiko-secret-slot-v1';
  const INITIAL_COINS = 500;
  const MIN_BET = 10;
  const SYMBOLS = [
    { id: 'cherry', icon: '🍒', name: 'チェリー', multiplier: 4 },
    { id: 'lemon',  icon: '🍋', name: 'レモン',     multiplier: 5 },
    { id: 'grape',  icon: '🍇', name: 'ブドウ',     multiplier: 6 },
    { id: 'bell',   icon: '🔔', name: 'ベル',       multiplier: 8 },
    { id: 'star',   icon: '⭐', name: 'スター',     multiplier: 12 },
    { id: 'seven',  icon: '7️⃣', name: 'セブン',    multiplier: 25 }
  ];

  const readSave = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Number.isSafeInteger(saved.coins) && saved.coins >= 0 &&
          Number.isSafeInteger(saved.spins) && saved.spins >= 0 &&
          Number.isSafeInteger(saved.wins) && saved.wins >= 0) return saved;
    } catch (_error) { /* プライベートモード等では保存なしで遊べる */ }
    return { coins: INITIAL_COINS, spins: 0, wins: 0 };
  };
  const state = readSave();
  let overlay = null;
  let spinning = false;
  let previousFocus = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_error) { /* 保存不可でもゲームは継続 */ }
  }
  function randomIndex(max) {
    // 偏りの小さい乱数。非対応ブラウザでは Math.random にフォールバック。
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const range = 0x100000000;
      const limit = range - range % max;
      const buf = new Uint32Array(1);
      let n;
      do { window.crypto.getRandomValues(buf); n = buf[0]; } while (n >= limit);
      return n % max;
    }
    return Math.floor(Math.random() * max);
  }
  const choice = () => SYMBOLS[randomIndex(SYMBOLS.length)];
  const $ = (selector) => overlay.querySelector(selector);
  const money = (amount) => amount.toLocaleString('ja-JP');

  function setReel(reel, symbol) {
    reel.querySelector('.shiko-slot-symbol').textContent = symbol.icon;
    reel.setAttribute('aria-label', symbol.name);
  }
  function setMessage(message, kind = '') {
    const target = $('[data-slot-message]');
    target.textContent = message;
    target.dataset.kind = kind;
  }
  function render() {
    $('[data-slot-coins]').textContent = money(state.coins);
    $('[data-slot-spins]').textContent = money(state.spins);
    $('[data-slot-wins]').textContent = money(state.wins);
    const bet = Number($('[data-slot-bet]').value);
    $('[data-slot-bet]').disabled = spinning;
    $('[data-slot-spin]').disabled = spinning || state.coins < bet;
    $('[data-slot-spin]').textContent = spinning ? '回転中…' : 'スピン';
    $('[data-slot-refill]').hidden = state.coins >= MIN_BET;
    $('[data-slot-refill]').disabled = spinning;
  }
  function reward(symbols, bet) {
    if (symbols[0].id === symbols[1].id && symbols[1].id === symbols[2].id) {
      const multiplier = symbols[0].multiplier;
      return { amount: bet * multiplier, message: `大当たり！ ${symbols[0].name} ×3、${multiplier}倍！`, kind: 'jackpot' };
    }
    // どの絵柄でも2つ一致すれば当たり（3つ一致は上の大当たりを優先）。
    const counts = new Map();
    for (const symbol of symbols) counts.set(symbol.id, (counts.get(symbol.id) || 0) + 1);
    const pair = symbols.find(symbol => counts.get(symbol.id) === 2);
    if (pair) {
      return { amount: bet * 2, message: `${pair.name}2個！ 2倍のコインを獲得！`, kind: 'win' };
    }
    return { amount: 0, message: 'ハズレ。次のスピンに挑戦！', kind: 'lose' };
  }
  function spin() {
    if (spinning) return;
    const bet = Number($('[data-slot-bet]').value);
    if (![10, 25, 50, 100].includes(bet)) return;
    if (state.coins < bet) {
      setMessage('コインが足りません。ベット額を下げるか無料補充してください。', 'lose');
      return;
    }

    spinning = true;
    state.coins -= bet;
    save();
    render();
    setMessage('リール回転中…');

    const finalSymbols = [choice(), choice(), choice()];
    const reels = Array.from(overlay.querySelectorAll('[data-slot-reel]'));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      reels.forEach((reel, i) => setReel(reel, finalSymbols[i]));
      finishSpin(finalSymbols, bet);
      return;
    }

    let stopped = 0;
    reels.forEach((reel, i) => {
      reel.classList.add('is-spinning');
      const frameTimer = window.setInterval(() => setReel(reel, choice()), 65 + i * 12);
      window.setTimeout(() => {
        window.clearInterval(frameTimer);
        setReel(reel, finalSymbols[i]);
        reel.classList.remove('is-spinning');
        stopped++;
        if (stopped === reels.length) finishSpin(finalSymbols, bet);
      }, 680 + i * 350);
    });
  }
  function finishSpin(symbols, bet) {
    const outcome = reward(symbols, bet);
    state.coins += outcome.amount;
    state.spins++;
    if (outcome.amount > 0) state.wins++;
    spinning = false;
    save();
    render();
    if (outcome.amount > 0) {
      setMessage(`${outcome.message} ＋${money(outcome.amount)}コイン`, outcome.kind);
    } else {
      setMessage(outcome.message, outcome.kind);
    }
  }
  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('shiko-slot-open');
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
  }
  function create() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'shikoSlotOverlay';
    overlay.className = 'shiko-slot-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="shiko-slot-machine" role="dialog" aria-modal="true" aria-labelledby="shikoSlotTitle" aria-describedby="shikoSlotDesc" tabindex="-1">
        <button type="button" class="shiko-slot-close" data-slot-close aria-label="スロットを閉じる">×</button>
        <p class="shiko-slot-kicker">SECRET ROOM / GOLDEN BAR</p>
        <h2 id="shikoSlotTitle">GOLDEN SLOT</h2>
        <p class="shiko-slot-description" id="shikoSlotDesc">絵柄が2つ揃っても当たり！ 約44.4%で払い戻し</p>
        <div class="shiko-slot-stats">
          <div><span>所持コイン</span><strong><span data-slot-coins>500</span> <small>COINS</small></strong></div>
          <div><span>プレイ回数</span><strong data-slot-spins>0</strong></div>
          <div><span>当たり回数</span><strong data-slot-wins>0</strong></div>
        </div>
        <div class="shiko-slot-reels" role="group" aria-label="3つのスロットリール">
          <div class="shiko-slot-reel" data-slot-reel="0" aria-label="セブン"><span class="shiko-slot-symbol">7️⃣</span></div>
          <div class="shiko-slot-reel" data-slot-reel="1" aria-label="スター"><span class="shiko-slot-symbol">⭐</span></div>
          <div class="shiko-slot-reel" data-slot-reel="2" aria-label="チェリー"><span class="shiko-slot-symbol">🍒</span></div>
        </div>
        <p class="shiko-slot-message" data-slot-message role="status" aria-live="polite">ベット額を選んでスピン！</p>
        <div class="shiko-slot-actions">
          <label class="shiko-slot-bet-label" for="shikoSlotBet">BET
            <select id="shikoSlotBet" data-slot-bet aria-label="ベットするゲーム内コイン数">
              <option value="10">10コイン</option>
              <option value="25">25コイン</option>
              <option value="50" selected>50コイン</option>
              <option value="100">100コイン</option>
            </select>
          </label>
          <button type="button" class="shiko-slot-spin" data-slot-spin>スピン</button>
        </div>
        <button type="button" class="shiko-slot-refill" data-slot-refill hidden>無料コインを500枚補充する</button>
        <div class="shiko-slot-paytable" aria-label="配当表">
          <p>PAY TABLE <small>同じ絵柄3つで大当たり</small></p>
          <div><span>7️⃣ ×25</span><span>⭐ ×12</span><span>🔔 ×8</span><span>🍇 ×6</span><span>🍋 ×5</span><span>🍒 ×4</span></div>
          <small>どの絵柄も2個一致で ×2 ・ 3個一致は上記倍率</small>
        </div>
        <p class="shiko-slot-disclaimer">※ 無料ゲーム専用の仮想コインです。現金・景品への交換はできません。</p>
      </section>`;
    document.body.appendChild(overlay);
    $('[data-slot-close]').addEventListener('click', close);
    $('[data-slot-spin]').addEventListener('click', spin);
    $('[data-slot-bet]').addEventListener('change', render);
    $('[data-slot-refill]').addEventListener('click', () => {
      if (spinning || state.coins >= MIN_BET) return;
      state.coins += INITIAL_COINS;
      save();
      render();
      setMessage('無料コイン500枚を補充しました！');
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', (event) => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      // ダイアログを開いている間、Tabキーが背後のページに移らないようにする。
      if (event.key === 'Tab') {
        const focusables = Array.from(overlay.querySelectorAll('button:not([disabled]):not([hidden]),select:not([disabled])'));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    });
    render();
  }
  window.shikoOpenSecretSlot = () => {
    create();
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('shiko-slot-open');
    render();
    $('[data-slot-close]').focus();
  };
})();

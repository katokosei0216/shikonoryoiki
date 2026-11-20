/*
 * 嗜好の領域 / 隠しゲーム「伍抜き」
 * サイコロ5個。目の5、または2個で合計5になる組（1＋4 / 2＋3）を抜き、抜けたときだけ残りを再振り。
 * 全員の手番終了後、残ったサイコロの合計が最小の人が勝利。
 * ゲーム結果は乱数に基づき、コイン・金銭・飲酒の強制はありません。
 */
(() => {
  'use strict';
  if (window.shikoOpenSecretFiveNuki) return;

  const PIPS = [
    [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]
  ];
  const state = {
    phase: 'setup', players: [], scores: [], current: 0,
    diceCount: 5, dice: [], selected: new Set(), rolls: 0, busy: false, lastRemoved: 0
  };
  let overlay;
  let previousFocus;
  let animationTimer = null;
  let animationInterval = null;
  // 「チンチロモード」は出目を確認するだけの独立したミニゲーム。
  // 特殊な7は各サイコロで1/200（0.5%）の確率。5抜きの出目には影響しない。
  const chinchiro = { dice: [], busy: false, pending: null, timer: null, interval: null };
  let currentMode = 'five';
  const $ = (selector) => overlay.querySelector(selector);

  function randomDie() {
    // 各面が等確率の一様乱数。cryptoが使えない環境ではMath.randomにフォールバック。
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      const limit = 4294967296 - (4294967296 % 6);
      do { window.crypto.getRandomValues(value); } while (value[0] >= limit);
      return (value[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  function canRemove(values) {
    // 抜けるのは「5単体」「1＋4」「2＋3」のみ。
    // 複数組の同時選択は許可するが、3個以上で合計5にする組は不可。
    if (!values.length) return false;
    const counts = Array(7).fill(0);
    for (const value of values) {
      if (!Number.isInteger(value) || value < 1 || value > 5) return false;
      counts[value]++;
    }
    return counts[1] === counts[4] && counts[2] === counts[3];
  }

  function bestSelection(dice) {
    // 5を作れるすべての選び方の中で、取り除ける個数が最大のものを提案する。
    let result = [];
    for (let mask = 1; mask < (1 << dice.length); mask++) {
      const indexes = dice.flatMap((_, i) => mask & (1 << i) ? [i] : []);
      if (indexes.length > result.length && canRemove(indexes.map(i => dice[i]))) result = indexes;
    }
    return result;
  }

  function makeDie(value, index, selected = false, inactive = false) {
    const pips = value ? Array.from({ length: 9 }, (_, i) =>
      `<span class="shiko-five-pip${PIPS[value].includes(i) ? ' on' : ''}"></span>`).join('') :
      `<span class="shiko-five-question">?</span>`;
    return `<button type="button" class="shiko-five-die${selected ? ' is-selected' : ''}${inactive ? ' is-inactive' : ''}"
      data-five-die="${index}" aria-label="${value ? `${value}の目` : 'まだ振っていません'}${selected ? '、選択中' : ''}"
      aria-pressed="${selected}" ${inactive ? 'disabled' : ''}>
      <span class="shiko-five-pips" aria-hidden="true">${pips}</span>
      ${selected ? '<span class="shiko-five-pick-label" aria-hidden="true">抜く</span>' : ''}
    </button>`;
  }

  function setFeedback(text, kind = '') {
    const el = $('[data-five-feedback]');
    el.textContent = text;
    el.dataset.kind = kind;
  }

  function refreshDice(values = state.dice, animated = false) {
    const canSelect = !animated && !state.busy && state.phase === 'choosing';
    $('[data-five-dice]').innerHTML = (values.length ? values : Array(state.diceCount).fill(null))
      .map((v, i) => makeDie(v, i, canSelect && state.selected.has(i), !canSelect)).join('');
  }

  function refreshScoreboard() {
    $('[data-five-scoreboard]').innerHTML = state.players.map((name, i) => {
      const score = state.scores[i];
      return `<div class="shiko-five-player${i === state.current && state.phase !== 'result' ? ' is-current' : ''}">
        <span class="shiko-five-player-num">P${i + 1}</span><span class="shiko-five-player-name"></span>
        <strong>${score === null ? (i === state.current ? 'PLAY' : '—') : `${score}点`}</strong>
      </div>`;
    }).join('');
    // HTMLへプレイヤー名を挿入するときはtextContentでエスケープする。
    $('[data-five-scoreboard]').querySelectorAll('.shiko-five-player-name').forEach((el, i) => {
      el.textContent = state.players[i];
    });
  }

  function refresh() {
    const isSetup = state.phase === 'setup';
    const isResult = state.phase === 'result';
    $('[data-five-setup]').hidden = !isSetup;
    $('[data-five-game]').hidden = isSetup || isResult;
    $('[data-five-result]').hidden = !isResult;
    if (isSetup) return;
    if (isResult) { refreshResults(); return; }

    $('[data-five-turn]').textContent = state.players[state.current];
    $('[data-five-progress]').textContent = `${state.current + 1} / ${state.players.length}`;
    $('[data-five-roll-count]').textContent = String(state.rolls);
    $('[data-five-dice-count]').textContent = String(state.diceCount);
    const total = state.dice.reduce((sum, v) => sum + v, 0);
    $('[data-five-sum]').textContent = state.dice.length ? String(total) : '—';
    refreshScoreboard();
    refreshDice();

    const choosing = state.phase === 'choosing' && !state.busy;
    const selectedValues = Array.from(state.selected, i => state.dice[i]);
    const valid = choosing && canRemove(selectedValues);
    $('[data-five-remove]').hidden = state.phase !== 'choosing';
    $('[data-five-remove]').disabled = !valid;
    $('[data-five-roll]').hidden = state.phase !== 'ready';
    $('[data-five-roll]').disabled = state.busy;
    $('[data-five-roll]').textContent = state.rolls ? `残り${state.diceCount}個を振る` : 'サイコロを5個振る';
    $('[data-five-next]').hidden = state.phase !== 'finished';
    $('[data-five-next]').textContent = state.current === state.players.length - 1 ? '結果を見る' : '次の人へ';

    if (state.busy) setFeedback('サイコロを振っています…');
    else if (state.phase === 'ready') {
      setFeedback(state.rolls ? `${state.lastRemoved}個抜き成功！ 残り${state.diceCount}個を振ってください。` : 'サイコロを振ってスタート！', 'good');
    } else if (state.phase === 'finished') {
      const score = state.scores[state.current];
      setFeedback(score === 0 ? 'パーフェクト！ 全部抜いて0点！' : `${score}点で終了。次の人に交代しましょう。`, score === 0 ? 'gold' : 'good');
    } else if (valid) {
      setFeedback(`合計${selectedValues.reduce((a, b) => a + b, 0)}を選択中。これで抜けます！`, 'good');
    } else if (selectedValues.length) {
      setFeedback('5単体、1＋4、2＋3のみ抜けます。3個以上で5は作れません。', 'warn');
    } else {
      setFeedback('5の目、または2個で5になる組（1＋4 / 2＋3）を選んで「5を抜く」。', '');
    }
  }

  function refreshResults() {
    const min = Math.min(...state.scores);
    const max = Math.max(...state.scores);
    const winners = state.players.filter((_, i) => state.scores[i] === min);
    const losers = state.players.filter((_, i) => state.scores[i] === max);
    $('[data-five-result-title]').textContent = state.players.length === 1 ? '練習終了！' : min === max ? '全員同点！' : 'ラウンド終了！';
    $('[data-five-winners]').textContent = state.players.length === 1 ? `${min}点` : `勝者：${winners.join('・')}（${min}点）`;
    $('[data-five-losers]').textContent = state.players.length <= 1 || min === max ?
      'もう一度挑戦しよう！' : `最下位：${losers.join('・')}（${max}点）`;
    const ranking = state.players.map((name, i) => ({name, score: state.scores[i], order: i}))
      .sort((a, b) => a.score - b.score || a.order - b.order);
    const target = $('[data-five-ranking]');
    target.innerHTML = ranking.map((x, i) =>
      `<li><span>${i + 1}位</span><strong></strong><b>${x.score}点</b></li>`).join('');
    target.querySelectorAll('strong').forEach((el, i) => { el.textContent = ranking[i].name; });
  }

  function finishTurn(score) {
    state.scores[state.current] = score;
    state.phase = 'finished';
    state.selected.clear();
    refresh();
  }

  function roll() {
    if (state.phase !== 'ready' || state.busy || state.diceCount === 0) return;
    state.busy = true;
    state.rolls += 1;
    const finalDice = Array.from({ length: state.diceCount }, randomDie);
    refresh();
    const done = () => {
      if (animationInterval !== null) window.clearInterval(animationInterval);
      if (animationTimer !== null) window.clearTimeout(animationTimer);
      animationInterval = null;
      animationTimer = null;
      state.dice = finalDice;
      state.selected.clear();
      state.busy = false;
      if (bestSelection(finalDice).length === 0) finishTurn(finalDice.reduce((a, b) => a + b, 0));
      else { state.phase = 'choosing'; refresh(); }
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    animationInterval = window.setInterval(() => {
      refreshDice(Array.from({length: state.diceCount}, randomDie), true);
    }, 80);
    animationTimer = window.setTimeout(done, 650);
  }

  function removeDice() {
    if (state.phase !== 'choosing' || state.busy) return;
    const chosen = Array.from(state.selected);
    if (!canRemove(chosen.map(i => state.dice[i]))) return;
    state.lastRemoved = chosen.length;
    state.diceCount -= chosen.length;
    state.dice = [];
    state.selected.clear();
    if (state.diceCount === 0) finishTurn(0);
    else { state.phase = 'ready'; refresh(); }
  }

  function nextPlayer() {
    if (state.phase !== 'finished') return;
    if (state.current === state.players.length - 1) { state.phase = 'result'; refresh(); return; }
    state.current++;
    state.phase = 'ready';
    state.diceCount = 5;
    state.dice = [];
    state.selected.clear();
    state.rolls = 0;
    state.lastRemoved = 0;
    refresh();
  }

  function startGame(names) {
    state.players = names;
    state.scores = Array(names.length).fill(null);
    state.current = 0;
    state.diceCount = 5;
    state.dice = [];
    state.selected.clear();
    state.rolls = 0;
    state.lastRemoved = 0;
    state.busy = false;
    state.phase = 'ready';
    refresh();
  }

  function refreshInputs() {
    const count = Number($('[data-five-players-count]').value);
    const existing = Array.from(overlay.querySelectorAll('[data-five-name]'), input => input.value);
    const container = $('[data-five-names]');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const label = document.createElement('label');
      label.className = 'shiko-five-name-label';
      const span = document.createElement('span');
      span.textContent = `プレイヤー ${i + 1}`;
      const input = document.createElement('input');
      input.dataset.fiveName = String(i);
      input.type = 'text';
      input.maxLength = 20;
      input.autocomplete = 'off';
      input.value = existing[i] || '';
      input.placeholder = `プレイヤー${i + 1}`;
      label.append(span, input);
      container.append(label);
    }
  }

  // 公平な整数乱数：cryptoを優先し、非対応環境ではMath.randomを使用する。
  function randomIndex(maxExclusive) {
    if (window.crypto?.getRandomValues) {
      const result = new Uint32Array(1);
      const range = 4294967296;
      const limit = range - (range % maxExclusive);
      do { window.crypto.getRandomValues(result); } while (result[0] >= limit);
      return result[0] % maxExclusive;
    }
    return Math.floor(Math.random() * maxExclusive);
  }

  function randomChinchiroDie() {
    return randomIndex(200) === 0 ? 7 : randomIndex(6) + 1;
  }

  // 架空の7の面は7つの黒い点を描く。見た目・演出は通常の面と同じ。
  const SEVEN_PIPS = [0, 2, 3, 4, 5, 6, 8];

  // サイコロの要素は再作成せずに点だけ更新し、短い揺れアニメーションを途切れさせない。
  function renderChinchiroDice(values = chinchiro.dice) {
    const dice = values.length === 3 ? values : [null, null, null];
    const container = $('[data-chinchiro-dice]');
    if (container.children.length !== 3) {
      container.innerHTML = Array.from({ length: 3 }, () =>
        '<div class="shiko-chinchiro-die" role="img"><span class="shiko-five-pips" aria-hidden="true"></span></div>'
      ).join('');
    }
    Array.from(container.children).forEach((die, index) => {
      const value = dice[index];
      const pips = value ? Array.from({ length: 9 }, (_, cell) =>
        `<span class="shiko-five-pip${(value === 7 ? SEVEN_PIPS : PIPS[value]).includes(cell) ? ' on' : ''}"></span>`
      ).join('') : '<span class="shiko-five-question">?</span>';
      die.setAttribute('aria-label', value ? `${index + 1}個目：${value}の目` : `${index + 1}個目：未確定`);
      die.querySelector('.shiko-five-pips').innerHTML = pips;
    });
  }

  function refreshChinchiro() {
    renderChinchiroDice();
    $('[data-chinchiro-roll]').disabled = chinchiro.busy;
    const feedback = $('[data-chinchiro-feedback]');
    feedback.textContent = chinchiro.busy ? '振っています…' : chinchiro.dice.length
      ? `出目：${chinchiro.dice.join('・')}` : 'サイコロを振ってください。';
  }

  function finishChinchiroRoll() {
    if (!chinchiro.busy) return;
    if (chinchiro.interval !== null) window.clearInterval(chinchiro.interval);
    if (chinchiro.timer !== null) window.clearTimeout(chinchiro.timer);
    chinchiro.interval = null;
    chinchiro.timer = null;
    chinchiro.busy = false;
    chinchiro.dice = chinchiro.pending;
    chinchiro.pending = null;
    $('[data-chinchiro-dice]').classList.remove('is-rolling');
    refreshChinchiro();
  }

  function rollChinchiro() {
    if (currentMode !== 'chinchiro' || overlay.hidden || chinchiro.busy) return;
    const result = Array.from({ length: 3 }, randomChinchiroDie);
    // 端末が「動きを減らす」設定なら結果をすぐに表示する。
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      chinchiro.dice = result;
      refreshChinchiro();
      return;
    }
    chinchiro.busy = true;
    chinchiro.pending = result;
    renderChinchiroDice(Array.from({ length: 3 }, () => randomIndex(6) + 1));
    $('[data-chinchiro-dice]').classList.add('is-rolling');
    $('[data-chinchiro-roll]').disabled = true;
    $('[data-chinchiro-feedback]').textContent = '振っています…';
    // 約0.45秒だけ1～6の仮の出目を切り替え、最後に確定済みの結果を表示する。
    chinchiro.interval = window.setInterval(() => {
      renderChinchiroDice(Array.from({ length: 3 }, () => randomIndex(6) + 1));
    }, 90);
    chinchiro.timer = window.setTimeout(finishChinchiroRoll, 450);
  }

  function setMode(mode) {
    if (mode !== 'five' && mode !== 'chinchiro') return;
    if (mode !== 'chinchiro') finishChinchiroRoll();
    currentMode = mode;
    overlay.querySelector('.shiko-five-panel').classList.toggle('is-chinchiro', mode === 'chinchiro');
    $('[data-five-mode]').hidden = mode !== 'five';
    $('[data-chinchiro-mode]').hidden = mode !== 'chinchiro';
    $('[data-five-title]').textContent = mode === 'five' ? '伍抜き' : 'チンチロ';
    $('[data-five-subtitle]').textContent = mode === 'five' ? 'FIVE NUKI' : 'CHINCHIRO';
    $('[data-five-desc]').textContent = mode === 'five'
      ? 'サイコロを5つ振って、5を抜く。最後の合計点が低い人の勝ち。'
      : 'サイコロを3個振るだけ。';
    for (const tab of overlay.querySelectorAll('[data-shiko-game-mode]')) {
      const selected = tab.dataset.shikoGameMode === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (mode === 'chinchiro') refreshChinchiro();
    else refresh();
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    finishChinchiroRoll();
    overlay.hidden = true;
    document.body.classList.remove('shiko-five-open');
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  function create() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'shikoFiveOverlay';
    overlay.className = 'shiko-five-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="shiko-five-panel" role="dialog" aria-modal="true" aria-labelledby="shikoFiveTitle" aria-describedby="shikoFiveDesc">
        <button type="button" class="shiko-five-close" data-five-close aria-label="ゲームを閉じる">×</button>
        <p class="shiko-five-kicker">SECRET BAR / TABLE GAMES</p>
        <h2 id="shikoFiveTitle"><span data-five-title>伍抜き</span><small data-five-subtitle>FIVE NUKI</small></h2>
        <div class="shiko-five-modes" role="tablist" aria-label="ゲームモードの切り替え">
          <button type="button" class="shiko-five-mode-tab" role="tab" id="shikoFiveTab" aria-controls="shikoFiveMode" aria-selected="true" data-shiko-game-mode="five">5抜き</button>
          <button type="button" class="shiko-five-mode-tab" role="tab" id="shikoChinchiroTab" aria-controls="shikoChinchiroMode" aria-selected="false" tabindex="-1" data-shiko-game-mode="chinchiro">チンチロモード</button>
        </div>
        <p class="shiko-five-description" id="shikoFiveDesc" data-five-desc>サイコロを5つ振って、5を抜く。最後の合計点が低い人の勝ち。</p>
        <div id="shikoFiveMode" role="tabpanel" aria-labelledby="shikoFiveTab" data-five-mode>
        <div data-five-setup>
          <div class="shiko-five-rulebox"><strong>HOW TO PLAY</strong>
            <p>① 5個のサイコロを振る。</p><p>②「5」の目、またはサイコロ2個で5になる組だけを抜く（1＋4、2＋3）。</p>
            <p>③ 抜けたら残りを振り直す。抜けなくなったらその時の合計点で終了。<b>0点が最強！</b></p>
          </div>
          <label class="shiko-five-count-label">参加人数
            <select data-five-players-count aria-label="参加人数">
              <option value="1">1人（練習）</option><option value="2" selected>2人</option><option value="3">3人</option>
              <option value="4">4人</option><option value="5">5人</option><option value="6">6人</option>
              <option value="7">7人</option><option value="8">8人</option>
            </select>
          </label>
          <div class="shiko-five-names" data-five-names></div>
          <button type="button" class="shiko-five-main" data-five-start>ゲームスタート</button>
        </div>
        <div data-five-game hidden>
          <div class="shiko-five-topline"><span class="shiko-five-turn-index">TURN <b data-five-progress>1 / 2</b></span>
            <span class="shiko-five-current" data-five-turn>プレイヤー1</span></div>
          <div class="shiko-five-scoreboard" data-five-scoreboard></div>
          <div class="shiko-five-info"><span>振った回数 <strong data-five-roll-count>0</strong></span>
            <span>残り <strong data-five-dice-count>5</strong> 個</span><span>現在の合計 <strong data-five-sum>—</strong></span></div>
          <div class="shiko-five-dice" data-five-dice role="group" aria-label="サイコロ：タップすると抜く目を選べます"></div>
          <p class="shiko-five-feedback" data-five-feedback role="status" aria-live="polite"></p>
          <div class="shiko-five-actions">
            <button type="button" class="shiko-five-main" data-five-roll>サイコロを5個振る</button>
            <button type="button" class="shiko-five-main" data-five-remove hidden>選んだ5を抜く</button>
            <button type="button" class="shiko-five-main" data-five-next hidden>次の人へ</button>
          </div>
          <p class="shiko-five-tip">選択中は金色に光ります。5単体・1＋4・2＋3のみ有効（複数組を同時に抜くことは可能）。</p>
        </div>
        <div data-five-result hidden>
          <p class="shiko-five-result-kicker">ROUND RESULT</p>
          <h3 data-five-result-title>ラウンド終了！</h3>
          <p class="shiko-five-winner" data-five-winners></p>
          <p class="shiko-five-loser" data-five-losers></p>
          <ol class="shiko-five-ranking" data-five-ranking></ol>
          <button type="button" class="shiko-five-main" data-five-again>同じメンバーでもう一度</button>
          <button type="button" class="shiko-five-minor" data-five-reconfigure>メンバーを変更する</button>
        </div>
        <p class="shiko-five-disclaimer">勝負のお題は自由。飲酒は必須ではありません（ノンアルコールでも遊べます）。</p>
        </div>
        <div id="shikoChinchiroMode" class="shiko-chinchiro-mode" role="tabpanel" aria-labelledby="shikoChinchiroTab" data-chinchiro-mode hidden>
          <div class="shiko-chinchiro-dice" data-chinchiro-dice role="group" aria-label="3つのサイコロ"></div>
          <p class="shiko-chinchiro-feedback" data-chinchiro-feedback role="status" aria-live="polite">ボタンを押してサイコロを振ってください。</p>
          <button type="button" class="shiko-five-main shiko-chinchiro-roll" data-chinchiro-roll>サイコロを3個振る</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-shiko-game-mode]').forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.shikoGameMode));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const next = tab.dataset.shikoGameMode === 'five' ? 'chinchiro' : 'five';
        setMode(next);
        overlay.querySelector(`[data-shiko-game-mode="${next}"]`).focus();
      });
    });
    $('[data-chinchiro-roll]').addEventListener('click', rollChinchiro);
    $('[data-five-players-count]').addEventListener('change', refreshInputs);
    $('[data-five-start]').addEventListener('click', () => {
      const names = Array.from(overlay.querySelectorAll('[data-five-name]'), (input, i) => input.value.trim() || `プレイヤー${i + 1}`);
      startGame(names);
    });
    $('[data-five-roll]').addEventListener('click', roll);
    $('[data-five-remove]').addEventListener('click', removeDice);
    $('[data-five-next]').addEventListener('click', nextPlayer);
    $('[data-five-again]').addEventListener('click', () => startGame(state.players.slice()));
    $('[data-five-reconfigure]').addEventListener('click', () => { state.phase = 'setup'; refresh(); });
    $('[data-five-close]').addEventListener('click', close);
    $('[data-five-dice]').addEventListener('click', (event) => {
      if (state.phase !== 'choosing' || state.busy) return;
      const target = event.target.closest('[data-five-die]');
      if (!target) return;
      const i = Number(target.dataset.fiveDie);
      if (!Number.isSafeInteger(i) || i < 0 || i >= state.dice.length) return;
      if (state.selected.has(i)) state.selected.delete(i);
      else state.selected.add(i);
      refresh();
      $('[data-five-dice]').querySelector(`[data-five-die="${i}"]`)?.focus();
    });
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const focusables = Array.from(overlay.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled])'))
          .filter(el => !el.closest('[hidden]') && el.getClientRects().length);
        if (!focusables.length) return;
        if (event.shiftKey && (document.activeElement === focusables[0] || !overlay.contains(document.activeElement))) {
          event.preventDefault(); focusables[focusables.length - 1].focus();
        } else if (!event.shiftKey && (document.activeElement === focusables[focusables.length - 1] || !overlay.contains(document.activeElement))) {
          event.preventDefault(); focusables[0].focus();
        }
      }
    });
    refreshInputs();
    setMode('five');
  }

  window.shikoOpenSecretFiveNuki = () => {
    create();
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('shiko-five-open');
    setMode(currentMode);
    $('[data-five-close]').focus();
  };
})();

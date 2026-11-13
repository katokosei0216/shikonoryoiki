// detail.php の場所（detail.html からの相対パス）
const DETAIL_API = '../php/detail.php';
// review.php の場所（口コミ・評価）
const REVIEW_API = '../php/review.php';
// 商品のお気に入り状態をMySQLに保存するAPI
const FAVORITES_API = '../php/favorites.php';

const CATEGORY_NAMES = {
  whisky: 'ウイスキー',
  cocktail: 'カクテル',
  sake: '日本酒',
  wine: 'ワイン',
  paper: '紙タバコ',
  cigarette: '紙タバコ',
  vape: '電子タバコ'
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 要素が無くてもエラーにならない textContent 設定
const setText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  return el;
};

// 1〜5 を ●●●○○ 形式に
const dots = n => {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1 || v > 5) return null;
  return '●'.repeat(v) + '○'.repeat(5 - v);
};

const METHOD_LABELS = { shake: 'シェイク', build: 'ビルド', stir: 'ステア', blend: 'ブレンド' };
const GLASS_LABELS  = { short: 'ショート', long: 'ロング' };
const WINE_LABELS   = { '泡': 'スパークリング' };

// 商品画像は assets/products/{画像番号}.webp に統一。
// 既存DBではウイスキー/日本酒は image_path に画像番号が入り、
// ワイン/カクテルは NULL のため商品IDとカテゴリから画像番号を補完する。
const IMAGE_ID_RANGES = {
  whisky:   { min: 1,   max: 100, offset: 1000 },
  sake:     { min: 101, max: 200, offset: 1900 },
  wine:     { min: 201, max: 300, offset: 2800 },
  cocktail: { min: 301, max: 400, offset: 3700 },
  // 紙タバコ: 商品ID 401〜500 に対して画像6001.webp〜6100.webp
  cigarette: { min: 401, max: 500, offset: 5600 }
};

function getCategoryImageUrl(p) {
  const range = IMAGE_ID_RANGES[p.category_code];
  const productId = Number(p.product_id);
  if (!range || !Number.isInteger(productId) ||
      productId < range.min || productId > range.max) return '';
  return `../assets/products/${productId + range.offset}.webp`;
}

function resolveProductImageUrl(p) {
  const stored = String(p.image_path ?? '').trim();
  // DBに保存されている画像番号（例: 1001, 2099）
  if (/^\d{4}$/.test(stored)) {
    return `../assets/products/${stored}.webp`;
  }
  // 画像URLが明示されている場合は従来の動作も維持
  if (stored) return stored;

  // image_path が NULL のカテゴリは商品IDから画像番号を取得
  return getCategoryImageUrl(p);
}

// 商品情報から「基本スペック」の行を組み立てる
function buildSpecRows(p, d, code) {
  const rows = [];
  const add = (label, value) => {
    if (value !== null && value !== undefined && value !== '') rows.push([label, value]);
  };

  if (code !== 'cocktail') {
    add('価格', p.price ? Number(p.price).toLocaleString() + '円' : null);
    if (code === 'cigarette') {
      add('ブランド', d.brand);
      // 0mgも有効な値として扱い、未登録ならその旨を明示する
      const mg = value => value == null || value === '' || !Number.isFinite(Number(value))
        ? '未登録' : `${Number(value)}mg`;
      add('タール', mg(d.tar_mg));
      add('ニコチン', mg(d.nicotine_mg));
    } else if (code !== 'vape') {
      add('度数', p.abv ? p.abv + '%' : null);
      add('年代', p.vintage ? p.vintage : null);
    }
  }

  add('香り', dots(p.aroma_score));
  add('味（甘↔苦）', dots(p.taste_score));
  add('酸味', dots(p.sour_score));
  add('濃厚さ', dots(p.richness_score));

  if (code === 'whisky') {
    const t = [];
    if (+d.is_smoky)   t.push('スモーク');
    if (+d.is_grain)   t.push('グレーン');
    if (+d.is_malt)    t.push('モルト');
    if (+d.is_blended) t.push('ブレンデッド');
    add('タイプ', t.join('、'));
  } else if (code === 'sake') {
    const t = [];
    if (+d.is_easy_to_drink) t.push('呑みやすい');
    if (+d.is_dry)           t.push('辛口');
    if (+d.is_sweet)         t.push('甘口');
    add('タイプ', t.join('、'));
  } else if (code === 'wine') {
    add('種類', WINE_LABELS[d.wine_type] || d.wine_type);
    add('ぶどう品種', d.grape);
  } else if (code === 'cocktail') {
    add('ベース酒', d.base_liquor_name);
    add('製法', METHOD_LABELS[d.method] || d.method);
    add('スモーク', +d.is_smoke ? 'あり' : null);
    add('グラス', GLASS_LABELS[d.glass_size] || d.glass_size);
    add('フルーツ', d.fruit_name);
  }
  return rows;
}

function renderProduct(data) {
  const p = data.product;
  const d = data.details || {};
  const code = p.category_code;
  // URLにカテゴリがない直接アクセスでも、検索に戻る際のカテゴリを商品データから確定する。
  if (typeof updateDetailBackLink === 'function') updateDetailBackLink(code);

  // 上部メタ情報：カテゴリ | メーカー | 製造国(日本酒は都道府県)
  const origin = code === 'sake' ? d.prefecture : p.country_name;
  const meta = [CATEGORY_NAMES[code] || '商品', p.maker_name, origin].filter(Boolean).join(' | ');
  setText('detailMeta', meta);

  // タイトル
  setText('detailTitle', p.product_name);
  document.title = p.product_name + ' | 嗜好の領域';

  // 商品画像（4カテゴリ合計400商品に対応）
  const imgBox = document.getElementById('detailImage');
  if (imgBox) {
    const imageUrl = resolveProductImageUrl(p);
    if (imageUrl) {
      const img = document.createElement('img');
      img.alt = `${p.product_name}の商品画像`;
      img.decoding = 'async';
      img.onerror = () => {
        // DBに古い画像パスが登録されていても、同梱の紙タバコ画像を試す
        const fallback = code === 'cigarette' ? getCategoryImageUrl(p) : '';
        if (fallback && img.getAttribute('src') !== fallback) {
          img.src = fallback;
        } else {
          imgBox.textContent = '画像なし';
        }
      };
      imgBox.replaceChildren(img);
      img.src = imageUrl;
    } else {
      imgBox.textContent = '画像なし';
    }
  }

  // 口コミ入力欄は紙タバコにも使える表現に切り替える
  const reviewInput = document.getElementById('commentTextarea');
  if (reviewInput && code === 'cigarette') {
    reviewInput.placeholder = 'この商品の感想を入力...';
  }

  // スペック表 + おすすめの飲み方
  const rows = buildSpecRows(p, d, code);
  if ((data.drink_styles || []).length) {
    rows.push(['おすすめの飲み方', data.drink_styles.join('、')]);
  }
  const specEl = document.getElementById('specList');
  if (specEl) {
    specEl.innerHTML = rows.map(([k, v]) => `
      <div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid #2d2618;font-size:13px;">
        <span style="width:130px;flex-shrink:0;color:var(--muted);">${esc(k)}</span>
        <span style="color:#ddd;">${esc(v)}</span>
      </div>`).join('') || '<p style="font-size:13px;color:var(--muted);">情報がありません。</p>';
  }

  // タグ
  const tagBox = document.getElementById('tagList');
  if (tagBox) {
    tagBox.innerHTML = (data.tags || [])
      .map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('')
      || '<span style="font-size:13px;color:var(--muted);">タグはありません</span>';
  }

  // 説明文（右側 + 拡大モーダル）
  const desc = p.description || '説明文はまだ登録されていません。';
  ['descText', 'descModalText'].forEach(id => {
    const el = setText(id, desc);
    if (el) el.style.whiteSpace = 'pre-wrap';
  });
}

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id || !/^\d+$/.test(id)) {
    setText('detailTitle', '商品が指定されていません');
    return;
  }

  try {
    const res = await fetch(DETAIL_API + '?id=' + encodeURIComponent(id));
    const data = await res.json();
    if (res.status === 404) {
      setText('detailTitle', '商品が見つかりませんでした');
      return;
    }
    if (!res.ok) throw new Error(data.error || 'error');
    renderProduct(data);
  } catch (e) {
    console.error(e);
    setText('detailTitle', '商品情報の取得に失敗しました');
  }
}

// ====================================================================
// 口コミ・評価
// ====================================================================
const MINI_REVIEW_COUNT = 5;   // 画面の小さい一覧に出す件数

const reviewState = {
  productId: null,   // 表示中の商品ID
  csrf: '',          // 保存・削除に必要な合言葉(review.php から受け取る)
  summary: { count: 0, average: null },
  mine: null,        // 自分の口コミ { review_id, rating, comment } / まだなら null
  reviews: [],       // この商品への口コミ一覧
  showAll: false     // 最新5件と、取得済み一覧の表示を切り替える
};

const starText = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const formatDate = s => String(s || '').slice(0, 10).replace(/-/g, '/');

function mk(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ログインが必要なときの案内
function showLoginPrompt(text) {
  setText('loginPromptText', text || 'この機能を利用するにはログインが必要です。');
  openModal('loginPromptModal');
}

// review.php を呼ぶ。失敗しても { ok:false, message } を返す(401 はログイン案内を出して null)
async function callReviewApi(url, init) {
  try {
    const res = await fetch(url, init);
    if (res.status === 401) {
      showLoginPrompt('口コミを利用するにはログインが必要です。');
      return null;
    }
    try {
      return await res.json();
    } catch (e) {
      return { ok: false, message: 'サーバーの応答が正しくありません。' };
    }
  } catch (e) {
    return { ok: false, message: 'サーバーに接続できませんでした。' };
  }
}

function postReview(payload) {
  return callReviewApi(REVIEW_API, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ csrf: reviewState.csrf }, payload))
  });
}

// ----- 星の入力欄 -----
function getStarEls() {
  return document.querySelectorAll('.star-rating-select .star');
}
function currentStars() {
  return Array.from(getStarEls()).filter(s => s.classList.contains('active')).length;
}
function setStars(n) {
  getStarEls().forEach((s, idx) => {
    const active = idx < n;
    s.classList.toggle('active', active);
    s.setAttribute('aria-pressed', String(active));
  });
}

function setReviewFeedback(message, isError = false) {
  const box = document.getElementById('reviewFeedback');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('is-error', isError);
}

function updateCommentCounter() {
  const textarea = document.getElementById('commentTextarea');
  setText('commentCounter', `${textarea ? Array.from(textarea.value).length : 0} / 1000文字`);
}

// ----- 一覧の取得 -----
async function loadReviews() {
  const refresh = document.getElementById('refreshReviewsBtn');
  if (refresh) refresh.disabled = true;
  try {
    // 常に商品IDを指定し、キャッシュを使用せず最新の口コミを取得する。
    const data = await callReviewApi(
      REVIEW_API + '?product_id=' + encodeURIComponent(reviewState.productId),
      { credentials: 'same-origin', cache: 'no-store' }
    );
    if (!data) {
      setText('reviewListCount', 'ログイン後に口コミを確認できます。');
      return;
    }

    if (!data.ok) {
      showReviewMessage(data.message || '口コミを取得できませんでした。');
      setText('reviewListCount', '口コミの取得に失敗しました。');
      return;
    }

    reviewState.csrf = data.csrf;
    reviewState.summary = data.summary;
    reviewState.mine = data.mine;
    reviewState.reviews = Array.isArray(data.reviews) ? data.reviews : [];

    renderReviewSummary();
    renderReviewLists();
    fillReviewForm();
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

// 一覧の場所にメッセージを出す
function showReviewMessage(text) {
  ['reviewListMini', 'reviewListModal'].forEach(id => {
    const box = document.getElementById(id);
    if (!box) return;
    box.replaceChildren();
    const p = mk('p', '', text);
    p.style.fontSize = '13px';
    p.style.color = 'var(--muted)';
    box.appendChild(p);
  });
}

// 平均と件数
function renderReviewSummary() {
  const box = document.getElementById('reviewSummary');
  if (!box) return;
  const s = reviewState.summary;
  box.textContent = s.count > 0
    ? `★ ${Number(s.average).toFixed(1)}（${s.count}件）`
    : 'まだ評価はありません';
}

// 口コミ1件のカード
function buildReviewCard(r, truncated) {
  const card = mk('div', 'comment-card');

  const user = mk('div', 'comment-user');
  user.appendChild(mk('div', 'avatar-img'));
  user.appendChild(mk('span', 'comment-user-text',
    ' ' + r.user_name + (r.is_mine ? '（あなた）' : '') + '　' + starText(r.rating)
  ));
  card.appendChild(user);

  const text = mk('div', 'comment-text' + (truncated ? ' truncated' : ''), r.comment || '（コメントなし）');
  // 改行・長い連続文字の折り返しはCSSが担当する。
  // ここでインラインのwhite-spaceを指定すると通常一覧の省略表示を上書きしてしまう。
  card.appendChild(text);

  const meta = mk('div', '', formatDate(r.created_at));
  meta.style.fontSize = '11px';
  meta.style.color = 'var(--muted)';
  meta.style.marginTop = '4px';
  card.appendChild(meta);

  // 自分の口コミだけ、削除ボタンを出す
  if (r.is_mine) {
    const del = mk('button', 'icon-btn', '削除');
    del.type = 'button';
    del.style.marginTop = '6px';
    del.addEventListener('click', () => deleteReview(r.review_id));
    card.appendChild(del);
  }
  return card;
}

// この商品の口コミを最大5件プレビュー。6件以上なら全件表示へ切り替え可能。
function renderReviewLists() {
  const all = reviewState.reviews;
  const total = Math.max(0, Number(reviewState.summary.count) || 0);
  const visible = reviewState.showAll ? all : all.slice(0, MINI_REVIEW_COUNT);
  const mini = document.getElementById('reviewListMini');
  const toggle = document.getElementById('toggleReviewListBtn');

  if (mini) {
    mini.replaceChildren();
    if (all.length === 0) {
      const p = mk('p', '', 'この商品への口コミはまだありません。最初の投稿者になりましょう。');
      p.style.fontSize = '13px';
      p.style.color = 'var(--muted)';
      mini.appendChild(p);
    } else {
      visible.forEach(r => mini.appendChild(buildReviewCard(r, !reviewState.showAll)));
    }
  }

  // 「最新5件」は必ず5件あるという意味ではなく、最大5件の意味。
  setText('reviewListHeading', reviewState.showAll
    ? 'みんなの口コミ（この商品の一覧）'
    : 'みんなの口コミ（この商品の最新5件）');
  const shownCount = visible.length;
  setText('reviewListCount', `この商品への口コミ：全${total}件／${shownCount}件表示` +
    (total > all.length && reviewState.showAll ? `（取得できるのは最新${all.length}件まで）` : ''));

  if (toggle) {
    toggle.hidden = all.length <= MINI_REVIEW_COUNT;
    toggle.textContent = reviewState.showAll
      ? '最新5件に戻す'
      : `もっと見る（残り${all.length - MINI_REVIEW_COUNT}件）`;
    toggle.setAttribute('aria-expanded', String(reviewState.showAll));
  }

  renderReviewModalList();
}

// 拡大モーダル: 星の数 と キーワード(コメント・ユーザー名)で絞り込む
function renderReviewModalList() {
  const box = document.getElementById('reviewListModal');
  if (!box) return;
  box.replaceChildren();

  const starEl = document.getElementById('reviewStarFilter');
  const kwEl = document.getElementById('reviewKeyword');
  const star = starEl ? starEl.value : '';
  const kw = kwEl ? kwEl.value.trim().toLowerCase() : '';

  const list = reviewState.reviews.filter(r => {
    if (star !== '' && String(r.rating) !== star) return false;
    if (kw !== '') {
      const target = ((r.comment || '') + ' ' + r.user_name).toLowerCase();
      if (!target.includes(kw)) return false;
    }
    return true;
  });

  if (list.length === 0) {
    const p = mk('p', '', '該当する口コミはありません。');
    p.style.fontSize = '13px';
    p.style.color = 'var(--muted)';
    box.appendChild(p);
    return;
  }
  list.forEach(r => box.appendChild(buildReviewCard(r, false)));
}

// 入力欄: 自分の口コミがあれば、その内容を入れて「更新する」にする
function fillReviewForm() {
  const textarea = document.getElementById('commentTextarea');
  const submit = document.getElementById('submitCommentBtn');
  const del = document.getElementById('deleteReviewBtn');
  const mine = reviewState.mine;

  setStars(mine ? mine.rating : 0);
  if (textarea) textarea.value = mine && mine.comment ? mine.comment : '';
  updateCommentCounter();
  if (submit) submit.textContent = mine ? '更新する' : '投稿する';
  if (del) del.style.display = mine ? '' : 'none';
}

// ----- 投稿・更新 -----
// 投稿の成否は #reviewFeedback に表示する。ブラウザー上部の alert は出さない。
async function saveReview() {
  const rating = currentStars();
  if (rating < 1) {
    setReviewFeedback('星の数を1〜5から選んでください。', true);
    return;
  }
  const textarea = document.getElementById('commentTextarea');
  const comment = textarea ? textarea.value.trim() : '';
  if (!comment) {
    setReviewFeedback('コメントを入力してください。', true);
    if (textarea) textarea.focus();
    return;
  }
  if (Array.from(comment).length > 1000) {
    setReviewFeedback('コメントは1000文字以内で入力してください。', true);
    return;
  }

  const submit = document.getElementById('submitCommentBtn');
  if (submit && submit.disabled) return;
  if (submit) submit.disabled = true;
  setReviewFeedback('保存中...');

  try {
    const data = await postReview({
      action: 'save',
      product_id: Number(reviewState.productId),
      rating,
      comment
    });
    if (!data) {
      setReviewFeedback('ログイン後に投稿してください。', true);
      return;
    }
    if (!data.ok) {
      setReviewFeedback(data.message || '投稿に失敗しました。', true);
      return;
    }
    await loadReviews();
    setReviewFeedback((data.message || '口コミを保存しました。') + ' マイページでも確認できます。');
  } catch (error) {
    console.error('口コミの保存・再読み込みに失敗しました:', error);
    setReviewFeedback('口コミの処理中にエラーが発生しました。再読み込みして投稿履歴を確認してください。', true);
  } finally {
    if (submit) submit.disabled = false;
  }
}

// ----- 削除(自分の口コミだけ) -----
async function deleteReview(reviewId) {
  if (!confirm('この口コミを削除しますか？')) return;

  const data = await postReview({ action: 'delete', review_id: Number(reviewId) });
  if (!data) return;

  if (data.ok) {
    await loadReviews();
    setReviewFeedback('口コミを削除しました。');
  } else {
    setReviewFeedback(data.message || '削除に失敗しました。', true);
  }
}

function initReviews() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id)) return;
  reviewState.productId = id;

  // サンプルの表示を消して、読み込み中にする
  showReviewMessage('読み込み中...');

  const submit = document.getElementById('submitCommentBtn');
  if (submit) {
    submit.addEventListener('click', e => {
      e.preventDefault();
      saveReview();
    });
  }
  const del = document.getElementById('deleteReviewBtn');
  if (del) {
    del.addEventListener('click', e => {
      e.preventDefault();
      if (reviewState.mine) deleteReview(reviewState.mine.review_id);
    });
  }
  const textarea = document.getElementById('commentTextarea');
  if (textarea) textarea.addEventListener('input', updateCommentCounter);
  updateCommentCounter();

  // 拡大モーダルの絞り込み
  const starFilter = document.getElementById('reviewStarFilter');
  if (starFilter) starFilter.addEventListener('change', renderReviewModalList);
  const keyword = document.getElementById('reviewKeyword');
  if (keyword) keyword.addEventListener('input', renderReviewModalList);

  // 別の利用者による新規投稿を手動で取得できるようにする。
  const refresh = document.getElementById('refreshReviewsBtn');
  if (refresh) refresh.addEventListener('click', loadReviews);
  const toggle = document.getElementById('toggleReviewListBtn');
  if (toggle) toggle.addEventListener('click', () => {
    reviewState.showAll = !reviewState.showAll;
    renderReviewLists();
  });

  loadReviews();
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduct();

  // 星評価：選択済みの最後の星をもう一度押すと解除
  const stars = document.querySelectorAll('.star-rating-select .star');
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      const isLastActive = star.classList.contains('active') &&
        (index === stars.length - 1 || !stars[index + 1].classList.contains('active'));
      setStars(isLastActive ? 0 : index + 1);
      setReviewFeedback('');
    });
  });

  // 口コミ・評価(一覧の表示、投稿、更新、削除)
  initReviews();

  // 商品のお気に入り状態の読み込み
  initFavorite();
});

// ====================================================================
// お気に入り: favorites.php に保存し、マイページの一覧へ反映する
// ====================================================================
const favoriteState = {
  productId: null,
  csrf: '',
  isFavorite: false,
  ready: false,
  busy: false
};

function renderFavorite() {
  const button = document.getElementById('favoriteBtn');
  if (!button) return;
  button.disabled = !favoriteState.ready || favoriteState.busy;
  button.classList.toggle('is-favorite', favoriteState.isFavorite);
  button.setAttribute('aria-pressed', String(favoriteState.isFavorite));
  button.textContent = favoriteState.isFavorite
    ? '♥ お気に入り解除'
    : '♡ お気に入り';
}

function updateFavoriteCount(count) {
  const label = document.getElementById('favoriteCount');
  if (label && Number.isFinite(Number(count))) {
    label.textContent = Number(count).toLocaleString('ja-JP');
  }
}

async function fetchFavoriteState() {
  if (!favoriteState.productId) return;
  try {
    const res = await fetch(
      FAVORITES_API + '?product_id=' + encodeURIComponent(favoriteState.productId),
      { credentials: 'same-origin', cache: 'no-store' }
    );
    if (res.status === 401) {
      showLoginPrompt('お気に入り機能を利用するにはログインが必要です。');
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'お気に入り情報の取得に失敗しました。');
    favoriteState.csrf = data.csrf;
    favoriteState.isFavorite = data.is_favorite === true;
    favoriteState.ready = true;
    updateFavoriteCount(data.count);
  } catch (e) {
    console.error('お気に入り取得エラー:', e);
    setText('favoriteCount', '取得失敗');
  } finally {
    renderFavorite();
  }
}

// HTMLの「お気に入り」ボタンから呼ばれる
async function toggleFavorite() {
  if (!favoriteState.productId || favoriteState.busy) return;
  if (!favoriteState.ready) {
    await fetchFavoriteState();
    if (!favoriteState.ready) {
      alert('お気に入り情報の取得に失敗しました。再読み込みしてお試しください。');
    }
    return;
  }

  favoriteState.busy = true;
  renderFavorite();
  try {
    const res = await fetch(FAVORITES_API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrf: favoriteState.csrf,
        product_id: favoriteState.productId,
        action: favoriteState.isFavorite ? 'remove' : 'add'
      })
    });
    if (res.status === 401) {
      showLoginPrompt('お気に入り機能を利用するにはログインが必要です。');
      return;
    }
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'お気に入りの保存に失敗しました。');
    favoriteState.isFavorite = data.is_favorite === true;
    favoriteState.csrf = data.csrf;
    updateFavoriteCount(data.count);
  } catch (e) {
    console.error('お気に入り保存エラー:', e);
    alert(e.message || 'お気に入りの更新に失敗しました。');
  } finally {
    favoriteState.busy = false;
    renderFavorite();
  }
}

function initFavorite() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id) || Number(id) < 1) return;
  favoriteState.productId = Number(id);
  renderFavorite();
  fetchFavoriteState();
}
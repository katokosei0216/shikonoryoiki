// detail.php の場所（detail.html からの相対パス）
const DETAIL_API = '../php/detail.php';
// review.php の場所（口コミ・評価）
const REVIEW_API = '../php/review.php';

const CATEGORY_NAMES = {
  whisky: 'ウイスキー',
  cocktail: 'カクテル',
  sake: '日本酒',
  wine: 'ワイン',
  paper: '紙タバコ',
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
  cocktail: { min: 301, max: 400, offset: 3700 }
};

function resolveProductImageUrl(p) {
  const stored = String(p.image_path ?? '').trim();
  // DBに保存されている画像番号（例: 1001, 2099）
  if (/^\d{4}$/.test(stored)) {
    return `../assets/products/${stored}.webp`;
  }
  // 画像URLが明示されている場合は従来の動作も維持
  if (stored) return stored;

  // DBの image_path が NULL のワイン/カクテルにも対応
  const range = IMAGE_ID_RANGES[p.category_code];
  const productId = Number(p.product_id);
  if (range && Number.isInteger(productId) &&
      productId >= range.min && productId <= range.max) {
    return `../assets/products/${productId + range.offset}.webp`;
  }
  return '';
}

// 商品情報から「基本スペック」の行を組み立てる
function buildSpecRows(p, d, code) {
  const rows = [];
  const add = (label, value) => {
    if (value !== null && value !== undefined && value !== '') rows.push([label, value]);
  };

  if (code !== 'cocktail') {
    add('価格', p.price ? Number(p.price).toLocaleString() + '円' : null);
    add('度数', p.abv ? p.abv + '%' : null);
    add('年代', p.vintage ? p.vintage : null);
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

  // 上部メタ情報：カテゴリ | メーカー | 製造国(日本酒は都道府県)
  const origin = code === 'sake' ? d.prefecture : p.country_name;
  const meta = [CATEGORY_NAMES[code] || 'お酒', p.maker_name, origin].filter(Boolean).join(' | ');
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
      img.onerror = () => { imgBox.textContent = '画像なし'; };
      imgBox.replaceChildren(img);
      img.src = imageUrl;
    } else {
      imgBox.textContent = '画像なし';
    }
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
  reviews: []        // 口コミ一覧
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
  getStarEls().forEach((s, idx) => s.classList.toggle('active', idx < n));
}

// ----- 一覧の取得 -----
async function loadReviews() {
  const data = await callReviewApi(
    REVIEW_API + '?product_id=' + encodeURIComponent(reviewState.productId),
    { credentials: 'same-origin', cache: 'no-store' }
  );
  if (!data) return;

  if (!data.ok) {
    showReviewMessage(data.message || '口コミを取得できませんでした。');
    return;
  }

  reviewState.csrf = data.csrf;
  reviewState.summary = data.summary;
  reviewState.mine = data.mine;
  reviewState.reviews = data.reviews;

  renderReviewSummary();
  renderReviewLists();
  fillReviewForm();
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
  user.appendChild(document.createTextNode(
    ' ' + r.user_name + (r.is_mine ? '（あなた）' : '') + '　' + starText(r.rating)
  ));
  card.appendChild(user);

  const text = mk('div', 'comment-text' + (truncated ? ' truncated' : ''), r.comment || '（コメントなし）');
  text.style.whiteSpace = 'pre-wrap';
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

// 画面の小さい一覧 と 拡大モーダルの一覧
function renderReviewLists() {
  const all = reviewState.reviews;

  const mini = document.getElementById('reviewListMini');
  if (mini) {
    mini.replaceChildren();
    if (all.length === 0) {
      const p = mk('p', '', 'まだ口コミはありません。最初の投稿者になりましょう。');
      p.style.fontSize = '13px';
      p.style.color = 'var(--muted)';
      mini.appendChild(p);
    } else {
      all.slice(0, MINI_REVIEW_COUNT).forEach(r => mini.appendChild(buildReviewCard(r, true)));
    }
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
  if (submit) submit.textContent = mine ? '更新する' : '投稿する';
  if (del) del.style.display = mine ? '' : 'none';
}

// ----- 投稿・更新 -----
async function saveReview() {
  const rating = currentStars();
  if (rating < 1) {
    alert('星の数を選んでください。');
    return;
  }
  const textarea = document.getElementById('commentTextarea');
  const comment = textarea ? textarea.value.trim() : '';
  if (comment.length > 1000) {
    alert('コメントは1000文字以内で入力してください。');
    return;
  }

  const submit = document.getElementById('submitCommentBtn');
  if (submit) submit.disabled = true;   // 二重送信の防止

  const data = await postReview({
    action: 'save',
    product_id: Number(reviewState.productId),
    rating: rating,
    comment: comment
  });

  if (submit) submit.disabled = false;
  if (!data) return;

  alert(data.message || (data.ok ? '保存しました。' : '保存に失敗しました。'));
  if (data.ok) await loadReviews();
}

// ----- 削除(自分の口コミだけ) -----
async function deleteReview(reviewId) {
  if (!confirm('この口コミを削除しますか？')) return;

  const data = await postReview({ action: 'delete', review_id: Number(reviewId) });
  if (!data) return;

  alert(data.message || (data.ok ? '削除しました。' : '削除に失敗しました。'));
  if (data.ok) await loadReviews();   // 一覧を取り直す(入力欄も空に戻る)
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

  // 拡大モーダルの絞り込み
  const starFilter = document.getElementById('reviewStarFilter');
  if (starFilter) starFilter.addEventListener('change', renderReviewModalList);
  const keyword = document.getElementById('reviewKeyword');
  if (keyword) keyword.addEventListener('input', renderReviewModalList);

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
      stars.forEach((s, idx) => {
        s.classList.toggle('active', !isLastActive && idx <= index);
      });
    });
  });

  // 口コミ・評価(一覧の表示、投稿、更新、削除)
  initReviews();
});

// お気に入りボタン（現状は未ログイン扱いで常にログイン誘導）
function toggleFavorite() {
  setText('loginPromptText', 'お気に入り機能を利用するにはログインが必要です。');
  openModal('loginPromptModal');
}
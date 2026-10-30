// detail.php の場所（detail.html からの相対パス）
const DETAIL_API = '../php/detail.php';

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

  // 画像（読み込めなければ「画像なし」）
  const imgBox = document.getElementById('detailImage');
  if (imgBox) {
    if (p.image_path) {
      const img = document.createElement('img');
      img.alt = p.product_name;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      img.onerror = () => { imgBox.textContent = '画像なし'; };
      img.src = p.image_path;
      imgBox.innerHTML = '';
      imgBox.appendChild(img);
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

  // 口コミ投稿：コメント欄フォーカス・投稿ボタンでログイン誘導
  const showLoginPrompt = () => {
    setText('loginPromptText', '口コミを投稿するにはログインが必要です。');
    openModal('loginPromptModal');
  };

  const commentTextarea = document.getElementById('commentTextarea');
  if (commentTextarea) {
    commentTextarea.addEventListener('focus', () => {
      commentTextarea.blur();
      showLoginPrompt();
    });
  }
  const submitBtn = document.getElementById('submitCommentBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', e => {
      e.preventDefault();
      showLoginPrompt();
    });
  }
});

// お気に入りボタン（現状は未ログイン扱いで常にログイン誘導）
function toggleFavorite() {
  setText('loginPromptText', 'お気に入り機能を利用するにはログインが必要です。');
  openModal('loginPromptModal');
}
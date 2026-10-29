// ===== 状態 =====
let initialData = { email: '' };   // 保存済みのメール(変更検知用)
let csrfToken = '';
let allFavorites = [];
let allReviews = [];

const MINI_FAV_COUNT = 3;       // 右上の小さい一覧に出す件数
const MINI_COMMENT_COUNT = 2;   // 右下の小さい一覧に出す件数

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);

  setupFilter('favModal', renderFavModal);
  setupFilter('commentModal', renderCommentModal);

  await loadMypage();
});

// ===== 小さな部品 =====
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function formatDate(s) {
  // "2026-10-01 12:34:56" → "2026/10/01"
  return String(s || '').slice(0, 10).replace(/-/g, '/');
}

function starString(n) {
  n = Number(n) || 0;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// ===== データ取得 =====
async function loadMypage() {
  let res;
  try {
    res = await fetch('../php/profile.php', { credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    console.error('fetch失敗:', e, '現在のURL:', location.href);
    alert('サーバーに接続できませんでした。\nURLが http://localhost/... で始まっているか確認してください。');
    return;
  }

  if (res.status === 401) {
    location.href = 'login.html';
    return;
  }

  let d;
  const text = await res.text();
  try {
    d = JSON.parse(text);
  } catch (e) {
    console.error('JSONではない応答:', res.status, text);
    alert('サーバーの応答が正しくありません(F12のコンソールを確認してください)。');
    return;
  }

  if (!d.ok) {
    alert(d.message || 'データの取得に失敗しました。');
    return;
  }

  csrfToken = d.csrf;
  document.getElementById('usernameInput').value = d.user.user_name;
  document.getElementById('emailInput').value = d.user.email;
  initialData.email = d.user.email;

  allFavorites = d.favorites;
  allReviews = d.reviews;

  renderFavMini();
  renderCommentMini();
  renderFavModal();
  renderCommentModal();
}

// ===== お気に入り =====
function renderFavMini() {
  const box = document.getElementById('favMini');
  box.replaceChildren();

  if (allFavorites.length === 0) {
    box.appendChild(el('p', '', 'お気に入りはまだありません。'));
    return;
  }

  allFavorites.slice(0, MINI_FAV_COUNT).forEach(f => {
    const card = el('div', 'mini-item-card');
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      location.href = 'detail.html?id=' + f.product_id;
    });
    card.appendChild(document.createTextNode(f.product_name));
    card.appendChild(document.createElement('br'));
    const small = el('small', '', f.category_name);
    small.style.color = 'var(--gold-light)';
    card.appendChild(small);
    box.appendChild(card);
  });
}

function renderFavModal() {
  const box = document.getElementById('favList');
  box.replaceChildren();

  const list = allFavorites.filter(f => matchesFilter('favModal', f));
  if (list.length === 0) {
    box.appendChild(el('p', '', '該当するお気に入りはありません。'));
    return;
  }

  list.forEach(f => {
    const a = el('a', 'answer-card');
    a.href = 'detail.html?id=' + f.product_id;
    const strong = el('strong', '', f.product_name);
    strong.style.color = 'var(--gold-light)';
    a.appendChild(strong);
    a.appendChild(el('small', '', f.category_name));
    box.appendChild(a);
  });
}

// ===== 投稿コメント =====
function buildCommentCard(r) {
  const card = el('div', 'mini-comment-card');
  card.style.marginBottom = '10px';

  const name = el('strong', '', r.product_name);
  name.style.color = 'var(--gold-light)';
  card.appendChild(name);
  card.appendChild(document.createTextNode(' ' + starString(r.rating)));

  const p = el('p', '', r.comment || '');
  p.style.margin = '4px 0 0';
  p.style.color = '#ccc';
  card.appendChild(p);

  card.appendChild(el('div', 'mini-comment-date', formatDate(r.created_at)));
  return card;
}

function renderCommentMini() {
  const box = document.getElementById('commentMini');
  box.replaceChildren();

  if (allReviews.length === 0) {
    box.appendChild(el('p', '', '投稿したコメントはまだありません。'));
    return;
  }
  allReviews.slice(0, MINI_COMMENT_COUNT).forEach(r => box.appendChild(buildCommentCard(r)));
}

function renderCommentModal() {
  const box = document.getElementById('commentList');
  box.replaceChildren();

  const list = allReviews.filter(r => matchesFilter('commentModal', r));
  if (list.length === 0) {
    box.appendChild(el('p', '', '該当するコメントはありません。'));
    return;
  }
  list.forEach(r => box.appendChild(buildCommentCard(r)));
}

// ===== カテゴリ絞り込み & 名称検索(モーダルごと) =====
function setupFilter(modalId, render) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // カテゴリボタン: 複数選択 & オレンジ枠(.active)切り替え
  modal.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      render();
    });
  });

  // 名称検索
  const input = modal.querySelector('input[type="text"]');
  if (input) input.addEventListener('input', render);
}

function matchesFilter(modalId, item) {
  const modal = document.getElementById(modalId);

  const cats = [...modal.querySelectorAll('.cat-btn.active')].map(b => b.dataset.category);
  if (cats.length > 0 && !cats.includes(item.category_code)) return false;

  const input = modal.querySelector('input[type="text"]');
  const kw = input ? input.value.trim().toLowerCase() : '';
  if (kw !== '' && !String(item.product_name).toLowerCase().includes(kw)) return false;

  return true;
}

// ===== パスワードの伏字/表示切り替え =====
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// ===== 保存(PHPへ送信) =====
async function sendUpdate(currentPassword) {
  try {
    const res = await fetch('../php/profile.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrf: csrfToken,
        name: document.getElementById('usernameInput').value.trim(),
        email: document.getElementById('emailInput').value.trim(),
        newPassword: document.getElementById('newPasswordInput').value,
        currentPassword: currentPassword
      })
    });
    if (res.status === 401) {
      location.href = 'login.html';
      return { ok: false, message: 'ログインしてください。' };
    }
    return await res.json();
  } catch (e) {
    console.error('保存時のfetch失敗:', e, '現在のURL:', location.href);
    return { ok: false, message: 'サーバーに接続できませんでした。' };
  }
}

// 保存ボタン押下時
async function handleProfileSubmit(e) {
  e.preventDefault();

  const emailVal = document.getElementById('emailInput').value.trim();
  const newPassVal = document.getElementById('newPasswordInput').value;
  const confirmPassVal = document.getElementById('confirmPasswordInput').value;

  // 新しいパスワードの一致チェック
  if (newPassVal !== '' && newPassVal !== confirmPassVal) {
    alert('パスワードが違います');
    return;
  }

  const isEmailChanged = (emailVal !== initialData.email);
  const isPasswordChanged = (newPassVal !== '');

  if (isEmailChanged || isPasswordChanged) {
    // メール・パスワード変更時は、現在のパスワードを確認するモーダルを開く
    document.getElementById('currentPasswordInput').value = '';
    openModal('currentPasswordModal');
  } else {
    // ユーザー名だけの変更
    const result = await sendUpdate('');
    alert(result.message);
  }
}

// モーダルの「確認して保存」
async function verifyAndSubmit() {
  const cur = document.getElementById('currentPasswordInput').value;
  if (!cur) {
    alert('現在のパスワードを入力してください。');
    return;
  }

  const result = await sendUpdate(cur);
  alert(result.message);

  if (result.ok) {
    initialData.email = document.getElementById('emailInput').value.trim();
    closeModal('currentPasswordModal');
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
  }
}
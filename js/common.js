document.addEventListener('DOMContentLoaded', () => {
  // 共通ヘッダー自動挿入
  const header = document.getElementById('siteHeader');
  if (header) {
    const isHome = document.body.classList.contains('home-body');
    header.className = 'site-header';
    header.innerHTML = `
      ${!isHome ? '<a href="index.html" class="back-button">← ホーム</a>' : ''}
      <div class="header-title">
        <div class="header-title-line top"></div>
        <span class="header-title-text">嗜好の領域</span>
        <div class="header-title-line bottom"></div>
      </div>
      <div class="header-user">
        <a href="login.html" class="login-button">ログイン</a>
      </div>
    `;
  }
});

// モーダル開閉汎用関数
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// 共通ダミーログイン状態
let isLoggedIn = false;
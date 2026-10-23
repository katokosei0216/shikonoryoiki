document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const isHome = document.body.classList.contains('home-body');
  
  // ログイン画面、新規登録画面、マイページかどうか
  const isAuthOrMyPage = document.body.classList.contains('login-page') || 
                         document.body.classList.contains('register-page') || 
                         document.body.classList.contains('mypage-page');

  // ローカルストレージからログイン状態を取得
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  // ユーザーエリアのHTML
  let userAreaHtml = '';
  if (!isAuthOrMyPage) {
    if (isLoggedIn) {
      userAreaHtml = `
        <a href="mypage.html" class="login-button" style="margin-right: 8px;">マイページ</a>
        <button id="logoutBtn" class="login-button" style="background: transparent; border: 1px solid var(--gold); cursor: pointer;">ログアウト</button>
      `;
    } else {
      userAreaHtml = `<a href="login.html" class="login-button">ログイン</a>`;
    }
  }

  // --- 左側のボタン群を生成 ---
  let leftButtonsHtml = '';
  const pathname = window.location.pathname;
  const referrer = document.referrer || '';

  if (!isHome) {
    // 1. 常に「← ホーム」ボタン
    leftButtonsHtml += '<a href="index.html" class="back-button">← ホーム</a>';

    // 2. ページに応じた追加の戻るボタン
    if (pathname.endsWith('easyanswer.html')) {
      leftButtonsHtml += '<a href="easysearch.html" class="back-button">← 簡単検索へ</a>';
    } 
    else if (pathname.endsWith('detail.html')) {
      if (referrer.includes('easyanswer')) {
        leftButtonsHtml += '<a href="easyanswer.html" class="back-button">← 検索結果へ</a>';
      } else {
        leftButtonsHtml += '<a href="search.html" class="back-button">← 検索へ</a>';
      }
    }
  }

  header.className = 'site-header';
  // インラインスタイルで絶対に左端（left: 22px）に配置されるように指定
  header.innerHTML = `
    <div style="position: absolute; z-index: 5; top: 50%; left: 22px; transform: translateY(-50%); display: flex; align-items: center; gap: 8px;">
      ${leftButtonsHtml}
    </div>
    <div class="header-title">
      <div class="header-title-line top"></div>
      <span class="header-title-text">嗜好の領域</span>
      <div class="header-title-line bottom"></div>
    </div>
    <div class="header-user">
      ${userAreaHtml}
    </div>
  `;

  // ログアウトボタンのイベント処理
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('isLoggedIn');
      alert('ログアウトしました');
      window.location.href = 'index.html';
    });
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
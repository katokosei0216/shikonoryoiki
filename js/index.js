document.addEventListener('DOMContentLoaded', async () => {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const isHome = document.body.classList.contains('home-body');

  // ログイン画面、新規登録画面、マイページかどうか
  const isAuthOrMyPage = document.body.classList.contains('login-page') ||
                         document.body.classList.contains('register-page') ||
                         document.body.classList.contains('mypage-page');

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
  // ユーザーエリア(.header-user)は空で作り、ログイン状態の確認後に中身を入れる
  header.innerHTML = `
    <div style="position: absolute; z-index: 5; top: 50%; left: 22px; transform: translateY(-50%); display: flex; align-items: center; gap: 8px;">
      ${leftButtonsHtml}
    </div>
    <div class="header-title">
      <div class="header-title-line top"></div>
      <span class="header-title-text">嗜好の領域</span>
      <div class="header-title-line bottom"></div>
    </div>
    <div class="header-user" id="headerUser"></div>
  `;

  // ログイン画面・新規登録画面・マイページにはユーザーエリアを出さない
  if (isAuthOrMyPage) return;

  // ログイン状態はサーバーのセッションで判定する(localStorage は使わない)
  const loggedIn = await checkLogin();
  isLoggedIn = loggedIn;   // 他のスクリプトが参照する共通の変数にも反映

  const userArea = document.getElementById('headerUser');
  if (!userArea) return;

  if (loggedIn) {
    // ログイン中: 「ログイン」ボタンと同じ見た目・同じ位置で「ログアウト」ボタンにする
    userArea.innerHTML = `<a href="#" id="logoutBtn" class="login-button">ログアウト</a>`;
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  } else {
    userArea.innerHTML = `<a href="login.html" class="login-button">ログイン</a>`;
  }
});

// サーバーに問い合わせて、ログイン中かどうかを返す
async function checkLogin() {
  try {
    const res = await fetch('../php/auth.php', { credentials: 'same-origin', cache: 'no-store' });
    const data = await res.json();
    return data.loggedIn === true;
  } catch (e) {
    return false;
  }
}

// ログアウト(サーバーのセッションを破棄する)
async function handleLogout() {
  try {
    await fetch('../php/auth.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  } catch (e) {
    // 通信に失敗しても、画面はトップへ戻す
  }
  alert('ログアウトしました');
  window.location.href = 'index.html';
}

// モーダル開閉汎用関数
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// ログイン状態(ヘッダー表示時にサーバーの結果で更新される)
let isLoggedIn = false;
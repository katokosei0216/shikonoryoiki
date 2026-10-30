// ★ログイン状態の確認ログ(ブラウザの F12 → Console に出る)。直ったら false にする
const DEBUG_AUTH = true;

// ログインなしで見せてよいページ(<body> の class で判定する)
const PUBLIC_PAGE_CLASSES = ['login-page', 'register-page'];

// ログインの確認が終わるまで、ページの中身を見せない
document.documentElement.style.visibility = 'hidden';

document.addEventListener('DOMContentLoaded', async () => {
  let redirecting = false;
  try {
    const isPublicPage = PUBLIC_PAGE_CLASSES.some(c => document.body.classList.contains(c));

    // ログイン状態はサーバーのセッションで判定する(localStorage は使わない)
    let loggedIn = false;
    if (!isPublicPage) {
      loggedIn = await checkLogin();
      isLoggedIn = loggedIn;   // 他のスクリプトが参照する共通の変数にも反映

      // ★ログインが必要なページ: 未ログインならログイン画面へ(中身は見せないまま移動する)
      if (!loggedIn) {
        redirecting = true;
        window.location.replace('login.html');
        return;
      }
    }

    buildHeader(isPublicPage, loggedIn);
  } finally {
    // 移動しないときだけ、ページを表示する
    if (!redirecting) document.documentElement.style.visibility = '';
  }
});

// ヘッダーを組み立てる
function buildHeader(isPublicPage, loggedIn) {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const isHome = document.body.classList.contains('home-body');

  // ログイン画面、新規登録画面、マイページかどうか
  const isAuthOrMyPage = isPublicPage || document.body.classList.contains('mypage-page');

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
  // 左側は .header-left(common.css)で配置。右側(.header-user)は空で作り、あとで中身を入れる
  header.innerHTML = `
    <div class="header-left">
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
}

// サーバーに問い合わせて、ログイン中かどうかを返す
async function checkLogin() {
  try {
    const res = await fetch('../php/auth.php', { credentials: 'same-origin', cache: 'no-store' });
    const text = await res.text();
    if (DEBUG_AUTH) console.log('[auth.php]', res.status, text);
    return JSON.parse(text).loggedIn === true;
  } catch (e) {
    if (DEBUG_AUTH) console.error('[auth.php] 失敗:', e);
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
    // 通信に失敗しても、画面はログイン画面へ戻す
  }
  alert('ログアウトしました');
  window.location.href = 'login.html';
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
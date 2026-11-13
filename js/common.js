// ★ログイン状態の確認ログ(ブラウザの F12 → Console に出る)。直ったら false にする
const DEBUG_AUTH = true;

// ログインなしで見せてよいページ(<body> の class で判定する)
const PUBLIC_PAGE_CLASSES = ['login-page', 'register-page'];

// ログインの確認が終わるまで、ページの中身を見せない
document.documentElement.style.visibility = 'hidden';

// 詳細ページのカテゴリ/遷移元はURLパラメータを優先する。
// 旧URL(detail.html?id=...)にも対応するため、同一オリジンの参照元も調べる。
const DETAIL_CATEGORY_CODES = ['whisky', 'cocktail', 'sake', 'wine', 'paper', 'vape', 'cigarette'];
function validDetailCategory(code) {
  return DETAIL_CATEGORY_CODES.includes(code);
}

function getDetailReturnContext() {
  const params = new URLSearchParams(window.location.search);
  let from = params.get('from');
  let category = params.get('category');
  let section = params.get('section');

  // 別サイトのreferrerは信用せず、同じサイト内の画面遷移だけを見る。
  try {
    const ref = new URL(document.referrer);
    if (ref.origin === window.location.origin) {
      if (!['search', 'mypage', 'easyanswer'].includes(from)) {
        if (ref.pathname.endsWith('/mypage.html')) from = 'mypage';
        else if (ref.pathname.endsWith('/easyanswer.html')) from = 'easyanswer';
        else if (ref.pathname.endsWith('/search.html')) from = 'search';
      }
      if (!validDetailCategory(category) && ref.pathname.endsWith('/search.html')) {
        category = ref.searchParams.get('category');
      }
      if (section !== 'comments' && ref.pathname.endsWith('/mypage.html') && ref.hash === '#comments') {
        section = 'comments';
      }
    }
  } catch (e) { /* 参照元がない場合 */ }

  return {
    from: ['search', 'mypage', 'easyanswer'].includes(from) ? from : 'search',
    category: validDetailCategory(category) ? category : null,
    section: section === 'comments' ? 'comments' : 'favorites' 
  };
}

// 商品取得後のカテゴリがURLと異なる場合も、検索の戻り先を正しく設定する。
// detail.js の方が先にAPI応答を受け取った場合は buildHeader から参照される。
function updateDetailBackLink(category) {
  if (!validDetailCategory(category)) return;
  window.detailCategoryCode = category;
  const link = document.getElementById('detailBackLink');
  if (link) link.href = 'search.html?category=' + encodeURIComponent(category);
}

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

  // 商品詳細の戻り先は、開いた画面から引き継ぐ。
  // 以前の search.html (カテゴリ指定なし) はウイスキー検索に固定されてしまう。
  let leftButtonsHtml = '';
  const pathname = window.location.pathname;

  if (!isHome) {
    leftButtonsHtml += '<a href="index.html" class="back-button">← ホーム</a>';

    if (pathname.endsWith('/easyanswer.html')) {
      leftButtonsHtml += '<a href="easysearch.html" class="back-button">← 簡単検索へ</a>';
    } else if (pathname.endsWith('/detail.html')) {
      const context = getDetailReturnContext();
      if (context.from === 'mypage') {
        leftButtonsHtml += context.section === 'comments'
          ? '<a href="mypage.html#comments" class="back-button">← 投稿コメント履歴へ</a>'
          : '<a href="mypage.html#favorites" class="back-button">← お気に入りへ</a>';
      } else if (context.from === 'easyanswer') {
        leftButtonsHtml += '<a href="easyanswer.html" class="back-button">← 検索結果へ</a>';
      } else {
        const category = context.category || window.detailCategoryCode;
        const href = validDetailCategory(category)
          ? 'search.html?category=' + encodeURIComponent(category)
          : 'index.html'; // API応答前または取得失敗時はウイスキーに飛ばさずホームへ
        leftButtonsHtml += `<a href="${href}" id="detailBackLink" class="back-button">← 検索へ</a>`;
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

  // ログイン画面・新規登録画面・マイページにはユーザーエリアを出さないよ
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

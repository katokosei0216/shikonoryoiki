// ★ログイン状態の確認ログ(ブラウザの F12 → Console に出る)。直ったら false にする
const DEBUG_AUTH = false;

// ログインなしで見せてよいページ(<body> の class で判定する)
const PUBLIC_PAGE_CLASSES = ['login-page', 'register-page'];

// 公開ページはログイン照会が遅れてもすぐ表示する。会員情報を含むマイページだけ事前に隠す。
if (document.body && document.body.classList.contains('mypage-page')) {
  document.documentElement.style.visibility = 'hidden';
}

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

// 現在のページ（または指定URL）を安全な戻り先（例: "detail.html?id=10&from=search"）にする
function getSafeReturnTarget(rawUrl) {
  try {
    const target = rawUrl ? new URL(rawUrl, window.location.origin) : new URL(window.location.href);
    if (target.origin !== window.location.origin) return 'index.html';

    const fileName = target.pathname.split('/').pop() || '';
    if (!fileName || fileName === 'login.html' || fileName === 'register.html') {
      return 'index.html';
    }
    if (!/^[A-Za-z0-9_-]+\.html$/.test(fileName)) {
      return 'index.html';
    }
    return fileName + target.search + target.hash;
  } catch (e) {
    return 'index.html';
  }
}

// 戻り先付きのログイン画面URLを組み立てる
function buildLoginUrl(returnTarget) {
  const safe = getSafeReturnTarget(returnTarget);
  return 'login.html?redirect=' + encodeURIComponent(safe);
}

// ページ内の login.html リンクにも現在の画面を戻り先として付与する
function applyReturnTargetsToLoginLinks() {
  const loginHref = buildLoginUrl();
  document.querySelectorAll('a[href="login.html"]').forEach(a => {
    a.href = loginHref;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // 同期的にリンクを保護し、認証照会が完了する前のタップも取りこぼさない。
  attachGuestAccountLinks();
  let redirecting = false;
  try {
    const isPublicPage = PUBLIC_PAGE_CLASSES.some(c => document.body.classList.contains(c));
    const isMyPage = document.body.classList.contains('mypage-page');

    // ログイン状態はサーバーのセッションで判定する(localStorage は使わない)
    let loggedIn = false;
    if (!isPublicPage) {
      loggedIn = await checkLogin();
      isLoggedIn = loggedIn;   // 他のスクリプトが参照する共通の変数にも反映

      // マイページだけはログイン必須にする（閲覧・検索は未ログインでもOK）
      if (isMyPage && !loggedIn) {
        redirecting = true;
        window.location.replace(buildLoginUrl());
        return;
      }
    }

    buildHeader(isPublicPage, loggedIn);
    applyReturnTargetsToLoginLinks();
  } finally {
    // 移動しないときだけ、ページを表示する
    if (!redirecting) document.documentElement.style.visibility = '';
  }
});

// 未ログインでマイページ（個人設定・お気に入り・自分の投稿履歴）に進もうとした場合、
// 詳細ページと同じデザインでログイン案内を表示する。検索・診断リンクは止めない。
function showGuestAccountModal(message) {
  let overlay = document.getElementById('guestAccountModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guestAccountModal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'guestAccountTitle');
    overlay.innerHTML = `
      <div class="modal-content guest-account-dialog">
        <button type="button" class="modal-close" aria-label="閉じる">×</button>
        <div class="subpage-heading"><span></span><h1 id="guestAccountTitle">ログインが必要</h1><span></span></div>
        <p id="guestAccountMessage" class="guest-account-message"></p>
        <a class="gold-button guest-account-login" href="${buildLoginUrl()}">ログイン画面へ</a>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.classList.remove('active'); });
  }
  overlay.querySelector('#guestAccountMessage').textContent = message || 'この機能を利用するにはログインが必要です。';
  overlay.classList.add('active');
  overlay.querySelector('.modal-close').focus();
}
function attachGuestAccountLinks() {
  // ヘッダーのリンクは認証照会後に追加されるので、後から生成された要素にも対応する。
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="mypage.html"]') : null;
    if (!link || isLoggedIn) return;
    event.preventDefault();
    const section = link.hash;
    const msg = section === '#comments' ? '自分のコメント履歴を利用するにはログインが必要です。' :
      section === '#favorites' ? 'お気に入り機能を利用するにはログインが必要です。' :
      'マイページ（会員情報・お気に入り・コメント履歴）を利用するにはログインが必要です。';
    showGuestAccountModal(msg);
  }, true);
}

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
    // ログアウトの直下に透明なクリック領域を作る（ログアウト自体は通常どおり動く）。
    userArea.classList.add('has-five-trigger');
    userArea.innerHTML = `
      <a href="#" id="logoutBtn" class="login-button">ログアウト</a>
      <button type="button" id="secretFiveTrigger" aria-label="秘密のゲームを開く（3回クリック）" title=""></button>`;
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
    setupSecretFiveTrigger(userArea.querySelector('#secretFiveTrigger'));
  } else {
    userArea.innerHTML = `<a href="${buildLoginUrl()}" class="login-button">ログイン</a>`;
  }
}


// 透明ボタンを1.2秒以内に3回クリックすると、5抜きゲームを開く。
// ゲーム用ファイルは初めて隠し機能を使用したときだけ読み込む。
function setupSecretFiveTrigger(trigger) {
  if (!trigger) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '../css/secret-five-nuki.css?v=20261120-chinchiro3';
  document.head.appendChild(stylesheet);

  let count = 0;
  let last = 0;
  let loading = false;
  trigger.addEventListener('click', () => {
    const now = performance.now();
    count = now - last <= 1200 ? count + 1 : 1;
    last = now;
    if (count < 3) return;
    count = 0;
    last = 0;

    if (typeof window.shikoOpenSecretFiveNuki === 'function') {
      window.shikoOpenSecretFiveNuki();
      return;
    }
    if (loading) return;
    loading = true;
    const script = document.createElement('script');
    script.src = '../js/secret-five-nuki.js?v=20261120-chinchiro3';
    script.onload = () => {
      loading = false;
      if (typeof window.shikoOpenSecretFiveNuki === 'function') window.shikoOpenSecretFiveNuki();
    };
    script.onerror = () => { loading = false; script.remove(); };
    document.head.appendChild(script);
  });
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
    // 通信に失敗しても、画面はホーム画面へ戻す
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